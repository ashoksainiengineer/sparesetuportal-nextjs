"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { masterCatalog } from "@/lib/masterdata";

export default function SpareSetuApp() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("search");
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { setUser(session.user); fetchProfile(session.user.id); }
      setLoading(false);
    };
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) { setUser(session.user); fetchProfile(session.user.id); }
      else { setUser(null); setProfile(null); }
      setLoading(false);
    });
    getSession();
    return () => authListener.subscription.unsubscribe();
  }, []);

  // REAL-TIME NOTIFICATION LOGIC
  useEffect(() => {
    if (!profile?.id || !profile?.unit) return;
    const fetchAllCounts = async () => {
        const { count: incoming } = await supabase.from("requests").select("*", { count: 'exact', head: true }).eq("to_unit", profile.unit).in("status", ["pending", "return_requested"]);
        const { count: updates } = await supabase.from("requests").select("*", { count: 'exact', head: true }).eq("from_uid", profile.id).eq("viewed_by_requester", false).in("status", ["approved", "rejected", "returned"]);
        setPendingCount((incoming || 0) + (updates || 0));
    };
    fetchAllCounts();
    const channel = supabase.channel('notif-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => { fetchAllCounts(); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  useEffect(() => {
    if (activeTab === 'returns' && profile?.id) {
        supabase.from("requests").update({ viewed_by_requester: true }).eq("from_uid", profile.id).eq("viewed_by_requester", false).then(() => {});
    }
  }, [activeTab, profile]);

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
    if (data) setProfile(data);
  };

  if (loading) return (
    <div className="fixed inset-0 z-[60] bg-[#0f172a] flex flex-col items-center justify-center">
      <div className="iocl-logo-container mb-4 animate-pulse" style={{ fontSize: '20px' }}>
        <div className="iocl-circle"><div className="iocl-band"><span className="iocl-hindi-text">इंडियनऑयल</span></div></div>
      </div>
      <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.3em]">SpareSetu Loading...</p>
    </div>
  );

  if (!user) return <AuthView />;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f1f5f9]">
      <aside className="w-64 bg-white hidden md:flex flex-col flex-shrink-0 z-20 shadow-xl border-r border-slate-200">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-orange-600"><i className="fa-solid fa-layer-group"></i></div>
          <span className="text-lg font-bold text-slate-800 font-industrial uppercase tracking-wide">Menu</span>
        </div>
        <nav className="flex-1 px-3 space-y-1 mt-4 overflow-y-auto">
          {[
            { id: 'search', label: 'Global Search', icon: 'fa-globe', badge: 0 },
            { id: 'mystore', label: 'My Local Store', icon: 'fa-warehouse', badge: 0 },
            { id: 'analysis', label: 'Monthly Analysis', icon: 'fa-chart-pie', badge: 0 },
            { id: 'usage', label: 'My Usage History', icon: 'fa-clock-rotate-left', badge: 0 },
            { id: 'returns', label: 'Returns & Udhaari', icon: 'fa-hand-holding-hand', badge: pendingCount }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium relative ${activeTab === tab.id ? 'active-nav' : 'text-slate-600 hover:bg-slate-50'}`}>
              <i className={`fa-solid ${tab.icon} w-5`}></i> 
              <span>{tab.label}</span>
              {(tab.badge || 0) > 0 && <span className="absolute right-3 top-3.5 bg-orange-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black animate-bounce">{tab.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white border mb-2 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-xs">{profile?.name?.charAt(0)}</div>
            <div className="overflow-hidden"><p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Logged in</p><div className="text-xs font-bold text-slate-700 truncate">{profile?.name}</div></div>
          </div>
          <button onClick={() => supabase.auth.signOut().then(()=>window.location.reload())} className="w-full py-2 text-xs text-red-500 hover:bg-red-50 font-bold rounded-lg transition border border-red-100">Logout</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-y-auto relative pb-20 md:pb-0">
        <header className="header-bg text-white sticky top-0 z-30 shadow-md">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="iocl-logo-container hidden md:flex" style={{ fontSize: '10px' }}>
                <div className="iocl-circle"><div className="iocl-band"><span className="iocl-hindi-text">इंडियनऑयल</span></div></div>
                <div className="iocl-english-text" style={{ color: 'white' }}>IndianOil</div>
                <div className="font-script text-orange-400 text-[10px] mt-1 whitespace-nowrap">The Energy of India</div>
              </div>
              <div className="flex flex-col items-center text-center"> 
                <h1 className="font-industrial text-2xl md:text-3xl uppercase tracking-wider leading-none font-bold">Gujarat Refinery</h1>
                <p className="font-hindi text-blue-400 text-xs font-bold tracking-wide mt-1">जहाँ प्रगति ही जीवन सार है</p>
              </div>
            </div>
            <h2 className="font-industrial text-xl text-orange-500 tracking-[0.1em] font-bold uppercase hidden md:block">SPARE SETU PORTAL</h2>
          </div>
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

// --- AUTH VIEW (100% ORIGINAL minute details restored) ---
function AuthView() {
  const [view, setView] = useState<"login" | "register" | "otp" | "forgot">("login");
  const [form, setForm] = useState({ email: "", pass: "", name: "", unit: "", enteredOtp: "", generatedOtp: "" });
  const [authLoading, setAuthLoading] = useState(false);

  const handleAuth = async () => {
    setAuthLoading(true);
    if (view === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.pass });
      if (error) alert(error.message);
    } else if (view === "register") {
      if (!form.name || !form.unit || !form.email || !form.pass) { alert("Details bhariye!"); setAuthLoading(false); return; }
      const { data: allowed } = await supabase.from('allowed_users').select('*').eq('email', form.email).eq('unit', form.unit).single();
      if (!allowed) { alert("Email access not allowed for this zone!"); setAuthLoading(false); return; }
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setForm({ ...form, generatedOtp: otp });
      const res = await fetch('/api/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, email: form.email, otp }) });
      if (res.ok) { alert("OTP sent!"); setView("otp"); } else alert("OTP Send Failed");
    } else if (view === "otp") {
      if (form.enteredOtp === form.generatedOtp) {
        const { error } = await supabase.auth.signUp({ email: form.email, password: form.pass, options: { data: { name: form.name, unit: form.unit } } });
        if (error) alert(error.message); else setView("login");
      } else alert("Wrong OTP");
    } else if (view === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(form.email);
      if (error) alert(error.message); else alert("Reset link sent to your email!");
    }
    setAuthLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 login-bg">
      <div className="w-full max-w-md login-card rounded-2xl shadow-2xl p-8 border-t-4 border-orange-500 text-center relative animate-fade-in">
        <div className="mb-8">
            <div className="flex justify-center mb-4">
              <div className="iocl-logo-container" style={{ fontSize: '14px' }}>
                <div className="iocl-circle"><div className="iocl-band"><span className="iocl-hindi-text">इंडियनऑयल</span></div></div>
                <div className="iocl-english-text" style={{ color: 'white' }}>IndianOil</div>
                <div className="font-script text-orange-400 text-[10px] mt-1 whitespace-nowrap">The Energy of India</div>
              </div>
            </div>
            <h1 className="font-industrial text-2xl font-bold text-white uppercase tracking-wider leading-tight">Gujarat Refinery</h1>
            <p className="font-hindi text-blue-400 text-sm font-bold mt-1 tracking-wide">जहाँ प्रगति ही जीवन सार है</p>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-4">Spare Setu Portal</p>
        </div>
        <div className="space-y-4">
          {(view === "register") && (
            <>
              <div className="relative"><i className="fa-solid fa-user absolute left-4 top-3.5 text-slate-400"></i><input type="text" placeholder="Engineer Full Name" className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm" onChange={e=>setForm({...form, name:e.target.value})} /></div>
              <div className="relative"><i className="fa-solid fa-building absolute left-4 top-3.5 text-slate-400"></i><select className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm bg-slate-900 text-slate-300" onChange={e=>setForm({...form, unit:e.target.value})}><option value="">Select Your Zone</option>{["RUP - South Block", "RUP - North Block", "LAB", "MSQU", "AU-5", "BS-VI", "GR-II & NBA", "GR-I", "OM&S", "OLD SRU & CETP", "Electrical Planning", "Electrical Testing", "Electrical Workshop", "FCC", "GRE", "CGP-I", "CGP-II & TPS", "Water Block & Bitumen", "Township - Estate Office", "AC Section", "GHC", "DHUMAD"].map(z=><option key={z} value={z}>{z}</option>)}</select></div>
            </>
          )}
          {view === "otp" ? (
             <div className="relative"><i className="fa-solid fa-key absolute left-4 top-3.5 text-slate-400"></i><input type="text" placeholder="######" maxLength={6} className="w-full p-3 rounded-lg login-input text-center text-2xl tracking-[0.5em] font-bold text-white outline-none" onChange={e=>setForm({...form, enteredOtp:e.target.value})} /></div>
          ) : (
             <div className="relative"><i className="fa-solid fa-envelope absolute left-4 top-3.5 text-slate-400"></i><input type="email" value={form.email} className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm" placeholder="Official Email ID" onChange={e=>setForm({...form, email:e.target.value})} /></div>
          )}
          {(view === "login" || view === "register") && <div className="relative"><i className="fa-solid fa-lock absolute left-4 top-3.5 text-slate-400"></i><input type="password" placeholder="Password" className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm" onChange={e=>setForm({...form, pass:e.target.value})} /></div>}
          {view === "login" && (
            <div className="text-right"><button onClick={()=>setView('forgot')} className="text-xs text-orange-500 hover:text-orange-400 font-bold transition">Forgot Password?</button></div>
          )}
          <button onClick={handleAuth} disabled={authLoading} className="w-full h-12 mt-4 iocl-btn text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 uppercase tracking-widest text-sm">
            {authLoading ? "Processing..." : view === 'login' ? "Secure Login →" : view === 'register' ? "Create Account" : view === 'otp' ? "Verify & Register" : "Send Reset Link"}
          </button>
          <div className="mt-6 text-center border-t border-white/10 pt-4">
            <p className="text-xs text-slate-400">{view==='login' ? "New User? " : "Already have an account? "}<button onClick={()=>setView(view==='login'?'register':'login')} className="text-white hover:text-orange-500 font-bold underline ml-1">{view==='login' ? "Create Account" : "Back to Login"}</button></p>
          </div>
          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Developed By Engineers</p>
            <p className="text-[11px] text-slate-300 font-bold font-hindi">अशोक सैनी • दीपक चौहान • दिव्यांक सिंह राजपूत</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function GlobalSearchView({ profile }: any) {
  const [items, setItems] = useState<any[]>([]); 
  const [contributors, setContributors] = useState<any[]>([]);
  const [search, setSearch] = useState(""); 
  const [selCat, setSelCat] = useState("all"); 
  const [breakdown, setBreakdown] = useState<any>(null); 
  const [showSummary, setShowSummary] = useState(false);
  const [requestItem, setRequestItem] = useState<any>(null);
  const [reqForm, setReqForm] = useState({ qty: "", comment: "" });

  useEffect(() => { fetchAll(); lead(); }, []);
  const fetchAll = async () => { const { data } = await supabase.from("inventory").select("*"); if (data) setItems(data); };
  const lead = async () => { const { data } = await supabase.from("profiles").select("name, unit, item_count").order("item_count", { ascending: false }).limit(3); if (data) setContributors(data); };

  const handleSendRequest = async () => {
    if (!reqForm.qty || Number(reqForm.qty) <= 0 || Number(reqForm.qty) > requestItem.qty) { alert("Invalid quantity!"); return; }
    const { error } = await supabase.from("requests").insert([{
        item_id: requestItem.id, item_name: requestItem.item, item_spec: requestItem.spec, item_unit: requestItem.unit, req_qty: Number(reqForm.qty), req_comment: reqForm.comment, from_name: profile.name, from_uid: profile.id, from_unit: profile.unit, to_name: requestItem.holder_name, to_uid: requestItem.holder_uid, to_unit: requestItem.holder_unit, status: 'pending', viewed_by_requester: false
    }]);
    if (!error) { alert("Request Sent Successfully!"); setRequestItem(null); setReqForm({ qty: "", comment: "" }); } else alert(error.message);
  };

  const grouped: any = {};
  items.forEach(i => {
    const key = `${i.item}-${i.spec}`.toLowerCase();
    if (!grouped[key]) grouped[key] = { ...i, totalQty: 0, holders: [] };
    grouped[key].totalQty += Number(i.qty);
    grouped[key].holders.push(i);
  });

  const filtered = Object.values(grouped).filter((i: any) => (i.item.toLowerCase().includes(search.toLowerCase()) || i.spec.toLowerCase().includes(search.toLowerCase())) && (selCat === "all" ? true : (selCat === "zero" ? i.totalQty === 0 : i.cat === selCat)));

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="bg-white p-4 rounded-xl border flex flex-wrap items-center gap-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase text-slate-700 font-industrial"><i className="fa-solid fa-trophy text-yellow-500"></i> Top Contributors</h2>
        <div className="flex gap-3 overflow-x-auto flex-1 pb-1">{contributors.map((c, idx) => (<div key={idx} className="bg-slate-50 p-2 rounded-lg border flex items-center gap-3 min-w-[180px] shadow-sm"><div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs border-2 border-orange-400">{c.name.charAt(0)}</div><div><p className="text-xs font-bold text-slate-800 truncate">{c.name}</p><p className="text-[9px] text-slate-400">{c.unit}</p><p className="text-[9px] font-bold text-green-600">{c.item_count || 0} Items</p></div></div>))}</div>
      </section>
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b bg-slate-50/80 flex flex-wrap items-center gap-2">
             <div className="relative flex-grow md:w-80"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Global Inventory Search..." className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none focus:ring-1 focus:ring-orange-500 shadow-inner" onChange={e=>setSearch(e.target.value)} /></div>
             <select className="border rounded-md text-xs font-bold p-2 bg-white" onChange={e=>setSelCat(e.target.value)}><option value="all">Category: All</option>{[...new Set(items.map(i => i.cat))].sort().map(c => <option key={c} value={c}>{c}</option>)}<option value="zero" className="text-red-600 font-bold">⚠️ Out of Stock</option></select>
             <button onClick={()=>setShowSummary(true)} className="bg-indigo-600 text-white px-3 py-2 rounded-md text-xs font-bold ml-auto flex items-center gap-2 shadow-sm"><i className="fa-solid fa-chart-pie"></i> Stock Summary</button>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left font-industrial tracking-tight"><thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b"><tr><th className="p-4 pl-6">Item Details</th><th className="p-4">Spec</th><th className="p-4 text-center">Total Stock</th><th className="p-4 text-center">Action</th></tr></thead>
          <tbody className="divide-y text-sm">
            {filtered.map((i: any, idx: number) => (
              <tr key={idx} className={`hover:bg-slate-50 transition border-b border-slate-50 ${i.totalQty === 0 ? 'bg-red-50/20' : ''}`}>
                <td className="p-4 pl-6 font-bold text-slate-800 leading-tight">{i.item}<div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{i.cat}</div></td>
                <td className="p-4"><span className="bg-white border px-2 py-1 rounded text-[11px] font-medium text-slate-600 shadow-sm">{i.spec}</span></td>
                <td className="p-4 text-center">{i.totalQty === 0 ? <span className="text-red-600 font-black text-[10px] uppercase bg-red-100 px-2 py-1 rounded border border-red-200 tracking-tighter">Out of Stock</span> : <button onClick={()=>setBreakdown(i)} className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-lg border border-blue-200 font-bold hover:bg-blue-100 transition shadow-sm mx-auto">{i.totalQty} Nos <i className="fa-solid fa-chevron-right text-[9px]"></i></button>}</td>
                <td className="p-4 text-center text-[10px] font-bold text-slate-400 uppercase italic">Breakdown</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>
      {requestItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <div className="bg-white w-full max-w-[340px] rounded-2xl shadow-2xl p-5 animate-scale-in border-t-8 border-orange-500">
                <h3 className="text-[11px] font-black text-slate-800 uppercase border-b pb-2 mb-4 font-industrial tracking-widest">Material Request</h3>
                <div className="text-[11px] font-black text-indigo-600 mb-1 leading-tight uppercase truncate">{requestItem.item}</div>
                <div className="text-[9px] text-slate-500 mb-5 bg-slate-50 p-2 rounded">From: {requestItem.holder_unit} ({requestItem.holder_name})</div>
                <div className="space-y-4">
                    <div><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Req Qty ({requestItem.unit})</label><input type="number" placeholder="0" className="w-full p-2 border-2 rounded-lg text-center text-lg font-black outline-none focus:border-orange-500" value={reqForm.qty} onChange={e=>setReqForm({...reqForm, qty: e.target.value})} /></div>
                    <div><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Log Note</label><textarea className="w-full p-2 border-2 rounded-lg text-xs h-20 outline-none focus:border-orange-500 font-mono leading-tight" placeholder="Reason..." onChange={e=>setReqForm({...reqForm, comment: e.target.value})}></textarea></div>
                    <div className="flex gap-2 pt-1"><button onClick={()=>setRequestItem(null)} className="flex-1 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg uppercase text-[9px]">Cancel</button><button onClick={handleSendRequest} className="flex-1 py-2 iocl-btn text-white font-bold rounded-lg uppercase text-[9px] shadow-lg">Submit</button></div>
                </div>
            </div>
        </div>
      )}
      {breakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-2xl p-6 relative shadow-2xl animate-scale-in">
             <button onClick={()=>setBreakdown(null)} className="absolute top-4 right-4 text-slate-400 font-bold text-xl hover:text-red-500 transition">✕</button>
             <h3 className="text-xl font-bold mb-1 text-slate-800 font-industrial">{breakdown.item}</h3>
             <p className="text-xs text-slate-400 mb-6 uppercase font-bold tracking-wider">{breakdown.spec}</p>
             <div className="overflow-hidden border border-slate-100 rounded-xl bg-slate-50/50">
               <table className="w-full text-left font-mono"><thead className="bg-slate-100 text-xs font-bold text-slate-500 uppercase border-b font-industrial"><tr><th className="p-4 pl-6">Unit / Zone</th><th className="p-4">Engineer</th><th className="p-4 text-right">Qty</th><th className="p-4 pr-6 text-center">Action</th></tr></thead>
                 <tbody className="divide-y text-sm bg-white">
                   {breakdown.holders.map((h:any, idx:number)=>(<tr key={idx} className="hover:bg-indigo-50/30 transition"><td className="p-4 pl-6 font-bold text-slate-700">{h.holder_unit}</td><td className="p-4 flex items-center gap-2 text-slate-500 uppercase"><div className="w-6 h-6 rounded-full bg-slate-200 text-[10px] flex items-center justify-center font-bold">{h.holder_name?.charAt(0)}</div>{h.holder_name}</td><td className="p-4 text-right font-black text-indigo-600">{h.qty} {h.unit || 'Nos'}</td><td className="p-4 pr-6 text-center">{h.holder_uid === profile?.id ? <span className="text-[10px] text-green-600 font-black uppercase italic">Your Stock</span> : <button className="bg-orange-500 text-white px-3 py-1 rounded text-xs font-bold shadow-sm" onClick={()=>{setRequestItem(h); setBreakdown(null);}}>Request</button>}</td></tr>))}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MyStoreView({ profile, fetchProfile }: any) {
  const [myItems, setMyItems] = useState<any[]>([]); const [showAddModal, setShowAddModal] = useState(false);
  const [consumeItem, setConsumeItem] = useState<any>(null); const [editItem, setEditItem] = useState<any>(null);
  const [search, setSearch] = useState(""); const [selCat, setSelCat] = useState("all");
  const [form, setForm] = useState({ cat: "", sub: "", make: "", model: "", spec: "", qty: "", isManual: false });

  useEffect(() => { if (profile) fetch(); }, [profile]);
  const fetch = async () => { const { data } = await supabase.from("inventory").select("*").eq("holder_uid", profile.id).order("id", { ascending: false }); if (data) setMyItems(data); };
  const filtered = myItems.filter(i => (i.item.toLowerCase().includes(search.toLowerCase()) || i.spec.toLowerCase().includes(search.toLowerCase())) && (selCat === 'all' ? true : i.cat === selCat));

  const categories = [...new Set(masterCatalog.map(i => i.cat))].sort();
  const subs = [...new Set(masterCatalog.filter(i => i.cat === form.cat).map(i => i.sub))].sort();
  const makes = [...new Set(masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub).map(i => i.make))].sort();
  const models = [...new Set(masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub && i.make === form.make).map(i => i.model))].sort();
  const specs = [...new Set(masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub && i.make === form.make && i.model === form.model).map(i => i.spec))].sort();

  useEffect(() => { if (form.cat && subs.length === 1 && !form.sub) setForm(f => ({...f, sub: subs[0]})); }, [form.cat, subs]);
  useEffect(() => { if (form.sub && makes.length === 1 && !form.make) setForm(f => ({...f, make: makes[0]})); }, [form.sub, makes]);
  useEffect(() => { if (form.make && models.length === 1 && !form.model) setForm(f => ({...f, model: models[0]})); }, [form.make, models]);
  useEffect(() => { if (form.model && specs.length === 1 && !form.spec) setForm(f => ({...f, spec: specs[0]})); }, [form.model, specs]);

  const handleSave = async () => {
    if (!form.spec || !form.qty) return alert("Sari details bhariye!");
    const itemName = form.isManual ? form.model : `${form.make} ${form.sub} ${form.model}`.trim();
    const { error } = await supabase.from("inventory").insert([{ 
        item: itemName, cat: form.cat || "Manual Entry", sub: form.sub || "-", make: form.make || "-", model: form.model || "-", spec: form.spec, qty: parseInt(form.qty), unit: 'Nos', holder_unit: profile.unit, holder_uid: profile.id, holder_name: profile.name 
    }]);
    if (!error) { alert("Stock Saved!"); fetch(); setShowAddModal(false); setForm({ cat: "", sub: "", make: "", model: "", spec: "", qty: "", isManual: false }); await supabase.from("profiles").update({ item_count: (profile.item_count || 0) + 1 }).eq('id', profile.id); fetchProfile(); } else alert(error.message);
  };

  return (
    <div className="animate-fade-in space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
        <div><h2 className="text-xl font-bold text-slate-800 font-industrial uppercase">My Local Store</h2><p className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded mt-1 uppercase tracking-tighter inline-block font-industrial tracking-widest">ZONE: {profile?.unit}</p></div>
        <button onClick={() => setShowAddModal(true)} className="iocl-btn text-white px-6 py-2.5 rounded-xl font-bold shadow-md flex items-center gap-2"><i className="fa-solid fa-plus"></i> Add New Stock</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden font-mono">
        <div className="p-4 border-b bg-slate-50/80 flex flex-wrap items-center gap-2"><div className="relative flex-grow md:w-64"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Search My Store..." className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none shadow-inner" onChange={e=>setSearch(e.target.value)} /></div><select className="border rounded-md text-[11px] font-bold p-2 bg-white" onChange={e=>setSelCat(e.target.value)}><option value="all">Category: All</option>{[...new Set(myItems.map(i => i.cat))].sort().map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="overflow-x-auto"><table className="w-full text-left font-industrial tracking-tight"><thead className="bg-slate-50 text-slate-500 text-[10px] font-bold border-b uppercase"><tr><th className="p-5 pl-8">Category</th><th className="p-5">Item Name</th><th className="p-5">Spec</th><th className="p-5 text-center">Qty</th><th className="p-5 text-center">Manage</th></tr></thead>
          <tbody className="divide-y text-sm">
              {filtered.map(i => (<tr key={i.id} className="hover:bg-slate-50 transition border-b border-slate-50"><td className="p-5 pl-8 text-[10px] font-bold text-slate-400 uppercase leading-none">{i.cat}</td><td className="p-5 font-bold text-slate-800 leading-tight uppercase">{i.item}</td><td className="p-5"><span className="bg-white border px-2 py-1 rounded text-[11px] font-medium text-slate-600 shadow-sm uppercase">{i.spec}</span></td><td className="p-5 font-bold text-center font-mono">{Number(i.qty) === 0 ? <span className="text-red-600 font-black text-[10px] uppercase bg-red-100 px-2 py-1 rounded border border-red-200 whitespace-nowrap">Out of Stock</span> : <span className="text-emerald-600 text-lg font-black">{i.qty} {i.unit || 'Nos'}</span>}</td><td className="p-5 flex gap-3 justify-center items-center"><button onClick={()=>setConsumeItem(i)} disabled={Number(i.qty) === 0} className="text-indigo-600 hover:scale-125 transition disabled:opacity-30"><i className="fa-solid fa-box-open text-xl"></i></button><button onClick={()=>setEditItem(i)} className="text-slate-400 hover:text-blue-500 hover:scale-125 transition"><i className="fa-solid fa-pen-to-square text-xl"></i></button></td></tr>))}
          </tbody>
        </table></div>
      </div>
      {showAddModal && <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md overflow-y-auto font-industrial"><div className="bg-white w-full max-w-[380px] rounded-2xl shadow-2xl p-6 relative animate-scale-in my-auto border-t-4 border-slate-900"><button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-slate-400 font-bold text-xl">✕</button><h3 className="text-sm font-black text-slate-800 mb-6 border-b pb-2 uppercase tracking-widest text-center">Add New Stock</h3><div className="space-y-3">
          {!form.isManual ? (<>
              <div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Category</label><select className="w-full p-2 border-2 border-slate-100 rounded-lg text-xs bg-slate-50 outline-none" value={form.cat} onChange={e=>setForm({...form, cat: e.target.value, sub:"", make:"", model:"", spec:""})}><option value="">-- Select --</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Sub Cat</label><select className="w-full p-2 border-2 border-slate-100 rounded-lg text-xs outline-none" disabled={!form.cat} value={form.sub} onChange={e=>setForm({...form, sub: e.target.value, make:"", model:"", spec:""})}><option value="">-- Select --</option>{subs.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                  <div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Make</label><select className="w-full p-2 border-2 border-slate-100 rounded-lg text-xs outline-none" disabled={!form.sub} value={form.make} onChange={e=>setForm({...form, make: e.target.value, model:"", spec:""})}><option value="">-- Select --</option>{makes.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
              </div>
              <div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Model</label><select className="w-full p-2 border-2 border-slate-100 rounded-lg text-xs outline-none" disabled={!form.make} value={form.model} onChange={e=>setForm({...form, model: e.target.value, spec:""})}><option value="">-- Select --</option>{models.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
              <div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Spec</label><select className="w-full p-2 border-2 border-slate-100 rounded-lg text-xs outline-none" disabled={!form.model} value={form.spec} onChange={e=>setForm({...form, spec: e.target.value})}><option value="">-- Select --</option>{specs.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          </>) : (<div className="space-y-3">
              <div><label className="text-[9px] font-black text-slate-400 uppercase pl-1">Description</label><input type="text" className="w-full p-2 border-2 rounded-lg text-xs outline-none" onChange={e=>setForm({...form, model: e.target.value})} /></div>
              <div><label className="text-[9px] font-black text-slate-400 uppercase pl-1">Specification</label><input type="text" className="w-full p-2 border-2 rounded-lg text-xs outline-none" onChange={e=>setForm({...form, spec: e.target.value})} /></div>
          </div>)}
          <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <div className="flex flex-col"><label className="text-[9px] font-black text-slate-400 uppercase block text-center mb-1">Qty</label><input type="number" placeholder="0" className="w-full p-2 border-2 border-slate-100 rounded-lg text-lg font-black text-center outline-none" onChange={e=>setForm({...form, qty: e.target.value})} /></div>
              <div className="flex flex-col"><label className="text-[9px] font-black text-slate-400 uppercase block text-center mb-1">Unit</label><select className="w-full p-2 border-2 border-slate-100 rounded-lg text-xs h-full uppercase font-bold outline-none"><option>Nos</option><option>Mtrs</option></select></div>
          </div>
          <button onClick={handleSave} className="w-full py-3 bg-slate-900 text-white font-black rounded-xl shadow-lg mt-2 uppercase text-[10px] tracking-widest hover:bg-slate-800">Confirm Stock Entry</button>
      </div></div></div>}
    </div>
  );
}

function UsageHistoryView({ profile }: any) {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => { const f = async () => { const { data } = await supabase.from("usage_logs").select("*").eq("consumer_uid", profile.id).order("timestamp", { ascending: false }); if (data) setLogs(data); }; if (profile) f(); }, [profile]);
  return (<section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm font-mono"><div className="p-5 border-b bg-slate-50/50 flex justify-between items-center"><h2 className="text-lg font-bold text-slate-800 uppercase font-industrial tracking-wider">Consumption History</h2></div><div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 text-slate-500 text-[10px] font-bold border-b uppercase"><tr><th className="p-5 pl-8 font-industrial">Date</th><th className="p-5 font-industrial">Details</th><th className="p-5 text-center font-industrial">Qty</th></tr></thead><tbody className="divide-y text-sm">{logs.map(l => (<tr key={l.id} className="hover:bg-slate-50 transition border-b border-slate-50"><td className="p-5 pl-8 text-xs text-slate-500 font-bold leading-tight">{new Date(Number(l.timestamp)).toLocaleDateString()}</td><td className="p-5 font-bold text-slate-800 leading-tight uppercase">{l.item_name}<div className="text-[10px] text-slate-400 uppercase mt-0.5">{l.category}</div></td><td className="p-5 text-center font-black text-red-600 whitespace-nowrap">-{l.qty_consumed} Nos</td></tr>))}</tbody></table></div></section>);
}

function MonthlyAnalysisView({ profile }: any) {
  const [analysis, setAnalysis] = useState<any[]>([]);
  useEffect(() => { const f = async () => { const { data } = await supabase.from("usage_logs").select("*").eq("consumer_uid", profile.id); if (data) { const stats: any = {}; data.forEach((l: any) => { const month = new Date(Number(l.timestamp)).toLocaleString('default', { month: 'long', year: 'numeric' }); if (!stats[month]) stats[month] = { month, total: 0, count: 0 }; stats[month].total += Number(l.qty_consumed); stats[month].count += 1; }); setAnalysis(Object.values(stats)); } }; if (profile) f(); }, [profile]);
  return (<div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-industrial">{analysis.map((a, idx) => (<div key={idx} className="bg-white p-6 rounded-2xl border shadow-sm text-center transition hover:shadow-md"><div className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">{a.month}</div><div className="w-16 h-16 bg-blue-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner"><i className="fa-solid fa-chart-line"></i></div><div className="text-3xl font-black text-slate-800 font-industrial">{a.total} <small className="text-[10px] text-slate-400 font-bold uppercase">Nos</small></div><div className="text-[10px] font-bold text-emerald-500 mt-2 uppercase">{a.count} Trans</div></div>))}{analysis.length===0 && <div className="p-20 text-center italic text-slate-400 bg-white rounded-xl border w-full col-span-3">No monthly data.</div>}</div>);
}

// --- FINALIZED RETURNS & UDHAARI VIEW (FULL TIMELINE AUDIT + COMPACT UI) ---
function ReturnsLedgerView({ profile, onAction }: any) { 
    const [pending, setPending] = useState<any[]>([]);
    const [given, setGiven] = useState<any[]>([]);
    const [taken, setTaken] = useState<any[]>([]);
    const [givenHistory, setGivenHistory] = useState<any[]>([]);
    const [takenHistory, setTakenHistory] = useState<any[]>([]);
    const [actionModal, setActionModal] = useState<any>(null); 
    const [form, setForm] = useState({ comment: "", qty: "" });

    const fetchAll = async () => {
        const { data: p } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).eq("status", "pending").order("id", { ascending: false });
        const { data: g } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).in("status", ["approved", "return_requested"]).order("id", { ascending: false });
        const { data: t } = await supabase.from("requests").select("*").eq("from_unit", profile.unit).in("status", ["approved", "return_requested"]).order("id", { ascending: false });
        const { data: gh } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).in("status", ["returned", "rejected"]).order("id", { ascending: false });
        const { data: th } = await supabase.from("requests").select("*").eq("from_unit", profile.unit).in("status", ["returned", "rejected"]).order("id", { ascending: false });
        if (p) setPending(p); if (g) setGiven(g); if (t) setTaken(t);
        if (gh) setGivenHistory(gh); if (th) setTakenHistory(th);
    };

    useEffect(() => {
        if (!profile) return; fetchAll();
        const channel = supabase.channel('audit-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => { fetchAll(); if(onAction) onAction(); }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [profile]);

    const formatTS = (ts: any) => new Date(Number(ts)).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });

    const handleProcess = async () => {
        const { type, data } = actionModal;
        if (type.includes('reject') && !form.comment.trim()) { alert("Rejection comment required!"); return; }
        let updateData: any = {};
        const actionQty = Number(form.qty || data.req_qty);

        if (type === 'approve') updateData = { status: 'approved', approve_comment: form.comment, to_uid: profile.id, to_name: profile.name, req_qty: actionQty, viewed_by_requester: false };
        else if (type === 'reject') updateData = { status: 'rejected', approve_comment: form.comment, to_uid: profile.id, to_name: profile.name, viewed_by_requester: false };
        else if (type === 'return') {
            if (actionQty < data.req_qty) {
                await supabase.from("requests").update({ req_qty: data.req_qty - actionQty }).eq("id", data.id);
                await supabase.from("requests").insert([{ ...data, id: undefined, req_qty: actionQty, status: 'return_requested', return_comment: form.comment, from_uid: profile.id, from_name: profile.name }]);
            } else {
                await supabase.from("requests").update({ status: 'return_requested', return_comment: form.comment, req_qty: actionQty, from_uid: profile.id, from_name: profile.name }).eq("id", data.id);
            }
            alert("Sent!"); setActionModal(null); return;
        }
        else if (type === 'verify') {
            await supabase.from("requests").update({ status: 'returned', approve_comment: `Verified By ${profile.name}: ${form.comment}`, to_uid: profile.id, to_name: profile.name, viewed_by_requester: false }).eq("id", data.id);
            const { data: inv } = await supabase.from("inventory").select("qty").eq("id", data.item_id).single();
            if (inv) await supabase.from("inventory").update({ qty: inv.qty + data.req_qty }).eq("id", data.item_id);
            alert("Verified!"); setActionModal(null); return;
        }
        else if (type === 'reject_return') updateData = { status: 'approved', approve_comment: `Return Rejected By ${profile.name}: ${form.comment}`, to_uid: profile.id, to_name: profile.name, viewed_by_requester: false };

        const { error } = await supabase.from("requests").update(updateData).eq("id", data.id);
        if (!error && type === 'approve') {
            const { data: inv } = await supabase.from("inventory").select("qty").eq("id", data.item_id).single();
            if (inv) await supabase.from("inventory").update({ qty: inv.qty - actionQty }).eq("id", data.item_id);
        }
        setActionModal(null); setForm({comment:"", qty:""});
    };

    return (
        <div className="space-y-10 animate-fade-in pb-20 font-industrial tracking-tight">
            <h2 className="text-2xl font-bold text-slate-800 uppercase flex items-center gap-2 tracking-tight"><i className="fa-solid fa-handshake-angle text-orange-500"></i> Udhaari Dashboard</h2>

            <section className="bg-white rounded-xl border-t-4 border-orange-500 shadow-xl overflow-hidden">
                <div className="p-4 bg-orange-50/50 flex justify-between border-b"><div className="flex items-center gap-2 text-orange-900 font-black uppercase text-[10px] tracking-widest"><i className="fa-solid fa-bolt animate-pulse"></i> Material Requests to {profile?.unit}</div><span className="bg-orange-600 text-white px-2 py-0.5 rounded-full font-black text-[10px]">{pending.length}</span></div>
                <div className="overflow-x-auto"><table className="w-full text-left text-sm divide-y font-mono">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase font-industrial tracking-widest"><tr><th className="p-4 pl-6">Material Detail</th><th className="p-4">Requester</th><th className="p-4 text-center">Qty</th><th className="p-4 text-center">Action</th></tr></thead>
                    <tbody className="divide-y text-slate-600">
                        {pending.map(r => (
                            <tr key={r.id} className="hover:bg-orange-50/20 transition border-b">
                                <td className="p-4 pl-6 font-bold text-slate-800 leading-tight uppercase font-industrial">{r.item_name}<div className="text-[9px] text-slate-400 font-normal mt-0.5">{r.item_spec}</div><div className="text-[8px] text-slate-300 italic mt-1">{formatTS(r.timestamp)}</div></td>
                                <td className="p-4 font-bold text-slate-700 uppercase font-industrial tracking-tighter">{r.from_name}<div className="text-[10px] text-slate-400 font-normal">{r.from_unit}</div></td>
                                <td className="p-4 text-center font-black text-orange-600 text-lg font-mono">{r.req_qty} {r.item_unit}</td>
                                <td className="p-4 flex gap-2 justify-center"><button onClick={()=>setActionModal({type:'approve', data:r})} className="bg-green-600 text-white px-4 py-2 rounded-lg text-[9px] font-black shadow-md hover:bg-green-700">APPROVE</button><button onClick={()=>setActionModal({type:'reject', data:r})} className="bg-slate-100 text-slate-500 px-4 py-2 rounded-lg text-[9px] font-black transition">REJECT</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table></div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* ACTIVE GIVEN */}
                <section className="bg-white rounded-2xl border-t-4 border-blue-600 shadow-lg overflow-hidden font-industrial">
                    <div className="p-5 border-b bg-blue-50/30 flex items-center gap-3 font-industrial tracking-widest uppercase text-xs font-black text-blue-900"><i className="fa-solid fa-arrow-up-from-bracket text-blue-600"></i> Active Udhaari (Given)</div>
                    <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                        {given.map(r => (
                            <div key={r.id} className={`p-4 border-2 rounded-2xl relative transition-all ${r.status === 'return_requested' ? 'border-orange-500 bg-orange-50 animate-pulse' : 'border-slate-100 bg-white'}`}>
                                <div className="text-xs font-black text-slate-800 uppercase mb-1 leading-tight">{r.item_name}</div>
                                <div className="text-[10px] text-slate-400 mb-3 uppercase tracking-tighter">{r.item_spec}</div>
                                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg mb-3"><div><p className="text-[9px] font-bold text-slate-400 uppercase">Receiver</p><p className="text-xs font-black text-slate-700 uppercase tracking-tighter">{r.from_name} ({r.from_unit})</p></div><div className="text-right font-black text-blue-600 font-mono">{r.req_qty} {r.item_unit}</div></div>
                                <div className="text-[9px] font-mono text-slate-400 mb-3 space-y-1 bg-slate-50/50 p-2 rounded border border-dashed leading-none">
                                    <p><span className="font-black text-blue-600/70">ISSUED BY:</span> {r.to_name}</p>
                                    <p><span className="font-black uppercase tracking-tighter">ISSUE DATE:</span> {formatTS(r.timestamp)}</p>
                                    <p><span className="font-black uppercase tracking-tighter">LENDER NOTE:</span> "{r.approve_comment || 'N/A'}"</p>
                                </div>
                                {r.status === 'return_requested' ? (
                                    <div className="space-y-2 border-t pt-3"><p className="text-[10px] font-bold text-orange-600 uppercase">Return Alert: "{r.return_comment}"</p><div className="flex gap-2"><button onClick={()=>setActionModal({type:'verify', data:r})} className="flex-1 py-2 bg-orange-500 text-white text-[10px] font-black rounded-xl">VERIFY RECEIPT</button><button onClick={()=>setActionModal({type:'reject_return', data:r})} className="px-4 py-2 bg-slate-200 text-slate-500 text-[10px] font-bold rounded-xl">REJECT</button></div></div>
                                ) : (
                                    <div className="text-[8px] text-slate-300 italic flex justify-center border-t pt-2 uppercase font-black">Record Active in zone ledger</div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                {/* ACTIVE TAKEN */}
                <section className="bg-white rounded-2xl border-t-4 border-red-600 shadow-lg overflow-hidden font-industrial">
                    <div className="p-5 border-b bg-red-50/30 flex items-center gap-3 font-industrial tracking-widest uppercase text-xs font-black text-red-900"><i className="fa-solid fa-arrow-down-long text-red-600"></i> Active Udhaari (Taken)</div>
                    <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                        {taken.map(r => (
                            <div key={r.id} className={`p-4 border-2 rounded-2xl relative ${r.status === 'return_requested' ? 'border-dashed border-slate-300 opacity-60' : 'border-slate-100 bg-white'}`}>
                                <div className="text-xs font-black text-slate-800 uppercase mb-1 leading-tight">{r.item_name}</div>
                                <div className="text-[10px] text-slate-400 mb-3 uppercase tracking-tighter">{r.item_spec}</div>
                                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg mb-3"><div><p className="text-[9px] font-bold text-slate-400 uppercase">Source Zone</p><p className="text-xs font-black text-slate-700 uppercase tracking-tighter">{r.to_unit} (Engr: {r.to_name})</p></div><div className="text-right font-black text-red-600 font-mono">{r.req_qty} {r.item_unit}</div></div>
                                <div className="text-[9px] font-mono text-slate-400 mb-3 space-y-1 bg-slate-50/50 p-2 rounded border border-dashed leading-none">
                                    <p><span className="font-black text-red-600/70 uppercase">REQUESTED BY:</span> {r.from_name}</p>
                                    <p><span className="font-black uppercase tracking-tighter">TAKEN DATE:</span> {formatTS(r.timestamp)}</p>
                                    <p><span className="font-black text-blue-600/70 uppercase">LENDER NOTE:</span> "{r.approve_comment || 'N/A'}"</p>
                                </div>
                                {r.status === 'return_requested' ? (
                                    <div className="text-center py-2 bg-slate-100 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500 animate-pulse">Wait for {r.to_unit} Verification...</div>
                                ) : (
                                    <button onClick={()=>setActionModal({type:'return', data:r})} className="w-full py-2 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase tracking-tighter">INITIATE RETURN</button>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* SETTLED HISTORY - FULL TIMELINE AUDIT VIEW */}
            <div className="pt-10 space-y-8 font-mono">
                <div className="flex items-center gap-4 font-industrial"><hr className="flex-1 border-slate-200"/><h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.4em]">Settled Transaction Archives</h3><hr className="flex-1 border-slate-200"/></div>
                
                <div className="grid grid-cols-1 gap-12">
                    {/* Material Given History */}
                    <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-800 text-white flex justify-between font-industrial text-[10px] tracking-widest uppercase"><span>Archive: Historical Material Output</span><i className="fa-solid fa-file-export text-slate-400 text-xs"></i></div>
                        <div className="overflow-x-auto"><table className="w-full text-left text-[10px] divide-y divide-slate-100">
                            <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-tighter font-industrial"><tr><th className="p-4">Material Details</th><th className="p-4 text-center">Settled Qty</th><th className="p-4">Receiver & Details</th><th className="p-4">Timeline Log</th><th className="p-4 text-center">Final State</th></tr></thead>
                            <tbody className="divide-y divide-slate-100 text-slate-600">
                                {givenHistory.map(h => (<tr key={h.id} className="hover:bg-slate-50 transition">
                                    <td className="p-4 leading-tight"><p className="font-bold text-slate-700 uppercase">{h.item_name}</p><p className="text-[9px] text-slate-400 uppercase mt-1 leading-relaxed">Spec: {h.item_spec}</p></td>
                                    <td className="p-4 text-center font-black text-slate-600 whitespace-nowrap">{h.req_qty} {h.item_unit}</td>
                                    <td className="p-4 leading-tight"><p className="font-bold text-slate-600 uppercase">To: {h.from_name}</p><p className="text-[9px] text-slate-400 font-black italic">{h.from_unit}</p><p className="text-[8px] text-slate-300 mt-1 uppercase font-black">Req Note: "{h.req_comment || 'N/A'}"</p></td>
                                    <td className="p-4 leading-tight space-y-1">
                                        <p className="text-[8px]"><span className="text-blue-500 font-black">ISSUED BY:</span> {h.to_name} @ {formatTS(h.timestamp)}</p>
                                        <p className="text-[8px]"><span className="text-green-600 font-black">RETURN VERIFIED:</span> {h.to_name} @ {formatTS(h.timestamp)}</p>
                                        <p className="text-[8px] text-slate-400 italic mt-1 max-w-[150px] truncate">Lender Remark: "{h.approve_comment || 'N/A'}"</p>
                                    </td>
                                    <td className="p-4 text-center"><span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${h.status==='returned' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{h.status}</span></td>
                                </tr>))}
                            </tbody></table></div>
                    </div>

                    {/* Material Taken History */}
                    <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-800 text-white flex justify-between font-industrial text-[10px] tracking-widest uppercase"><span>Archive: Historical Material Input</span><i className="fa-solid fa-file-import text-slate-400 text-xs"></i></div>
                        <div className="overflow-x-auto"><table className="w-full text-left text-[10px] divide-y divide-slate-100">
                            <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-tighter font-industrial"><tr><th className="p-4">Material Details</th><th className="p-4 text-center">Settled Qty</th><th className="p-4">Source & Details</th><th className="p-4">Timeline Log</th><th className="p-4 text-center">Final State</th></tr></thead>
                            <tbody className="divide-y divide-slate-100 text-slate-600">
                                {takenHistory.map(h => (<tr key={h.id} className="hover:bg-slate-50 transition">
                                    <td className="p-4 leading-tight"><p className="font-bold text-slate-700 uppercase">{h.item_name}</p><p className="text-[9px] text-slate-400 uppercase mt-1 leading-relaxed">Spec: {h.item_spec}</p></td>
                                    <td className="p-4 text-center font-black text-slate-600 whitespace-nowrap">{h.req_qty} {h.item_unit}</td>
                                    <td className="p-4 leading-tight"><p className="font-bold text-slate-600 uppercase">From: {h.to_unit}</p><p className="text-[9px] text-slate-400 font-black italic">Engr: {h.to_name}</p><p className="text-[8px] text-slate-300 mt-1 uppercase font-black">Borrower Note: "{h.return_comment || h.req_comment || 'N/A'}"</p></td>
                                    <td className="p-4 leading-tight space-y-1">
                                        <p className="text-[8px]"><span className="text-red-500 font-black">REQUESTED ON:</span> {formatTS(h.timestamp)}</p>
                                        <p className="text-[8px]"><span className="text-green-600 font-black">VERIFIED & SETTLED:</span> {formatTS(h.timestamp)}</p>
                                        <p className="text-[8px] text-slate-400 italic mt-1 max-w-[150px] truncate">Lender Remark: "{h.approve_comment || 'N/A'}"</p>
                                    </td>
                                    <td className="p-4 text-center"><span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${h.status==='returned' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{h.status}</span></td>
                                </tr>))}
                            </tbody></table></div>
                    </div>
                </div>
            </div>

            {/* UNIVERSAL ACTION MODAL (COMPACT DASHBOARD STYLE) */}
            {actionModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                    <div className="bg-white w-full max-w-[340px] rounded-2xl shadow-2xl p-5 animate-scale-in border-t-4 border-slate-900 font-industrial">
                        <div className="flex justify-between items-center mb-4 border-b pb-2 tracking-widest"><h3 className="text-[11px] font-black text-slate-800 uppercase">{actionModal.type.replace('_', ' ')} Portal</h3><button onClick={()=>setActionModal(null)} className="text-slate-400 hover:text-red-500 transition-colors">✕</button></div>
                        <div className="text-[11px] font-black text-indigo-600 mb-1 leading-tight uppercase truncate">{actionModal.data.item_name}</div>
                        <div className="text-[9px] text-slate-400 mb-5 font-mono truncate">{actionModal.data.item_spec}</div>
                        <div className="space-y-4">
                            {(actionModal.type === 'approve' || actionModal.type === 'return' || actionModal.type === 'verify') && (
                                <div className="bg-slate-50 p-3 rounded-xl text-center shadow-inner">
                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Quantity</label>
                                    <input type="number" defaultValue={actionModal.data.req_qty} className="w-full bg-white p-2 border-2 rounded-lg text-center text-lg font-black outline-none focus:border-slate-800 shadow-sm" onChange={e=>setForm({...form, qty: e.target.value})} />
                                    <p className="text-[8px] text-slate-400 mt-1 uppercase font-bold tracking-widest">Available Limit: {actionModal.data.req_qty} {actionModal.data.item_unit}</p>
                                </div>
                            )}
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">{(actionModal.type.includes('reject')) ? 'Mandatory Reason' : 'Action Note'}</label>
                                <textarea className="w-full p-2 border-2 rounded-lg text-xs h-20 outline-none focus:border-slate-800 mt-1 font-mono leading-tight shadow-inner" placeholder="Type entry detail..." onChange={e=>setForm({...form, comment: e.target.value})}></textarea>
                            </div>
                            <div className="flex flex-col gap-2 pt-1">
                                <button onClick={handleProcess} className={`w-full py-2.5 font-black rounded-xl uppercase text-[10px] shadow-lg text-white ${actionModal.type.includes('reject') ? 'bg-red-600' : 'bg-slate-900'} hover:opacity-90 transition-all tracking-[0.2em]`}>Confirm Action</button>
                                <button onClick={()=>setActionModal(null)} className="w-full py-1 text-slate-400 text-[9px] font-bold uppercase tracking-widest">Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    ); 
}
