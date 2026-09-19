CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price INTEGER NOT NULL CHECK(price > 0),
  category TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🛒',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  landmark TEXT NOT NULL DEFAULT '',
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'جديد',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK(qty > 0),
  price INTEGER NOT NULL CHECK(price >= 0),
  FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_products_active_category ON products(active, category);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
INSERT INTO products(name,price,category,emoji,active) SELECT 'لحم غنم',18000,'لحوم','🥩',1 WHERE NOT EXISTS (SELECT 1 FROM products);
INSERT INTO products(name,price,category,emoji,active) SELECT 'لحم عجل',16000,'لحوم','🥩',1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='لحم عجل');
INSERT INTO products(name,price,category,emoji,active) SELECT 'حليب طازج',2500,'ألبان','🥛',1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='حليب طازج');
INSERT INTO products(name,price,category,emoji,active) SELECT 'لبن',2000,'ألبان','🥛',1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='لبن');
INSERT INTO products(name,price,category,emoji,active) SELECT 'جبن أبيض',4500,'أجبان','🧀',1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='جبن أبيض');
INSERT INTO products(name,price,category,emoji,active) SELECT 'جبن مثلثات',3500,'أجبان','🧀',1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='جبن مثلثات');