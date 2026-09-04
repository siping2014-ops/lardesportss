import json
import os
import re
import secrets
import threading
import uuid
from functools import wraps

from flask import Flask, jsonify, request, send_from_directory, session

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "products.json")
UPLOAD_DIR = os.path.join(ROOT, "uploads")
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
CATEGORIES = {
    "raquettes",
    "chaussures",
    "volants",
    "cordages",
    "vetements",
    "sacs",
    "accessoires",
    "autres-sports",
}

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)

app = Flask(__name__, static_folder=ROOT, static_url_path="")
app.secret_key = os.environ.get("SECRET_KEY", secrets.token_hex(16))
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
_lock = threading.Lock()


def load_products():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_products(products):
    tmp = DATA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    os.replace(tmp, DATA_FILE)


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("admin"):
            return jsonify({"error": "未登录后台"}), 401
        return fn(*args, **kwargs)

    return wrapper


def parse_optional_float(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def slugify(text):
    text = (text or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:40] or "produit"


def save_uploaded_image(file_storage):
    if not file_storage or not file_storage.filename:
        return None
    ext = os.path.splitext(file_storage.filename)[1].lower()
    if ext not in ALLOWED_EXT:
        raise ValueError("图片格式仅支持 jpg / png / gif / webp")
    name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, name)
    file_storage.save(path)
    return f"uploads/{name}"


@app.get("/api/products")
def list_products():
    category = request.args.get("category", "").strip()
    products = load_products()
    if category:
        products = [p for p in products if p.get("category") == category]
    return jsonify(products)


@app.get("/api/products/<product_id>")
def get_product(product_id):
    for product in load_products():
        if product.get("id") == product_id:
            return jsonify(product)
    return jsonify({"error": "商品不存在"}), 404


@app.post("/api/login")
def login():
    data = request.get_json(silent=True) or {}
    password = data.get("password", "")
    if password != ADMIN_PASSWORD:
        return jsonify({"error": "密码错误"}), 401
    session["admin"] = True
    return jsonify({"ok": True})


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/session")
def session_status():
    return jsonify({"admin": bool(session.get("admin"))})


@app.post("/api/products")
@admin_required
def create_product():
    form = request.form
    name = (form.get("name") or "").strip()
    category = (form.get("category") or "").strip()
    if not name:
        return jsonify({"error": "请填写商品名称"}), 400
    if category not in CATEGORIES:
        return jsonify({"error": "分类无效"}), 400

    try:
        image = save_uploaded_image(request.files.get("image"))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if not image:
        image = (form.get("image") or "").strip()

    product = {
        "id": f"{slugify(name)}-{uuid.uuid4().hex[:8]}",
        "category": category,
        "brand": (form.get("brand") or "").strip(),
        "name": name,
        "description": (form.get("description") or "").strip(),
        "specs": (form.get("specs") or "").strip(),
        "price": parse_optional_float(form.get("price")) or 0,
        "oldPrice": parse_optional_float(form.get("oldPrice")),
        "discount": parse_optional_float(form.get("discount")),
        "image": image,
    }

    with _lock:
        products = load_products()
        products.append(product)
        save_products(products)
    return jsonify(product), 201


@app.put("/api/products/<product_id>")
@admin_required
def update_product(product_id):
    form = request.form
    with _lock:
        products = load_products()
        target = next((p for p in products if p.get("id") == product_id), None)
        if not target:
            return jsonify({"error": "商品不存在"}), 404

        if "name" in form:
            name = form.get("name", "").strip()
            if not name:
                return jsonify({"error": "请填写商品名称"}), 400
            target["name"] = name
        if "category" in form:
            category = form.get("category", "").strip()
            if category not in CATEGORIES:
                return jsonify({"error": "分类无效"}), 400
            target["category"] = category
        for key in ("brand", "description", "specs", "image"):
            if key in form:
                target[key] = (form.get(key) or "").strip()
        if "price" in form:
            target["price"] = parse_optional_float(form.get("price")) or 0
        if "oldPrice" in form:
            target["oldPrice"] = parse_optional_float(form.get("oldPrice"))
        if "discount" in form:
            target["discount"] = parse_optional_float(form.get("discount"))

        try:
            uploaded = save_uploaded_image(request.files.get("image"))
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        if uploaded:
            target["image"] = uploaded

        save_products(products)
    return jsonify(target)


@app.delete("/api/products/<product_id>")
@admin_required
def delete_product(product_id):
    with _lock:
        products = load_products()
        kept = [p for p in products if p.get("id") != product_id]
        if len(kept) == len(products):
            return jsonify({"error": "商品不存在"}), 404
        save_products(kept)
    return jsonify({"ok": True})


@app.before_request
def block_private_paths():
    path = request.path.lower()
    if path.startswith("/backend/") or path.endswith(".py"):
        return jsonify({"error": "forbidden"}), 403


@app.get("/")
def home():
    return send_from_directory(ROOT, "index.html")


@app.get("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
