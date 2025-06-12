# Requirements Analysis: GuessMyGas

### 🔧 Functional Requirements

**F1. Fuel Price Retrieval**

Fetch real-time fuel prices for all fuel types (E10, U91, PULP, Diesel)

Support multiple vendors (7-Eleven, BP, Shell, etc.)

Retrieve prices based on user’s current GPS location

**F2. Fuel Price Prediction**

Train and serve predictive models using historical data

Forecast short-term (1–3 day) price trends per station and fuel type

**F3. “Should I Fill Up Now or Wait?” Decision Engine**

Analyze current vs. predicted prices

Recommend “Fill now” or “Wait until ***[day]***” with confidence score

**F4. Location Handling**

Use GPS or user-input location to define "near you"

Detect user's current location to recommend nearby stations

**F5. Historical Data Logging**

Store real-time fuel prices daily for all supported stations

Organize by timestamp, fuel type, vendor, location

**F6. User Alerts (Future)**

Allow users to subscribe to fuel price drop alerts (by price or prediction)

Alert users when ideal time to use 7-Eleven's price lock occurs

**F7. UI Display (Minimum)**

Allow users to select a fuel type. Showing:

- Current price

- Predicted price

- Recommendation to wait or refuel now

### 📊 Non-Functional Requirements

**N1. Performance**

API responses (price lookup/prediction) should complete within 1 second

**N2. Accuracy**

Fuel price prediction models should reach at least 85%+ trend accuracy within 4–6 weeks of historical data collection

**N3. Availability**

System should auto-fetch and store data daily without manual input

**N4. Maintainability**

Code should be modular and allow easy addition of new vendors or fuel types

**N5. Scalability**

Should support hundreds of locations and potentially add user accounts in the future

### 🤔 Assumptions

7-Eleven and other vendors’ APIs stay publicly accessible

Initial users are in Melbourne metro

Price prediction models will initially be simple (e.g., regression-based), then improve