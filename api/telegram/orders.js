const tg=async(method,body)=>{const r=await fetch("https://api.telegram.org/bot"+process.env.ORDERS_BOT_TOKEN+"/"+method,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const d=await r.json();if(!d.ok)throw new Error(d.description||"telegram");return d.result};
const dbHeaders=()=>({apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:"Bearer "+process.env.SUPABASE_SERVICE_ROLE_KEY,"Content-Type":"application/json","Prefer":"return=representation"});
const secretOk=req=>!process.env.TELEGRAM_WEBHOOK_SECRET||req.headers["x-telegram-bot-api-secret-token"]===process.env.TELEGRAM_WEBHOOK_SECRET;
const statusText={accept:"مقبول",reject:"مرفوض",ready:"جاهز للتسليم"};
export default async function handler(req,res){
 if(req.method!=="POST"||!secretOk(req))return res.status(401).json({ok:false});
 try{const q=req.body?.callback_query;if(!q)return res.status(200).json({ok:true});if(String(q.message?.chat?.id)!==String(process.env.ORDERS_CHAT_ID))return res.status(200).json({ok:true});
  const a=String(q.data||"").split(":");if(a[0]!=="order")return res.status(200).json({ok:true});const action=a[1],id=Number(a[2]);if(!statusText[action])return res.status(200).json({ok:true});
  const r=await fetch(process.env.SUPABASE_URL+"/rest/v1/orders?id=eq."+id,{method:"PATCH",headers:{...dbHeaders(),Prefer:"return=minimal"},body:JSON.stringify({status:statusText[action],updated_at:new Date().toISOString()})});if(!r.ok)throw new Error("db");
  await tg("answerCallbackQuery",{callback_query_id:q.id,text:"تم تحديث الطلب"});
  const text=(q.message.text||"").replace(/📌 الحالة:.*$/s,"📌 الحالة: "+statusText[action]);
  await tg("editMessageText",{chat_id:q.message.chat.id,message_id:q.message.message_id,text});
  res.status(200).json({ok:true});
 }catch(e){res.status(200).json({ok:true})}
}