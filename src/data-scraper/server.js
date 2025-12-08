const express = require('express');
const cors = require('cors');
const { addDays, subDays, format, isSameDay, parseISO } = require('date-fns');
const { makePrediction } = require('./prediction_engine');

const sqlite3 = require('sqlite3').verbose();

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
        // You can now accept ?model=linear in the URL
        const { storeId, fuelEan, targetDate, model = 'linear' } = req.query;
        const target = new Date(targetDate);

        // 1. Generate 15-Day History/Forecast
        // Range: 7 days before -> 7 days after
        const history = [];
        
        for (let i = -7; i <= 7; i++) {
            const date = addDays(target, i);
            const dateStr = format(date, 'yyyy-MM-dd');

            // ASK THE ENGINE FOR THE PRICE
            // The engine handles the logic: 
            // - If it's in the past/present, it might align with training data
            // - If it's in the future, it uses Linear Regression formula (y = mx + b)
            const predictedPrice = await makePrediction(storeId, fuelEan, date, model);

            history.push({
                date: date,
                displayDate: format(date, 'MMM dd'),
                fullDate: format(date, 'MMM dd, yyyy'),
                price: predictedPrice,
                isTarget: i === 0,
                // We mark it as "Real" if it's in the past (simplified logic for UI)
                isReal: i <= 0 
            });
        }

        // 2. Get Fuel Comparisons (Current prices)
        const compRows = await getLatestFuelPrices(storeId);
        const comparisons = compRows.map(row => ({
            ean: row.fuel_type_ean,
            price: row.price_cents / 100
        }));

        res.json({
            modelUsed: model,
            history,
            current: history.find(h => h.isTarget),
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