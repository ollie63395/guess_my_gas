const sqlite3 = require('sqlite3').verbose();
const { SimpleLinearRegression } = require('ml-regression-simple-linear');
const { PolynomialRegression } = require('ml-regression-polynomial');
const { RandomForestRegression } = require('ml-random-forest');
const { addDays, differenceInDays } = require('date-fns');

const DB_FILE = './fuel_prices.db';
const db = new sqlite3.Database(DB_FILE);

// --- 1. Data Fetching Layer ---
const getTrainingData = (storeId, fuelEan) => {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT price_cents, price_date 
            FROM prices 
            WHERE store_id = ? AND fuel_type_ean = ? 
            ORDER BY price_date ASC
            LIMIT 100 
        `; // Increased limit for Random Forest (needs more data to be smart)
        db.all(query, [storeId, fuelEan], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// --- 2. Model Strategies ---
class LinearRegressionModel {
    constructor() { this.model = null; }

    train(data) {
        if (data.length < 2) return false;
        this.startDate = new Date(data[0].price_date);
        const xValues = data.map(d => differenceInDays(new Date(d.price_date), this.startDate));
        const yValues = data.map(d => d.price_cents / 100);
        this.model = new SimpleLinearRegression(xValues, yValues);
        return true;
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
        // Polynomial needs at least 3 points to make a curve
        if (data.length < 3) return false;

        this.startDate = new Date(data[0].price_date);
        
        const xValues = data.map(d => differenceInDays(new Date(d.price_date), this.startDate));
        const yValues = data.map(d => d.price_cents / 100);

        // Degree 3 allows for "Up, Down, Up" patterns (S-shapes)
        // Degree 2 is a simple U-shape or Hill-shape
        const degree = 3; 
        
        this.model = new PolynomialRegression(xValues, yValues, degree);
        return true;
    }

    predict(targetDate) {
        if (!this.model) return null;
        const xInput = differenceInDays(new Date(targetDate), this.startDate);
        const prediction = this.model.predict(xInput);
        return Number(prediction.toFixed(3));
    }
}

class RandomForestModel {
    constructor() { this.model = null; }
    
    train(data) {
        if (data.length < 5) return false; // Needs decent data quantity

        this.startDate = new Date(data[0].price_date);
        
        // Random Forest expects a Matrix (Array of Arrays) for X: [[0], [1], [2]]
        const xValues = data.map(d => [differenceInDays(new Date(d.price_date), this.startDate)]);
        const yValues = data.map(d => d.price_cents / 100);

        // Configuration: 50 trees, max depth 10
        this.model = new RandomForestRegression({
            nEstimators: 50,
            treeOptions: { maxDepth: 10 }
        });
        
        this.model.train(xValues, yValues);
        return true;
    }

    predict(targetDate) {
        if (!this.model) return null;
        
        const xInput = differenceInDays(new Date(targetDate), this.startDate);
        
        // Predict returns an array, we want the first result
        const prediction = this.model.predict([[xInput]])[0];
        return Number(prediction.toFixed(3));
    }
}

// --- 3. The Engine (Factory) ---

const Models = {
    'linear': LinearRegressionModel,
    'polynomial': PolynomialRegressionModel,
    'random_forest': RandomForestModel
};

const makePrediction = async (storeId, fuelEan, targetDate, modelType = 'linear') => {
    const rawData = await getTrainingData(storeId, fuelEan);
    
    const ModelClass = Models[modelType] || Models['linear'];
    const strategy = new ModelClass();

    const isTrained = strategy.train(rawData);

    // Fallback
    if (!isTrained || rawData.length === 0) {
        return rawData.length > 0 
            ? rawData[rawData.length - 1].price_cents / 100 
            : 1.50; 
    }

    return strategy.predict(targetDate);
};

module.exports = { makePrediction };