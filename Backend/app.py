"""
Café Nova — Order API

A small Flask backend that accepts table orders from the frontend and
stores them in a local SQLite database.

Endpoint:
    POST /api/orders
        Body (JSON): {
            "customer": str,
            "phone": str,
            "table": str,
            "instructions": str,
            "items": list,
            "total": number
        }
        Response: { "success": true, "orderId": int }
"""

import json
import os
import sqlite3
from contextlib import contextmanager

from flask import Flask, jsonify, request
from flask_cors import CORS

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.join(BASE_DIR, "..", "database", "orders.db")

# Fields that must be present in every order. "instructions" is allowed to
# be an empty string, so it isn't checked for truthiness — only presence.
REQUIRED_FIELDS = ("customer", "phone", "table", "items", "total")


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

@contextmanager
def get_connection():
    """Yields a SQLite connection and guarantees it gets closed afterwards,
    even if an error is raised while it's open."""
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    try:
        yield connection
    finally:
        connection.close()


def init_db():
    """Creates the orders table if it doesn't already exist."""
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer TEXT NOT NULL,
                phone TEXT NOT NULL,
                table_number TEXT NOT NULL,
                items TEXT NOT NULL,
                total REAL NOT NULL,
                instructions TEXT
            )
        """)
        connection.commit()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def home():
    return "Café Nova Backend is Running!"


@app.route("/api/orders", methods=["POST"])
def create_order():
    """Validates an incoming order and saves it to the database."""
    order = request.get_json(silent=True)

    if order is None:
        return jsonify({"success": False, "error": "Request body must be JSON."}), 400

    missing = [field for field in REQUIRED_FIELDS if field not in order]
    if missing:
        return jsonify({
            "success": False,
            "error": f"Missing required field(s): {', '.join(missing)}",
        }), 400

    try:
        with get_connection() as connection:
            cursor = connection.execute(
                """
                INSERT INTO orders
                    (customer, phone, table_number, items, total, instructions)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    order["customer"],
                    order["phone"],
                    order["table"],
                    json.dumps(order["items"]),  # store as valid JSON, not a Python repr
                    order["total"],
                    order.get("instructions", ""),
                ),
            )
            connection.commit()
            order_id = cursor.lastrowid
    except sqlite3.Error as db_error:
        return jsonify({"success": False, "error": f"Database error: {db_error}"}), 500

    print(f"NEW ORDER SAVED! id={order_id}")
    return jsonify({"success": True, "orderId": order_id})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("App is starting...")
    init_db()
    app.run(debug=True)