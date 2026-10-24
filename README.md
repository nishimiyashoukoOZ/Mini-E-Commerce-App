# Little Things — mini e-commerce app

A responsive, beginner-friendly storefront built with Python's standard library and plain HTML, CSS, and JavaScript. The catalog and checkout preview are served by a small Python API; cart contents are saved in the browser.

## Run locally

1. Install Python 3.9 or newer.
2. From this project folder, run `python app.py`.
3. Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

No packages or build step are required. Stop the server with `Ctrl+C`.

## What it does

- Renders product cards and category filters from the Python product catalog.
- Adds items, changes quantities, removes items, and calculates the item count and subtotal.
- Saves the bag in browser local storage between visits.
- Shows a free-shipping progress indicator, an order-preview modal, and a receipt after the demo order is placed.
- Validates cart items and recalculates totals on the server. The final order is a demo only; no payment is collected.

Product photography and typefaces load from Unsplash and Google Fonts, so those visual assets need an internet connection.
