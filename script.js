let products=[];
let cart=JSON.parse(localStorage.getItem("abuCart")||"[]"),activeCat="الكل",query="";
const grid=document.querySelector("#grid"),count=document.querySelector("#cartCount"),modal=document.querySelector("#cartModal"),checkout=document.querySelector("#checkoutModal");
const money=n=>Number(n).toLocaleString("ar-IQ")+" د.ع";
const fallback=[{id:1,n:"لحم غنم",p:18000,c:"لحوم",e:"🥩"},{id:2,n:"لحم عجل",p:16000,c:"لحوم",e:"🥩"},{id:3,n:"حليب طازج",p:2500,c:"ألبان",e:"🥛"},{id:4,n:"لبن",p:2000,c:"ألبان",e:"🥛"},{id:5,n:"جبن أبيض",p:4500,c:"أجبان",e:"🧀"},{id:6,n:"جبن مثلثات",p:3500,c:"أجبان",e:"🧀"}];
async function loadProducts(){
  try{const r=await fetch("/api/products");if(!r.ok)throw new Error();products=await r.json();}
  catch(e){products=fallback}
  render();save();
}
function render(){
  const q=query.toLowerCase();
  const list=products.filter(x=>(activeCat==="الكل"||x.c===activeCat)&&String(x.n).toLowerCase().includes(q));
  grid.innerHTML=list.length?list.map(x=>'<article class="card"><div class="pic">'+x.e+'</div><h3>'+x.n+'</h3><div class="price">'+money(x.p)+'</div><button onclick="add('+x.id+')">أضف للسلة</button></article>').join(""):'<p class="empty">🔎 ماكو منتجات مطابقة للبحث.</p>';
}
function save(){localStorage.setItem("abuCart",JSON.stringify(cart));renderCart();count.textContent=cart.reduce((a,x)=>a+x.q,0)}
function add(id){let x=cart.find(a=>a.id===id);x?x.q++:cart.push({id,q:1});save();showCartHint()}
function showCartHint(){const btn=document.querySelector("#cartBtn");btn.animate([{transform:"scale(1)"},{transform:"scale(1.06)"},{transform:"scale(1)"}],{duration:220})}
function renderCart(){
  const box=document.querySelector("#cartItems");
  cart=cart.filter(x=>products.some(p=>p.id===x.id));
  if(!cart.length){box.innerHTML='<div class="empty">🛒 السلة فارغة حالياً.<br><small>اختار منتجات من المتجر وأضفها هنا.</small></div>';document.querySelector("#total").textContent=money(0);return}
  box.innerHTML=cart.map(x=>{let p=products.find(a=>a.id===x.id);return '<div class="cartRow"><div><div class="cartName">'+p.e+" "+p.n+'</div><small>'+money(p.p)+'</small></div><div class="qty"><button onclick="change('+x.id+',-1)">−</button> '+x.q+' <button onclick="change('+x.id+',1)">+</button></div></div>'}).join("");
  document.querySelector("#total").textContent=money(cart.reduce((s,x)=>s+products.find(p=>p.id===x.id).p*x.q,0));
}
function change(id,d){let x=cart.find(a=>a.id===id);if(!x)return;x.q+=d;if(x.q<=0)cart=cart.filter(a=>a.id!==id);save()}
document.querySelector("#cartBtn").onclick=()=>{renderCart();modal.classList.remove("hidden")};
document.querySelector("#closeCart").onclick=()=>modal.classList.add("hidden");
document.querySelector("#checkoutBtn").onclick=()=>{if(cart.length){modal.classList.add("hidden");checkout.classList.remove("hidden");document.querySelector("#orderMsg").textContent=""}};
document.querySelector("#closeCheckout").onclick=()=>checkout.classList.add("hidden");
document.querySelector("#search").oninput=e=>{query=e.target.value.trim();render()};
document.querySelectorAll(".filters button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filters button").forEach(x=>x.classList.remove("active"));b.classList.add("active");activeCat=b.dataset.cat;render()});
document.querySelector("#orderForm").onsubmit=async e=>{
  e.preventDefault();if(!cart.length)return;
  const f=new FormData(e.target),items=cart.map(x=>{const p=products.find(a=>a.id===x.id);return{name:p.n,qty:x.q,price:p.p}}),total=items.reduce((s,x)=>s+x.price*x.qty,0),msg=document.querySelector("#orderMsg");
  msg.textContent="⏳ جاري إرسال الطلب...";
  try{
    const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:f.get("name"),phone:f.get("phone"),address:f.get("address"),landmark:f.get("landmark"),items,total})});
    const data=await r.json();if(!r.ok||!data.ok)throw new Error(data.message||"failed");
    msg.textContent="✅ تم إرسال الطلب للمحل بنجاح. رقم الطلب: #"+data.orderId;
    cart=[];save();e.target.reset();
  }catch(err){msg.textContent="❌ تعذر إرسال الطلب حالياً. تأكد من تشغيل السيرفر والبوت."}
};
document.addEventListener("keydown",e=>{if(e.key==="Escape"){modal.classList.add("hidden");checkout.classList.add("hidden")}});
loadProducts();