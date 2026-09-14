/* Investor ↔ Trader V1 — browser application layer */
const SUPABASE_URL = "https://mhyppitteqephfcqjlrx.supabase.co";
const SUPABASE_KEY = "sb_publishable_QeZD6jeTtwrNe2sZi5U5PQ_r7K66zhL";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let authMode="login", session=null, profile=null, transactions=[], payments=[];

const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=(n,c)=>c==="USDT"?"₮"+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):"₦"+Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const norm=s=>String(s||"").trim().toLowerCase().replace(/\s+/g," ");
const toast=m=>{ $("toast").textContent=m;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2800); };

function showHome(){$("home").classList.remove("hidden");$("auth").classList.add("hidden");$("dashboard").classList.add("hidden");$("navActions").innerHTML=session?'<button class="secondary" onclick="signOut()">Log out</button>':'';window.scrollTo(0,0)}
function openAuth(mode){$("home").classList.add("hidden");$("dashboard").classList.add("hidden");$("auth").classList.remove("hidden");setAuthMode(mode);$("navActions").innerHTML="";window.scrollTo(0,0)}
function setAuthMode(mode){authMode=mode;$("loginTab").classList.toggle("active",mode==="login");$("registerTab").classList.toggle("active",mode==="register");$("nameField").classList.toggle("hidden",mode!=="register");$("roleField").classList.toggle("hidden",mode!=="register");$("authTitle").textContent=mode==="login"?"Log in":"Create account";$("authSubtitle").textContent=mode==="login"?"Access your private dashboard.":"Choose INVESTOR or TRADER.";$("authSubmit").textContent=mode==="login"?"Log in":"Create account";$("authMessage").textContent=""}

$("authForm").addEventListener("submit",async e=>{
 e.preventDefault();$("authMessage").textContent="Please wait...";
 const email=$("email").value.trim(), password=$("password").value, name=$("fullName").value.trim(), role=$("role").value;
 if(authMode==="register"){
   if(!name){$("authMessage").textContent="Full name is required.";return}
   const {data,error}=await db.auth.signUp({email,password,options:{data:{full_name:name,role}}});
   if(error){$("authMessage").textContent=error.message;return}
   if(data.session){await loadApp()}else{$("authMessage").style.color="#176b3a";$("authMessage").textContent="Account created. Check your email to confirm, then log in."}
 }else{
   const {data,error}=await db.auth.signInWithPassword({email,password});
   if(error){$("authMessage").textContent=error.message;return}
   session=data.session;await loadApp();
 }
});

async function signOut(){await db.auth.signOut();session=null;profile=null;transactions=[];payments=[];showHome();toast("Logged out")}
async function loadApp(){
 const {data:{session:s}}=await db.auth.getSession();session=s;
 if(!session){showHome();return}
 let r=await db.from("profiles").select("*").eq("id",session.user.id).maybeSingle();
 if(!r.data){
   const meta=session.user.user_metadata||{};
   await db.from("profiles").upsert({id:session.user.id,full_name:meta.full_name||session.user.email,role:meta.role||"INVESTOR"});
   r=await db.from("profiles").select("*").eq("id",session.user.id).maybeSingle();
 }
 profile=r.data;
 if(!profile){$("authMessage").textContent="Your profile could not be loaded.";return}
 $("home").classList.add("hidden");$("auth").classList.add("hidden");$("dashboard").classList.remove("hidden");$("navActions").innerHTML='<button class="secondary" onclick="signOut()">Log out</button>';
 $("welcome").textContent="Welcome, "+(profile.full_name||"User");$("roleLabel").textContent=profile.role+" DASHBOARD";$("dashMessage").textContent=profile.role==="INVESTOR"?"Track investments, confirmations and payouts.":"Track obligations, confirmations and payments.";
 $("newBtn").classList.toggle("hidden",profile.role!=="INVESTOR");$("totalLabel").textContent=profile.role==="INVESTOR"?"TOTAL INVESTED":"TOTAL COLLECTED";
 await refresh();
}
async function refresh(){
  let q=db.from("transactions").select("*").order("created_at",{ascending:false});
  if(profile.role==="INVESTOR"){
    q=q.eq("investor_id",session.user.id);
  }else{
    q=q.or("investor_id.eq."+session.user.id+",trader_id.eq."+session.user.id+",and(trader_id.is.null,trader_name_normalized.eq."+profile.normalized_name+")");
  }
  const r=await q;
  transactions=(r.data||[]).filter(t=>{
    if(profile.role==="INVESTOR") return t.investor_id===session.user.id;
    return t.investor_id===session.user.id || t.trader_id===session.user.id || (t.trader_id===null && norm(t.trader_name)===norm(profile.full_name));
  });
  const ids=transactions.map(t=>t.id);
  const pr=ids.length?await db.from("payments").select("*").in("transaction_id",ids).order("created_at",{ascending:true}):{data:[]};
  payments=pr.data||[];
  renderDashboard();renderTransactions();renderPending();
}
function paymentTotal(id){return payments.filter(p=>p.transaction_id===id&&p.confirmation_status!=="DISPUTED").reduce((a,p)=>a+Number(p.amount||0),0)}
function txStatus(t){
  const paid=paymentTotal(t.id),due=Number(t.expected_payout||0),left=Math.max(0,due-paid);
  if(t.confirmation_status!=="CONFIRMED")return t.confirmation_status;
  if(left<=0)return"PAID";
  if(new Date(t.expected_payout_date+"T23:59:59")<new Date())return"OVERDUE";
  if(paid>0)return"PARTIALLY_PAID";
  return"NOT_PAID";
}
function renderDashboard(){
  const mine=transactions.filter(t=>t.investor_id===session.user.id);
  const obligations=transactions.filter(t=>t.trader_id===session.user.id && t.investor_id!==session.user.id);
  const investedN=mine.filter(t=>t.currency==="NGN").reduce((a,t)=>a+Number(t.amount_invested||0),0);
  const investedU=mine.filter(t=>t.currency==="USDT").reduce((a,t)=>a+Number(t.amount_invested||0),0);
  const collectedN=obligations.filter(t=>t.currency==="NGN").reduce((a,t)=>a+Number(t.amount_invested||0),0);
  const collectedU=obligations.filter(t=>t.currency==="USDT").reduce((a,t)=>a+Number(t.amount_invested||0),0);
  const outN=obligations.filter(t=>t.currency==="NGN"&&t.confirmation_status==="CONFIRMED").reduce((a,t)=>a+Math.max(0,Number(t.expected_payout)-paymentTotal(t.id)),0);
  const outU=obligations.filter(t=>t.currency==="USDT"&&t.confirmation_status==="CONFIRMED").reduce((a,t)=>a+Math.max(0,Number(t.expected_payout)-paymentTotal(t.id)),0);
  $("ngnInvested").textContent=money(investedN,"NGN");$("usdtInvested").textContent=money(investedU,"USDT");
  $("ngnCollected").textContent=money(collectedN,"NGN");$("usdtCollected").textContent=money(collectedU,"USDT");
  $("ngnOutstanding").textContent=money(profile.role==="INVESTOR"?mine.filter(t=>t.currency==="NGN"&&t.confirmation_status==="CONFIRMED").reduce((a,t)=>a+Math.max(0,Number(t.expected_payout)-paymentTotal(t.id)),0):outN,"NGN");
  $("usdtOutstanding").textContent=money(profile.role==="INVESTOR"?mine.filter(t=>t.currency==="USDT"&&t.confirmation_status==="CONFIRMED").reduce((a,t)=>a+Math.max(0,Number(t.expected_payout)-paymentTotal(t.id)),0):outU,"USDT");
}
function renderPending(){
  const pending=transactions.filter(t=>t.confirmation_status==="PENDING"&&profile.role==="TRADER"&&t.investor_id!==session.user.id);
  $("pendingArea").innerHTML=pending.length?pending.map(t=>`<div class="pendingCard"><div><strong>${esc(t.transaction_id)}</strong><br>${esc(t.investor_name)} • ${money(t.amount_invested,t.currency)} • ROI ${t.roi_percent}%</div><div class="actions"><button class="smallBtn primarySmall" onclick="confirmTx('${t.id}','CONFIRMED')">Confirm</button><button class="smallBtn" onclick="confirmTx('${t.id}','DISPUTED')">Dispute</button></div></div>`).join(""):"";
}
function renderTransactions(){
 const term=norm($("searchBox").value);
 const rows=transactions.filter(t=>!term||norm(t.transaction_id+" "+t.investor_name+" "+t.trader_name).includes(term));
 $("txBody").innerHTML=rows.length?rows.map(t=>{
   const mine=t.investor_id===session.user.id;
   const other=profile.role==="INVESTOR"?t.trader_name:(mine?t.trader_name:t.investor_name);
   const type=profile.role==="TRADER"?(mine?"MY INVESTMENT":"TRADING OBLIGATION"):"INVESTMENT";
   const st=txStatus(t);
   const cls=["CONFIRMED","PAID"].includes(st)?"confirmed":(st==="DISPUTED"?"disputed":(st==="OVERDUE"?"overdue":"pending"));
   return `<tr><td><b>${esc(t.transaction_id)}</b><br><small>${type}</small></td><td>${esc(other)}</td><td>${t.currency}</td><td>${money(t.amount_invested,t.currency)}</td><td>${Number(t.roi_percent)}%</td><td><span class="status ${cls}">${esc(st.replace("_"," "))}</span></td><td>${profile.role==="TRADER"&&t.trader_id===session.user.id&&t.confirmation_status==="CONFIRMED"?`<button class="smallBtn" onclick="recordPayment('${t.id}')">Payment</button>`:""}</td></tr>`;
 }).join(""):`<tr><td colspan="7" class="empty">No transactions yet.</td></tr>`;
}
async function confirmTx(id,decision){const {error}=await db.rpc("confirm_transaction",{tx_id:id,decision});if(error){toast(error.message);return}toast("Transaction "+decision.toLowerCase());await refresh()}
async function recordPayment(id){
  const amount=prompt("Enter amount paid/returned:");if(amount===null)return;
  const n=Number(amount);if(!n||n<=0){toast("Enter a valid amount");return}
  const note=prompt("Optional payment note:")||null;
  const {error}=await db.rpc("record_payment",{tx_id:id,amount:n,note});
  if(error){toast(error.message);return}
  toast("Payment recorded and sent for receipt confirmation");await refresh()
}

function openNewInvestment(){$("newInvestment").classList.remove("hidden");$("investmentDate").value=new Date().toISOString().slice(0,10);updatePreview();$("newInvestment").scrollIntoView({behavior:"smooth"})}
function closeNewInvestment(){$("newInvestment").classList.add("hidden");$("investmentMessage").textContent=""}
function addBusinessDays(date,days){let d=new Date(date+"T12:00:00");let left=Number(days);while(left){d.setDate(d.getDate()+1);if(d.getDay()!==0&&d.getDay()!==6)left--}return d.toISOString().slice(0,10)}
function updatePreview(){const a=Number($("amount").value||0),r=Number($("roi").value||0),d=$("investmentDate").value,term=$("term").value;if(!a||!d){$("calcPreview").textContent="Expected profit and payout will appear here.";return}const profit=a*r/100,payout=a+profit,due=addBusinessDays(d,term);$("calcPreview").innerHTML=`Expected profit: <b>${money(profit,$("currency").value)}</b> · Expected payout: <b>${money(payout,$("currency").value)}</b> · Expected payout date: <b>${due}</b>`}
["amount","roi","investmentDate","term","currency"].forEach(id=>$(id).addEventListener("input",updatePreview));
$("investmentForm").addEventListener("submit",async e=>{
 e.preventDefault();$("investmentMessage").textContent="Creating...";
 const d=$("investmentDate").value,a=Number($("amount").value),r=Number($("roi").value),term=Number($("term").value),currency=$("currency").value,traderName=$("traderName").value.trim();
 if(!traderName||!a||a<=0||r<0||![3,7].includes(term)||!d){$("investmentMessage").textContent="Please complete all fields.";return}
 const due=addBusinessDays(d,term),day=new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"long"}),pday=new Date(due+"T12:00:00").toLocaleDateString("en-US",{weekday:"long"});
 const {data,error}=await db.from("transactions").insert({investor_id:session.user.id,investor_name:profile.full_name,trader_name,currency,amount_invested:a,roi_percent:r,investment_date:d,investment_day:day,term:String(term),expected_payout_date:due,payout_day:pday,confirmation_status:"PENDING"}).select().single();
 if(error){$("investmentMessage").textContent=error.message;return}

 $("investmentMessage").style.color="#176b3a";$("investmentMessage").textContent="Investment created and is awaiting trader confirmation.";toast("Investment created");closeNewInvestment();await refresh()
});

db.auth.onAuthStateChange((event,s)=>{if(event==="SIGNED_OUT"){session=null;profile=null;showHome()}});
loadApp();
