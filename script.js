let products=[];
let cart=JSON.parse(localStorage.getItem("abuCart")||"[]"),activeCat="الكل",query="";
const grid=document.querySelector("#grid"),count=document.querySelector("#cartCount"),modal=document.querySelector("#cartModal"),checkout=document.querySelector("#checkoutModal");
const money=n=>Number(n).toLocaleString("ar-IQ")+" د.ع";
async function loadProducts(){
  try{const r=await fetch("/api/products");if(!r.ok)throw new Error();products=await r.json();}
  catch(e){products=[{id:1,n:"لحم غنم",p:18000,c:"لحوم",e:"🥩"},{id:2,n:"لحم عجل",p:16000,c:"لحوم",e:"🥩"},{id:3,n:"حليب طازج",p:2500,c:"ألبان",e:"🥛"},{id:4,n:"لبن",p:2000,c:"ألبان",e:"🥛"},{id:5,n:"جبن أبيض",p:4500,c:"أجبان",e:"🧀"},{id:6,n:"جبن مثلثات",p:3500,c:"أجبان",e:"🧀"}];}
  render();save();
}
function render(){const q=query.toLowerCase();const list=products.filter(x=>(activeCat==="الكل"||x.c===activeCat)&&x.n.toLowerCase().includes(q));grid.innerHTML=list.length?list.map(x=>'<article class="card"><div class="pic">'+x.e+'</div><h3>'+x.n+'</h3><div class="price">'+money(x.p)+'</div><button onclick="add('+x.id+')">أضف للسلة</button></article>').join(""):'<p class="empty">ماكو منتجات مطابقة للبحث.</p>'}
function save(){localStorage.setItem("abuCart",JSON.stringify(cart));renderCart();count.textContent=cart.reduce((a,x)=>a+x.q,0)}
function add(id){let x=cart.find(a=>a.id===id);x?x.q++:cart.push({id,q:1});save()}
function renderCart(){const box=document.querySelector("#cartItems");const valid=cart.filter(x=>products.some(p=>p.id===x.id));cart=valid;if(!cart.length){box.innerHTML="<p>السلة فارغة حالياً.</p>";document.querySelector("#total").textContent=money(0);return}box.innerHTML=cart.map(x=>{let p=products.find(a=>a.id===x.id);return '<div class="cartRow"><div>'+p.e+' '+p.n+'<br><small>'+money(p.p)+'</small></div><div class="qty"><button onclick="change('+x.id+',-1)">−</button> '+x.q+' <button onclick="change('+x.id+',1)">+</button></div></div>'}).join("");document.querySelector("#total").textContent=money(cart.reduce((s,x)=>s+products.find(p=>p.id===x.id).p*x.q,0))}
function change(id,d){let x=cart.find(a=>a.id===id);if(!x)return;x.q+=d;if(x.q<=0)cart=cart.filter(a=>a.id!==id);save()}
document.querySelector("#cartBtn").onclick=()=>{renderCart();modal.classList.remove("hidden")};
document.querySelector("#closeCart").onclick=()=>modal.classList.add("hidden");
document.querySelector("#checkoutBtn").onclick=()=>{if(cart.length){modal.classList.add("hidden");checkout.classList.remove("hidden")}};
document.querySelector("#closeCheckout").onclick=()=>checkout.classList.add("hidden");
document.querySelector("#search").oninput=e=>{query=e.target.value.trim();render()};
document.querySelectorAll(".filters button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filters button").forEach(x=>x.classList.remove("active"));b.classList.add("active");activeCat=b.dataset.cat;render()});
document.querySelector("#orderForm").onsubmit=async e=>{e.preventDefault();if(!cart.length)return;const f=new FormData(e.target),items=cart.map(x=>{const p=products.find(a=>a.id===x.id);return{name:p.n,qty:x.q,price:p.p}}),total=items.reduce((s,x)=>s+x.price*x.qty,0),msg=document.querySelector("#orderMsg");msg.textContent="جاري إرسال الطلب...";try{const r=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:f.get("name"),phone:f.get("phone"),address:f.get("address"),landmark:f.get("landmark"),items,total})});const data=await r.json();if(!r.ok||!data.ok)throw new Error(data.message);msg.textContent="✅ تم إرسال الطلب للمحل بنجاح.";cart=[];save();e.target.reset()}catch(err){msg.textContent="❌ تعذر إرسال الطلب. تأكد أن السيرفر والبوت شغالين."}};
loadProducts();