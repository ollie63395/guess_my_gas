const axios = require('axios');
const nodemailer = require('nodemailer');
const client = require('./db');

// COMPREHENSIVE MELBOURNE COVERAGE
// Scanning these points with a 15km radius covers almost all 7-Elevens in Greater Melbourne
const SEARCH_DIST = 15;
const LOCATIONS = [
    // Central & Inner
    { name: 'Melbourne CBD', lat: -37.8136, lng: 144.9631 },

    // South East & Bayside
    { name: 'St Kilda/Brighton', lat: -37.8850, lng: 144.9900 },
    { name: 'Moorabbin/Cheltenham', lat: -37.9500, lng: 145.0600 },
    { name: 'Dandenong', lat: -37.9810, lng: 145.2150 },
    { name: 'Frankston', lat: -38.1390, lng: 145.1220 },
    { name: 'Cranbourne', lat: -38.0990, lng: 145.2800 },

    // East
    { name: 'Box Hill', lat: -37.8200, lng: 145.1200 },
    { name: 'Ringwood', lat: -37.8150, lng: 145.2300 },
    { name: 'Ferntree Gully', lat: -37.8800, lng: 145.2900 },

    // North
    { name: 'Preston/Reservoir', lat: -37.7200, lng: 145.0000 },
    { name: 'Epping', lat: -37.6500, lng: 145.0100 },
    { name: 'Broadmeadows', lat: -37.6800, lng: 144.9200 },

    // West
    { name: 'Sunshine', lat: -37.7800, lng: 144.8300 },
    { name: 'Werribee', lat: -37.9000, lng: 144.6600 },
    { name: 'Watergardens', lat: -37.7000, lng: 144.7700 }
];
// --- URLs ---
const STORES_URL = (lat, lng) => `https://www.7eleven.com.au/storelocator-retail/mulesoft/stores?lat=${lat}&long=${lng}&dist=${SEARCH_DIST}`;
const FUEL_PRICE_URL_BASE = 'https://www.7eleven.com.au/storelocator-retail/mulesoft/fuelPrices?storeNo=';

// --- Email Logic ---
const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });
};

// --- Database Setup ---
async function initDB() {
    await client.execute(`CREATE TABLE IF NOT EXISTS stores (store_id TEXT PRIMARY KEY, name TEXT, address TEXT, suburb TEXT, postcode TEXT, lat REAL, lng REAL, is_fuel_store INTEGER)`);
    await client.execute(`CREATE TABLE IF NOT EXISTS fuel_ref (ean TEXT PRIMARY KEY, name TEXT, description TEXT)`);

    // Insert using individual statements for compatibility
    const fuels = [
        ['52', 'ULP', 'Mobil Unleaded 91'],
        ['53', 'Diesel', 'Mobil Diesel Efficient'],
        ['54', 'LPG', 'AutoGas LPG'],
        ['55', 'PULP', 'Mobil Extra 95'],
        ['56', 'PULP98', 'Mobil Supreme+ 98'],
        ['57', 'E10', 'Mobil Unleaded E10']
    ];
    for (const f of fuels) {
        await client.execute({
            sql: `INSERT OR IGNORE INTO fuel_ref (ean, name, description) VALUES (?, ?, ?)`,
            args: f
        });
    }

    await client.execute(`CREATE TABLE IF NOT EXISTS prices (id INTEGER PRIMARY KEY AUTOINCREMENT, store_id TEXT, fuel_type_ean TEXT, price_cents INTEGER, price_date TEXT, retrieved_at TEXT)`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_prices_store_fuel ON prices(store_id, fuel_type_ean, price_date)`);
    await client.execute(`CREATE TABLE IF NOT EXISTS alerts (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, store_id TEXT, fuel_ean TEXT, threshold_cents INTEGER, last_sent_at TEXT)`);

    console.log("Database initialized (Turso) with indexes.");
}

// --- Alert Checking Logic ---
async function checkAlerts() {
    console.log("Checking alerts...");
    const result = await client.execute("SELECT * FROM alerts");
    const alerts = result.rows;

    if (alerts.length === 0) return;

    const transporter = createTransporter();

    for (const alert of alerts) {
        // Fetch latest price from Turso
        const priceRes = await client.execute({
            sql: `SELECT price_cents FROM prices WHERE store_id = ? AND fuel_type_ean = ? ORDER BY retrieved_at DESC LIMIT 1`,
            args: [alert.store_id, alert.fuel_ean]
        });

        if (priceRes.rows.length > 0) {
            const price = priceRes.rows[0].price_cents;
            if (price <= alert.threshold_cents) {
                console.log(`Sending alert to ${alert.email}`);
                try {
                    await transporter.sendMail({
                        from: '"GuessMyGas" <alerts@guessmygas.com>',
                        to: alert.email,
                        subject: "📉 Price Drop Alert!",
                        text: `Good news! Fuel is down to ${(price / 100).toFixed(1)}c/litre.`
                    });
                } catch (e) { console.error("Email fail:", e); }
            }
        }
    }
}

// --- Main Scraper ---
async function fetchAndStoreData() {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Starting Cloud Scrape...`);

    try {
        await initDB();

        for (const loc of LOCATIONS) {
            console.log(`Fetching ${loc.name}...`);
            const url = STORES_URL(loc.lat, loc.lng);
            try {
                const storeRes = await axios.get(url);
                const stores = storeRes.data.stores || [];

                for (const store of stores) {
                    // 1. Save Store
                    await client.execute({
                        sql: `INSERT OR REPLACE INTO stores (store_id, name, address, suburb, postcode, lat, lng, is_fuel_store) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        args: [store.storeId, store.name, store.address.address1, store.address.suburb, store.address.postcode, store.location[0], store.location[1], store.isFuelStore ? 1 : 0]
                    });

                    // 2. Save Prices
                    if (store.isFuelStore) {
                        try {
                            const pRes = await axios.get(`${FUEL_PRICE_URL_BASE}${store.storeId}`);
                            let prices = pRes.data;
                            if (prices && prices.data) prices = prices.data;

                            if (Array.isArray(prices)) {
                                for (const p of prices) {
                                    await client.execute({
                                        sql: `INSERT INTO prices (store_id, fuel_type_ean, price_cents, price_date, retrieved_at) VALUES (?, ?, ?, ?, ?)`,
                                        args: [p.storeNo, p.ean, p.price, p.priceDate, timestamp]
                                    });
                                }
                            }
                        } catch (e) { /* ignore individual store error */ }
                    }
                }
            } catch (e) { console.error(`Failed loc ${loc.name}: ${e.message}`); }
        }

        await checkAlerts();
        console.log("Scrape Complete.");

    } catch (error) {
        console.error("Critical Error:", error);
        process.exit(1);
    }
}

// Run immediately on startup
fetchAndStoreData();