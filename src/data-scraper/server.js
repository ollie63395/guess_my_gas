const express = require('express');
const cors = require('cors');
const client = require('./db');

const { addDays, format } = require('date-fns');
const { makePrediction, getTrainingData } = require('./prediction_engine');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors()); // Allow React (localhost:5173) to talk to us
app.use(express.json());

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
app.get('/api/stores', async (req, res) => {
    const { search, lat, lng, fuelEan } = req.query;
    const userLat = parseFloat(lat) || -37.8136;
    const userLng = parseFloat(lng) || 144.9631;

    let query = `
        SELECT s.*, 
        (SELECT COUNT(*) FROM prices p WHERE p.store_id = s.store_id AND p.fuel_type_ean = ?) as has_fuel
        FROM stores s 
        WHERE s.is_fuel_store = 1
    `;
    let args = [fuelEan];

    if (search) {
        query += " AND (s.name LIKE ? OR s.address LIKE ? OR s.suburb LIKE ? OR s.postcode LIKE ?)";
        const term = `%${search}%`;
        args.push(term, term, term, term);
    }

    try {
        const result = await client.execute({ sql: query, args });
        const storesWithDist = result.rows.map(store => {
            const dist = getDistanceFromLatLonInKm(userLat, userLng, store.lat, store.lng);
            return {
                id: store.store_id,
                name: store.name,
                address: `${store.address}, ${store.suburb} ${store.postcode}`,
                distance: `${dist.toFixed(1)} km`,
                rawDistance: dist,
                coordinates: { lat: store.lat, lng: store.lng },
                hasFuel: store.has_fuel > 0
            };
        });

        storesWithDist.sort((a, b) => a.rawDistance - b.rawDistance);

        let finalResults = search ? storesWithDist.slice(0, 4) : storesWithDist.filter(s => s.hasFuel).slice(0, 4);
        res.json(finalResults);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// --- Save Alert Endpoint ---
app.post('/api/alerts', async (req, res) => {
    const { email, storeId, fuelEan, threshold } = req.body;

    if (!email || !storeId || !fuelEan || !threshold) {
        return res.status(400).json({ error: "Missing fields" });
    }

    // threshold comes in Dollars (1.85), DB stores cents (185)
    const thresholdCents = Math.round(threshold * 100);

    try {
        const result = await client.execute({
            sql: `INSERT INTO alerts (email, store_id, fuel_ean, threshold_cents) VALUES (?, ?, ?, ?)`,
            args: [email, storeId, fuelEan, thresholdCents]
        });
        res.json({ success: true, id: result.lastInsertRowid ? result.lastInsertRowid.toString() : '0' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save alert" });
    }
});

// --- Prediction Endpoint ---
app.get('/api/predict', async (req, res) => {
    try {
        const { storeId, fuelEan, targetDate, model = 'linear' } = req.query;
        const target = new Date(targetDate);
        let predictionMetrics = null;
        const history = [];

        // ONLY FETCH ONCE PER REQUEST OR PULL FROM MEMORY
        const cachedTrainingData = await getTrainingData(storeId, fuelEan);

        for (let i = -7; i <= 7; i++) {
            const date = addDays(target, i);
            const result = await makePrediction(storeId, fuelEan, date, model, cachedTrainingData);
            const priceVal = typeof result === 'object' ? result.price : result;
            if (typeof result === 'object' && result.metrics) predictionMetrics = result.metrics;

            history.push({
                date: date,
                displayDate: format(date, 'MMM dd'),
                fullDate: format(date, 'MMM dd, yyyy'),
                price: priceVal,
                isTarget: i === 0,
                isReal: i <= 0
            });
        }

        // Get Comparisons (Latest Prices)
        const compRes = await client.execute({
            sql: `SELECT fuel_type_ean, price_cents FROM prices WHERE store_id = ? GROUP BY fuel_type_ean HAVING retrieved_at = MAX(retrieved_at)`,
            args: [storeId]
        });

        const comparisons = compRes.rows.map(row => ({
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
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// --- Optimal Recommendation Endpoint ---
app.get('/api/recommendation', async (req, res) => {
    const { lat, lng, fuelEan, model = 'linear' } = req.query;
    const userLat = parseFloat(lat) || -37.8136;
    const userLng = parseFloat(lng) || 144.9631;

    try {
        const result = await client.execute(`SELECT * FROM stores WHERE is_fuel_store = 1`);

        const nearbyStores = result.rows.map(store => {
            const dist = getDistanceFromLatLonInKm(userLat, userLng, store.lat, store.lng);
            return { ...store, dist };
        })
            .filter(s => s.dist <= 10)
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 5);

        if (nearbyStores.length === 0) return res.json(null);

        let bestOption = null;
        let minPrice = Infinity;

        for (const store of nearbyStores) {
            const today = new Date();
            // ONLY FETCH ONCE PER STORE PER REQUEST OR PULL FROM MEMORY
            const cachedTrainingData = await getTrainingData(store.store_id, fuelEan);

            for (let i = 0; i < 7; i++) {
                const targetDate = addDays(today, i);
                const result = await makePrediction(store.store_id, fuelEan, targetDate, model, cachedTrainingData);
                const price = typeof result === 'object' ? result.price : result;

                if (price < minPrice) {
                    minPrice = price;
                    bestOption = {
                        storeName: store.name,
                        address: store.address,
                        suburb: store.suburb,
                        dist: store.dist.toFixed(1),
                        date: targetDate,
                        price: price
                    };
                }
            }
        }
        res.json(bestOption);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Server Error" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});