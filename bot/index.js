require("dotenv").config();
const express = require("express");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");
const { readProducts, addProduct, updateProduct, deleteProduct } = require("./store");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("."));

const PORT = Number(process.env.PORT || 3000);
const ADMIN_CHAT_ID = String(process.env.ADMIN_CHAT_ID || "").trim();
const ORDERS_CHAT_ID = String(process.env.ORDERS_CHAT_ID || ADMIN_CHAT_ID).trim();
const ordersFile = path.join(__dirname, "data", "orders.json");

function money(n) {
  return Number(n || 0).toLocaleString("ar-IQ") + " د.ع";
}
function isAdmin(msg) {
  return ADMIN_CHAT_ID && String(msg.chat.id) === ADMIN_CHAT_ID;
}
function adminOnly(bot, msg) {
  if (!isAdmin(msg)) {
    bot.sendMessage(msg.chat.id, "⛔ هذا البوت مخصص للإدارة فقط.");
    return false;
  }
  return true;
}
function readOrders() {
  if (!fs.existsSync(ordersFile)) fs.writeFileSync(ordersFile, "[]", "utf8");
  return JSON.parse(fs.readFileSync(ordersFile, "utf8"));
}
function saveOrder(order) {
  const orders = readOrders();
  orders.push(order);
  fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2), "utf8");
}
function nextOrderId() {
  return readOrders().reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
}
function setupAdminBot() {
  if (!process.env.ADMIN_BOT_TOKEN) return null;
  const bot = new TelegramBot(process.env.ADMIN_BOT_TOKEN, { polling: true });

  bot.onText(/^\/start$/, msg => {
    if (!adminOnly(bot, msg)) return;
    bot.sendMessage(msg.chat.id,
      "🤖 بوت إدارة أبو هاشم\n\n" +
      "/products — عرض المنتجات\n" +
      "/orders — آخر الطلبات\n" +
      "/add الاسم | السعر | التصنيف | الإيموجي\n" +
      "/edit ID | الاسم | السعر | التصنيف | الإيموجي\n" +
      "/hide ID — إخفاء منتج\n" +
      "/show ID — إظهار منتج\n" +
      "/delete ID — حذف منتج"
    );
  });
  bot.onText(/^\/products$/, msg => {
    if (!adminOnly(bot, msg)) return;
    const products = readProducts();
    bot.sendMessage(msg.chat.id, products.length
      ? products.map(p => `#${p.id} ${p.e} ${p.n} — ${money(p.p)} — ${p.c} — ${p.active ? "ظاهر" : "مخفي"}`).join("\n")
      : "ماكو منتجات.");
  });
  bot.onText(/^\/orders$/, msg => {
    if (!adminOnly(bot, msg)) return;
    const orders = readOrders().slice(-10).reverse();
    if (!orders.length) return bot.sendMessage(msg.chat.id, "📭 ماكو طلبات محفوظة.");
    bot.sendMessage(msg.chat.id, orders.map(o =>
      `#${o.id} — ${o.name} — ${money(o.total)} — ${o.status}`
    ).join("\n"));
  });
  bot.onText(/^\/add (.+)$/s, (msg, match) => {
    if (!adminOnly(bot, msg)) return;
    const parts = match[1].split("|").map(x => x.trim());
    if (parts.length < 3) return bot.sendMessage(msg.chat.id, "الصيغة:\n/add الاسم | السعر | التصنيف | الإيموجي");
    const [name, price, category, emoji = "🛒"] = parts;
    if (!name || !Number(price) || !category) return bot.sendMessage(msg.chat.id, "تأكد من الاسم والسعر والتصنيف.");
    const product = addProduct(name, Number(price), category, emoji);
    bot.sendMessage(msg.chat.id, `✅ تمت إضافة #${product.id} — ${product.n} — ${money(product.p)}`);
  });
  bot.onText(/^\/edit (.+)$/s, (msg, match) => {
    if (!adminOnly(bot, msg)) return;
    const parts = match[1].split("|").map(x => x.trim());
    if (parts.length < 4) return bot.sendMessage(msg.chat.id, "الصيغة:\n/edit ID | الاسم | السعر | التصنيف | الإيموجي");
    const [id, name, price, category, emoji = "🛒"] = parts;
    const product = updateProduct(id, { n: name, p: Number(price), c: category, e: emoji });
    bot.sendMessage(msg.chat.id, product ? `✅ تم تعديل #${product.id}` : "❌ المنتج غير موجود.");
  });
  bot.onText(/^\/(hide|show) (\d+)$/, (msg, match) => {
    if (!adminOnly(bot, msg)) return;
    const active = match[1] === "show";
    const product = updateProduct(match[2], { active });
    bot.sendMessage(msg.chat.id, product ? `✅ تم ${active ? "إظهار" : "إخفاء"} المنتج #${product.id}` : "❌ المنتج غير موجود.");
  });
  bot.onText(/^\/delete (\d+)$/, (msg, match) => {
    if (!adminOnly(bot, msg)) return;
    bot.sendMessage(msg.chat.id, deleteProduct(match[1]) ? "🗑️ تم حذف المنتج." : "❌ المنتج غير موجود.");
  });
  return bot;
}
function setupOrdersBot() {
  if (!process.env.ORDERS_BOT_TOKEN) return null;
  const bot = new TelegramBot(process.env.ORDERS_BOT_TOKEN, { polling: true });
  bot.onText(/^\/start$/, msg => bot.sendMessage(msg.chat.id, "📦 هذا بوت استقبال طلبات متجر أبو هاشم."));
  return bot;
}

const adminBot = setupAdminBot();
const ordersBot = setupOrdersBot();

app.get("/api/health", (req, res) => res.json({ ok: true, store: "abu-hashim" }));
app.get("/api/products", (req, res) => res.json(readProducts().filter(p => p.active)));

app.post("/api/orders", async (req, res) => {
  try {
    const { name, phone, address, landmark, items } = req.body || {};
    if (!name?.trim() || !phone?.trim() || !address?.trim() || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ ok: false, message: "بيانات الطلب ناقصة." });
    }
    const products = readProducts().filter(p => p.active);
    const normalizedItems = items.map(x => {
      const product = products.find(p => p.id === Number(x.id));
      const qty = Math.max(1, Math.min(99, Number(x.qty) || 0));
      return product && qty ? { id: product.id, name: product.n, qty, price: product.p } : null;
    }).filter(Boolean);
    if (!normalizedItems.length) return res.status(400).json({ ok: false, message: "المنتجات المطلوبة غير متاحة." });

    const total = normalizedItems.reduce((sum, x) => sum + x.price * x.qty, 0);
    const id = nextOrderId();
    const order = {
      id, name: name.trim(), phone: phone.trim(), address: address.trim(),
      landmark: String(landmark || "").trim(), items: normalizedItems, total,
      status: "جديد", createdAt: new Date().toISOString()
    };
    saveOrder(order);

    if (!ordersBot || !ORDERS_CHAT_ID) {
      return res.status(503).json({ ok: false, message: "بوت الطلبات غير مفعّل بعد." });
    }

    const text =
      `🛒 طلب جديد #${id} — أبو هاشم\n\n` +
      `👤 الاسم: ${order.name}\n📱 الهاتف: ${order.phone}\n📍 العنوان: ${order.address}\n` +
      `🧭 النقطة الدالة: ${order.landmark || "غير محددة"}\n\n📦 الطلبات:\n` +
      normalizedItems.map(x => `• ${x.name} × ${x.qty} = ${money(x.price * x.qty)}`).join("\n") +
      `\n\n💰 المجموع: ${money(total)}`;

    await ordersBot.sendMessage(ORDERS_CHAT_ID, text);
    res.json({ ok: true, orderId: id });
  } catch (error) {
    console.error("order error:", error);
    res.status(500).json({ ok: false, message: "تعذر إرسال الطلب." });
  }
});

app.listen(PORT, () => {
  console.log(`أبو هاشم يعمل على http://localhost:${PORT}`);
  console.log("بوت الإدارة:", adminBot ? "مفعّل" : "غير مفعّل");
  console.log("بوت الطلبات:", ordersBot ? "مفعّل" : "غير مفعّل");
});
