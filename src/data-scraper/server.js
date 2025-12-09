const express = require('express');
const cors = require('cors');
require('./collector');

const { addDays, subDays, format, isSameDay, parseISO } = require('date-fns');
const { makePrediction } = require('./prediction_engine');

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, 'fuel_prices.db');

app.use(cors()); // Allow React (localhost:5173) to talk to us
app.use(express.json()); 

const db = new sqlite3.Database(DB_FILE);

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

// --- Save Alert Endpoint ---
app.post('/api/alerts', (req, res) => {
    const { email, storeId, fuelEan, threshold } = req.body;
    
    if (!email || !storeId || !fuelEan || !threshold) {
        return res.status(400).json({ error: "Missing fields" });
    }

    // threshold comes in Dollars (1.85), DB stores cents (185)
    const thresholdCents = Math.round(threshold * 100);

    const stmt = db.prepare(`INSERT INTO alerts (email, store_id, fuel_ean, threshold_cents) VALUES (?, ?, ?, ?)`);
    stmt.run(email, storeId, fuelEan, thresholdCents, function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Failed to save alert" });
        }
        res.json({ success: true, id: this.lastID });
    });
    stmt.finalize();
});

// --- Prediction Endpoint ---
app.get('/api/predict', async (req, res) => {
    try {
        // You can now accept ?model=linear in the URL
        const { storeId, fuelEan, targetDate, model = 'linear' } = req.query;
        const target = new Date(targetDate);
        
        let predictionMetrics = null;

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

            const result = await makePrediction(storeId, fuelEan, date, model);
            const priceVal = typeof result === 'object' ? result.price : result;
            if (typeof result === 'object' && result.metrics) predictionMetrics = result.metrics;

            history.push({
                date: date,
                displayDate: format(date, 'MMM dd'),
                fullDate: format(date, 'MMM dd, yyyy'),
                price: priceVal,
                isTarget: i === 0,
                // We mark it as "Real" if it's in the past (simplified logic for UI)
                isReal: i <= 0 
            });
        }

        // 2. Get Fuel Comparisons (Current prices)
        const compRows = await getLatestFuelPrices(storeId);
        const comparisons = compRows.map(row => ({
            ean: row.fuel_type_ean,
            price: row.price_cents / 1000
        }));

        res.json({
            modelUsed: model,
            history,
            current: history.find(h => h.isTarget),
            fuelComparisons: comparisons,
            metrics: predictionMetrics
        });

    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- Helper: Calculate Distance (Haversine Formula) ---
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

// --- Store Search Endpoint ---
app.get('/api/stores', (req, res) => {
    const { search, lat, lng } = req.query;
    
    // Default to Melbourne CBD if user denies location
    const userLat = parseFloat(lat) || -37.8136; 
    const userLng = parseFloat(lng) || 144.9631; 

    // 1. Base Query
    let query = "SELECT * FROM stores WHERE is_fuel_store = 1";
    let params = [];

    // 2. Add Search Filter if provided
    if (search) {
        query += " AND (name LIKE ? OR address LIKE ? OR suburb LIKE ? OR postcode LIKE ?)";
        const term = `%${search}%`;
        params = [term, term, term, term];
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Database error" });
        }

        // 3. Calculate Distance for every store found
        const storesWithDist = rows.map(store => {
            const dist = getDistanceFromLatLonInKm(userLat, userLng, store.lat, store.lng);
            return {
                id: store.store_id,
                name: store.name,
                // Format: "123 Main St, Suburb 3000"
                address: `${store.address}, ${store.suburb} ${store.postcode}`, 
                distance: `${dist.toFixed(1)} km`,
                rawDistance: dist, // used for sorting
                coordinates: { lat: store.lat, lng: store.lng }
            };
        });

        // 4. Sort by Nearest and take top 4
        storesWithDist.sort((a, b) => a.rawDistance - b.rawDistance);
        
        res.json(storesWithDist.slice(0, 4));
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});