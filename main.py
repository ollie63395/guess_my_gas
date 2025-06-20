import requests
import csv
import time

from datetime import datetime

# API URLs
store_url = "https://www.7eleven.com.au/storelocator-retail/mulesoft/stores?lat=-37.8780651&long=145.1016256&dist=10"
fuel_url = "https://www.7eleven.com.au/storelocator-retail/mulesoft/fuelPrices?storeNo=1259"

# CSV file path
csv_file = "fuel_prices.csv"

price_data = []

def fetch_fuel_price():
    try:
        price_response = requests.get(fuel_url)
        price_data = price_response.json()

        # index 5 corresponds to E95 (PULP) at Chadstone store
        index = 5
        # convert price to cents/L
        price = price_data['data'][index]['price'] / 10

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        data = [timestamp, price]

        with open(csv_file, mode='a', newline='') as file:
            writer = csv.writer(file)
            writer.writerow(data)

        price_data.append(data)

        print(f"{timestamp} - E95 (PULP) Price at Chadstone: {price:.1f}¢/L (Logged)")

    except Exception as e:
        print("Error fetching data: ", e)


fetch_fuel_price()

# while True:
#     fetch_fuel_price()
#     print(f"Current time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
#     print("Waiting 3 hours before the next run...\n")
#     time.sleep(3 * 60 * 60)  # Sleep for 3 hours (in seconds)