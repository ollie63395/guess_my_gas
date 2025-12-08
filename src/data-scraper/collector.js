const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
const fs = require('fs');

// --- Configuration ---
const DB_FILE = './fuel_prices.db';
const SEARCH_LAT = -37.8780651;
const SEARCH_LONG = 145.1016256;
const SEARCH_DIST = 15; // Increased distance to get more data points

// --- URLs ---
const STORES_URL = `https://www.7eleven.com.au/storelocator-retail/mulesoft/stores?lat=${SEARCH_LAT}&long=${SEARCH_LONG}&dist=${SEARCH_DIST}`;
const FUEL_PRICE_URL_BASE = 'https://www.7eleven.com.au/storelocator-retail/mulesoft/fuelPrices?storeNo=';

// --- Database Setup ---
const db = new sqlite3.Database(DB_FILE);

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
        
        console.log("Database initialized with Fuel Reference map.");
    });
}

// --- Fetching Logic ---

async function fetchAndStoreData() {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] Starting data collection...`);

    try {
        // 1. Get Stores
        console.log(`Fetching stores from ${STORES_URL}...`);
        const storeRes = await axios.get(STORES_URL);
        const stores = storeRes.data.stores;

        console.log(`Found ${stores.length} stores. Processing fuel prices...`);

        // We use a promise to wrap the database transaction to ensure sequential processing
        await new Promise((resolve, reject) => {
            db.serialize(async () => {
                const stmtStore = db.prepare(`INSERT OR REPLACE INTO stores (store_id, name, address, suburb, postcode, lat, lng, is_fuel_store) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
                const stmtPrice = db.prepare(`INSERT INTO prices (store_id, fuel_type_ean, price_cents, price_date, retrieved_at) VALUES (?, ?, ?, ?, ?)`);

                try {
                    // Use a for...of loop to wait for each request sequentially
                    // This is slower but much safer and prevents being rate-limited by 7-Eleven
                    for (const store of stores) {
                        
                        // Save Store Details
                        stmtStore.run(
                            store.storeId,
                            store.name,
                            store.address.address1,
                            store.address.suburb,
                            store.address.postcode,
                            store.location[0],
                            store.location[1],
                            store.isFuelStore ? 1 : 0
                        );

                        // If it sells fuel, get the prices
                        if (store.isFuelStore) {
                            try {
                                const priceRes = await axios.get(`${FUEL_PRICE_URL_BASE}${store.storeId}`);
                                const prices = priceRes.data.data;

                                if (prices && prices.length > 0) {
                                    for (const p of prices) {
                                        stmtPrice.run(
                                            p.storeNo,
                                            p.ean,           
                                            p.price,         
                                            p.priceDate,     
                                            timestamp        
                                        );
                                    }
                                }
                            } catch (err) {
                                console.error(`Failed to fetch prices for store ${store.storeId}: ${err.message}`);
                            }
                        }
                    }

                    // Only finalize AFTER the loop is 100% done
                    stmtStore.finalize();
                    stmtPrice.finalize();
                    console.log(`Data collection finished. Saved to ${DB_FILE}`);
                    resolve();

                } catch (e) {
                    reject(e);
                }
            });
        });

    } catch (error) {
        console.error("Critical Error during collection:", error.message);
    }
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