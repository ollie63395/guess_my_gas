# from selenium import webdriver
# from selenium.webdriver.chrome.service import Service
# from selenium.webdriver.common.by import By
# from selenium.webdriver.support.ui import WebDriverWait
# from selenium.webdriver.support import expected_conditions as EC

# import time
import requests









# # specify the path to chromedriver
# chrome_driver_path = "./chromedriver.exe"

# # initiate the driver
# service = Service(chrome_driver_path)
# driver = webdriver.Chrome(service=service)

# # file path to 7-Eleven website
# driver.get("https://www.7eleven.com.au/store-locator.html?filter=isFuelStore-true")

# time.sleep(10)

# print(driver.page_source)

# # wait for the page to load
# WebDriverWait(driver, 10).until(
#     EC.presence_of_element_located((By.CLASS_NAME, "store-list"))
# )

# # get the list of stores
# chadstone_store = None
# stores = driver.find_elements(By.CLASS_NAME, "store-list__item")

# # find the store with the name "Chadstone"
# for store in stores:
#         store_name = store.find_element(By.CLASS_NAME, "store-list__name").text
#         if "Chadstone" in store_name:
#             chadstone_store = store
#             break

# if chadstone_store:
#     # click on the Chadstone store
#     chadstone_store.click()
    
#     # wait for the page to load
#     time.sleep(5)
    
#     # get the list of fuel types
#     fuel_types = chadstone_store.find_elements(By.CLASS_NAME, "fuel-type")
#     for fuel in fuel_types:
#         # get the fuel name and price
#         fuel_name = fuel.find_element(By.CLASS_NAME, "fuel-type__name").text
#         fuel_price = fuel.find_element(By.CLASS_NAME, "fuel-type__price").text
#         # check if the fuel type "Mobil Extra" exists
#         if "Mobil Extra" in fuel_name:
#             print(f"Fuel: {fuel_name}, Price: {fuel_price}")
#             break
# else:
#     print("Store not found")

# # close the browser
# driver.quit()