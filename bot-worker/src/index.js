const REPO = "jufurmajid/abu_hashim_stor";
const PRODUCTS_PATH = "data/products.json";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function tg(method, body, env) {
  return fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function encodeUtf8Base64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function githubGet(env) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${PRODUCTS_PATH}?ref=main`, {
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "abu-hashim-admin-bot"
    }
  });

  if (!r.ok) {
    throw new Error(`GitHub read failed: ${r.status}`);
  }

  const data = await r.json();
  const content = decodeBase64Utf8(data.content);
  return { products: JSON.parse(content), sha: data.sha };
}

async function githubSave(products, sha, message, env) {
  const content = encodeUtf8Base64(JSON.stringify(products, null, 2) + "\n");

  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${PRODUCTS_PATH}`, {
    method: "PUT",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "abu-hashim-admin-bot",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message,
      content,
      sha,
      branch: "main"
    })
  });

  if (!r.ok) {
    const body = await r.text();
    throw new Error(`GitHub write failed (${r.status}): ${body.slice(0, 500)}`);
  }
}

async function send(chatId, text, env) {
  await tg("sendMessage", { chat_id: chatId, text }, env);
}

function help() {
  return `🛠️ أبو هاشم — إدارة المنتجات

➕ إضافة:
 /add لحم عجل 16000
 /add حليب طازج السعر 2500

✏️ تعديل:
 /edit رقم | الاسم | السعر | التصنيف | الإيموجي

👁️ /hide رقم
👁️ /show رقم
🗑️ /delete رقم
📦 /list
ℹ️ /help`;
}

function detectCategory(name) {
  if (/لحم|دجاج|كباب|ستيك/i.test(name)) return "لحوم";
  if (/حليب|لبن|روب|قشطة/i.test(name)) return "ألبان";
  if (/جبن|جبنة|قشقوان/i.test(name)) return "أجبان";
  return "عام";
}

function parsePrice(value) {
  const normalized = value
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[,،]/g, "")
    .replace(/\s+/g, "");
  return Number(normalized);
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("OK");

    const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response("Bad JSON", { status: 400 });
    }

    const msg = update.message;
    if (!msg?.chat?.id || !msg?.text) return new Response("OK");
    if (String(msg.chat.id) !== String(env.ADMIN_CHAT_ID)) return new Response("OK");

    const text = msg.text.trim();
    const chatId = msg.chat.id;

    try {
      if (text === "/start" || text === "/help") {
        await send(chatId, help(), env);
        return new Response("OK");
      }

      const { products, sha } = await githubGet(env);

      if (text === "/list") {
        const lines = products.map(p =>
          `${p.active === false ? "🔴" : "🟢"} #${p.id} — ${p.n} — ${Number(p.p).toLocaleString("ar-IQ")} د.ع`
        );
        await send(
          chatId,
          lines.length ? "📦 المنتجات:\n\n" + lines.join("\n") : "📦 ماكو منتجات.",
          env
        );
        return new Response("OK");
      }

      if (text === "/add") {
        await send(
          chatId,
          "➕ اكتب المنتج والسعر بسطر واحد:\n\n/add لحم عجل 16000\n/add حليب طازج السعر 2500",
          env
        );
        return new Response("OK");
      }

      if (text.startsWith("/add ")) {
        const input = text.slice(5).trim();
        let name = "";
        let priceRaw = "";

        const pipeParts = input.split("|").map(x => x.trim()).filter(Boolean);

        if (pipeParts.length >= 2) {
          name = pipeParts[0];
          priceRaw = pipeParts[1];
        } else {
          const priceMatch = input.match(/(?:السعر\s*)?([0-9٠-٩]+(?:[.,،][0-9٠-٩]+)?)\s*(?:د\.?ع|دينار)?\s*$/i);
          if (priceMatch) {
            name = input.slice(0, priceMatch.index).trim();
            name = name.replace(/السعر\s*$/i, "").trim();
            priceRaw = priceMatch[1];
          }
        }

        const price = parsePrice(priceRaw);

        if (!name || !Number.isFinite(price) || price <= 0) {
          await send(
            chatId,
            "❌ ما فهمت المنتج والسعر.\n\nاكتب مثلاً:\n/add لحم عجل 16000\nأو\n/add لحم عجل السعر 16000",
            env
          );
          return new Response("OK");
        }

        const category = pipeParts.length >= 3 ? pipeParts[2] : detectCategory(name);
        const emoji = pipeParts.length >= 4 ? pipeParts[3] : "🛒";
        const id = products.length
          ? Math.max(...products.map(p => Number(p.id) || 0)) + 1
          : 1;

        products.push({
          id,
          n: name,
          p: Math.round(price),
          c: category,
          e: emoji,
          active: true
        });

        await githubSave(products, sha, `إضافة منتج #${id}: ${name}`, env);
        await send(
          chatId,
          `✅ تمت إضافة #${id} — ${name} — ${Math.round(price).toLocaleString("ar-IQ")} د.ع`,
          env
        );
        return new Response("OK");
      }

      if (text.startsWith("/edit ")) {
        const parts = text.slice(6).split("|").map(x => x.trim());
        if (parts.length < 4) {
          await send(chatId, "❌ الصيغة:\n/edit رقم | الاسم | السعر | التصنيف | الإيموجي", env);
          return new Response("OK");
        }

        const id = Number(parts[0]);
        const price = parsePrice(parts[2]);
        const p = products.find(x => Number(x.id) === id);

        if (!p || !Number.isFinite(price) || price <= 0) {
          await send(chatId, "❌ المنتج غير موجود أو السعر غير صحيح.", env);
          return new Response("OK");
        }

        p.n = parts[1];
        p.p = Math.round(price);
        p.c = parts[3];
        p.e = parts[4] || p.e || "🛒";

        await githubSave(products, sha, `تعديل المنتج #${id}: ${p.n}`, env);
        await send(chatId, `✅ تم تعديل المنتج #${id}`, env);
        return new Response("OK");
      }

      const one = text.match(/^\/(hide|show|delete)\s+(\d+)$/);

      if (one) {
        const action = one[1];
        const id = Number(one[2]);
        const index = products.findIndex(x => Number(x.id) === id);

        if (index < 0) {
          await send(chatId, "❌ المنتج غير موجود.", env);
          return new Response("OK");
        }

        if (action === "hide") products[index].active = false;
        if (action === "show") products[index].active = true;
        if (action === "delete") products.splice(index, 1);

        await githubSave(products, sha, `${action} المنتج #${id}`, env);

        await send(
          chatId,
          action === "delete"
            ? `🗑️ تم حذف #${id}`
            : action === "hide"
              ? `🔴 تم إخفاء #${id}`
              : `🟢 تم إظهار #${id}`,
          env
        );

        return new Response("OK");
      }

      await send(chatId, "❓ الأمر غير معروف. اكتب /help", env);
      return new Response("OK");
    } catch (e) {
      console.error("Admin bot error:", e);
      await send(
        chatId,
        "⚠️ صار خطأ أثناء تحديث GitHub. جرّب مرة ثانية.",
        env
      );
      return new Response("OK");
    }
  }
};
