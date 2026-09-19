const tg=async(method,body)=>{const r=await fetch("https://api.telegram.org/bot"+process.env.ADMIN_BOT_TOKEN+"/"+method,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const d=await r.json();if(!d.ok)throw new Error(d.description||"telegram");return d.result};
const dbHeaders=()=>({apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:"Bearer "+process.env.SUPABASE_SERVICE_ROLE_KEY,"Content-Type":"application/json","Prefer":"return=representation"});
const db=async(path,opt={})=>{const r=await fetch(process.env.SUPABASE_URL+"/rest/v1/"+path,{...opt,headers:{...dbHeaders(),...(opt.headers||{})}});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error("db");return d};
const secretOk=req=>!process.env.TELEGRAM_WEBHOOK_SECRET||req.headers["x-telegram-bot-api-secret-token"]===process.env.TELEGRAM_WEBHOOK_SECRET;
const chatOk=id=>String(id)===String(process.env.ADMIN_CHAT_ID);
const help="الأوامر:\n/products — عرض المنتجات\n/add الاسم | السعر | الفئة | الإيموجي\n/edit الرقم | الاسم | السعر | الفئة | الإيموجي\n/hide الرقم\n/show الرقم\n/delete الرقم\n/orders — آخر الطلبات";
export default async function handler(req,res){
 if(req.method!=="POST"||!secretOk(req))return res.status(401).json({ok:false});
 try{
  const u=req.body||{},m=u.message;if(!m||!chatOk(m.chat?.id))return res.status(200).json({ok:true});
  const c=String(m.text||"").trim();if(c==="/start"||c==="/help")await tg("sendMessage",{chat_id:m.chat.id,text:help});
  else if(c==="/products"){const ps=await db("products?select=id,name,price,category,active&order=id.asc");const t=ps.length?ps.map(p=>"#"+p.id+" "+p.name+" — "+p.price.toLocaleString("ar-IQ")+" د.ع — "+p.category+(p.active?" ✅":" ⛔")).join("\n"):"لا توجد منتجات.";await tg("sendMessage",{chat_id:m.chat.id,text:t});}
  else if(c==="/orders"){const os=await db("orders?select=id,name,phone,total,status,created_at&order=id.desc&limit=15");const t=os.length?os.map(o=>"#"+o.id+" — "+o.name+" — "+o.total.toLocaleString("ar-IQ")+" د.ع — "+o.status).join("\n"):"لا توجد طلبات.";await tg("sendMessage",{chat_id:m.chat.id,text:t});}
  else if(c.startsWith("/add ")){const a=c.slice(5).split("|").map(x=>x.trim());if(a.length<3)throw new Error("format");const p=await db("products",{method:"POST",body:JSON.stringify({name:a[0],price:Number(a[1]),category:a[2],emoji:a[3]||"🛒",active:true})});await tg("sendMessage",{chat_id:m.chat.id,text:"✅ تمت إضافة المنتج #"+p[0].id});}
  else if(c.startsWith("/edit ")){const a=c.slice(6).split("|").map(x=>x.trim());if(a.length<4)throw new Error("format");const id=Number(a[0]);await db("products?id=eq."+id,{method:"PATCH",body:JSON.stringify({name:a[1],price:Number(a[2]),category:a[3],emoji:a[4]||"🛒"})});await tg("sendMessage",{chat_id:m.chat.id,text:"✅ تم تعديل المنتج #"+id});}
  else if(/^\/(hide|show|delete)\s+\d+$/.test(c)){const [cmd,sid]=c.split(/\s+/),id=Number(sid);if(cmd==="/delete")await db("products?id=eq."+id,{method:"DELETE"});else await db("products?id=eq."+id,{method:"PATCH",body:JSON.stringify({active:cmd==="/show"})});await tg("sendMessage",{chat_id:m.chat.id,text:"✅ تم تنفيذ الأمر على المنتج #"+id});}
  else await tg("sendMessage",{chat_id:m.chat.id,text:help});
  res.status(200).json({ok:true});
 }catch(e){res.status(200).json({ok:true})}
}