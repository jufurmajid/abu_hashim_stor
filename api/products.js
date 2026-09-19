export default async function handler(req,res){
 try{
  const r=await fetch(process.env.SUPABASE_URL+"/rest/v1/products?select=id,name,price,category,emoji&active=eq.true&order=id.asc",{headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:"Bearer "+process.env.SUPABASE_SERVICE_ROLE_KEY}});
  const d=await r.json();
  if(!r.ok)throw new Error("db");
  res.status(200).json(d.map(p=>({id:Number(p.id),n:p.name,p:Number(p.price),c:p.category,e:p.emoji})));
 }catch(e){res.status(500).json({ok:false,message:"تعذر تحميل المنتجات."})}
}