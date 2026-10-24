import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"

PRODUCTS = [
    {
        "id": "headphones",
        "name": "Studio Wireless Headphones",
        "category": "Audio",
        "price": 129.00,
        "rating": 4.9,
        "reviews": 248,
        "badge": "BESTSELLER",
        "description": "Your own little corner of quiet. Rich, detailed sound meets all-day comfort.",
        "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85",
        "image_alt": "Black and gold over-ear headphones",
        "color": "#e7e4de",
    },
    {
        "id": "sneakers",
        "name": "Everyday Runner Sneakers",
        "category": "Footwear",
        "price": 89.00,
        "rating": 4.8,
        "reviews": 186,
        "badge": "JUST IN",
        "description": "Light on your feet and easy on the eyes. Made for wherever today takes you.",
        "image": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85",
        "image_alt": "Bright red athletic sneaker",
        "color": "#ece3dd",
    },
    {
        "id": "watch",
        "name": "Minimalist Everyday Watch",
        "category": "Accessories",
        "price": 159.00,
        "rating": 4.9,
        "reviews": 132,
        "badge": "",
        "description": "A thoughtful finishing touch. Timeless lines, a soft leather strap, no fuss.",
        "image": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85",
        "image_alt": "Minimal wristwatch on a light background",
        "color": "#e9e5df",
    },
    {
        "id": "camera",
        "name": "Pocket Film Camera",
        "category": "Tech",
        "price": 74.00,
        "rating": 4.7,
        "reviews": 94,
        "badge": "STAFF PICK",
        "description": "A little grain, a lot of feeling. Capture the good stuff as it happens.",
        "image": "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=85",
        "image_alt": "Vintage camera ready to capture a moment",
        "color": "#e7e4de",
    },
    {
        "id": "tote",
        "name": "Canvas Market Tote",
        "category": "Accessories",
        "price": 38.00,
        "rating": 4.8,
        "reviews": 76,
        "badge": "",
        "description": "Room for the little things and the unexpected ones. Your everyday carry-all.",
        "image": "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=85",
        "image_alt": "Everyday handbag in a neutral color",
        "color": "#eae5dc",
    },
    {
        "id": "speaker",
        "name": "Portable Bluetooth Speaker",
        "category": "Audio",
        "price": 62.00,
        "rating": 4.8,
        "reviews": 115,
        "badge": "",
        "description": "Small speaker, big atmosphere. Bring your favorite soundtrack along.",
        "image": "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=85",
        "image_alt": "Compact portable wireless speaker",
        "color": "#e8e2dc",
    },
]

PRODUCT_BY_ID = {product["id"]: product for product in PRODUCTS}
MAX_QUANTITY_PER_ITEM = 25


class StoreHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/products":
            return self.send_json({"products": PRODUCTS})
        if path.startswith("/api/"):
            return self.send_json({"error": "API endpoint not found."}, 404)
        if path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/api/checkout":
            return self.send_json({"error": "API endpoint not found."}, 404)

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 16_384:
                return self.send_json({"error": "Please send a valid cart."}, 400)
            payload = json.loads(self.rfile.read(content_length))
        except (ValueError, json.JSONDecodeError):
            return self.send_json({"error": "Please send a valid JSON cart."}, 400)

        items = payload.get("items") if isinstance(payload, dict) else None
        if not isinstance(items, list) or not items:
            return self.send_json({"error": "Your cart is empty."}, 400)

        order_items = []
        for item in items:
            if not isinstance(item, dict):
                return self.send_json({"error": "A cart item is invalid."}, 400)
            product_id = item.get("id")
            quantity = item.get("quantity")
            if (
                not isinstance(product_id, str)
                or product_id not in PRODUCT_BY_ID
                or not isinstance(quantity, int)
                or isinstance(quantity, bool)
                or not 1 <= quantity <= MAX_QUANTITY_PER_ITEM
            ):
                return self.send_json({"error": "A cart item is invalid."}, 400)
            product = PRODUCT_BY_ID[product_id]
            order_items.append(
                {
                    "id": product_id,
                    "name": product["name"],
                    "price": product["price"],
                    "quantity": quantity,
                    "line_total": round(product["price"] * quantity, 2),
                }
            )

        total = round(sum(item["line_total"] for item in order_items), 2)
        return self.send_json(
            {
                "message": "Your order preview is ready.",
                "items": order_items,
                "item_count": sum(item["quantity"] for item in order_items),
                "total": total,
                "currency": "USD",
            }
        )

    def log_message(self, format, *args):
        print("%s - %s" % (self.address_string(), format % args))


if __name__ == "__main__":
    host = "127.0.0.1"
    port = 8000
    server = ThreadingHTTPServer((host, port), StoreHandler)
    print("Little Things is running at http://%s:%s" % (host, port))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down Little Things.")
    finally:
        server.server_close()
