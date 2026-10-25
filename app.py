"""
BigBasket Inventory & Warehouse Management System
Backend: Flask REST API with SQLite database
"""

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import sqlite3
import csv
import os

app = Flask(__name__)
CORS(app)  # Allow frontend to connect to backend


@app.route('/')
def index():
    return send_from_directory(app.root_path, 'index.html')


@app.route('/style.css')
def stylesheet():
    return send_from_directory(app.root_path, 'style.css')


@app.route('/app.js')
def frontend_script():
    return send_from_directory(app.root_path, 'app.js')


# ─── Database Configuration ───────────────────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), 'inventory.db')
CSV_PATH = os.path.join(os.path.dirname(__file__), 'bigbasket_products.csv')


def get_db():
    """Open a database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Return rows as dictionaries
    return conn


def init_db():
    """Create the products table if it doesn't exist, then load CSV data."""
    conn = get_db()
    cursor = conn.cursor()

    # Create table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            product     TEXT    NOT NULL,
            category    TEXT,
            sub_category TEXT,
            brand       TEXT,
            sale_price  REAL,
            market_price REAL,
            type        TEXT,
            rating      REAL,
            description TEXT,
            quantity    INTEGER DEFAULT 100
        )
    ''')
    conn.commit()

    # Load CSV only if the table is empty (first run)
    count = cursor.execute('SELECT COUNT(*) FROM products').fetchone()[0]
    if count == 0 and os.path.exists(CSV_PATH):
        print("Loading CSV data into database (first run)...")
        load_csv(cursor)
        conn.commit()
        total = cursor.execute('SELECT COUNT(*) FROM products').fetchone()[0]
        print(f"Loaded {total} products into inventory.db")
    else:
        print(f"Database ready — {count} products found.")

    conn.close()


def load_csv(cursor):
    """Read the CSV file and insert rows into the products table."""
    with open(CSV_PATH, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Skip placeholder rows like "..."
            if row.get('product', '').strip() == '...':
                continue
            cursor.execute('''
                INSERT INTO products
                    (product, category, sub_category, brand, sale_price,
                     market_price, type, rating, description, quantity)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                row.get('product', '').strip(),
                row.get('category', '').strip(),
                row.get('sub_category', '').strip(),
                row.get('brand', '').strip(),
                float(row['sale_price'])   if row.get('sale_price')   else 0.0,
                float(row['market_price']) if row.get('market_price') else 0.0,
                row.get('type', '').strip(),
                float(row['rating'])       if row.get('rating')       else 0.0,
                row.get('description', '').strip(),
                100   # default quantity
            ))


# ─── Helper ───────────────────────────────────────────────────────────────────
def row_to_dict(row):
    return dict(row)


# ─── API Routes ───────────────────────────────────────────────────────────────

@app.route('/products', methods=['GET'])
def get_products():
    """
    GET /products
    Optional query params:
      search   — filter by product name or brand
      category — filter by category
      low_stock — if 'true', return only quantity < 20
    """
    search    = request.args.get('search', '').strip()
    category  = request.args.get('category', '').strip()
    low_stock = request.args.get('low_stock', '').lower() == 'true'

    query  = 'SELECT * FROM products WHERE 1=1'
    params = []

    if search:
        query += ' AND (product LIKE ? OR brand LIKE ?)'
        params += [f'%{search}%', f'%{search}%']

    if category:
        query += ' AND category = ?'
        params.append(category)

    if low_stock:
        query += ' AND quantity < 20'

    query += ' ORDER BY id'

    conn = get_db()
    rows = conn.execute(query, params).fetchall()
    conn.close()

    return jsonify([row_to_dict(r) for r in rows])


@app.route('/products', methods=['POST'])
def add_product():
    """POST /products — Add a new product."""
    data = request.get_json()
    if not data or not data.get('product'):
        return jsonify({'error': 'product name is required'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO products
            (product, category, sub_category, brand, sale_price,
             market_price, type, rating, description, quantity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        data.get('product', ''),
        data.get('category', ''),
        data.get('sub_category', ''),
        data.get('brand', ''),
        float(data.get('sale_price', 0)),
        float(data.get('market_price', 0)),
        data.get('type', ''),
        float(data.get('rating', 0)),
        data.get('description', ''),
        int(data.get('quantity', 100)),
    ))
    conn.commit()
    new_id = cursor.lastrowid
    new_row = conn.execute('SELECT * FROM products WHERE id = ?', (new_id,)).fetchone()
    conn.close()

    return jsonify(row_to_dict(new_row)), 201


@app.route('/products/<int:product_id>', methods=['PUT'])
def update_product(product_id):
    """PUT /products/<id> — Update an existing product."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    conn = get_db()
    existing = conn.execute('SELECT * FROM products WHERE id = ?', (product_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'Product not found'}), 404

    conn.execute('''
        UPDATE products SET
            product      = ?,
            category     = ?,
            sub_category = ?,
            brand        = ?,
            sale_price   = ?,
            market_price = ?,
            type         = ?,
            rating       = ?,
            description  = ?,
            quantity     = ?
        WHERE id = ?
    ''', (
        data.get('product',      existing['product']),
        data.get('category',     existing['category']),
        data.get('sub_category', existing['sub_category']),
        data.get('brand',        existing['brand']),
        float(data.get('sale_price',   existing['sale_price'])),
        float(data.get('market_price', existing['market_price'])),
        data.get('type',         existing['type']),
        float(data.get('rating', existing['rating'])),
        data.get('description',  existing['description']),
        int(data.get('quantity', existing['quantity'])),
        product_id,
    ))
    conn.commit()
    updated = conn.execute('SELECT * FROM products WHERE id = ?', (product_id,)).fetchone()
    conn.close()

    return jsonify(row_to_dict(updated))


@app.route('/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    """DELETE /products/<id> — Remove a product."""
    conn = get_db()
    existing = conn.execute('SELECT * FROM products WHERE id = ?', (product_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'Product not found'}), 404

    conn.execute('DELETE FROM products WHERE id = ?', (product_id,))
    conn.commit()
    conn.close()

    return jsonify({'message': f'Product {product_id} deleted successfully'})


@app.route('/dashboard/stats', methods=['GET'])
def dashboard_stats():
    """GET /dashboard/stats — Summary numbers for the dashboard."""
    conn = get_db()

    total_products = conn.execute('SELECT COUNT(*) FROM products').fetchone()[0]
    low_stock      = conn.execute('SELECT COUNT(*) FROM products WHERE quantity < 20').fetchone()[0]
    out_of_stock   = conn.execute('SELECT COUNT(*) FROM products WHERE quantity = 0').fetchone()[0]
    total_categories = conn.execute('SELECT COUNT(DISTINCT category) FROM products').fetchone()[0]

    avg_price = conn.execute('SELECT AVG(sale_price) FROM products').fetchone()[0] or 0
    avg_rating = conn.execute('SELECT AVG(rating) FROM products WHERE rating > 0').fetchone()[0] or 0
    total_stock = conn.execute('SELECT SUM(quantity) FROM products').fetchone()[0] or 0

    # Category breakdown
    cat_rows = conn.execute('''
        SELECT category, COUNT(*) as count
        FROM products
        GROUP BY category
        ORDER BY count DESC
    ''').fetchall()

    # Top rated products
    top_rated = conn.execute('''
        SELECT id, product, brand, rating, quantity, sale_price
        FROM products
        WHERE rating > 0
        ORDER BY rating DESC
        LIMIT 5
    ''').fetchall()

    # Low stock products
    low_stock_items = conn.execute('''
        SELECT id, product, brand, quantity, category
        FROM products
        WHERE quantity < 20
        ORDER BY quantity ASC
        LIMIT 5
    ''').fetchall()

    conn.close()

    return jsonify({
        'total_products':    total_products,
        'low_stock':         low_stock,
        'out_of_stock':      out_of_stock,
        'total_categories':  total_categories,
        'avg_price':         round(avg_price, 2),
        'avg_rating':        round(avg_rating, 2),
        'total_stock':       total_stock,
        'categories':        [row_to_dict(r) for r in cat_rows],
        'top_rated':         [row_to_dict(r) for r in top_rated],
        'low_stock_items':   [row_to_dict(r) for r in low_stock_items],
    })


@app.route('/categories', methods=['GET'])
def get_categories():
    """GET /categories — Distinct category list for filter dropdowns."""
    conn = get_db()
    rows = conn.execute(
        'SELECT DISTINCT category FROM products ORDER BY category'
    ).fetchall()
    conn.close()
    return jsonify([r['category'] for r in rows if r['category']])


# ─── Entry Point ──────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("Starting Inventory & Warehouse Management System...")
    init_db()
    print("Server running at http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
