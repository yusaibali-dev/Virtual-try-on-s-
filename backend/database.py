import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "vton_closet.db")

def init_db():
    conn = sqlite3.connect(DB_PATH, timeout=5.0)
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=NORMAL;")
    cursor.execute("PRAGMA busy_timeout=5000;")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS closet_items (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            image_filename TEXT NOT NULL,
            thumbnail_filename TEXT NOT NULL,
            original_url TEXT,
            source_type TEXT NOT NULL, -- 'upload', 'image_url', 'product_url'
            is_favourite INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata_json TEXT
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_closet_category ON closet_items(category);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_closet_created_at ON closet_items(created_at);")
    conn.commit()
    conn.close()

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=5.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=5000;")
    return conn

def insert_item(item_data: dict) -> dict:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO closet_items (
            id, title, category, image_filename, thumbnail_filename,
            original_url, source_type, is_favourite, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        item_data["id"],
        item_data["title"],
        item_data["category"],
        item_data["image_filename"],
        item_data["thumbnail_filename"],
        item_data.get("original_url"),
        item_data.get("source_type", "upload"),
        1 if item_data.get("is_favourite") else 0,
        json.dumps(item_data.get("metadata", {}))
    ))
    conn.commit()
    conn.close()
    return item_data

def list_items(category: str = None, favourites_only: bool = False) -> list[dict]:
    conn = get_db()
    cursor = conn.cursor()

    query = "SELECT * FROM closet_items WHERE 1=1"
    params = []

    if category and category != "all":
        query += " AND category = ?"
        params.append(category)

    if favourites_only:
        query += " AND is_favourite = 1"

    query += " ORDER BY created_at DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    items = []
    for row in rows:
        item = dict(row)
        item["is_favourite"] = bool(item["is_favourite"])
        try:
            item["metadata"] = json.loads(item["metadata_json"] or "{}")
        except Exception:
            item["metadata"] = {}
        items.append(item)
    return items

def get_item(item_id: str) -> dict | None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM closet_items WHERE id = ?", (item_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    item = dict(row)
    item["is_favourite"] = bool(item["is_favourite"])
    try:
        item["metadata"] = json.loads(item["metadata_json"] or "{}")
    except Exception:
        item["metadata"] = {}
    return item

def toggle_favourite(item_id: str) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT is_favourite FROM closet_items WHERE id = ?", (item_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise ValueError(f"Item {item_id} not found")
    new_status = 0 if row["is_favourite"] == 1 else 1
    cursor.execute("UPDATE closet_items SET is_favourite = ? WHERE id = ?", (new_status, item_id))
    conn.commit()
    conn.close()
    return bool(new_status)

def delete_item(item_id: str) -> dict | None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM closet_items WHERE id = ?", (item_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    item = dict(row)
    cursor.execute("DELETE FROM closet_items WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()
    return item
