require("dotenv").config();
const express = require("express");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");
const { readProducts, addProduct, updateProduct, deleteProduct } = require("./store");
const fs = require("fs");
const path = require("path");

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const ROOT_DIR = path.join(__dirname, "..");
app.get("/", (req, res) => res.sendFile(path.join(ROOT_DIR, "index.html")));
app.get("/style.css", (req, res) => res.sendFile(path.join(ROOT_DIR, "style.css")));
app.get("/script.js", (req, res) => res.sendFile(path.join(ROOT_DIR, "script.js")));

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
function updateOrderStatus(id, status) {
  const orders = readOrders();
  const order = orders.find(x => Number(x.id) === Number(id));
  if (!order) return null;
  order.status = status;
  order.updatedAt = new Date().toISOString();
  fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2), "utf8");
  return order;
}
function orderText(order) {
  return (
    `🛒 طلب جديد #${order.id} — أبو هاشم\n\n` +
    `👤 الاسم: ${order.name}\n📱 الهاتف: ${order.phone}\n📍 العنوان: ${order.address}\n` +
    `🧭 النقطة الدالة: ${order.landmark || "غير محددة"}\n\n📦 الطلبات:\n` +
    order.items.map(x => `• ${x.name} × ${x.qty} = ${money(x.price * x.qty)}`).join("\n") +
    `\n\n💰 المجموع: ${money(order.total)}\n📌 الحالة: ${order.status}`
  );
}
function orderButtons(order) {
  if (order.status === "جديد") {
    return { inline_keyboard: [[
      { text: "✅ قبول الطلب", callback_data: `order:accept:${order.id}` },
      { text: "❌ رفض", callback_data: `order:reject:${order.id}` }
    ]] };
  }
  if (order.status === "مقبول") {
    return { inline_keyboard: [[
      { text: "📦 تم التجهيز", callback_data: `order:ready:${order.id}` }
    ]] };
  }
  return { inline_keyboard: [] };
}
function setupAdminBot() {
  if (!process.env.ADMIN_BOT_TOKEN) return null;
  const bot = new TelegramBot(process.env.ADMIN_BOT_TOKEN, { polling: true });
  bot.on("polling_error", error => console.error("admin bot polling error:", error.message));

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
    const numericPrice = Number(price);
    if (!name || !Number.isFinite(numericPrice) || numericPrice <= 0 || !category) {
      return bot.sendMessage(msg.chat.id, "تأكد من الاسم والسعر والتصنيف.");
    }
    const product = addProduct(name, numericPrice, category, emoji);
    bot.sendMessage(msg.chat.id, `✅ تمت إضافة #${product.id} — ${product.n} — ${money(product.p)}`);
  });
  bot.onText(/^\/edit (.+)$/s, (msg, match) => {
    if (!adminOnly(bot, msg)) return;
    const parts = match[1].split("|").map(x => x.trim());
    if (parts.length < 4) return bot.sendMessage(msg.chat.id, "الصيغة:\n/edit ID | الاسم | السعر | التصنيف | الإيموجي");
    const [id, name, price, category, emoji = "🛒"] = parts;
    const numericPrice = Number(price);
    if (!name || !Number.isFinite(numericPrice) || numericPrice <= 0 || !category) {
      return bot.sendMessage(msg.chat.id, "تأكد من الاسم والسعر والتصنيف.");
    }
    const product = updateProduct(id, { n: name, p: numericPrice, c: category, e: emoji });
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
  bot.on("polling_error", error => console.error("orders bot polling error:", error.message));
  bot.onText(/^\/start$/, msg => bot.sendMessage(msg.chat.id, "📦 هذا بوت استقبال طلبات متجر أبو هاشم."));
  bot.on("callback_query", async query => {
    try {
      const chatId = String(query.message?.chat?.id || "");
      if (!ORDERS_CHAT_ID || chatId !== ORDERS_CHAT_ID) {
        return bot.answerCallbackQuery(query.id, { text: "⛔ غير مصرح." });
      }
      const parts = String(query.data || "").split(":");
      const statusMap = { accept: "مقبول", reject: "مرفوض", ready: "تم التجهيز" };
      if (parts.length !== 3 || parts[0] !== "order" || !statusMap[parts[1]]) {
        return bot.answerCallbackQuery(query.id, { text: "إجراء غير معروف." });
      }
      const status = statusMap[parts[1]];
      const order = updateOrderStatus(parts[2], status);
      if (!order) return bot.answerCallbackQuery(query.id, { text: "الطلب غير موجود." });
      await bot.editMessageText(orderText(order), {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        reply_markup: orderButtons(order)
      });
      await bot.answerCallbackQuery(query.id, { text: `تم تحديث الطلب إلى: ${status}` });
    } catch (error) {
      console.error("order status error:", error);
      try { await bot.answerCallbackQuery(query.id, { text: "تعذر تحديث الطلب." }); } catch {}
    }
  });
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

    if (!ordersBot || !ORDERS_CHAT_ID) {
      return res.status(503).json({ ok: false, message: "بوت الطلبات غير مفعّل بعد." });
    }

    await ordersBot.sendMessage(ORDERS_CHAT_ID, orderText(order), {
      reply_markup: orderButtons(order)
    });
    saveOrder(order);
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
