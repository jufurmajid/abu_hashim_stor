const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "data", "products.json");

function ensureFile() {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, "[]", "utf8");
}

function readProducts() {
  ensureFile();
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(data) ? data : [];
}

function writeProducts(products) {
  ensureFile();
  fs.writeFileSync(file, JSON.stringify(products, null, 2), "utf8");
}

function nextId(products) {
  return products.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1;
}

function addProduct(n, p, c, e = "🛒") {
  const products = readProducts();
  const product = {
    id: nextId(products),
    n: String(n).trim(),
    p: Number(p),
    c: String(c).trim(),
    e: String(e || "🛒").trim(),
    active: true
  };
  products.push(product);
  writeProducts(products);
  return product;
}

function updateProduct(id, changes) {
  const products = readProducts();
  const product = products.find(x => x.id === Number(id));
  if (!product) return null;
  Object.assign(product, changes);
  writeProducts(products);
  return product;
}

function deleteProduct(id) {
  const products = readProducts();
  const filtered = products.filter(x => x.id !== Number(id));
  if (filtered.length === products.length) return false;
  writeProducts(filtered);
  return true;
}

module.exports = { readProducts, addProduct, updateProduct, deleteProduct };
