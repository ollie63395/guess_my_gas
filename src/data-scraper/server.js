const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const { addDays, subDays, format, isSameDay, parseISO } = require('date-fns');

const app = express();
const PORT = 3001;
const DB_FILE = './fuel_prices.db';

app.use(cors()); // Allow React (localhost:5173) to talk to us

const db = new sqlite3.Database(DB_FILE);

// --- Helper: Get Price from DB ---
const getPricesFromDB = (storeId, fuelEan) => {
    return new Promise((resolve, reject) => {
        // Get the most recent 20 prices for this store/fuel
        const query = `
            SELECT price_cents, price_date, retrieved_at 
            FROM prices 
            WHERE store_id = ? AND fuel_type_ean = ? 
            ORDER BY retrieved_at DESC 
            LIMIT 20
        `;
        db.all(query, [storeId, fuelEan], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// --- Helper: Get Latest Price for ALL fuels (for comparison) ---
const getLatestFuelPrices = (storeId) => {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT fuel_type_ean, price_cents 
            FROM prices 
            WHERE store_id = ? 
            GROUP BY fuel_type_ean 
            HAVING retrieved_at = MAX(retrieved_at)
        `;
        db.all(query, [storeId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// --- Prediction Endpoint ---
app.get('/api/predict', async (req, res) => {
    try {
        const { storeId, fuelEan, targetDate } = req.query;
        const target = new Date(targetDate);

        // 1. Fetch Real Data History
        const dbRows = await getPricesFromDB(storeId, fuelEan);
        
        // Find the absolute latest known price to use as a baseline
        // If DB is empty, fallback to 150.0 cents
        let baselinePrice = dbRows.length > 0 ? dbRows[0].price_cents / 100 : 1.50;
        
        // 2. Build 15-Day History (7 days before -> 7 days after)
        const history = [];
        
        for (let i = -7; i <= 7; i++) {
            const date = addDays(target, i);
            const dateStr = format(date, 'yyyy-MM-dd');
            
            // Check if we have REAL data for this specific date
            // (Matches 'price_date' from 7-Eleven API)
            const realEntry = dbRows.find(row => row.price_date.startsWith(dateStr));
            
            let price;
            if (realEntry) {
                // USE REAL DB PRICE
                price = realEntry.price_cents / 100;
                // Update baseline so future projections start from here
                if (i === 0) baselinePrice = price; 
            } else {
                // PREDICT FUTURE PRICE (using the Mock Logic anchored to Real Baseline)
                // Variance: 0.15 cents random swing + 0.2 cent trend
                const dayOffset = date.getDate();
                const randomSwing = Math.sin(dayOffset * 0.5) * 0.15;
                const trend = (i > 0) ? (i * 0.002) : 0; // Only trend upwards for future
                price = Number((baselinePrice + randomSwing + trend).toFixed(3));
            }

            history.push({
                date: date,
                displayDate: format(date, 'MMM dd'),
                fullDate: format(date, 'MMM dd, yyyy'),
                price: price,
                isTarget: i === 0,
                isReal: !!realEntry // Flag to show UI it's real data
            });
        }

        // 3. Get Fuel Comparisons (Real data only)
        const compRows = await getLatestFuelPrices(storeId);
        
        // Map DB rows to cleaner objects
        const comparisons = compRows.map(row => ({
            ean: row.fuel_type_ean,
            price: row.price_cents / 100
        }));

        res.json({
            history,
            current: history.find(h => h.isTarget),
            prev: history.find(h => h.isTarget - 1) || history[6], // roughly prev day
            next: history.find(h => h.isTarget + 1) || history[8], // roughly next day
            fuelComparisons: comparisons
        });

    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});