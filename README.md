# ☕ Café Nova — QR Ordering System

Café Nova is a full-stack restaurant ordering system built to simplify table-based food ordering.

Customers can scan a QR code at their table, browse the menu, add items to a cart, and place an order. The order is sent to a Flask REST API, stored in PostgreSQL, and displayed on a separate kitchen dashboard where staff can manage the order status.

## 🌐 Live Demo

### Customer Website
https://cafe-nova-qr-ordering-system.vercel.app/

### Kitchen Dashboard
https://cafenova-kitchen.vercel.app/

### Backend API
https://cafenova-backend.onrender.com/

---

## 🚀 Features

### Customer Ordering

- QR-based table ordering
- Digital food and beverage menu
- Add/remove items from cart
- Quantity management
- Customer name and phone number
- Table number identification
- Special instructions
- Automatic order total
- Order confirmation

### Kitchen Dashboard

- View incoming orders
- View customer and table information
- View ordered items and quantities
- View special instructions
- View order totals
- Track order status
- Pending → Preparing → Ready → Completed
- Dashboard statistics
- Manual order refresh
- Online/offline API connection indicator

---

## 🔄 How It Works

```text
Customer
   │
   │ Scan Table QR
   ▼
Café Nova Website
   │
   │ POST /api/orders
   ▼
Flask REST API
   │
   ▼
PostgreSQL
   │
   │ GET /api/orders
   ▼
Kitchen Dashboard
   │
   │ PATCH /api/orders/<id>
   ▼
Order Status Updated
