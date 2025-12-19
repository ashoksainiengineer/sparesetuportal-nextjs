"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { masterCatalog } from "@/lib/masterdata";

export default function SpareSetuApp() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("search");
  const [loading, setLoading] = useState(true);

  // --- AUTH & PROFILE LISTENER ---
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
      setLoading(false);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    getSession();
    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
    if (data) setProfile(data);
  };

  if (loading) return (
    <div className="fixed inset-0 z-[60] bg-[#0f172a] flex flex-col items-center justify-center transition-opacity duration-500">
      <div className="iocl-logo-container mb-4 animate-pulse" style={{ fontSize: '20px' }}>
        <div className="iocl-circle"><div className="iocl-band"><span className="iocl-hindi-text">इंडियनऑयल</span></div></div>
      </div>
      <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.3em]">SpareSetu Loading...</p>
    </div>
  );

  if (!user) return <AuthView />;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f1f5f9]">
      {/* --- SIDEBAR (ALL 5 TABS AS PER ORIGINAL) --- */}
      <aside className="w-64 bg-white hidden md:flex flex-col flex-shrink-0 z-20 shadow-xl border-r border-slate-200">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-orange-600">
            <i className="fa-solid fa-layer-group"></i>
          </div>
          <span className="text-lg font-bold text-slate-800 font-industrial uppercase tracking-wide">Menu</span>
        </div>
        <nav className="flex-1 px-3 space-y-1 mt-4">
          <button onClick={() => setActiveTab("search")} className={`nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${activeTab === 'search' ? 'active-nav' : 'text-slate-600'}`}>
            <i className="fa-solid fa-globe w-5"></i> <span>Global Search</span>
          </button>
          <button onClick={() => setActiveTab("mystore")} className={`nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${activeTab === 'mystore' ? 'active-nav' : 'text-slate-600'}`}>
            <i className="fa-solid fa-warehouse w-5"></i> <span>My Local Store</span>
          </button>
          <button onClick={() => setActiveTab("analysis")} className={`nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${activeTab === 'analysis' ? 'active-nav' : 'text-slate-600'}`}>
            <i className="fa-solid fa-chart-simple w-5"></i> <span>Monthly Analysis</span>
          </button>
          <button onClick={() => setActiveTab("usage")} className={`nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${activeTab === 'usage' ? 'active-nav' : 'text-slate-600'}`}>
            <i className="fa-solid fa-clipboard-list w-5"></i> <span>My Usage</span>
          </button>
          <button onClick={() => setActiveTab("returns")} className={`nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${activeTab === 'returns' ? 'active-nav' : 'text-slate-600'}`}>
            <i className="fa-solid fa-hand-holding-hand w-5"></i> <span>Returns & Udhaari</span>
          </button>
        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-xs">{profile?.name?.charAt(0) || "U"}</div>
            <div className="overflow-hidden">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Logged in</p>
              <div className="text-xs font-bold text-slate-700 truncate">{profile?.name}</div>
            </div>
          </div>
          <button onClick={() => supabase.auth.signOut().then(()=>window.location.reload())} className="w-full mt-2 py-2 text-xs text-red-500 hover:bg-red-50 font-bold rounded-lg transition">Logout</button>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col overflow-y-auto relative pb-20 md:pb-0">
        <header className="header-bg text-white sticky top-0 z-30 shadow-md">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              {/* CSS LOGO WITH IDENTICAL TAGLINE */}
              <div className="iocl-logo-container hidden md:flex flex-col items-center" style={{ fontSize: '10px' }}>
                <div className="iocl-circle"><div className="iocl-band"><span className="iocl-hindi-text">इंडियनऑयल</span></div></div>
                <div className="iocl-english-text" style={{ color: 'white', fontWeight: 800 }}>IndianOil</div>
                <div className="font-script text-orange-400 text-[10px] mt-1 whitespace-nowrap">The Energy of India</div>
              </div>
              <div className="flex flex-col items-center"> 
                <h1 className="font-industrial text-3xl md:text-4xl uppercase tracking-wider leading-none font-bold text-center">Gujarat Refinery</h1>
                <p className="font-hindi text-blue-400 text-sm font-bold tracking-wide mt-1 text-center">जहाँ प्रगति ही जीवन सार है</p>
              </div>
            </div>
            <div className="text-left md:text-right">
              <h2 className="font-industrial text-2xl text-orange-500 tracking-[0.1em] font-bold">SPARE SETU PORTAL</h2>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-10 max-w-7xl mx-auto w-full space-y-8 mt-2">
          {activeTab === "search" && <GlobalSearchView profile={profile} />}
          {activeTab === "mystore" && <MyStoreView profile={profile} />}
          {activeTab === "analysis" && <div className="p-20 text-center italic text-slate-400 bg-white rounded-xl border">Monthly Consumption Charts...</div>}
          {activeTab === "usage" && <UsageHistoryView profile={profile} />}
          {activeTab === "returns" && <div className="p-20 text-center italic text-slate-400 bg-white rounded-xl border">Returns Ledger...</div>}
        </div>
      </main>
    </div>
  );
}

// --- AUTH VIEW (OTP + 22 ZONES + HINDI CREDITS) ---
function AuthView() {
  const [view, setView] = useState<"login" | "register" | "forgot" | "otp">("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const switchAuthView = (v: any) => { setEnteredOtp(""); setView(v); };

  const handleAuth = async () => {
    setAuthLoading(true);
    if (view === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) alert(error.message);
    } else if (view === "register") {
      if (!name || !unit || !email || !pass) { alert("Sari details bhariye!"); setAuthLoading(false); return; }
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(otp);
      try {
        const res = await fetch('/api/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, otp })
        });
        if (res.ok) { alert("OTP sent to your email!"); switchAuthView("otp"); }
        else { alert("OTP send failed. Check EmailJS."); }
      } catch (err) { alert("Server error."); }
    } else if (view === "otp") {
      if (enteredOtp === generatedOtp) {
        const { error } = await supabase.auth.signUp({ email, password: pass, options: { data: { name, unit } } });
        if (error) alert(error.message); else { alert("Account Created!"); switchAuthView("login"); }
      } else alert("Invalid OTP!");
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) alert(error.message); else alert("Link Sent!");
    }
    setAuthLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 login-bg">
      <div className="w-full max-w-md login-card rounded-2xl shadow-2xl p-8 fade-in border-t-4 border-orange-500 text-center relative">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="iocl-logo-container" style={{ fontSize: '14px' }}>
              <div className="iocl-circle"><div className="iocl-band"><span className="iocl-hindi-text">इंडियनऑयल</span></div></div>
              <div className="iocl-english-text" style={{ marginTop: '8px' }}>IndianOil</div>
              <div className="font-script text-orange-400 text-[10px] mt-1 whitespace-nowrap">The Energy of India</div>
            </div>
          </div>
          <h1 className="font-industrial text-2xl font-bold text-white uppercase tracking-wider leading-tight">Gujarat Refinery</h1>
          <p className="font-hindi text-blue-400 text-sm font-bold mt-1 tracking-wide">जहाँ प्रगति ही जीवन सार है</p>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-4 mb-6">Spare Setu Portal</p>
        </div>

        <div className="space-y-4">
          {view === "register" && (
            <>
              <input type="text" placeholder="Full Name" value={name} className="w-full p-3 rounded-lg login-input outline-none text-sm" onChange={(e)=>setName(e.target.value)} />
              <select className="w-full p-3 rounded-lg login-input outline-none text-sm bg-slate-900 text-slate-300" value={unit} onChange={(e)=>setUnit(e.target.value)}>
                <option value="">Select Your Zone</option>
                {["RUP - South Block", "RUP - North Block", "LAB", "MSQU", "AU-5", "BS-VI", "GR-II & NBA", "GR-I", "OM&S", "OLD SRU & CETP", "Electrical Planning", "Electrical Testing", "Electrical Workshop", "FCC", "GRE", "CGP-I", "CGP-II & TPS", "Water Block & Bitumen", "Township - Estate Office", "AC Section", "GHC", "DHUMAD"].map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </>
          )}
          {view === "otp" ? (
             <input type="text" placeholder="######" value={enteredOtp} className="w-full p-3 rounded-lg login-input text-center text-xl font-bold tracking-[0.5em] text-white" onChange={(e)=>setEnteredOtp(e.target.value)} />
          ) : (
             <input type="email" placeholder="Official Email ID" value={email} className="w-full p-3 rounded-lg login-input outline-none text-sm" onChange={(e)=>setEmail(e.target.value)} />
          )}
          {view !== "forgot" && view !== "otp" && <input type="password" placeholder="Password" className="w-full p-3 rounded-lg login-input outline-none text-sm" onChange={(e)=>setPass(e.target.value)} />}
          
          <button onClick={handleAuth} disabled={authLoading} className="w-full h-12 mt-6 iocl-btn text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 uppercase tracking-widest">
            {authLoading ? "Wait..." : view === "login" ? "Secure Login →" : view === "register" ? "Send OTP" : "Verify & Register"}
          </button>

          <div className="mt-6 text-center border-t border-white/10 pt-4">
            <p className="text-xs text-slate-400">{view === "login" ? "New User? " : "Already registered? "}
              <button onClick={() => switchAuthView(view === "login" ? "register" : "login")} className="text-white hover:text-orange-500 font-bold underline ml-1">{view === "login" ? "Create Account" : "Back to Login"}</button>
            </p>
          </div>
          
          <div className="mt-8 pt-4 border-t border-white/10 text-center">
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Developed By</p>
            <p className="text-[11px] text-slate-300 font-bold tracking-wide font-hindi">अशोक सैनी <span className="text-orange-500 mx-1">•</span> दीपक चौहान <span className="text-orange-500 mx-1">•</span> दिव्यांक सिंह राजपूत</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- GLOBAL SEARCH (AGGREGATED + UI MATCHED) ---
function GlobalSearchView({ profile }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [contributors, setContributors] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selCat, setSelCat] = useState("all");
  const [selSubCat, setSelSubCat] = useState("all");
  const [breakdown, setBreakdown] = useState<any>(null);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => { 
    const fetch = async () => { const { data } = await supabase.from("inventory").select("*"); if (data) setItems(data); };
    const fetchLead = async () => { const { data } = await supabase.from("profiles").select("name, unit, item_count").order("item_count", { ascending: false }).limit(3); if (data) setContributors(data); };
    fetch(); fetchLead();
  }, []);

  const grouped: any = {};
  items.forEach(i => {
    const key = `${i.item}-${i.spec}`.toLowerCase();
    if (!grouped[key]) grouped[key] = { ...i, totalQty: 0, holders: [] };
    grouped[key].totalQty += i.qty;
    grouped[key].holders.push(i);
  });

  const availableSubCats = [...new Set(items.filter(i => selCat === "all" || selCat === "zero" ? true : i.cat === selCat).map(i => i.sub))];

  const filtered = Object.values(grouped).filter((i: any) => {
    const matchesSearch = i.item.toLowerCase().includes(search.toLowerCase()) || i.spec.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selCat === "all" ? true : (selCat === "zero" ? i.totalQty === 0 : i.cat === selCat);
    const matchesSub = selSubCat === "all" ? true : i.sub === selSubCat;
    return matchesSearch && matchesCat && matchesSub;
  });

  // Explicit type casting to fix "unknown" type error
  const summary = {
      totalUnique: filtered.length as number,
      totalUnits: filtered.reduce((sum: number, i: any) => sum + (i.totalQty || 0), 0) as number,
      zeroStock: filtered.filter((i: any) => i.totalQty === 0).length as number
  };

  const exportCSV = () => {
    const csv = "Item,Category,Sub-Category,Total Stock,Spec\n" + filtered.map((i:any) => `"${i.item}","${i.cat}","${i.sub}","${i.totalQty}","${i.spec}"`).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Global_Stock.csv'; a.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="bg-white p-6 rounded-xl border flex flex-wrap justify-between items-center gap-6 shadow-sm">
        <h2 className="text-lg font-bold flex items-center gap-2 font-industrial"><i className="fa-solid fa-trophy text-yellow-500"></i> Top Contributors</h2>
        <div className="flex gap-4 overflow-x-auto w-full md:w-auto pb-2">
          {contributors.map((c, idx) => (
            <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center gap-3 min-w-[200px] shadow-sm">
              <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm border-2 border-orange-400">{c.name.charAt(0)}</div>
              <div><p className="text-xs font-bold text-slate-800">{c.name}</p><p className="text-[10px] text-slate-500">{c.unit}</p><p className="text-[10px] font-bold text-green-600 mt-0.5">{c.item_count} Items Added</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {/* ATTACHED HEADER UI AS PER IMAGE */}
        <div className="p-4 border-b bg-slate-50/80 flex flex-wrap md:flex-nowrap items-center gap-2">
             <div className="relative flex-grow md:w-80"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Global Inventory Search..." className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none focus:ring-1 focus:ring-orange-500" onChange={(e)=>setSearch(e.target.value)} /></div>
             <select className="border rounded-md text-xs font-bold p-2 bg-white outline-none w-full md:w-auto" onChange={(e)=>{setSelCat(e.target.value); setSelSubCat("all");}}>
               <option value="all">Category: All</option>
               <option value="zero">⚠️ Out of Stock Items</option>
               {[...new Set(items.map(i => i.cat))].map(c => <option key={c} value={c}>{c}</option>)}
             </select>
             <select className="border rounded-md text-xs font-bold p-2 bg-white outline-none w-full md:w-auto" disabled={selCat === 'all' || selCat === 'zero'} onChange={(e)=>setSelSubCat(e.target.value)} value={selSubCat}>
                <option value="all">Sub-Cat: All</option>
                {availableSubCats.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
             <div className="flex gap-2 ml-auto w-full md:w-auto">
                <button onClick={()=>setShowSummary(true)} className="bg-indigo-600 text-white px-3 py-2 rounded-md text-xs font-bold shadow-sm flex-1 md:flex-none flex items-center justify-center gap-2"><i className="fa-solid fa-chart-pie"></i> Stock Summary</button>
                <button onClick={exportCSV} className="bg-emerald-600 text-white px-3 py-2 rounded-md text-xs font-bold shadow-sm flex-1 md:flex-none flex items-center justify-center gap-2"><i className="fa-solid fa-file-csv"></i> Export CSV</button>
             </div>
        </div>
        
        <div className="overflow-x-auto"><table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b">
            <tr><th className="p-5">Item Details</th><th className="p-5">Spec</th><th className="p-5 text-center">Total Stock</th><th className="p-5 text-center">Action</th></tr>
          </thead>
          <tbody className="divide-y text-sm">
            {filtered.map((i: any, idx: number) => (
              <tr key={idx} className={`hover:bg-slate-50 transition border-b border-slate-50 ${i.totalQty === 0 ? 'bg-red-50/40' : ''}`}>
                <td className="p-5 font-bold text-slate-800">{i.item}<div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{i.cat} / {i.sub}</div></td>
                <td className="p-5"><span className="bg-slate-100 border px-2 py-1 rounded text-[11px] font-medium text-slate-600 shadow-sm">{i.spec}</span></td>
                <td className="p-5 text-center">
                  {i.totalQty === 0 ? <span className="text-red-600 font-black text-[10px] uppercase bg-red-100 px-2 py-1 rounded border border-red-200">Out of Stock</span> : 
                  <button onClick={()=>setBreakdown(i)} className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-lg border border-blue-200 font-bold hover:bg-blue-100 transition mx-auto shadow-sm">{i.totalQty} Nos <i className="fa-solid fa-chevron-right text-[9px]"></i></button>}
                </td>
                <td className="p-5 text-center text-[10px] font-bold text-slate-400 uppercase italic">Click Stock Qty</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>

      {/* SUMMARY MODAL */}
      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 relative shadow-2xl animate-scale-in">
             <button onClick={()=>setShowSummary(false)} className="absolute top-4 right-4 text-slate-400 font-bold text-xl hover:text-red-500 transition">✕</button>
             <h3 className="text-lg font-bold mb-4 text-slate-800 uppercase border-b pb-2 flex items-center gap-2"><i className="fa-solid fa-chart-pie text-indigo-500"></i> Stock Summary</h3>
             <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg"><span className="text-xs font-bold text-blue-600">UNIQUE ITEMS</span><span className="text-xl font-black text-blue-700">{summary.totalUnique}</span></div>
                <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg"><span className="text-xs font-bold text-emerald-600">TOTAL QUANTITY</span><span className="text-xl font-black text-emerald-700">{summary.totalUnits}</span></div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg"><span className="text-xs font-bold text-red-600">ZERO STOCK ITEMS</span><span className="text-xl font-black text-red-700">{summary.zeroStock}</span></div>
             </div>
            </div>
        </div>
      )}

      {/* BREAKDOWN MODAL */}
      {breakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-2xl p-6 relative shadow-2xl animate-scale-in">
             <button onClick={()=>setBreakdown(null)} className="absolute top-4 right-4 text-slate-400 font-bold text-xl hover:text-red-500 transition">✕</button>
             <h3 className="text-xl font-bold mb-1 text-slate-800">{breakdown.item}</h3>
             <p className="text-xs text-slate-400 mb-6 uppercase font-bold tracking-wider">{breakdown.spec}</p>
             <div className="overflow-hidden border border-slate-100 rounded-xl">
               <table className="w-full text-left">
                 <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b"><tr><th className="p-4">Unit / Zone</th><th className="p-4">Engineer</th><th className="p-4 text-right">Qty</th><th className="p-4 text-center">Action</th></tr></thead>
                 <tbody className="divide-y text-sm bg-white">
                   {breakdown.holders.map((h:any, idx:number)=>(
                     <tr key={idx} className="hover:bg-indigo-50/30 transition">
                        <td className="p-4 font-bold text-slate-700">{h.holder_unit}</td>
                        <td className="p-4 text-slate-500">{h.holder_name}</td>
                        <td className="p-4 text-right font-bold text-indigo-600">{h.qty} Nos</td>
                        <td className="p-4 text-center">{h.holder_uid === profile?.id ? <span className="text-[10px] text-green-500 font-bold uppercase italic">Your Stock</span> : <button className="bg-orange-500 text-white px-3 py-1 rounded text-xs font-bold shadow-sm hover:bg-orange-600 transition" onClick={()=>alert(`Request sent to ${h.holder_name}`)}>Request</button>}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- MY LOCAL STORE (FUNCTIONAL MANAGE & ALERT) ---
function MyStoreView({ profile }: any) {
  const [myItems, setMyItems] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [consumeItem, setConsumeItem] = useState<any>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ cat: "", sub: "", make: "", model: "", spec: "", qty: "" });

  useEffect(() => { if (profile) fetch(); }, [profile]);

  const fetch = async () => {
    const { data } = await supabase.from("inventory").select("*").eq("holder_uid", profile.id).order("id", { ascending: false });
    if (data) setMyItems(data);
  };

  const outOfStockCount = myItems.filter(i => i.qty === 0).length;

  const handleSave = async () => {
    if (!form.spec || !form.qty) return alert("Fill all details!");
    const { error } = await supabase.from("inventory").insert([{
      item: `${form.make} ${form.sub} ${form.model}`.trim(), cat: form.cat, sub: form.sub, make: form.make, model: form.model, spec: form.spec,
      qty: parseInt(form.qty), unit: 'Nos', holder_unit: profile.unit, holder_uid: profile.id, holder_name: profile.name
    }]);
    if (!error) { alert("Saved!"); fetch(); setForm({ cat: "", sub: "", make: "", model: "", spec: "", qty: "" }); setShowAddModal(false); } else alert(error.message);
  };

  const updateQty = async (id: any, newQty: number) => {
    if (newQty < 0) return alert("Quantity cannot be negative!");
    const { error } = await supabase.from("inventory").update({ qty: newQty }).eq('id', id);
    if (!error) { alert("Stock Updated!"); fetch(); setConsumeItem(null); setEditItem(null); } else alert(error.message);
  };

  const categories = [...new Set(masterCatalog.map(i => i.cat))];
  const subs = [...new Set(masterCatalog.filter(i => i.cat === form.cat).map(i => i.sub))];
  const specs = [...new Set(masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub).map(i => i.spec))];

  return (
    <div className="animate-fade-in space-y-6 pb-10">
      {/* ACTION REQUIRED ALERT */}
      {outOfStockCount > 0 && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 animate-fade-in shadow-sm">
          <i className="fa-solid fa-triangle-exclamation text-red-500 text-xl mt-1"></i>
          <div><h3 className="font-bold text-red-800 text-sm uppercase">Action Required: Restock Items</h3><p className="text-xs text-red-600 font-bold">{outOfStockCount} items in your zone are currently Out of Stock. Please Restock.</p></div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
        <div><h2 className="text-xl font-bold text-slate-800 font-industrial">My Local Store</h2><p className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded mt-1 uppercase tracking-tighter inline-block">Managing Zone: {profile?.unit}</p></div>
        <button onClick={() => setShowAddModal(true)} className="iocl-btn text-white px-6 py-2.5 rounded-xl font-bold shadow-md hover:shadow-lg transition flex items-center gap-2"><i className="fa-solid fa-plus"></i> Add New Stock</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold border-b uppercase">
            <tr><th className="p-5">Category</th><th className="p-5">Item Details</th><th className="p-5">Spec</th><th className="p-5 text-center">Qty</th><th className="p-5 text-center">Manage</th></tr>
          </thead>
          <tbody className="divide-y text-sm">
            {myItems.map(i => (
              <tr key={i.id} className={`${i.qty === 0 ? 'bg-red-50/20' : 'hover:bg-slate-50'} transition border-b border-slate-50`}>
                <td className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{i.cat}</td>
                <td className="p-5 font-bold text-slate-800">{i.item}</td>
                <td className="p-5"><span className="bg-slate-100 border px-2 py-1 rounded text-[11px] font-medium text-slate-600 shadow-sm">{i.spec}</span></td>
                <td className="p-5 font-bold text-center">{i.qty === 0 ? <span className="text-red-600 uppercase font-black text-[10px] bg-red-100 px-2 py-1 rounded border border-red-200">OUT OF STOCK</span> : <span className="text-emerald-600 text-lg">{i.qty} Nos</span>}</td>
                <td className="p-5 flex gap-3 justify-center items-center">
                    <button onClick={()=>setConsumeItem(i)} disabled={i.qty === 0} className="text-indigo-600 bg-indigo-50 p-2 rounded-lg hover:bg-indigo-100 transition disabled:opacity-50 disabled:cursor-not-allowed" title="Consume Stock"><i className="fa-solid fa-box-open text-xl"></i></button>
                    <button onClick={()=>setEditItem(i)} className="text-slate-500 bg-slate-100 p-2 rounded-lg hover:bg-slate-200 transition" title="Edit Stock"><i className="fa-solid fa-pen-to-square text-xl"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {/* ADD STOCK MODAL (MATERIAL UI LOOK) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 relative animate-scale-in">
            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-slate-400 font-bold text-xl hover:text-red-500 transition">✕</button>
            <h3 className="text-lg font-bold text-slate-800 mb-6 border-b pb-2 uppercase tracking-wide text-center">Add New Stock Item</h3>
            <div className="space-y-4">
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">1. Category</label><select className="w-full p-3 border-2 border-slate-100 rounded-lg text-sm bg-slate-50 focus:border-orange-500 outline-none transition" onChange={(e)=>setForm({...form, cat: e.target.value})}><option value="">-- Select --</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2. Sub-Category</label><select className="w-full p-3 border-2 border-slate-100 rounded-lg text-sm bg-white focus:border-orange-500 outline-none transition disabled:opacity-50" disabled={!form.cat} onChange={(e)=>setForm({...form, sub: e.target.value})}><option value="">-- Select --</option>{subs.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">3. Specification</label><select className="w-full p-3 border-2 border-slate-100 rounded-lg text-sm bg-white focus:border-orange-500 outline-none transition disabled:opacity-50" disabled={!form.sub} onChange={(e)=>setForm({...form, spec: e.target.value})}><option value="">-- Select --</option>{specs.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">4. Quantity</label><input type="number" placeholder="Enter Qty" className="w-full p-3 border-2 border-slate-100 rounded-lg text-xl font-bold outline-none focus:border-orange-500 text-center" onChange={(e)=>setForm({...form, qty: e.target.value})} /></div>
              <button onClick={handleSave} className="w-full py-4 iocl-btn text-white font-bold rounded-xl shadow-lg uppercase tracking-widest mt-2 hover:scale-[1.02] transition">Save & Add Stock</button>
            </div>
          </div>
        </div>
      )}

      {/* CONSUME MODAL */}
      {consumeItem && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"><div className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-2xl relative"><button onClick={()=>setConsumeItem(null)} className="absolute top-4 right-4 text-slate-400">✕</button><h3 className="font-bold text-slate-800 mb-2 uppercase">Consume Stock</h3><p className="text-xs text-slate-500 mb-6 font-bold uppercase">{consumeItem.item}</p><label className="text-[10px] font-black text-slate-400">QTY TO REMOVE</label><input type="number" id="cQty" placeholder="Qty" className="w-full p-4 border-2 border-slate-100 rounded-xl mb-4 outline-none focus:border-red-500 text-center font-bold text-2xl" /><button onClick={()=>updateQty(consumeItem.id, consumeItem.qty - (parseInt((document.getElementById('cQty') as HTMLInputElement).value) || 0))} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl shadow-md uppercase tracking-wider">Confirm Consume</button></div></div>}

      {/* EDIT MODAL */}
      {editItem && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"><div className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-2xl relative"><button onClick={()=>setEditItem(null)} className="absolute top-4 right-4 text-slate-400">✕</button><h3 className="font-bold text-slate-800 mb-6 uppercase border-b pb-2">Edit Quantity</h3><p className="text-xs text-slate-500 mb-6 font-bold uppercase">{editItem.item}</p><label className="text-[10px] font-black text-slate-400">NEW QUANTITY</label><input type="number" id="eQty" defaultValue={editItem.qty} className="w-full p-4 border-2 border-slate-100 rounded-xl mb-4 outline-none focus:border-blue-500 text-center font-bold text-2xl" /><button onClick={()=>updateQty(editItem.id, parseInt((document.getElementById('eQty') as HTMLInputElement).value) || 0)} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-md uppercase tracking-wider">Update Details</button></div></div>}
    </div>
  );
}

function UsageHistoryView({ profile }: any) {
  return (
    <section className="bg-white rounded-xl shadow-sm border overflow-hidden animate-fade-in">
        <div className="p-6 border-b bg-slate-50/50"><h2 className="text-lg font-bold font-industrial">Recent Consumption History</h2></div>
        <div className="p-20 text-center italic text-slate-400">Logic to fetch usage logs coming soon...</div>
    </section>
  );
}