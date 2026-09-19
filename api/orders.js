const tg=async(method,body)=>{const r=await fetch("https://api.telegram.org/bot"+process.env.ORDERS_BOT_TOKEN+"/"+method,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const d=await r.json();if(!d.ok)throw new Error(d.description||"telegram");return d.result};
const money=n=>Number(n||0).toLocaleString("ar-IQ")+" د.ع";
const text=v=>String(v??"").trim();
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false});
 try{
  const b=req.body||{},name=text(b.name),phone=text(b.phone),address=text(b.address),landmark=text(b.landmark);
  if(!name||!phone||!address||!Array.isArray(b.items)||!b.items.length)return res.status(400).json({ok:false,message:"بيانات الطلب ناقصة."});
  const headers={apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:"Bearer "+process.env.SUPABASE_SERVICE_ROLE_KEY,"Content-Type":"application/json","Prefer":"return=representation"};
  const pr=await fetch(process.env.SUPABASE_URL+"/rest/v1/products?select=id,name,price&active=eq.true",{headers}).then(r=>r.json());
  const items=b.items.map(x=>{const p=pr.find(y=>Number(y.id)===Number(x.id));const qty=Math.max(1,Math.min(99,Number(x.qty)||0));return p?{id:p.id,name:p.name,qty,price:p.price}:null}).filter(Boolean);
  if(!items.length)return res.status(400).json({ok:false,message:"المنتجات المطلوبة غير متاحة."});
  const total=items.reduce((s,x)=>s+x.price*x.qty,0);
  const or=await fetch(process.env.SUPABASE_URL+"/rest/v1/orders",{method:"POST",headers,body:JSON.stringify({name,phone,address,landmark,total,status:"جديد"})});
  if(!or.ok)throw new Error("db");
  const ro=await or.json(),id=ro[0]?.id;if(!id)throw new Error("db");
  const ir=await fetch(process.env.SUPABASE_URL+"/rest/v1/order_items",{method:"POST",headers,body:JSON.stringify(items.map(x=>({order_id:id,product_id:x.id,product_name:x.name,qty:x.qty,price:x.price})))});
  if(!ir.ok)throw new Error("db");
  const lines=items.map(x=>"• "+x.name+" × "+x.qty+" = "+money(x.price*x.qty)).join("\n");
  const msg="🛒 طلب جديد #"+id+" — أبو هاشم\n\n👤 الاسم: "+name+"\n📱 الهاتف: "+phone+"\n📍 العنوان: "+address+"\n🧭 النقطة الدالة: "+(landmark||"غير محددة")+"\n\n📦 الطلبات:\n"+lines+"\n\n💰 المجموع: "+money(total)+"\n📌 الحالة: جديد";
  await tg("sendMessage",{chat_id:process.env.ORDERS_CHAT_ID,text:msg,reply_markup:{inline_keyboard:[[{text:"✅ قبول الطلب",callback_data:"order:accept:"+id},{text:"❌ رفض",callback_data:"order:reject:"+id}]]}});
  res.status(200).json({ok:true,orderId:id});
 }catch(e){res.status(500).json({ok:false,message:"تعذر إرسال الطلب حالياً."})}
}