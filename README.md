# GuessMyGas ⛽🇦🇺

**GuessMyGas** is a sophisticated fuel price prediction web application tailored for the Australian market (specifically Melbourne). It forecasts fuel prices at 7-Eleven locations using historical data, machine learning models, and real-time scraping.

The application is built as a **Progressive Web App (PWA)**, allowing users to install it on mobile devices for a native app experience.

---

## 🚀 Features

### 🌟 Core Functionality
*   **Price Prediction Engine:** Forecasts fuel prices for the next 7 days using three selectable Machine Learning models.
*   **Real-Time Data:** Automatically scrapes 7-Eleven API data every 12 hours to maintain an up-to-date dataset.
*   **Location Awareness:** 
    *   **GPS:** Automatically finds the nearest stores to the user.
    *   **Smart Search:** Search by suburb, postcode, or store name.
*   **Fuel Type Support:** Covers all major Australian fuel types (Unleaded 91, Premium 95, Premium 98, Diesel, E10, LPG).

### 📊 Data Visualization
*   **Interactive Graphs:** 15-day trend lines (7 days history + 7 days forecast).
*   **Unit Conversion:** Automatically handles data normalization to display Australian Cents (e.g., 189.9c).
*   **Comparison Tools:** "Cheapest vs. Most Expensive" fuel analysis and neighboring day price comparisons.

### 📱 Mobile Experience
*   **PWA Support:** Installable on iOS and Android (Add to Home Screen).
*   **Responsive Design:** Optimized touch targets and layouts for mobile devices.

---

## 🛠️ Tech Stack

### Frontend (Client)
*   **Framework:** React + TypeScript (Vite)
*   **Styling:** Tailwind CSS
*   **Visualization:** Recharts
*   **Icons:** Lucide React
*   **Date Handling:** date-fns

### Backend (Server)
*   **Runtime:** Node.js
*   **API:** Express.js
*   **Database:** SQLite (Persistent file storage)
*   **Scraper:** Axios + node-cron

### Machine Learning
*   **Linear Regression:** `ml-regression-simple-linear`
*   **Polynomial Regression:** `ml-regression-simple-linear`
*   **Random Forest:** `ml-random-forest`

---

## 🤖 Prediction Models

The application allows users to toggle between three distinct algorithmic strategies:

1.  **Linear Regression:**
    *   *Best for:* Identifying long-term inflation or deflation trends.
    *   *Logic:* Draws a straight trend line through historical data points.

2.  **Polynomial Regression (Degree 3):**
    *   *Best for:* Capturing price cycles (the "sawtooth" pattern typical of AU fuel prices).
    *   *Logic:* Fits a curved line that can swing up and down based on recent volatility.

3.  **Random Forest Regression:**
    *   *Best for:* Stability and complex pattern recognition.
    *   *Logic:* Uses an ensemble of 50 decision trees to predict prices without over-extrapolating wild trends.

---

## 📂 Project Structure

```bash
GUESS_MY_GAS/
├── public/                 # PWA Icons and manifest assets
├── src/
│   ├── data-scraper/       # 🧠 THE BACKEND
│   │   ├── collector.js        # Scrapes 7-Eleven API (Runs every 12h)
│   │   ├── server.js           # Express API (Endpoints: /predict, /stores)
│   │   ├── prediction_engine.js # ML Logic Factory
│   │   └── fuel_prices.db      # SQLite Database (Persistent)
│   ├── components/         # React UI Components
│   └── App.tsx             # Main Frontend Logic
├── index.html              # Entry point
└── vite.config.ts          # Vite & PWA Configuration
```

---

## ⚡ Local Development Setup

To run this project locally, you need two terminal windows open.

### 1. Start the Backend (API + Scraper)
This handles the database, serves the API, and starts the background data collector.

```bash
cd src/data-scraper
npm install
node server.js
```
*   *The server runs on port 3001.*
*   *It will immediately attempt to scrape data if the DB is empty.*

### 2. Start the Frontend
This runs the React interface.

```bash
# In the root folder
npm install
npm run dev
```
*   *The app runs on port 5173.*

---

## ☁️ Deployment Architecture

This project uses a split-hosting strategy to ensure database persistence while maintaining a fast CDN for the frontend.

### Backend: Railway.app
*   **Service:** Node.js Server (`src/data-scraper`).
*   **Persistence:** Uses a **Railway Volume** mounted at `/app/src/data-scraper`.
    *   *Why?* Cloud containers are ephemeral. The volume ensures `fuel_prices.db` survives restarts and deployments.
*   **Startup:** `node server.js` (which internally requires `collector.js` to start the cron job).

### Frontend: Vercel
*   **Service:** Static Site (Vite Build).
*   **Configuration:** 
    *   Environment Variable `VITE_API_URL` points to the Railway backend URL.
    *   Build Command: `npm run build`.

---

## 📝 License

This project is for educational and personal use to predict fuel prices. Data is sourced from public API endpoints.
