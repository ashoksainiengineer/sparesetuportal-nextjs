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
      {/* --- SIDEBAR (ALL 5 TABS) --- */}
      <aside className="w-64 bg-white hidden md:flex flex-col flex-shrink-0 z-20 shadow-xl border-r border-slate-200">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-orange-600">
            <i className="fa-solid fa-layer-group"></i>
          </div>
          <span className="text-lg font-bold text-slate-800 font-industrial uppercase tracking-wide">Menu</span>
        </div>
        <nav className="flex-1 px-3 space-y-1 mt-4">
          {[
            { id: 'search', label: 'Global Search', icon: 'fa-globe' },
            { id: 'mystore', label: 'My Local Store', icon: 'fa-warehouse' },
            { id: 'analysis', label: 'Monthly Analysis', icon: 'fa-chart-pie' },
            { id: 'usage', label: 'My Usage', icon: 'fa-clock-rotate-left' },
            { id: 'returns', label: 'Returns & Udhaari', icon: 'fa-hand-holding-hand' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${activeTab === tab.id ? 'active-nav' : 'text-slate-600'}`}>
              <i className={`fa-solid ${tab.icon} w-5`}></i> <span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white border mb-2 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-xs">{profile?.name?.charAt(0)}</div>
            <div className="overflow-hidden"><p className="text-[9px] text-slate-400 font-bold uppercase">Logged in</p><div className="text-xs font-bold text-slate-700 truncate">{profile?.name}</div></div>
          </div>
          <button onClick={() => supabase.auth.signOut().then(()=>window.location.reload())} className="w-full py-2 text-xs text-red-500 hover:bg-red-50 font-bold rounded-lg transition border border-red-100">Logout</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-y-auto relative pb-20 md:pb-0">
        <header className="header-bg text-white p-4 sticky top-0 z-30 shadow-md flex justify-between items-center">
            <div className="flex items-center gap-6">
              <div className="iocl-logo-container hidden md:flex flex-col items-center" style={{ fontSize: '10px' }}>
                <div className="iocl-circle"><div className="iocl-band"><span className="iocl-hindi-text">इंडियनऑयल</span></div></div>
                <div className="iocl-english-text" style={{ color: 'white', fontWeight: 800 }}>IndianOil</div>
                <div className="font-script text-orange-400 text-[10px] mt-1 whitespace-nowrap">The Energy of India</div>
              </div>
              <div className="flex flex-col items-center"> 
                <h1 className="font-industrial text-2xl md:text-3xl uppercase tracking-wider leading-none font-bold">Gujarat Refinery</h1>
                <p className="font-hindi text-blue-400 text-xs font-bold tracking-wide mt-1">जहाँ प्रगति ही जीवन सार है</p>
              </div>
            </div>
            <h2 className="font-industrial text-xl text-orange-500 tracking-[0.1em] font-bold">SPARE SETU</h2>
        </header>

        <div className="p-4 md:p-10 max-w-7xl mx-auto w-full space-y-8">
          {activeTab === "search" && <GlobalSearchView profile={profile} />}
          {activeTab === "mystore" && <MyStoreView profile={profile} fetchProfile={()=>fetchProfile(user.id)} />}
          {activeTab === "usage" && <UsageHistoryView profile={profile} />}
          {activeTab === "analysis" && <MonthlyAnalysisView profile={profile} />}
          {activeTab === "returns" && <ReturnsLedgerView profile={profile} />}
        </div>
      </main>
    </div>
  );
}

// --- AUTH VIEW (OTP + ZONE VALIDATION + HINDI NAMES) ---
function AuthView() {
  const [view, setView] = useState<"login" | "register" | "otp">("login");
  const [form, setForm] = useState({ email: "", pass: "", name: "", unit: "", enteredOtp: "", generatedOtp: "" });
  const [authLoading, setAuthLoading] = useState(false);

  const handleAuth = async () => {
    setAuthLoading(true);
    if (view === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.pass });
      if (error) alert(error.message);
    } else if (view === "register") {
      if (!form.name || !form.unit || !form.email) { alert("Sari details bhariye!"); setAuthLoading(false); return; }
      
      const { data: allowed } = await supabase.from('allowed_users').select('*').eq('email', form.email).eq('unit', form.unit).single();
      if (!allowed) { alert("Access Denied: Email mapping not found for this zone."); setAuthLoading(false); return; }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setForm({ ...form, generatedOtp: otp });
      const res = await fetch('/api/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, email: form.email, otp }) });
      if (res.ok) { alert("OTP sent to your email!"); setView("otp"); } else alert("OTP Send Failed");
    } else if (view === "otp") {
      if (form.enteredOtp === form.generatedOtp) {
        const { error } = await supabase.auth.signUp({ email: form.email, password: form.pass, options: { data: { name: form.name, unit: form.unit } } });
        if (error) alert(error.message); else { alert("Account Created! Login Now."); setView("login"); }
      } else alert("Wrong OTP");
    }
    setAuthLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 login-bg">
      <div className="w-full max-w-md login-card rounded-2xl shadow-2xl p-8 border-t-4 border-orange-500 text-center relative">
        <h1 className="font-industrial text-2xl font-bold text-white uppercase tracking-wider">Gujarat Refinery</h1>
        <p className="font-hindi text-blue-400 text-sm font-bold mt-1 mb-6">जहाँ प्रगति ही जीवन सार है</p>
        <div className="space-y-4">
          {view === "register" && (
            <>
              <input type="text" placeholder="Full Name" className="w-full p-3 rounded-lg login-input text-sm" onChange={e=>setForm({...form, name:e.target.value})} />
              <select className="w-full p-3 rounded-lg login-input text-sm bg-slate-900 text-slate-300" onChange={e=>setForm({...form, unit:e.target.value})}>
                <option value="">Select Zone</option>
                {["RUP - South Block", "RUP - North Block", "LAB", "MSQU", "AU-5", "BS-VI", "GR-II & NBA", "GR-I", "OM&S", "OLD SRU & CETP", "Electrical Planning", "Electrical Testing", "Electrical Workshop", "FCC", "GRE", "CGP-I", "CGP-II & TPS", "Water Block & Bitumen", "Township - Estate Office", "AC Section", "GHC", "DHUMAD"].map(z=><option key={z} value={z}>{z}</option>)}
              </select>
            </>
          )}
          {view === "otp" ? <input type="text" placeholder="Enter OTP" className="w-full p-3 rounded-lg login-input text-center text-xl tracking-[0.5em] text-white" onChange={e=>setForm({...form, enteredOtp:e.target.value})} /> : <input type="email" placeholder="Official Email ID" value={form.email} className="w-full p-3 rounded-lg login-input text-sm" onChange={e=>setForm({...form, email:e.target.value})} />}
          {view !== "otp" && <input type="password" placeholder="Password" className="w-full p-3 rounded-lg login-input text-sm" onChange={e=>setForm({...form, pass:e.target.value})} />}
          <button onClick={handleAuth} className="w-full h-12 mt-4 iocl-btn text-white font-bold rounded-lg shadow-lg uppercase tracking-widest">{authLoading ? "..." : "Continue"}</button>
          <button onClick={()=>setView(view==='login'?'register':'login')} className="text-xs text-slate-400 mt-4 underline">{view==='login'?'Create Account':'Back to Login'}</button>
          <div className="mt-8 pt-4 border-t border-white/10 text-center">
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Developed By</p>
            <p className="text-[11px] text-slate-300 font-bold font-hindi">अशोक सैनी • दीपक चौहान • दिव्यांक सिंह राजपूत</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- GLOBAL SEARCH (TOTAL STOCK + SUMMARY MODAL) ---
function GlobalSearchView({ profile }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [contributors, setContributors] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selCat, setSelCat] = useState("all");
  const [selSub, setSelSub] = useState("all");
  const [showSummary, setShowSummary] = useState(false);
  const [breakdown, setBreakdown] = useState<any>(null);

  useEffect(() => { 
    const fetchAll = async () => { const { data } = await supabase.from("inventory").select("*"); if (data) setItems(data); };
    const fetchLead = async () => { const { data } = await supabase.from("profiles").select("name, unit, item_count").order("item_count", { ascending: false }).limit(3); if (data) setContributors(data); };
    fetchAll(); fetchLead();
  }, []);

  const grouped: any = {};
  items.forEach(i => {
    const key = `${i.item}-${i.spec}`.toLowerCase();
    if (!grouped[key]) grouped[key] = { ...i, totalQty: 0, holders: [] };
    grouped[key].totalQty += i.qty;
    grouped[key].holders.push(i);
  });

  const availableSubCats = [...new Set(items.filter(i => selCat === "all" || selCat === "zero" ? true : i.cat === selCat).map(i => i.sub))].sort();

  const filtered = Object.values(grouped).filter((i: any) => {
    const matchSearch = i.item.toLowerCase().includes(search.toLowerCase()) || i.spec.toLowerCase().includes(search.toLowerCase());
    const matchCat = selCat === "all" ? true : (selCat === "zero" ? i.totalQty === 0 : i.cat === selCat);
    const matchSub = selSub === "all" ? true : i.sub === selSub;
    return matchSearch && matchCat && matchSub;
  });

  const summaryMap: any = {};
  filtered.forEach((i: any) => {
    const key = `${i.cat}||${i.sub}`;
    if (!summaryMap[key]) summaryMap[key] = { cat: i.cat, sub: i.sub, total: 0 };
    summaryMap[key].total += i.totalQty;
  });

  const exportCSV = () => {
    const csv = "Item,Category,Sub-Category,Total Stock,Spec\n" + filtered.map((i:any) => `"${i.item}","${i.cat}","${i.sub}","${i.totalQty}","${i.spec}"`).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Global_Stock.csv'; a.click();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Contributors UI */}
      <section className="bg-white p-4 rounded-xl border flex flex-wrap items-center gap-4 shadow-sm">
        <h2 className="text-sm font-bold flex items-center gap-2 uppercase text-slate-700"><i className="fa-solid fa-trophy text-yellow-500"></i> Top Contributors</h2>
        <div className="flex gap-3 overflow-x-auto flex-1 pb-1">{contributors.map((c, idx) => (<div key={idx} className="bg-slate-50 p-2 rounded-lg border flex items-center gap-3 min-w-[180px] shadow-sm"><div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs border-2 border-orange-400">{c.name.charAt(0)}</div><div><p className="text-xs font-bold text-slate-800 truncate">{c.name}</p><p className="text-[9px] text-slate-400">{c.unit}</p><p className="text-[9px] font-bold text-green-600 uppercase tracking-tighter">{c.item_count || 0} Items Added</p></div></div>))}</div>
      </section>

      <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {/* ATTACHED HEADER UI */}
        <div className="p-4 border-b bg-slate-50/80 flex flex-wrap items-center gap-2">
             <div className="relative flex-grow md:w-80"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Global Inventory Search..." className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none focus:ring-1 focus:ring-orange-500 shadow-inner" onChange={(e)=>setSearch(e.target.value)} /></div>
             <select className="border rounded-md text-xs font-bold p-2 bg-white" onChange={(e)=>{setSelCat(e.target.value); setSelSub("all");}}>
                <option value="all">Category: All</option>
                {[...new Set(items.map(i => i.cat))].sort().filter(c=>c!=="zero").map(c => <option key={c} value={c}>{c}</option>)}
                <option value="zero" className="text-red-600 font-bold">⚠️ Out of Stock Items</option>
             </select>
             <select className="border rounded-md text-xs font-bold p-2 bg-white" disabled={selCat === 'all' || selCat === 'zero'} value={selSub} onChange={(e)=>setSelSub(e.target.value)}>
                <option value="all">Sub: All</option>
                {availableSubCats.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
             <div className="flex gap-2 ml-auto">
                <button onClick={()=>setShowSummary(true)} className="bg-indigo-600 text-white px-3 py-2 rounded-md text-xs font-bold shadow-sm flex items-center gap-2"><i className="fa-solid fa-chart-pie"></i> Stock Summary</button>
                <button onClick={exportCSV} className="bg-emerald-600 text-white px-3 py-2 rounded-md text-xs font-bold shadow-sm flex items-center gap-2"><i className="fa-solid fa-file-csv"></i> Export CSV</button>
             </div>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b"><tr><th className="p-4">Item Details</th><th className="p-4">Spec</th><th className="p-4 text-center">Total Stock</th><th className="p-4 text-center">Action</th></tr></thead>
          <tbody className="divide-y text-sm">
            {filtered.map((i: any, idx: number) => (
              <tr key={idx} className={`hover:bg-slate-50 transition border-b border-slate-50 ${i.totalQty === 0 ? 'bg-red-50/30' : ''}`}>
                <td className="p-4 font-bold text-slate-800">{i.item}<div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{i.cat}</div></td>
                <td className="p-4"><span className="bg-white border px-2 py-1 rounded text-[11px] font-medium text-slate-600 shadow-sm">{i.spec}</span></td>
                <td className="p-4 text-center">
                  {i.totalQty === 0 ? <span className="text-red-600 font-black text-[10px] uppercase bg-red-100 px-2 py-1 rounded border border-red-200">Out of Stock</span> : 
                  <button onClick={()=>setBreakdown(i)} className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-lg border border-blue-200 font-bold hover:bg-blue-100 transition shadow-sm flex items-center gap-2 mx-auto">{i.totalQty} Nos <i className="fa-solid fa-chevron-right text-[9px]"></i></button>}
                </td>
                <td className="p-4 text-center text-[10px] font-bold text-slate-400 uppercase italic">Breakdown</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>

      {/* SUMMARY MODAL */}
      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-in max-h-[80vh] flex flex-col">
                <div className="bg-indigo-50 px-6 py-4 border-b flex justify-between items-center"><h3 className="text-lg font-bold text-indigo-900">Total Stock Summary (All Zones)</h3><button onClick={()=>setShowSummary(false)} className="text-slate-400 hover:text-red-500 font-bold text-xl">✕</button></div>
                <div className="overflow-y-auto p-4 space-y-4">
                    {Object.entries(summaryMap).map(([key, row]: any) => (
                        <div key={key} className="border rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-slate-100 p-2 text-[10px] font-black text-slate-600 uppercase tracking-widest">{row.cat}</div>
                            <table className="w-full text-sm"><tbody className="divide-y"><tr className="hover:bg-slate-50"><td className="p-3 pl-6 text-slate-600">{row.sub}</td><td className="p-3 text-right pr-6 font-bold text-indigo-600">{row.total} Nos</td></tr></tbody></table>
                        </div>
                    ))}
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
             <div className="overflow-hidden border border-slate-100 rounded-xl bg-slate-50/50">
               <table className="w-full text-left">
                 <thead className="bg-slate-100 text-xs font-bold text-slate-500 uppercase border-b"><tr><th className="p-4">Unit / Zone</th><th className="p-4">Engineer</th><th className="p-4 text-right">Qty</th><th className="p-4 text-center">Action</th></tr></thead>
                 <tbody className="divide-y text-sm bg-white">
                   {breakdown.holders.map((h:any, idx:number)=>(
                     <tr key={idx} className="hover:bg-indigo-50/30 transition">
                        <td className="p-4 font-bold text-slate-700">{h.holder_unit}</td>
                        <td className="p-4 flex items-center gap-2 text-slate-500"><div className="w-6 h-6 rounded-full bg-slate-200 text-[10px] flex items-center justify-center font-bold">{h.holder_name?.charAt(0)}</div>{h.holder_name}</td>
                        <td className="p-4 text-right font-bold text-indigo-600">{h.qty} Nos</td>
                        <td className="p-4 text-center">{h.holder_uid === profile?.id ? <span className="text-[10px] text-green-500 font-bold uppercase italic">Your Stock</span> : <button className="bg-orange-500 text-white px-3 py-1 rounded text-xs font-bold shadow-sm hover:bg-orange-600 transition" onClick={()=>alert(`Request logic coming soon`)}>Request</button>}</td>
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

// --- MY LOCAL STORE (RESTOCK ALERT + AUTO-SELECT + MANAGE) ---
function MyStoreView({ profile, fetchProfile }: any) {
  const [myItems, setMyItems] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [consumeItem, setConsumeItem] = useState<any>(null);
  const [editItem, setEditItem] = useState<any>(null); // FIXED
  const [form, setForm] = useState({ cat: "", sub: "", make: "", model: "", spec: "", qty: "", isManual: false });
  const [search, setSearch] = useState("");
  const [selCat, setSelCat] = useState("all");

  useEffect(() => { if (profile) fetch(); }, [profile]);

  const fetch = async () => {
    const { data } = await supabase.from("inventory").select("*").eq("holder_uid", profile.id).order("id", { ascending: false });
    if (data) setMyItems(data);
  };

  const filteredItems = myItems.filter(i => (i.item.toLowerCase().includes(search.toLowerCase()) || i.spec.toLowerCase().includes(search.toLowerCase())) && (selCat === 'all' ? true : i.cat === selCat));
  const outOfStockCount = myItems.filter(i => i.qty === 0).length;

  const handleSave = async () => {
    if (!form.spec || !form.qty) return alert("Sari details bhariye!");
    const itemName = form.isManual ? form.model : `${form.make} ${form.sub} ${form.model}`.trim();
    const { error } = await supabase.from("inventory").insert([{
      item: itemName, cat: form.cat || "Manual Entry", sub: form.sub || "-", make: form.make || "-", model: form.model || "-", spec: form.spec,
      qty: parseInt(form.qty), unit: 'Nos', holder_unit: profile.unit, holder_uid: profile.id, holder_name: profile.name
    }]);
    if (!error) { 
        alert("Stock Saved!"); fetch(); setShowAddModal(false); setForm({ cat: "", sub: "", make: "", model: "", spec: "", qty: "", isManual: false }); 
        await supabase.from("profiles").update({ item_count: (profile.item_count || 0) + 1 }).eq('id', profile.id);
        fetchProfile();
    } else alert(error.message);
  };

  const updateQty = async (id: any, newQty: number, logUsage = false) => {
    const { error } = await supabase.from("inventory").update({ qty: newQty }).eq('id', id);
    if (!error) {
      if(logUsage && consumeItem) {
        await supabase.from("usage_logs").insert([{ item_name: consumeItem.item, category: consumeItem.cat, spec: consumeItem.spec, qty_consumed: consumeItem.qty - newQty, consumer_uid: profile.id, consumer_name: profile.name, consumer_unit: profile.unit }]);
      }
      alert("Updated!"); fetch(); setConsumeItem(null); setEditItem(null); 
    } else alert(error.message);
  };

  // Auto-Select Logic
  const categories = [...new Set(masterCatalog.map(i => i.cat))].sort();
  const subs = [...new Set(masterCatalog.filter(i => i.cat === form.cat).map(i => i.sub))].sort();
  const makes = [...new Set(masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub).map(i => i.make))].sort();
  const models = [...new Set(masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub && i.make === form.make).map(i => i.model))].sort();
  const specs = [...new Set(masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub && i.make === form.make && i.model === form.model).map(i => i.spec))].sort();

  useEffect(() => { if (form.cat && subs.length === 1 && !form.sub) setForm(f => ({...f, sub: subs[0]})); }, [form.cat, subs]);
  useEffect(() => { if (form.sub && makes.length === 1 && !form.make) setForm(f => ({...f, make: makes[0]})); }, [form.sub, makes]);
  useEffect(() => { if (form.make && models.length === 1 && !form.model) setForm(f => ({...f, model: models[0]})); }, [form.make, models]);
  useEffect(() => { if (form.model && specs.length === 1 && !form.spec) setForm(f => ({...f, spec: specs[0]})); }, [form.model, specs]);

  const exportMyCSV = () => {
    const csv = "Category,Item Name,Spec,Qty\n" + myItems.map(i => `"${i.cat}","${i.item}","${i.spec}","${i.qty}"`).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'My_Store.csv'; a.click();
  };

  return (
    <div className="animate-fade-in space-y-6 pb-10">
      {/* RESTOCK WARNING */}
      {outOfStockCount > 0 && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 animate-fade-in shadow-sm">
          <i className="fa-solid fa-triangle-exclamation text-red-500 text-xl mt-1"></i>
          <div><h3 className="font-bold text-red-800 text-sm uppercase leading-tight">Action Needed: Restock Required</h3><p className="text-xs text-red-600 font-bold">{outOfStockCount} items are out of stock. Please update inventory.</p></div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
        <div><h2 className="text-xl font-bold text-slate-800 font-industrial uppercase tracking-wide">My Local Store</h2><p className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded mt-1 uppercase tracking-tighter inline-block">ZONE: {profile?.unit}</p></div>
        <div className="flex gap-2">
            <button onClick={exportMyCSV} className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition flex items-center gap-2"><i className="fa-solid fa-file-csv"></i> Export CSV</button>
            <button onClick={() => setShowAddModal(true)} className="iocl-btn text-white px-6 py-2.5 rounded-xl font-bold shadow-md hover:scale-105 transition flex items-center gap-2"><i className="fa-solid fa-plus"></i> Add New Stock</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b bg-slate-50/80 flex flex-wrap items-center gap-2">
             <div className="relative flex-grow md:w-64"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Filter My Store..." className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none focus:ring-1 focus:ring-orange-500" onChange={(e)=>setSearch(e.target.value)} /></div>
             <select className="border rounded-md text-xs font-bold p-2 bg-white" onChange={(e)=>setSelCat(e.target.value)}>
                <option value="all">Filter: All Categories</option>
                {[...new Set(myItems.map(i => i.cat))].sort().map(c => <option key={c} value={c}>{c}</option>)}
             </select>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold border-b uppercase"><tr><th className="p-5">Category</th><th className="p-5">Item Details</th><th className="p-5">Spec</th><th className="p-5 text-center">Qty</th><th className="p-5 text-center">Manage</th></tr></thead>
          <tbody className="divide-y text-sm">
            {filteredItems.map(i => (
              <tr key={i.id} className={`${i.qty === 0 ? 'bg-red-50/30' : 'hover:bg-slate-50'} transition border-b border-slate-50`}>
                <td className="p-5 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{i.cat}</td>
                <td className="p-5 font-bold text-slate-800">{i.item}</td>
                <td className="p-5"><span className="bg-slate-100 border px-2 py-0.5 rounded text-[11px] font-medium text-slate-600 shadow-sm">{i.spec}</span></td>
                <td className="p-5 font-bold text-center">{i.qty === 0 ? <span className="text-red-600 font-black text-[10px] uppercase bg-red-100 px-2 py-1 rounded border border-red-200">Out of Stock</span> : <span className="text-emerald-600 text-lg font-black">{i.qty} Nos</span>}</td>
                <td className="p-5 flex gap-3 justify-center items-center">
                    <button onClick={()=>setConsumeItem(i)} disabled={i.qty === 0} className="text-indigo-600 bg-indigo-50 p-2 rounded-lg hover:bg-indigo-100 transition disabled:opacity-30" title="Consume Stock"><i className="fa-solid fa-box-open text-xl"></i></button>
                    <button onClick={()=>setEditItem(i)} className="text-slate-400 bg-slate-100 p-2 rounded-lg hover:bg-slate-200 transition" title="Correct Details"><i className="fa-solid fa-pen-to-square text-xl"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {/* CONSUME MODAL */}
      {consumeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="bg-white px-6 py-4 border-b flex justify-between items-center"><h3 className="text-lg font-bold text-slate-800">Consume Item</h3><button onClick={()=>setConsumeItem(null)} className="text-slate-300 hover:text-red-500 font-bold text-xl">✕</button></div>
            <div className="p-6 space-y-4">
                <div className="text-sm font-bold text-slate-700 leading-tight mb-2">{consumeItem.item}</div>
                <div className="bg-slate-50 p-3 rounded-lg flex justify-between items-center border border-slate-100"><span className="text-xs text-slate-400 font-bold uppercase tracking-tight">Available Stock:</span> <span className="text-sm font-black text-slate-800">{consumeItem.qty} Nos</span></div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Quantity to Remove</label><input type="number" id="cQty" placeholder="1" className="w-full p-3 border-2 border-slate-200 rounded-lg text-lg font-bold outline-none focus:border-indigo-500 text-center" /></div>
                <button onClick={()=>updateQty(consumeItem.id, consumeItem.qty - (parseInt((document.getElementById('cQty') as HTMLInputElement).value) || 0), true)} className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl shadow-lg uppercase tracking-widest hover:bg-indigo-700 transition">Confirm Consumption</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-scale-in p-6">
            <div className="flex justify-between items-center mb-6 border-b pb-2"><h3 className="text-lg font-bold uppercase">Correct Quantity</h3><button onClick={()=>setEditItem(null)} className="text-slate-300">✕</button></div>
            <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-tighter">{editItem.item}</p>
            <input type="number" id="eQty" defaultValue={editItem.qty} className="w-full p-3 border-2 rounded-xl text-center text-2xl font-black mb-4 focus:border-blue-500 outline-none" />
            <button onClick={()=>updateQty(editItem.id, parseInt((document.getElementById('eQty') as HTMLInputElement).value) || 0)} className="w-full py-4 bg-blue-600 text-white font-black rounded-xl uppercase tracking-widest hover:bg-blue-700 shadow-md">Save Changes</button>
          </div>
        </div>
      )}

      {/* ADD STOCK MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 relative animate-scale-in max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-slate-400 font-bold text-xl hover:text-red-500 transition">✕</button>
            <h3 className="text-lg font-bold text-slate-800 mb-6 border-b pb-2 uppercase tracking-wide text-center font-industrial">Add New Stock</h3>
            
            <div className="flex items-center justify-between bg-yellow-50 p-3 rounded-xl border border-yellow-200 mb-6">
                <span className="text-xs font-bold text-yellow-800 uppercase tracking-tighter"><i className="fa-solid fa-circle-info mr-1"></i> Item not in list?</span>
                <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" onChange={(e)=>setForm({...form, isManual: e.target.checked})} /><div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-orange-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div><span className="ml-3 text-xs font-bold text-slate-600 uppercase">Manual Entry</span></label>
            </div>

            <div className="space-y-4">
              {!form.isManual ? (<>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Category</label><select className="w-full p-3 border-2 border-slate-100 rounded-lg text-sm bg-slate-50 focus:border-orange-500 outline-none" onChange={e=>setForm({...form, cat: e.target.value, sub:"", make:"", model:"", spec:""})} value={form.cat}><option value="">-- Select --</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Sub Category</label><select className="w-full p-3 border-2 border-slate-100 rounded-lg text-sm bg-white outline-none disabled:bg-slate-100" disabled={!form.cat} value={form.sub} onChange={e=>setForm({...form, sub: e.target.value, make:"", model:"", spec:""})}><option value="">-- Select --</option>{subs.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Make</label><select className="w-full p-3 border-2 border-slate-100 rounded-lg text-sm bg-white outline-none disabled:bg-slate-100" disabled={!form.sub} value={form.make} onChange={e=>setForm({...form, make: e.target.value, model:"", spec:""})}><option value="">-- Select --</option>{makes.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                </div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Model</label><select className="w-full p-3 border-2 border-slate-100 rounded-lg text-sm bg-white outline-none disabled:bg-slate-100" disabled={!form.make} value={form.model} onChange={e=>setForm({...form, model: e.target.value, spec:""})}><option value="">-- Select --</option>{models.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Specification</label><select className="w-full p-3 border-2 border-slate-100 rounded-lg text-sm bg-white outline-none disabled:bg-slate-100" disabled={!form.model} value={form.spec} onChange={e=>setForm({...form, spec: e.target.value})}><option value="">-- Select --</option>{specs.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              </>) : (
                <div className="space-y-4">
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Item Name</label><input type="text" placeholder="Item Name" className="w-full p-3 border-2 border-slate-100 rounded-lg text-sm outline-none focus:border-orange-500" onChange={e=>setForm({...form, model: e.target.value})} /></div>
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Specification</label><input type="text" placeholder="Tech Details" className="w-full p-3 border-2 border-slate-100 rounded-lg text-sm outline-none focus:border-orange-500" onChange={e=>setForm({...form, spec: e.target.value})} /></div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 border-t pt-4">
                  <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Initial Qty</label><input type="number" placeholder="0" className="w-full p-3 border-2 border-slate-100 rounded-lg text-xl font-black text-center" onChange={e=>setForm({...form, qty: e.target.value})} /></div>
                  <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Unit</label><select className="w-full p-3 border-2 border-slate-100 rounded-lg text-sm bg-slate-50"><option>Nos</option><option>Mtrs</option><option>Set</option></select></div>
              </div>
              <button onClick={handleSave} className="w-full py-4 bg-slate-900 text-white font-black rounded-xl shadow-lg uppercase tracking-widest mt-2 hover:bg-slate-800 transition">Save Stock to Store</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- USAGE HISTORY ---
function UsageHistoryView({ profile }: any) {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => {
    const fetch = async () => { const { data } = await supabase.from("usage_logs").select("*").eq("consumer_uid", profile.id).order("timestamp", { ascending: false }); if (data) setLogs(data); };
    if (profile) fetch();
  }, [profile]);
  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
        <div className="p-5 border-b bg-slate-50/50 flex justify-between items-center"><h2 className="text-lg font-bold text-slate-800 font-industrial uppercase">Consumption History</h2><span className="text-[10px] font-bold bg-slate-200 px-2 py-1 rounded uppercase tracking-widest">Zone Logs</span></div>
        <div className="overflow-x-auto"><table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold border-b uppercase"><tr><th className="p-5">Date</th><th className="p-5">Item Details</th><th className="p-5 text-center">Consumed Qty</th></tr></thead>
          <tbody className="divide-y text-sm">
            {logs.map(l => (
              <tr key={l.id} className="hover:bg-slate-50 transition">
                <td className="p-5 text-xs text-slate-500 font-bold leading-tight">{new Date(l.timestamp).toLocaleDateString()} <br/> <span className="text-[9px] font-normal">{new Date(l.timestamp).toLocaleTimeString()}</span></td>
                <td className="p-5 font-bold text-slate-800">{l.item_name}<div className="text-[10px] text-slate-400 uppercase mt-0.5">{l.category} | {l.spec}</div></td>
                <td className="p-5 text-center font-black text-red-600">-{l.qty_consumed} Nos</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {logs.length === 0 && <div className="p-20 text-center italic text-slate-400">No records found.</div>}
    </section>
  );
}

// --- MONTHLY ANALYSIS VIEW ---
function MonthlyAnalysisView({ profile }: any) {
  const [analysis, setAnalysis] = useState<any[]>([]);
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("usage_logs").select("*").eq("consumer_uid", profile.id);
      if (data) {
        const stats: any = {};
        data.forEach((l: any) => {
          const month = new Date(l.timestamp).toLocaleString('default', { month: 'long', year: 'numeric' });
          if (!stats[month]) stats[month] = { month, total: 0, count: 0 };
          stats[month].total += Number(l.qty_consumed); stats[month].count += 1;
        });
        setAnalysis(Object.values(stats));
      }
    };
    if (profile) fetch();
  }, [profile]);
  return (
    <div className="space-y-6 pb-10">
      <div className="bg-white p-6 rounded-xl border flex justify-between items-center"><h2 className="text-xl font-bold font-industrial uppercase">Usage Statistics</h2></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {analysis.map((a, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border shadow-sm text-center transition hover:shadow-md">
            <div className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">{a.month}</div>
            <div className="text-3xl font-black text-slate-800">{a.total} <small className="text-[10px] text-slate-400 font-bold uppercase">Nos</small></div>
            <div className="text-[10px] font-bold text-emerald-500 mt-2 uppercase">{a.count} Consumptions</div>
          </div>
        ))}
      </div>
      {analysis.length === 0 && <div className="p-20 text-center italic text-slate-400 bg-white rounded-xl border">Insufficient data for trend analysis.</div>}
    </div>
  );
}

// --- RETURNS LEDGER VIEW ---
function ReturnsLedgerView({ profile }: any) {
    return (<div className="bg-white p-20 rounded-xl border text-center italic text-slate-400 border-dashed">Udhaari & Returns logic placeholder. [Logic from original site]</div>);
}