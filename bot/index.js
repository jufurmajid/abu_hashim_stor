require("dotenv").config();
const express = require("express");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");
const { readProducts, addProduct, updateProduct, deleteProduct } = require("./store");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("."));

const PORT = Number(process.env.PORT || 3000);
const ADMIN_CHAT_ID = String(process.env.ADMIN_CHAT_ID || "").trim();

function money(n) {
  return Number(n).toLocaleString("ar-IQ") + " د.ع";
}

function isAdmin(msg) {
  return ADMIN_CHAT_ID && String(msg.chat.id) === ADMIN_CHAT_ID;
}

function adminOnly(bot, msg, text) {
  if (!isAdmin(msg)) {
    bot.sendMessage(msg.chat.id, "⛔ هذا البوت مخصص للإدارة فقط.");
    return false;
  }
  if (text) bot.sendMessage(msg.chat.id, text);
  return true;
}

function setupAdminBot() {
  if (!process.env.ADMIN_BOT_TOKEN) return null;
  const bot = new TelegramBot(process.env.ADMIN_BOT_TOKEN, { polling: true });

  bot.onText(/^\/start$/, msg => {
    if (!adminOnly(bot, msg)) return;
    bot.sendMessage(msg.chat.id,
      "🤖 بوت إدارة أبو هاشم\\n\\n" +
      "/products — عرض المنتجات\\n" +
      "/add الاسم | السعر | التصنيف | الإيموجي\\n" +
      "/edit ID | الاسم | السعر | التصنيف | الإيموجي\\n" +
      "/hide ID — إخفاء منتج\\n" +
      "/show ID — إظهار منتج\\n" +
      "/delete ID — حذف منتج"
    );
  });

  bot.onText(/^\/products$/, msg => {
    if (!adminOnly(bot, msg)) return;
    const products = readProducts();
    const text = products.length
      ? products.map(p => `#${p.id} ${p.e} ${p.n} — ${money(p.p)} — ${p.c} — ${p.active ? "ظاهر" : "مخفي"}`).join("\n")
      : "ماكو منتجات.";
    bot.sendMessage(msg.chat.id, text);
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

app.get("/api/products", (req, res) => {
  res.json(readProducts().filter(p => p.active));
});

app.post("/api/orders", async (req, res) => {
  try {
    const { name, phone, address, landmark, items, total } = req.body || {};
    if (!name || !phone || !address || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ ok: false, message: "بيانات الطلب ناقصة." });
    }

    const text =
      "🛒 طلب جديد — أبو هاشم\\n\\n" +
      `👤 الاسم: ${name}\\n` +
      `📱 الهاتف: ${phone}\\n` +
      `📍 العنوان: ${address}\\n` +
      `🧭 النقطة الدالة: ${landmark || "غير محددة"}\\n\\n` +
      "📦 الطلبات:\\n" +
      items.map(x => `• ${x.name} × ${x.qty} = ${money(x.price * x.qty)}`).join("\n") +
      `\\n\\n💰 المجموع: ${money(total)}`;

    if (!ordersBot) return res.status(503).json({ ok: false, message: "بوت الطلبات غير مفعّل بعد." });
    if (!ADMIN_CHAT_ID) return res.status(503).json({ ok: false, message: "لم يتم تحديد Chat ID للاستلام." });

    await ordersBot.sendMessage(ADMIN_CHAT_ID, text);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: "تعذر إرسال الطلب." });
  }
});

app.listen(PORT, () => {
  console.log(`أبو هاشم يعمل على http://localhost:${PORT}`);
  console.log("بوت الإدارة:", adminBot ? "مفعّل" : "غير مفعّل");
  console.log("بوت الطلبات:", ordersBot ? "مفعّل" : "غير مفعّل");
});
