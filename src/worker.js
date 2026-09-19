const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8"}});
const money=n=>Number(n||0).toLocaleString("ar-IQ")+" د.ع";
const text=v=>String(v??"").trim();
const esc=v=>text(v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const tg=async(env,token,method,body)=>{const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const d=await r.json();if(!d.ok)throw new Error(d.description||"Telegram API error");return d.result};
const orderButtons=o=>o.status==="جديد"?{inline_keyboard:[[{text:"✅ قبول الطلب",callback_data:`order:accept:${o.id}`},{text:"❌ رفض",callback_data:`order:reject:${o.id}`}]]}:o.status==="مقبول"?{inline_keyboard:[[{text:"📦 تم التجهيز",callback_data:`order:ready:${o.id}`}]]}:{inline_keyboard:[]};
const orderText=o=>"🛒 طلب جديد #"+o.id+" — أبو هاشم\n\n"+"👤 الاسم: "+o.name+"\n📱 الهاتف: "+o.phone+"\n📍 العنوان: "+o.address+"\n🧭 النقطة الدالة: "+(o.landmark||"غير محددة")+"\n\n📦 الطلبات:\n"+o.items.map(x=>`• ${x.name} × ${x.qty} = ${money(x.price*x.qty)}`).join("\n")+"\n\n💰 المجموع: "+money(o.total)+"\n📌 الحالة: "+o.status;
function allowed(update,chatId){return String(update?.message?.chat?.id||update?.callback_query?.message?.chat?.id||"")===String(chatId||"")}
async function admin(env,update){
  const m=update.message;if(!m||!allowed(update,env.ADMIN_CHAT_ID))return;
  const chat_id=m.chat.id, body=text(m.text);
  if(body==="/start")return tg(env,env.ADMIN_BOT_TOKEN,"sendMessage",{chat_id,text:"🤖 بوت إدارة أبو هاشم\n\n/products — عرض المنتجات\n/orders — آخر الطلبات\n/add الاسم | السعر | التصنيف | الإيموجي\n/edit ID | الاسم | السعر | التصنيف | الإيموجي\n/hide ID\n/show ID\n/delete ID"});
  if(body==="/products"){const r=await env.DB.prepare("SELECT id,name,price,category,emoji,active FROM products ORDER BY id").all();return tg(env,env.ADMIN_BOT_TOKEN,"sendMessage",{chat_id,text:r.results.length?r.results.map(p=>`#${p.id} ${p.emoji} ${p.name} — ${money(p.price)} — ${p.category} — ${p.active?"ظاهر":"مخفي"}`).join("\n"):"ماكو منتجات."})}
  if(body==="/orders"){const r=await env.DB.prepare("SELECT id,name,total,status FROM orders ORDER BY id DESC LIMIT 10").all();return tg(env,env.ADMIN_BOT_TOKEN,"sendMessage",{chat_id,text:r.results.length?r.results.map(o=>`#${o.id} — ${o.name} — ${money(o.total)} — ${o.status}`).join("\n"):"📭 ماكو طلبات محفوظة."})}
  let q;
  if((q=body.match(/^\/add\s+(.+)$/s))){const p=q[1].split("|").map(text);if(p.length<3)return tg(env,env.ADMIN_BOT_TOKEN,"sendMessage",{chat_id,text:"الصيغة: /add الاسم | السعر | التصنيف | الإيموجي"});const price=Number(p[1]);if(!p[0]||!Number.isFinite(price)||price<=0||!p[2])return tg(env,env.ADMIN_BOT_TOKEN,"sendMessage",{chat_id,text:"تأكد من الاسم والسعر والتصنيف."});const r=await env.DB.prepare("INSERT INTO products(name,price,category,emoji,active) VALUES(?,?,?,?,1)").bind(p[0],price,p[2],p[3]||"🛒").run();return tg(env,env.ADMIN_BOT_TOKEN,"sendMessage",{chat_id,text:`✅ تمت إضافة #${r.meta.last_row_id} — ${p[0]} — ${money(price)}`})}
  if((q=body.match(/^\/edit\s+(.+)$/s))){const p=q[1].split("|").map(text);if(p.length<4)return tg(env,env.ADMIN_BOT_TOKEN,"sendMessage",{chat_id,text:"الصيغة: /edit ID | الاسم | السعر | التصنيف | الإيموجي"});const price=Number(p[2]);if(!Number.isFinite(price)||price<=0||!p[1]||!p[3])return tg(env,env.ADMIN_BOT_TOKEN,"sendMessage",{chat_id,text:"تأكد من البيانات."});const r=await env.DB.prepare("UPDATE products SET name=?,price=?,category=?,emoji=? WHERE id=?").bind(p[1],price,p[3],p[4]||"🛒",Number(p[0])).run();return tg(env,env.ADMIN_BOT_TOKEN,"sendMessage",{chat_id,text:r.meta.changes?`✅ تم تعديل #${p[0]}`:"❌ المنتج غير موجود."})}
  if((q=body.match(/^\/(hide|show)\s+(\d+)$/))){const active=q[1]==="show"?1:0;const r=await env.DB.prepare("UPDATE products SET active=? WHERE id=?").bind(active,Number(q[2])).run();return tg(env,env.ADMIN_BOT_TOKEN,"sendMessage",{chat_id,text:r.meta.changes?`✅ تم ${active?"إظهار":"إخفاء"} المنتج #${q[2]}`:"❌ المنتج غير موجود."})}
  if((q=body.match(/^\/delete\s+(\d+)$/))){const r=await env.DB.prepare("DELETE FROM products WHERE id=?").bind(Number(q[1])).run();return tg(env,env.ADMIN_BOT_TOKEN,"sendMessage",{chat_id,text:r.meta.changes?"🗑️ تم حذف المنتج.":"❌ المنتج غير موجود."})}
}
async function orders(env,update){
  const q=update.callback_query;if(!q)return;
  if(!allowed(update,env.ORDERS_CHAT_ID))return tg(env,env.ORDERS_BOT_TOKEN,"answerCallbackQuery",{callback_query_id:q.id,text:"⛔ غير مصرح."});
  const p=text(q.data).split(":");const map={accept:"مقبول",reject:"مرفوض",ready:"تم التجهيز"};
  if(p.length!==3||p[0]!=="order"||!map[p[1]])return tg(env,env.ORDERS_BOT_TOKEN,"answerCallbackQuery",{callback_query_id:q.id,text:"إجراء غير معروف."});
  const id=Number(p[2]),status=map[p[1]];const r=await env.DB.prepare("UPDATE orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,id).run();
  if(!r.meta.changes)return tg(env,env.ORDERS_BOT_TOKEN,"answerCallbackQuery",{callback_query_id:q.id,text:"الطلب غير موجود."});
  const o=await getOrder(env,id);await tg(env,env.ORDERS_BOT_TOKEN,"editMessageText",{chat_id:q.message.chat.id,message_id:q.message.message_id,text:orderText(o),reply_markup:orderButtons(o)});return tg(env,env.ORDERS_BOT_TOKEN,"answerCallbackQuery",{callback_query_id:q.id,text:"تم تحديث الطلب إلى: "+status});
}
async function getOrder(env,id){const o=(await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first());if(!o)return null;const items=await env.DB.prepare("SELECT product_id AS id,product_name AS name,qty,price FROM order_items WHERE order_id=?").bind(id).all();return {...o,items:items.results||[]}}
async function handleOrder(env,req){
  const b=await req.json(),name=text(b.name),phone=text(b.phone),address=text(b.address),landmark=text(b.landmark);
  if(!name||!phone||!address||!Array.isArray(b.items)||!b.items.length)return json({ok:false,message:"بيانات الطلب ناقصة."},400);
  const ids=[...new Set(b.items.map(x=>Number(x.id)).filter(Number.isInteger))];if(!ids.length)return json({ok:false,message:"المنتجات المطلوبة غير متاحة."},400);
  const marks=ids.map(()=>"?").join(",");const pr=(await env.DB.prepare(`SELECT id,name,price FROM products WHERE active=1 AND id IN (${marks})`).bind(...ids).all()).results||[];
  const normalized=b.items.map(x=>{const p=pr.find(y=>y.id===Number(x.id));const qty=Math.max(1,Math.min(99,Number(x.qty)||0));return p&&qty?{id:p.id,name:p.name,qty,price:p.price}:null}).filter(Boolean);
  if(!normalized.length)return json({ok:false,message:"المنتجات المطلوبة غير متاحة."},400);
  const total=normalized.reduce((s,x)=>s+x.price*x.qty,0);
  const ins=await env.DB.prepare("INSERT INTO orders(name,phone,address,landmark,total,status) VALUES(?,?,?,?,?,?)").bind(name,phone,address,landmark,total,"جديد").run();
  const id=ins.meta.last_row_id;const stmts=normalized.map(x=>env.DB.prepare("INSERT INTO order_items(order_id,product_id,product_name,qty,price) VALUES(?,?,?,?,?)").bind(id,x.id,x.name,x.qty,x.price));await env.DB.batch(stmts);
  const order={id,name,phone,address,landmark,total,status:"جديد",items:normalized};
  try{await tg(env,env.ORDERS_BOT_TOKEN,"sendMessage",{chat_id:env.ORDERS_CHAT_ID,text:orderText(order),reply_markup:orderButtons(order)});return json({ok:true,orderId:id})}catch(e){await env.DB.prepare("UPDATE orders SET status='فشل الإرسال' WHERE id=?").bind(id).run();return json({ok:false,message:"تعذر إرسال الطلب حالياً."},503)}
}
export default {async fetch(request,env){
  const u=new URL(request.url);
  try{
    if(request.method==="GET"&&u.pathname==="/api/health")return json({ok:true,store:"abu-hashim",platform:"cloudflare"});
    if(request.method==="GET"&&u.pathname==="/api/products"){const r=await env.DB.prepare("SELECT id,name AS n,price AS p,category AS c,emoji AS e FROM products WHERE active=1 ORDER BY id").all();return json(r.results||[])}
    if(request.method==="POST"&&u.pathname==="/api/orders")return await handleOrder(env,request);
    if(request.method==="POST"&&u.pathname==="/telegram/admin"){if(env.TELEGRAM_WEBHOOK_SECRET&&request.headers.get("X-Telegram-Bot-Api-Secret-Token")!==env.TELEGRAM_WEBHOOK_SECRET)return new Response("forbidden",{status:403});await admin(env,await request.json());return new Response("ok")}
    if(request.method==="POST"&&u.pathname==="/telegram/orders"){if(env.TELEGRAM_WEBHOOK_SECRET&&request.headers.get("X-Telegram-Bot-Api-Secret-Token")!==env.TELEGRAM_WEBHOOK_SECRET)return new Response("forbidden",{status:403});await orders(env,await request.json());return new Response("ok")}
    if(request.method==="GET")return env.ASSETS.fetch(request);
    return new Response("Not Found",{status:404});
  }catch(e){console.error(e);return json({ok:false,message:"حدث خطأ بالخادم."},500)}
}};