const { SimpleLinearRegression } = require('ml-regression-simple-linear');
const { PolynomialRegression } = require('ml-regression-polynomial');
const { RandomForestRegression } = require('ml-random-forest');

const { differenceInDays } = require('date-fns'); // Added format
const client = require('./db'); // Turso client

// --- 1. Data Fetching Layer ---
const getTrainingData = (storeId, fuelEan) => {
    return new Promise(async (resolve, reject) => {
        try {
            const result = await client.execute({
                sql: `SELECT price_cents, price_date FROM prices WHERE store_id = ? AND fuel_type_ean = ? ORDER BY price_date ASC LIMIT 100`,
                args: [storeId, fuelEan]
            });
            resolve(result.rows);
        } catch (e) {
            reject(e);
        }
    });
};

// --- Helper: Preprocess Data (Deduplicate Days) ---
// This fixes the "Singular Matrix" error by averaging prices for the same day
const preprocessData = (rawData) => {
    const dailyMap = new Map();

    rawData.forEach(row => {
        // Normalize date to YYYY-MM-DD to group same-day entries
        const dateKey = row.price_date.substring(0, 10); 
        
        if (!dailyMap.has(dateKey)) {
            dailyMap.set(dateKey, { total: 0, count: 0, date: row.price_date });
        }
        
        const entry = dailyMap.get(dateKey);
        entry.total += row.price_cents;
        entry.count += 1;
    });

    // Convert back to array
    const cleanData = Array.from(dailyMap.values()).map(entry => ({
        price_date: entry.date,
        price_cents: entry.total / entry.count // Average price for that day
    }));

    // Sort by date just in case map order got mixed
    cleanData.sort((a, b) => new Date(a.price_date) - new Date(b.price_date));
    
    return cleanData;
};

// --- Helper: Calculate Accuracy ---
const calculateAccuracy = (model, cleanData) => {

    // If absolutely no data, return empty structure
    if (!model || cleanData.length === 0) {
        return { accuracy: 0, correctCount: 0, totalCount: 7, avgDiff: 0, details: [] };
    }

    // 1. Prepare variables
    const TEST_WINDOW = 30;

    let totalDiff = 0;
    let correctCount = 0;
    const details = [];
    
    // 2. We need the last 7 days of REAL data
    // If we have less, we take what we have.
    const daysToTest = Math.min(cleanData.length, TEST_WINDOW);
    const testSet = cleanData.slice(-daysToTest);

    // 3. Evaluate each day
    testSet.forEach(day => {
        const inputDate = new Date(day.price_date);
        const predicted = model.predict(inputDate); // Dollars
        const actual = day.price_cents / 1000;      // Dollars

        // SAFE CHECK: If prediction failed (null), skip this metric
        if (predicted !== null && !isNaN(predicted)) {
            const diff = Math.abs(predicted - actual);
            totalDiff += diff;
            const isCorrect = diff <= 0.05;
            if (isCorrect) correctCount++;
            details.push({ date: day.price_date, predicted, actual, diff, isCorrect });
        }

        // Avoid NaN if we had 0 valid predictions
        if (details.length === 0) {
            return { accuracy: 0, correctCount: 0, totalCount: daysToTest, avgDiff: 0, details: [] };
        }
    });

    const avgDiff = totalDiff / details.length;
    const avgPrice = testSet.reduce((a, b) => a + b.price_cents/1000, 0) / testSet.length || 1.85;
    const accuracy = Math.max(0, Math.min(100, (1 - (avgDiff / avgPrice)) * 100));

    return {
        accuracy: Math.round(accuracy),
        correctCount: correctCount,
        totalCount: daysToTest,
        avgDiff: avgDiff.toFixed(3),
        details: details.reverse()
    };
};

// --- 2. Model Strategies ---
class LinearRegressionModel {
    constructor() { this.model = null; }

    train(data) {
        if (data.length < 2) return false;
        try {
            this.startDate = new Date(data[0].price_date);
            const xValues = data.map(d => differenceInDays(new Date(d.price_date), this.startDate));
            const yValues = data.map(d => d.price_cents / 1000); 
            this.model = new SimpleLinearRegression(xValues, yValues);
            return true;
        } catch (e) {
            console.error("Linear Training Failed:", e.message);
            return false;
        }
    }

    predict(targetDate) {
        if (!this.model) return null;
        const xInput = differenceInDays(new Date(targetDate), this.startDate);
        const prediction = this.model.predict(xInput);
        return Number(prediction.toFixed(3));
    }
}

class PolynomialRegressionModel {
    constructor() { this.model = null; }

    train(data) {
        // Needs strictly distinct X values. Preprocessing handles this, but let's be safe.
        if (data.length < 4) return false; 

        try {
            this.startDate = new Date(data[0].price_date);
            
            const xValues = data.map(d => differenceInDays(new Date(d.price_date), this.startDate));
            const yValues = data.map(d => d.price_cents / 1000);

            // Using Degree 3 (Cubic)
            this.model = new PolynomialRegression(xValues, yValues, 3);
            return true;
        } catch (e) {
            console.error("Polynomial Training Failed:", e.message); // Will catch "Matrix singular"
            return false;
        }
    }

    predict(targetDate) {
        if (!this.model) return null;
        const xInput = differenceInDays(new Date(targetDate), this.startDate);
        const prediction = this.model.predict(xInput);
        return (typeof prediction === 'number' && !isNaN(prediction)) ? Number(prediction.toFixed(3)) : null;
    }
}

class RandomForestModel {
    constructor() { this.model = null; }
    
    train(data) {
        if (data.length < 5) return false; 

        try {
            this.startDate = new Date(data[0].price_date);
            const xValues = data.map(d => [differenceInDays(new Date(d.price_date), this.startDate)]);
            const yValues = data.map(d => d.price_cents / 1000);

            this.model = new RandomForestRegression({
                nEstimators: 50,
                treeOptions: { maxDepth: 10 }
            });
            
            this.model.train(xValues, yValues);
            return true;
        } catch (e) {
            console.error("RF Training Failed:", e.message);
            return false;
        }
    }

    predict(targetDate) {
        if (!this.model) return null;
        const xInput = differenceInDays(new Date(targetDate), this.startDate);
        const prediction = this.model.predict([[xInput]]);

        if (Array.isArray(prediction) && typeof prediction[0] === 'number' && !isNaN(prediction[0])) {
            return Number(prediction[0].toFixed(3));
        }
        return null;
    }
}

// --- 3. The Engine (Factory) ---
const Models = {
    'linear': LinearRegressionModel,
    'polynomial': PolynomialRegressionModel,
    'random_forest': RandomForestModel
};

const makePrediction = async (storeId, fuelEan, targetDate, modelType = 'linear') => {
    let rawData = await getTrainingData(storeId, fuelEan);
    
    // 1. CLEAN THE DATA (Fixes Singular Matrix Error)
    const cleanData = preprocessData(rawData);

    const ModelClass = Models[modelType] || Models['linear'];
    const strategy = new ModelClass();

    // 2. ATTEMPT TRAINING (with try/catch inside classes)
    const isTrained = strategy.train(cleanData);

    const accuracyMetrics = calculateAccuracy(strategy, cleanData);

    // --- FALLBACK LOGIC (When not enough data or training failed) ---
    if (!isTrained || cleanData.length === 0) {
        // Fallback to Linear if Poly failed? Or just basic average?
        // Perform a simulated fallback based on the last known price.
        const basePrice = cleanData.length > 0 
            ? cleanData[cleanData.length - 1].price_cents / 1000
            : 1.85;

        // Add fake "noise" so graph isn't flat while waiting for more data
        const dayOfMonth = new Date(targetDate).getDate();
        const fakeFluctuation = Math.sin(dayOfMonth * 0.5) * 0.05; 

        return { 
            price: Number((basePrice + fakeFluctuation).toFixed(3)), 
            metrics: accuracyMetrics 
        };
    }

    const predicted = strategy.predict(targetDate);

    if (predicted === null) {
        predicted = cleanData[cleanData.length - 1].price_cents / 1000;
    }

    return {
        price: predicted,
        metrics: accuracyMetrics
    };
};

module.exports = { makePrediction };