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

async function sendTelegram(text, env) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: env.ORDERS_CHAT_ID,
      text,
      disable_web_page_preview: true
    })
  });
  if (!r.ok) throw new Error("Telegram send failed");
}

function clean(value, max = 500) {
  return String(value ?? "").trim().replace(/[\\r\\n]+/g, " ").slice(0, max);
}

function money(n) {
  return Number(n || 0).toLocaleString("ar-IQ") + " د.ع";
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

    if (request.method !== "POST") return json({ ok: true, service: "abu-hashim-order-bot" });

    try {
      const body = await request.json();
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
      const lines = items.map(x => `• ${x.name} × ${x.qty} = ${money(x.price * x.qty)}`).join("\\n");
      const text =
        `🛒 طلب جديد — أبو هاشم\\n\\n` +
        `🆔 رقم الطلب: ${orderId}\\n` +
        `👤 الاسم: ${name}\\n` +
        `📱 الهاتف: ${phone}\\n` +
        `📍 العنوان: ${address}\\n` +
        `🧭 النقطة الدالة: ${landmark || "غير محددة"}\\n\\n` +
        `📦 الطلبات:\\n${lines}\\n\\n` +
        `💰 المجموع: ${money(total)}`;

      await sendTelegram(text, env);
      return json({ ok: true, orderId });
    } catch (e) {
      return json({ ok: false, error: "تعذر إرسال الطلب حالياً" }, 500);
    }
  }
};
