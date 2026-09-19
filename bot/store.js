const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "data", "products.json");

function readProducts() {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeProducts(products) {
  fs.writeFileSync(file, JSON.stringify(products, null, 2), "utf8");
}

function nextId(products) {
  return products.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1;
}

function addProduct(n, p, c, e = "🛒") {
  const products = readProducts();
  const product = { id: nextId(products), n, p: Number(p), c, e, active: true };
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
