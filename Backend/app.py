"""
Café Nova — Order API

Flask backend for receiving table orders.

Production:
- Uses PostgreSQL through DATABASE_URL.

Local development:
- Falls back to SQLite when DATABASE_URL is not set.

Endpoints:
POST /api/orders
GET  /api/orders
"""

import json
import os
import sqlite3
from contextlib import contextmanager

import psycopg
from flask import Flask, jsonify, request
from flask_cors import CORS


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Render PostgreSQL connection
DATABASE_URL = os.getenv("DATABASE_URL")

# Local SQLite fallback
DATABASE_PATH = os.path.join(
    BASE_DIR,
    "..",
    "database",
    "orders.db"
)

# Fields required in every order
REQUIRED_FIELDS = (
    "customer",
    "phone",
    "table",
    "items",
    "total"
)


# ---------------------------------------------------------------------------
# Database connection
# ---------------------------------------------------------------------------

@contextmanager
def get_connection():
    """
    Uses PostgreSQL when DATABASE_URL is available.
    Otherwise uses local SQLite.
    """

    if DATABASE_URL:
        connection = psycopg.connect(DATABASE_URL)

        try:
            yield connection
        finally:
            connection.close()

    else:
        os.makedirs(
            os.path.dirname(DATABASE_PATH),
            exist_ok=True
        )

        connection = sqlite3.connect(DATABASE_PATH)

        try:
            yield connection
        finally:
            connection.close()


# ---------------------------------------------------------------------------
# Database initialization
# ---------------------------------------------------------------------------

def init_db():
    """
    Creates the orders table if it doesn't exist.

    Also safely adds the status column to an existing
    PostgreSQL orders table.
    """

    with get_connection() as connection:

        if DATABASE_URL:

            # ---------------------------------------------------------------
            # PostgreSQL
            # ---------------------------------------------------------------

            connection.execute("""
                CREATE TABLE IF NOT EXISTS orders (
                    id SERIAL PRIMARY KEY,
                    customer TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    table_number TEXT NOT NULL,
                    items TEXT NOT NULL,
                    total DOUBLE PRECISION NOT NULL,
                    instructions TEXT,
                    status TEXT NOT NULL DEFAULT 'pending'
                )
            """)

            # Add status column to an existing PostgreSQL table
            connection.execute("""
                ALTER TABLE orders
                ADD COLUMN IF NOT EXISTS status
                TEXT NOT NULL DEFAULT 'pending'
            """)

        else:

            # ---------------------------------------------------------------
            # SQLite — local development
            # ---------------------------------------------------------------

            connection.execute("""
                CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    table_number TEXT NOT NULL,
                    items TEXT NOT NULL,
                    total REAL NOT NULL,
                    instructions TEXT,
                    status TEXT NOT NULL DEFAULT 'pending'
                )
            """)

        connection.commit()


# ---------------------------------------------------------------------------
# IMPORTANT:
# Initialize database when Gunicorn/Render starts the application.
# ---------------------------------------------------------------------------

init_db()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def home():
    return "Café Nova Backend is Running!"


# ---------------------------------------------------------------------------
# CREATE ORDER
# ---------------------------------------------------------------------------

@app.route("/api/orders", methods=["POST"])
def create_order():
    """
    Validates an incoming order and saves it to the database.
    """

    order = request.get_json(silent=True)

    # Check JSON
    if order is None:
        return jsonify({
            "success": False,
            "error": "Request body must be JSON."
        }), 400

    # Check required fields
    missing = [
        field
        for field in REQUIRED_FIELDS
        if field not in order
    ]

    if missing:
        return jsonify({
            "success": False,
            "error": (
                f"Missing required field(s): "
                f"{', '.join(missing)}"
            )
        }), 400

    try:

        with get_connection() as connection:

            if DATABASE_URL:

                # -----------------------------------------------------------
                # PostgreSQL
                # -----------------------------------------------------------

                cursor = connection.execute(
                    """
                    INSERT INTO orders
                        (
                            customer,
                            phone,
                            table_number,
                            items,
                            total,
                            instructions
                        )
                    VALUES
                        (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        order["customer"],
                        order["phone"],
                        order["table"],
                        json.dumps(order["items"]),
                        order["total"],
                        order.get("instructions", "")
                    )
                )

                order_id = cursor.fetchone()[0]

            else:

                # -----------------------------------------------------------
                # SQLite
                # -----------------------------------------------------------

                cursor = connection.execute(
                    """
                    INSERT INTO orders
                        (
                            customer,
                            phone,
                            table_number,
                            items,
                            total,
                            instructions
                        )
                    VALUES
                        (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        order["customer"],
                        order["phone"],
                        order["table"],
                        json.dumps(order["items"]),
                        order["total"],
                        order.get("instructions", "")
                    )
                )

                order_id = cursor.lastrowid

            connection.commit()

    except (sqlite3.Error, psycopg.Error) as db_error:

        return jsonify({
            "success": False,
            "error": f"Database error: {db_error}"
        }), 500

    print(f"NEW ORDER SAVED! id={order_id}")

    return jsonify({
        "success": True,
        "orderId": order_id
    })


# ---------------------------------------------------------------------------
# GET ALL ORDERS
# ---------------------------------------------------------------------------

@app.route("/api/orders", methods=["GET"])
def get_orders():
    """
    Returns all orders for the kitchen/admin dashboard.
    """

    try:

        with get_connection() as connection:

            cursor = connection.execute("""
                SELECT
                    id,
                    customer,
                    phone,
                    table_number,
                    items,
                    total,
                    instructions,
                    status
                FROM orders
                ORDER BY id DESC
            """)

            rows = cursor.fetchall()

            orders = []

            for row in rows:

                orders.append({
                    "id": row[0],
                    "customer": row[1],
                    "phone": row[2],
                    "table": row[3],
                    "items": json.loads(row[4]),
                    "total": row[5],
                    "instructions": row[6],
                    "status": row[7]
                })

        return jsonify({
            "success": True,
            "orders": orders
        })

    except (sqlite3.Error, psycopg.Error) as db_error:

        return jsonify({
            "success": False,
            "error": f"Database error: {db_error}"
        }), 500


# ---------------------------------------------------------------------------
# Local development
# ---------------------------------------------------------------------------

if __name__ == "__main__":

    print("Café Nova Backend is starting...")

    app.run(
        debug=True
    )