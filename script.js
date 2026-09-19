let products=[],cart=JSON.parse(localStorage.getItem("abuCart")||"[]"),activeCat="الكل",query="",store={orderApiUrl:""};
const grid=document.querySelector("#grid"),count=document.querySelector("#cartCount"),modal=document.querySelector("#cartModal"),checkout=document.querySelector("#checkoutModal");
const money=n=>Number(n||0).toLocaleString("ar-IQ")+" د.ع";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
async function loadProducts(){
 try{
  const [pr,sr]=await Promise.all([fetch("/data/products.json?"+Date.now()),fetch("/data/store.json?"+Date.now())]);
  if(!pr.ok||!sr.ok)throw new Error();
  products=await pr.json(); store=await sr.json();
 }catch(e){products=[];store={orderApiUrl:""}}
 render();save();
}
function render(){
 const q=query.toLowerCase();
 const list=products.filter(x=>x.active!==false&&(activeCat==="الكل"||x.c===activeCat)&&String(x.n).toLowerCase().includes(q));
 grid.innerHTML=list.length?list.map(x=>'<article class="card"><div class="pic">'+esc(x.e)+'</div><h3>'+esc(x.n)+'</h3><div class="price">'+money(x.p)+'</div><button onclick="add('+Number(x.id)+')">أضف للسلة</button></article>').join(""):'<p class="empty">🔎 ماكو منتجات مطابقة للبحث.</p>';
}
function save(){localStorage.setItem("abuCart",JSON.stringify(cart));renderCart();count.textContent=cart.reduce((a,x)=>a+x.q,0)}
function add(id){if(!products.some(p=>Number(p.id)===Number(id)))return;let x=cart.find(a=>Number(a.id)===Number(id));x?x.q++:cart.push({id:Number(id),q:1});save();document.querySelector("#cartBtn").animate([{transform:"scale(1)"},{transform:"scale(1.06)"},{transform:"scale(1)"}],{duration:220})}
function renderCart(){
 const box=document.querySelector("#cartItems");cart=cart.filter(x=>products.some(p=>Number(p.id)===Number(x.id)));
 if(!cart.length){box.innerHTML='<div class="empty">🛒 السلة فارغة حالياً.<br><small>اختار منتجات من المتجر وأضفها هنا.</small></div>';document.querySelector("#total").textContent=money(0);return}
 box.innerHTML=cart.map(x=>{const p=products.find(a=>Number(a.id)===Number(x.id));return '<div class="cartRow"><div><div class="cartName">'+esc(p.e)+" "+esc(p.n)+'</div><small>'+money(p.p)+'</small></div><div class="qty"><button onclick="change('+Number(x.id)+',-1)">−</button> '+Number(x.q)+' <button onclick="change('+Number(x.id)+',1)">+</button></div></div>'}).join("");
 document.querySelector("#total").textContent=money(cart.reduce((s,x)=>s+products.find(p=>Number(p.id)===Number(x.id)).p*x.q,0));
}
function change(id,d){let x=cart.find(a=>Number(a.id)===Number(id));if(!x)return;x.q+=d;if(x.q<=0)cart=cart.filter(a=>Number(a.id)!==Number(id));save()}
document.querySelector("#cartBtn").onclick=()=>{renderCart();modal.classList.remove("hidden")};
document.querySelector("#closeCart").onclick=()=>modal.classList.add("hidden");
document.querySelector("#checkoutBtn").onclick=()=>{if(cart.length){modal.classList.add("hidden");checkout.classList.remove("hidden");document.querySelector("#orderMsg").textContent=""}};
document.querySelector("#closeCheckout").onclick=()=>checkout.classList.add("hidden");
document.querySelector("#search").oninput=e=>{query=e.target.value.trim();render()};
document.querySelectorAll(".filters button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filters button").forEach(x=>x.classList.remove("active"));b.classList.add("active");activeCat=b.dataset.cat;render()});
document.querySelector("#orderForm").onsubmit=async e=>{
 e.preventDefault();if(!cart.length)return;
 const f=new FormData(e.target),msg=document.querySelector("#orderMsg"),submit=e.target.querySelector('button[type="submit"]');
 if(!store.orderApiUrl||store.orderApiUrl.includes("PUT_ORDER_WORKER_URL_HERE")){msg.textContent="⚠️ خدمة استقبال الطلبات غير مربوطة بعد.";return}
 submit.disabled=true;submit.textContent="جاري إرسال الطلب...";
 try{
  const payload={
   name:f.get("name"),phone:f.get("phone"),address:f.get("address"),landmark:f.get("landmark"),
   items:cart.map(x=>({id:Number(x.id),qty:Number(x.q)}))
  };
  const r=await fetch(store.orderApiUrl,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data.ok)throw new Error();
  msg.textContent="✅ تم إرسال طلبك للمحل بنجاح. رقم الطلب: "+data.orderId;
  cart=[];save();e.target.reset();
 }catch(err){
  msg.textContent="❌ ما قدرنا نرسل الطلب حالياً. حاول مرة ثانية.";
 }finally{
  submit.disabled=false;submit.textContent="تأكيد وإرسال الطلب";
 }
};
document.addEventListener("keydown",e=>{if(e.key==="Escape"){modal.classList.add("hidden");checkout.classList.add("hidden")}});
loadProducts();