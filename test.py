from selenium import webdriver

# specify the path to chromedriver
chrome_driver_path = "./chromedriver.exe"
# initiate the driver
driver = webdriver.Chrome(executable_path=chrome_driver_path)

driver.get("https://www.google.com")

driver.quit()