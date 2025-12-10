const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const fs = require('fs');

// --- Configuration ---
const DB_FILE = './fuel_prices.db';
const SEARCH_LAT = -37.8780651;
const SEARCH_LONG = 145.1016256;
const SEARCH_DIST = 15; // Increased distance to get more data points

// COMPREHENSIVE MELBOURNE COVERAGE
// Scanning these points with a 15km radius covers almost all 7-Elevens in Greater Melbourne
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
const STORES_URL = `https://www.7eleven.com.au/storelocator-retail/mulesoft/stores?lat=${SEARCH_LAT}&long=${SEARCH_LONG}&dist=${SEARCH_DIST}`;
const FUEL_PRICE_URL_BASE = 'https://www.7eleven.com.au/storelocator-retail/mulesoft/fuelPrices?storeNo=';

// --- Database Setup ---
const db = new sqlite3.Database(DB_FILE);

// --- Email Setup ---
const createTransporter = async () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'ollie.guessmygas@gmail.com',
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });
};

function initDB() {
    db.serialize(() => {
        // 1. Stores Table (Existing)
        db.run(`CREATE TABLE IF NOT EXISTS stores (
            store_id TEXT PRIMARY KEY,
            name TEXT,
            address TEXT,
            suburb TEXT,
            postcode TEXT,
            lat REAL,
            lng REAL,
            is_fuel_store INTEGER
        )`);

        // 2. Fuel Reference Table (NEW!)
        db.run(`CREATE TABLE IF NOT EXISTS fuel_ref (
            ean TEXT PRIMARY KEY,
            name TEXT,
            description TEXT
        )`);

        // Insert the User's Mapping Rules
        const stmtType = db.prepare(`INSERT OR IGNORE INTO fuel_ref (ean, name, description) VALUES (?, ?, ?)`);
        stmtType.run('52', 'ULP', 'Mobil Unleaded 91');
        stmtType.run('53', 'Diesel', 'Mobil Diesel Efficient');
        stmtType.run('54', 'LPG', 'AutoGas LPG');
        stmtType.run('55', 'PULP', 'Mobil Extra 95');
        stmtType.run('56', 'PULP98', 'Mobil Supreme+ 98');
        stmtType.run('57', 'E10', 'Mobil Unleaded E10');
        stmtType.finalize();

        // 3. Prices Table (Existing)
        db.run(`CREATE TABLE IF NOT EXISTS prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id TEXT,
            fuel_type_ean TEXT,
            price_cents INTEGER,
            price_date TEXT,
            retrieved_at TEXT,
            FOREIGN KEY(store_id) REFERENCES stores(store_id),
            FOREIGN KEY(fuel_type_ean) REFERENCES fuel_ref(ean)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT,
            store_id TEXT,
            fuel_ean TEXT,
            threshold_cents INTEGER,
            last_sent_at TEXT
        )`);
        
        console.log("Database initialized with Fuel Reference map.");
    });
}

// --- Alert Checking Logic ---
async function checkAlerts() {
    console.log("Checking alerts against new prices...");
    
    // 1. Get all active alerts
    db.all("SELECT * FROM alerts", async (err, alerts) => {
        if (err || !alerts || alerts.length === 0) return;

        const transporter = await createTransporter();

        alerts.forEach(alert => {
            // 2. Get latest price for this alert's store/fuel
            db.get(
                `SELECT price_cents FROM prices WHERE store_id = ? AND fuel_type_ean = ? ORDER BY retrieved_at DESC LIMIT 1`,
                [alert.store_id, alert.fuel_ean],
                async (err, row) => {
                    if (row && row.price_cents <= alert.threshold_cents) {
                        // 3. Price is LOW! Send Email.
                        console.log(`✅ ALERT TRIGGERED: ${alert.email} - Price ${row.price_cents} <= ${alert.threshold_cents}`);
                        
                        try {
                            const info = await transporter.sendMail({
                                from: '"GuessMyGas" <alerts@guessmygas.com>',
                                to: alert.email,
                                subject: "📉 Price Drop Alert! Time to Fill Up",
                                text: `Good news! Fuel at your selected store has dropped to ${(row.price_cents/100).toFixed(1)}c/litre. This is below your threshold.`
                            });
                            console.log("📧 Email sent: %s", info.messageId);
                            console.log("   Preview URL: %s", nodemailer.getTestMessageUrl(info));
                        } catch (e) {
                            console.error("Failed to send email", e);
                        }
                    }
                }
            );
        });
    });
}

// --- Fetching Logic ---

async function fetchAndStoreData() {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] Starting data collection...`);

    try {
        await new Promise((resolve, reject) => {
            db.serialize(async () => {
                const stmtStore = db.prepare(`INSERT OR REPLACE INTO stores (store_id, name, address, suburb, postcode, lat, lng, is_fuel_store) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
                const stmtPrice = db.prepare(`INSERT INTO prices (store_id, fuel_type_ean, price_cents, price_date, retrieved_at) VALUES (?, ?, ?, ?, ?)`);

                try {
                    // Loop through all defined locations
                    for (const loc of LOCATIONS) {
                        const url = `https://www.7eleven.com.au/storelocator-retail/mulesoft/stores?lat=${loc.lat}&long=${loc.lng}&dist=${SEARCH_DIST}`;
                        console.log(`Fetching ${loc.name} zone...`);
                        
                        const storeRes = await axios.get(url);
                        const stores = storeRes.data.stores;

                        console.log(`Found ${stores.length} stores in ${loc.name}.`);

                        for (const store of stores) {
                            // Save Store (Same as before)
                            stmtStore.run(store.storeId, store.name, store.address.address1, store.address.suburb, store.address.postcode, store.location[0], store.location[1], store.isFuelStore ? 1 : 0);

                            if (store.isFuelStore) {
                                try {
                                    const priceRes = await axios.get(`https://www.7eleven.com.au/storelocator-retail/mulesoft/fuelPrices?storeNo=${store.storeId}`);
                                    let prices = priceRes.data;
                                    if (prices && prices.data) prices = prices.data; 
                                    if (Array.isArray(prices)) {
                                        for (const p of prices) {
                                            stmtPrice.run(p.storeNo, p.ean, p.price, p.priceDate, timestamp);
                                        }
                                    }
                                } catch (err) { /* ignore errors */ }
                            }
                        }
                    }

                    stmtStore.finalize();
                    stmtPrice.finalize();
                    console.log(`Data collection finished.`);

                    await checkAlerts(); 
                    resolve();

                } catch (e) { reject(e); }
            });
        });
    } catch (error) { console.error("Critical Error:", error.message); }
}

// --- Execution ---

initDB();

// Run immediately on startup
fetchAndStoreData();

// Schedule to run every 12 hours
// Cron syntax: "0 */12 * * *" means "At minute 0 past every 12th hour"
cron.schedule('0 */12 * * *', () => {
    fetchAndStoreData();
});

console.log("Scheduler started. Will run every 12 hours.");