# GuessMyGas

**GuessMyGas** is an AI-powered app that helps users make smarter decisions about when and where to refuel. By predicting future fuel prices, analyzing price trends, and tracking nearby stations across multiple vendors, GuessMyGas saves users time and money every time they fill up.

### ✨ Features

⛽ Predicts whether you should refuel now or wait (fuel price forecasting)

⛽ Supports multiple fuel types (E10, U91, PULP, Diesel, etc.)

⛽ Tracks fuel prices at 7-Eleven and other major fuel vendors in Melbourne

⛽ Uses GPS location to show the cheapest nearby station

⛽ Historical data logging for model training and user insight

⛽ Future plans: smart price lock alerts, multi-brand comparison, savings tracker

### 🌐 Tech Stack (Planned)

Python (data collection, API integration, ML models)

Flask (backend API)

SQLite or PostgreSQL (data storage)

React or Streamlit (frontend dashboard)

Scheduled tasks / Cron for data scraping

### 🚀 Project Roadmap

Phase 1: Fuel price collection + GPS-based station lookup (in progress)

Phase 2: AI model for fuel price prediction (PULP first, then others)

Phase 3: Smart alerts, price lock suggestions, and user customization

Phase 4: Multi-vendor expansion and route planning

### 📅 Status

Currently in early development stage. Using 7-Eleven APIs to collect data for price prediction.

docs/initiation.md

Project Initiation: GuessMyGas

### 🌍 Purpose

To help users make informed decisions about when and where to refuel by predicting future fuel prices using historical data and AI models.

### 🔍 Problem Statement

Existing fuel apps (e.g. 7-Eleven) only provide real-time fuel prices. Users have no way to:

Know if prices will rise/fall tomorrow

Time their Price Lock usage

Plan fuel purchases based on historical trends

Compare prices across multiple brands

### 🚀 Project Goals

Predict short-term fuel price trends for different fuel types (E10, U91, PULP, Diesel, etc.)

Provide recommendations on whether to fill up now or wait

Integrate fuel price data from multiple vendors

Use location data to suggest relevant stations

Provide smart, customizable price alerts

### 📈 Scope (Phase 1)

Track real-time fuel prices from 7-Eleven stations using their API

Predict future PULP prices at a given station

GPS-based user location tracking

Daily logging of price data for model training

Basic user interface for querying predictions

### ⚠️ Constraints

Not all vendors provide open access to price data

Accurate predictions require a few weeks of historical data

GPS usage requires user permission

👤 Target Users

Drivers looking to save on fuel costs

Rideshare and delivery drivers

Budget-conscious commuters

### 📊 Success Metrics

High prediction accuracy for short-term price forecasts

User-reported savings or confidence in decision-making

Growth in historical data collection over time

### 🌐 Benefits

Reduced fuel costs by refueling at optimal times

Less stress over fluctuating fuel prices

Insightful analytics for smart fuel planning

