const REPO = "jufurmajid/abu_hashim_stor";
const PRODUCTS_RAW = `https://raw.githubusercontent.com/${REPO}/main/data/products.json`;

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      ...extra
    }
  });
}

async function telegram(method, body, env) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`Telegram ${method} failed`);
  return await r.json();
}

async function sendTelegram(text, env, replyMarkup = null) {
  const body = {
    chat_id: env.ORDERS_CHAT_ID,
    text,
    disable_web_page_preview: true
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  return telegram("sendMessage", body, env);
}

function clean(value, max = 500) {
  return String(value ?? "").trim().replace(/[\r\n]+/g, " ").slice(0, max);
}

function money(n) {
  return Number(n || 0).toLocaleString("ar-IQ") + " د.ع";
}

function orderButtons(orderId) {
  return {
    inline_keyboard: [
      [
        { text: "✅ قبول الطلب", callback_data: `accept:${orderId}` },
        { text: "❌ رفض الطلب", callback_data: `reject:${orderId}` }
      ],
      [
        { text: "📦 قيد التجهيز", callback_data: `preparing:${orderId}` },
        { text: "🚚 تم التوصيل", callback_data: `delivered:${orderId}` }
      ]
    ]
  };
}

function statusText(action) {
  return {
    accept: "✅ تم قبول الطلب",
    reject: "❌ تم رفض الطلب",
    preparing: "📦 الطلب قيد التجهيز",
    delivered: "🚚 تم تسجيل الطلب كمُسلَّم"
  }[action] || "تم تحديث حالة الطلب";
}

async function loadProducts() {
  const r = await fetch(PRODUCTS_RAW, { headers: { "cache-control": "no-cache" } });
  if (!r.ok) throw new Error("Products read failed");
  return await r.json();
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type"
      }
    });

    if (request.method !== "POST") {
      if (request.method === "GET" && new URL(request.url).pathname === "/setup") {
        const webhookUrl = new URL(request.url).origin + "/";
        const result = await telegram("setWebhook", {
          url: webhookUrl,
          allowed_updates: ["message", "callback_query"]
        }, env);
        return json({
          ok: true,
          webhook: result.result === true,
          description: result.description || ""
        });
      }
      return json({ ok: true, service: "abu-hashim-order-bot" });
    }

    try {
      const update = await request.json();

      // Ensure Telegram webhook is configured whenever Telegram sends an update.
      if (update.callback_query || update.message) {
        const webhookUrl = new URL(request.url).origin + "/";
        await telegram("setWebhook", {
          url: webhookUrl,
          allowed_updates: ["message", "callback_query"]
        }, env);
      }

      if (update.callback_query) {
        const callback = update.callback_query;
        const chatId = callback.message?.chat?.id;
        const data = String(callback.data || "");
        const [action, orderId] = data.split(":");

        if (String(chatId) !== String(env.ORDERS_CHAT_ID)) {
          await telegram("answerCallbackQuery", {
            callback_query_id: callback.id,
            text: "غير مسموح",
            show_alert: true
          }, env);
          return json({ ok: true });
        }

        if (!["accept", "reject", "preparing", "delivered"].includes(action) || !orderId) {
          await telegram("answerCallbackQuery", {
            callback_query_id: callback.id,
            text: "أمر غير معروف",
            show_alert: true
          }, env);
          return json({ ok: true });
        }

        await telegram("answerCallbackQuery", {
          callback_query_id: callback.id,
          text: statusText(action)
        }, env);

        await telegram("editMessageReplyMarkup", {
          chat_id: chatId,
          message_id: callback.message.message_id,
          reply_markup: { inline_keyboard: [] }
        }, env);

        await sendTelegram(
          `${statusText(action)} — ${orderId}`,
          env
        );

        return json({ ok: true });
      }

      const body = update;
      const name = clean(body.name, 100);
      const phone = clean(body.phone, 40);
      const address = clean(body.address, 300);
      const landmark = clean(body.landmark, 200);
      const incomingItems = Array.isArray(body.items) ? body.items.slice(0, 30) : [];

      if (!name || !phone || !address || !incomingItems.length) {
        return json({ ok: false, error: "بيانات الطلب ناقصة" }, 400);
      }

      const products = await loadProducts();
      const items = [];
      let total = 0;

      for (const item of incomingItems) {
        const id = Number(item.id);
        const qty = Math.max(1, Math.min(99, Number(item.qty)));
        const product = products.find(p => Number(p.id) === id && p.active !== false);
        if (!product || !Number.isFinite(qty)) continue;

        const price = Number(product.p);
        if (!Number.isFinite(price) || price < 0) continue;

        items.push({
          id,
          name: clean(product.n, 120),
          qty,
          price
        });
        total += price * qty;
      }

      if (!items.length) return json({ ok: false, error: "المنتجات غير صالحة أو غير متاحة" }, 400);

      const orderId = "AH-" + Date.now().toString(36).toUpperCase();
      const lines = items.map(x => `• ${x.name} × ${x.qty} = ${money(x.price * x.qty)}`).join("\n");
      const text =
        `🛒 طلب جديد — أبو هاشم\n\n` +
        `🆔 رقم الطلب: ${orderId}\n` +
        `👤 الاسم: ${name}\n` +
        `📱 الهاتف: ${phone}\n` +
        `📍 العنوان: ${address}\n` +
        `🧭 النقطة الدالة: ${landmark || "غير محددة"}\n\n` +
        `📦 الطلبات:\n${lines}\n\n` +
        `💰 المجموع: ${money(total)}`;

      await sendTelegram(text, env, orderButtons(orderId));
      return json({ ok: true, orderId });
    } catch (e) {
      return json({ ok: false, error: "تعذر إرسال الطلب حالياً" }, 500);
    }
  }
};
