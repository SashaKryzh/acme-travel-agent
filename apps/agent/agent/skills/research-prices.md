---
description: >-
  Use when the user wants price research: comparing many hotel prices across places, dates or star ratings, finding the cheapest dates or areas, price trends, or a data-backed answer such as "is Krakow cheaper than Warsaw in December?". Collects the data into CSV files in your sandbox and analyses them with Python.
---
Collect a lot of data, analyse it with code, then answer with real numbers.

1. Plan the dataset in one or two lines: which places, which stays (for example every Friday-to-Sunday weekend in a month, or the same dates in three cities), the guests and the currency. Prefer more data points over guessing: several places or dates, up to 200 hotels each.
2. Collect hotel prices with export_hotel_prices, once per place and stay, into one file (append true after the first call). Start the independent calls in the same step so they run side by side.
3. Collect other data when the question needs it, such as events on the dates, flight or train prices, or exchange rates: use web_search and web_fetch, or curl a public JSON or CSV source in bash. Save what you use as its own CSV under data/, with a source column. Never invent rows.
4. Analyse with Python. The sandbox has python3 with the standard library only (csv, statistics, sqlite3, json, datetime); there is no pandas and no pip. Write the script to analysis/<name>.py with write_file, run it with bash (`python3 analysis/<name>.py`), and fix it until it runs. Useful cuts: median and lowest price per night by place, date, stars or board; the cheapest dates; value for money as guest rating per 100 of price; how many hotels have rooms. Print compact tables, not raw rows.
5. Write the findings as a short markdown report with write_file (reports/<name>.md): what you collected, the key numbers, and your recommendation. The user sees the file in the chat.
6. Reply with the answer in a few sentences with the key numbers, and say how many hotels and dates the numbers rest on. When specific hotels stand out, search for them for the same stay and show them with show_hotels.

Prices are a snapshot from when you fetched them and can change. Say which currency they are in.
