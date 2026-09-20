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

function encodeBytesBase64(bytes) {
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
  if (!r.ok) throw new Error(`GitHub read failed: ${r.status}`);
  const data = await r.json();
  return {
    products: JSON.parse(decodeBase64Utf8(data.content)),
    sha: data.sha
  };
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
    body: JSON.stringify({ message, content, sha, branch: "main" })
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`GitHub write failed (${r.status}): ${body.slice(0, 500)}`);
  }
}

async function githubUpload(path, bytes, message, env) {
  const content = encodeBytesBase64(bytes);
  const base = `https://api.github.com/repos/${REPO}/contents/${path}`;
  const headers = {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
    "User-Agent": "abu-hashim-admin-bot",
    "Content-Type": "application/json"
  };
  const existing = await fetch(`${base}?ref=main`, { headers });
  const payload = { message, content, branch: "main" };
  if (existing.ok) {
    const data = await existing.json();
    if (data.sha) payload.sha = data.sha;
  } else if (existing.status !== 404) {
    const body = await existing.text();
    throw new Error(`Image check failed (${existing.status}): ${body.slice(0, 500)}`);
  }
  const r = await fetch(base, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload)
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Image upload failed (${r.status}): ${body.slice(0, 500)}`);
  }
}

async function getTelegramPhotoBytes(fileId, env) {
  const r = await tg("getFile", { file_id: fileId }, env);
  const data = await r.json();
  if (!data.ok || !data.result?.file_path) throw new Error("Telegram image download failed");
  const image = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`);
  if (!image.ok) throw new Error("Telegram image fetch failed");
  return new Uint8Array(await image.arrayBuffer());
}

async function send(chatId, text, env) {
  await tg("sendMessage", { chat_id: chatId, text }, env);
}

function detectCategory(name) {
  if (/لحم|دجاج|كباب|ستيك/i.test(name)) return "لحوم";
  if (/حليب|لبن|روب|قشطة/i.test(name)) return "ألبان";
  if (/جبن|جبنة|قشقوان/i.test(name)) return "أجبان";
  return "عام";
}

function parsePrice(value) {
  const normalized = String(value || "")
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[,،]/g, "")
    .replace(/\s+/g, "");
  return Number(normalized);
}

function parseProductInput(input) {
  let text = String(input || "").trim().replace(/^\/add\s*/i, "").trim();
  const parts = text.split("|").map(x => x.trim()).filter(Boolean);
  let name = "";
  let priceRaw = "";

  if (parts.length >= 2) {
    name = parts[0];
    priceRaw = parts[1];
  } else {
    const match = text.match(/(?:السعر\s*)?([0-9٠-٩]+(?:[.,،][0-9٠-٩]+)?)\s*(?:د\.?ع|دينار)?\s*$/i);
    if (match) {
      name = text.slice(0, match.index).trim().replace(/السعر\s*$/i, "").trim();
      priceRaw = match[1];
    }
  }

  const price = parsePrice(priceRaw);
  if (!name || !Number.isFinite(price) || price <= 0) return null;

  return {
    name,
    price: Math.round(price),
    category: parts.length >= 3 ? parts[2] : detectCategory(name),
    emoji: parts.length >= 4 ? parts[3] : "🛒"
  };
}

function adminHelp() {
  return `🛠️ إدارة أبو هاشم — بسيطة جداً

📸 لإضافة منتج:
أرسل صورة المنتج واكتب بالسطر نفسه:
لحم غنم 18000

مثال:
📷 صورة + "حليب طازج 2500"

البوت يحفظ الصورة والاسم والسعر تلقائياً.

📦 /list — عرض المنتجات
🗑️ /delete 1 — حذف منتج
👁️ /hide 1 — إخفاء
👁️ /show 1 — إظهار

إذا تريد إضافة منتج جديد: فقط صورة + الاسم + السعر.`;
}async function sendMenu(chatId, env) {
  await tg("sendMessage", {
    chat_id: chatId,
    text: "🛍️ لوحة إدارة أبو هاشم\\n\\nاختار شتريد تسوي:",
    reply_markup: adminMenu()
  }, env);
}

function adminMenu() {
  return {
    inline_keyboard: [
      [{ text: "📦 المنتجات", callback_data: "list" }],
      [{ text: "➕ إضافة منتج", callback_data: "add" }],
      [{ text: "👁️ إخفاء منتج", callback_data: "hide_menu" }, { text: "🟢 إظهار منتج", callback_data: "show_menu" }],
      [{ text: "🗑️ حذف منتج", callback_data: "delete_menu" }],
      [{ text: "❓ المساعدة", callback_data: "help" }]
    ]
  };
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

    const callback = update.callback_query;
    if (callback?.message?.chat?.id) {
      if (String(callback.message.chat.id) !== String(env.ADMIN_CHAT_ID)) return new Response("OK");
      const chatId = callback.message.chat.id;
      const data = callback.data || "";
      await tg("answerCallbackQuery", { callback_query_id: callback.id }, env);
      try {
        const { products, sha } = await githubGet(env);
        if (data === "menu") { await sendMenu(chatId, env); return new Response("OK"); }
        if (data === "help") { await send(chatId, adminHelp(), env); await sendMenu(chatId, env); return new Response("OK"); }
        if (data === "add") { await send(chatId, "📸 أرسل صورة المنتج واكتب وياها الاسم والسعر.\nمثال: صورة + لحم غنم 18000", env); return new Response("OK"); }
        if (data === "list") {
          const lines = products.map(p => (p.active === false ? "🔴" : "🟢") + " #" + p.id + " — " + p.n + " — " + Number(p.p).toLocaleString("ar-IQ") + " د.ع");
          await send(chatId, lines.length ? "📦 المنتجات:\n\n" + lines.join("\n") : "📦 المتجر فارغ حالياً.", env);
          await sendMenu(chatId, env); return new Response("OK");
        }
        const menuMatch = data.match(/^(hide_menu|show_menu|delete_menu)$/);
        if (menuMatch) {
          const action = menuMatch[1].replace("_menu", "");
          if (!products.length) { await send(chatId, "📦 ماكو منتجات حالياً.", env); await sendMenu(chatId, env); return new Response("OK"); }
          const buttons = products.map(p => [{ text: (p.active === false ? "🔴" : "🟢") + " #" + p.id + " — " + p.n, callback_data: action + ":" + p.id }]);
          buttons.push([{ text: "⬅️ رجوع", callback_data: "menu" }]);
          await tg("sendMessage", { chat_id: chatId, text: action === "delete" ? "🗑️ اختار المنتج اللي تريد تحذفه:" : action === "hide" ? "👁️ اختار المنتج اللي تريد تخفيه:" : "🟢 اختار المنتج اللي تريد تظهره:", reply_markup: { inline_keyboard: buttons } }, env);
          return new Response("OK");
        }
        const actionMatch = data.match(/^(hide|show|delete):(\d+)$/);
        if (actionMatch) {
          const action = actionMatch[1], id = Number(actionMatch[2]);
          const index = products.findIndex(x => Number(x.id) === id);
          if (index < 0) { await send(chatId, "❌ المنتج غير موجود.", env); return new Response("OK"); }
          if (action === "delete") {
            const p = products[index];
            await tg("sendMessage", { chat_id: chatId, text: "⚠️ تأكيد حذف المنتج #" + id + " — " + p.n + "\n\nاختار نعم أو لا:", reply_markup: { inline_keyboard: [[{ text: "✅ نعم، احذف", callback_data: "confirm_delete:" + id }], [{ text: "❌ لا، إلغاء", callback_data: "menu" }]] } }, env);
            return new Response("OK");
          }
          products[index].active = action === "show";
          await githubSave(products, sha, action + " المنتج #" + id, env);
          await send(chatId, (action === "show" ? "🟢 تم إظهار #" : "🔴 تم إخفاء #") + id + " — " + products[index].n, env);
          await sendMenu(chatId, env); return new Response("OK");
        }
        const confirm = data.match(/^confirm_delete:(\d+)$/);
        if (confirm) {
          const id = Number(confirm[1]);
          const index = products.findIndex(x => Number(x.id) === id);
          if (index < 0) { await send(chatId, "❌ المنتج غير موجود.", env); return new Response("OK"); }
          const name = products[index].n; products.splice(index, 1);
          await githubSave(products, sha, "حذف المنتج #" + id, env);
          await send(chatId, "🗑️ تم حذف المنتج #" + id + " — " + name, env);
          await sendMenu(chatId, env); return new Response("OK");
        }
      } catch (e) { await send(chatId, "⚠️ صار خطأ:\n" + (e?.message || "خطأ غير معروف").slice(0, 900), env); }
      return new Response("OK");
    }
    const msg = update.message;
    if (!msg?.chat?.id) return new Response("OK");
    if (String(msg.chat.id) !== String(env.ADMIN_CHAT_ID)) return new Response("OK");

    const chatId = msg.chat.id;
    const text = (msg.text || msg.caption || "").trim();

    try {
      if (text === "/start" || text === "/help") {
        await sendMenu(chatId, env);
        return new Response("OK");
      }

      const { products, sha } = await githubGet(env);

      if (text === "/list") {
        const lines = products.map(p =>
          `${p.active === false ? "🔴" : "🟢"} #${p.id} — ${p.n} — ${Number(p.p).toLocaleString("ar-IQ")} د.ع`
        );
        await send(chatId, lines.length ? "📦 المنتجات:\n\n" + lines.join("\n") : "📦 المتجر فارغ حالياً.", env);
        return new Response("OK");
      }

      const photo = msg.photo?.length ? msg.photo[msg.photo.length - 1] : null;

      if (photo) {
        const product = parseProductInput(text);
        if (!product) {
          await send(chatId, "❌ ارسل صورة واكتب بالوصف: اسم المنتج + السعر\nمثال: لحم غنم 18000", env);
          return new Response("OK");
        }

        const id = products.length ? Math.max(...products.map(p => Number(p.id) || 0)) + 1 : 1;
        const imagePath = `data/products/${id}.jpg`;
        const bytes = await getTelegramPhotoBytes(photo.file_id, env);

        if (bytes.byteLength > 8 * 1024 * 1024) {
          await send(chatId, "❌ الصورة كبيرة جداً. أرسل صورة أقل من 8MB.", env);
          return new Response("OK");
        }

        await githubUpload(imagePath, bytes, `إضافة صورة المنتج #${id}`, env);

        products.push({
          id,
          n: product.name,
          p: product.price,
          c: product.category,
          e: product.emoji,
          image: imagePath,
          active: true
        });

        await githubSave(products, sha, `إضافة المنتج #${id}: ${product.name}`, env);
        await send(chatId, `✅ تمت إضافة المنتج #${id}\n📦 ${product.name}\n💰 ${product.price.toLocaleString("ar-IQ")} د.ع\n🖼️ الصورة محفوظة وتظهر بالمتجر.`, env);
        return new Response("OK");
      }

      if (text === "/add") {
        await send(chatId, "📸 أسهل طريقة:\nأرسل صورة المنتج واكتب وياها الاسم والسعر.\n\nمثال:\nصورة + لحم عجل 16000", env);
        return new Response("OK");
      }

      if (text.startsWith("/add ")) {
        const product = parseProductInput(text);
        if (!product) {
          await send(chatId, "❌ اكتب مثلاً:\n/add لحم عجل 16000\n\nوالأفضل: صورة + الاسم والسعر.", env);
          return new Response("OK");
        }

        const id = products.length ? Math.max(...products.map(p => Number(p.id) || 0)) + 1 : 1;
        products.push({
          id,
          n: product.name,
          p: product.price,
          c: product.category,
          e: product.emoji,
          active: true
        });

        await githubSave(products, sha, `إضافة المنتج #${id}: ${product.name}`, env);
        await send(chatId, `✅ تمت إضافة #${id} — ${product.name} — ${product.price.toLocaleString("ar-IQ")} د.ع`, env);
        return new Response("OK");
      }

      const replyText = msg.reply_to_message?.text || "";
      const deleteReply = replyText.match(/تأكيد حذف المنتج #([0-9]+)/);

      if (deleteReply && /^(نعم|نعم\s*،?\s*احذف|لا)$/i.test(text)) {
        const id = Number(deleteReply[1]);
        const index = products.findIndex(x => Number(x.id) === id);

        if (text.startsWith("لا")) {
          await send(chatId, "❎ تم إلغاء الحذف.", env);
          return new Response("OK");
        }

        if (index < 0) {
          await send(chatId, "❌ المنتج غير موجود.", env);
          return new Response("OK");
        }

        const productName = products[index].n;
        products.splice(index, 1);
        await githubSave(products, sha, `حذف المنتج #${id}`, env);
        await send(chatId, `🗑️ تم حذف المنتج #${id} — ${productName}`, env);
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

        if (action === "delete") {
          const p = products[index];
          await tg("sendMessage", {
            chat_id: chatId,
            text: `⚠️ تأكيد حذف المنتج #${id} — ${p.n}\\n\\nاكتب «نعم» للحذف أو «لا» للإلغاء.`,
            reply_markup: { force_reply: true, input_field_placeholder: "نعم أو لا" }
          }, env);
          return new Response("OK");
        }

        if (action === "hide") products[index].active = false;
        if (action === "show") products[index].active = true;

        await githubSave(products, sha, `${action} المنتج #${id}`, env);
        await send(chatId, action === "hide" ? `🔴 تم إخفاء #${id}` : `🟢 تم إظهار #${id}`, env);
        return new Response("OK");
      }

      await send(chatId, "❓ اكتب /help لمعرفة طريقة الإدارة.", env);
      return new Response("OK");
    } catch (e) {
      console.error("Admin bot error:", e);
      await send(chatId, "⚠️ صار خطأ:\n" + (e?.message || "خطأ غير معروف").slice(0, 900), env);
      return new Response("OK");
    }
  }
};
