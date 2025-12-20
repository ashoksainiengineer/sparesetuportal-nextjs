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

  // GLOBAL REAL-TIME NOTIFICATION ENGINE
  useEffect(() => {
    if (!profile?.id || !profile?.unit) return;
    const fetchAllCounts = async () => {
        const { count: incoming } = await supabase.from("requests").select("*", { count: 'exact', head: true }).eq("to_unit", profile.unit).in("status", ["pending", "return_requested"]);
        const { count: updates } = await supabase.from("requests").select("*", { count: 'exact', head: true }).eq("from_uid", profile.id).eq("viewed_by_requester", false).in("status", ["approved", "rejected", "returned"]);
        setPendingCount((incoming || 0) + (updates || 0));
    };
    fetchAllCounts();
    const channel = supabase.channel('sparesetu-global-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => { fetchAllCounts(); }).subscribe();
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
    <div className="flex h-screen overflow-hidden bg-[#f1f5f9] font-inter">
      <aside className="w-64 bg-white hidden md:flex flex-col flex-shrink-0 z-20 shadow-xl border-r border-slate-200">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-orange-600"><i className="fa-solid fa-layer-group"></i></div>
          <span className="text-lg font-bold text-slate-800 font-industrial uppercase tracking-wide">Menu</span>
        </div>
        <nav className="flex-1 px-3 space-y-1 mt-4 overflow-y-auto font-inter font-bold">
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
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white border mb-2 shadow-sm font-inter">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-xs">{profile?.name?.charAt(0)}</div>
            <div className="overflow-hidden"><p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Logged in</p><div className="text-xs font-bold text-slate-700 truncate">{profile?.name}</div></div>
          </div>
          <button onClick={() => supabase.auth.signOut().then(()=>window.location.reload())} className="w-full py-2 text-xs text-red-500 hover:bg-red-50 font-bold rounded-lg transition border border-red-100 text-center block uppercase">Logout</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-y-auto relative pb-20 md:pb-0 font-inter font-bold">
        <header className="header-bg text-white sticky top-0 z-30 shadow-md">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 font-inter">
            <div className="flex items-center gap-6">
              <div className="iocl-logo-container hidden md:flex" style={{ fontSize: '10px' }}>
                <div className="iocl-circle"><div className="iocl-band"><span className="iocl-hindi-text">इंडियनऑयल</span></div></div>
                <div className="iocl-english-text" style={{ color: 'white' }}>IndianOil</div>
                <div className="font-script text-orange-400 text-[10px] mt-1 whitespace-nowrap">The Energy of India</div>
              </div>
              <div className="flex flex-col items-center text-center font-bold"> 
                <h1 className="font-industrial text-2xl md:text-3xl uppercase tracking-wider leading-none">Gujarat Refinery</h1>
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

// --- AUTH VIEW (NO CHANGES AS PER INSTRUCTION) ---
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
      <div className="w-full max-w-md login-card rounded-2xl shadow-2xl p-8 border-t-4 border-orange-500 text-center relative animate-fade-in font-inter">
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
              <div className="relative"><i className="fa-solid fa-user absolute left-4 top-3.5 text-slate-400"></i><input type="text" placeholder="Engineer Full Name" className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm font-bold" onChange={e=>setForm({...form, name:e.target.value})} /></div>
              <div className="relative"><i className="fa-solid fa-building absolute left-4 top-3.5 text-slate-400"></i><select className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm bg-slate-900 text-slate-300 font-bold" onChange={e=>setForm({...form, unit:e.target.value})}><option value="">Select Your Zone</option>{["RUP - South Block", "RUP - North Block", "LAB", "MSQU", "AU-5", "BS-VI", "GR-II & NBA", "GR-I", "OM&S", "OLD SRU & CETP", "Electrical Planning", "Electrical Testing", "Electrical Workshop", "FCC", "GRE", "CGP-I", "CGP-II & TPS", "Water Block & Bitumen", "Township - Estate Office", "AC Section", "GHC", "DHUMAD"].map(z=><option key={z} value={z}>{z}</option>)}</select></div>
            </>
          )}
          {view === "otp" ? (
             <div className="relative"><i className="fa-solid fa-key absolute left-4 top-3.5 text-slate-400"></i><input type="text" placeholder="######" maxLength={6} className="w-full p-3 rounded-lg login-input text-center text-2xl tracking-[0.5em] font-bold text-white outline-none font-mono" onChange={e=>setForm({...form, enteredOtp:e.target.value})} /></div>
          ) : (
             <div className="relative"><i className="fa-solid fa-envelope absolute left-4 top-3.5 text-slate-400"></i><input type="email" value={form.email} className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm font-bold font-inter" placeholder="Official Email ID" onChange={e=>setForm({...form, email:e.target.value})} /></div>
          )}
          {(view === "login" || view === "register") && <div className="relative"><i className="fa-solid fa-lock absolute left-4 top-3.5 text-slate-400"></i><input type="password" placeholder="Password" className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm font-bold font-inter" onChange={e=>setForm({...form, pass:e.target.value})} /></div>}
          {view === "login" && (
            <div className="text-right font-inter"><button onClick={()=>setView('forgot')} className="text-xs text-orange-500 hover:text-orange-400 font-bold transition">Forgot Password?</button></div>
          )}
          <button onClick={handleAuth} disabled={authLoading} className="w-full h-12 mt-4 iocl-btn text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 uppercase tracking-widest text-sm">
            {authLoading ? "Processing..." : view === 'login' ? "Secure Login →" : view === 'register' ? "Create Account" : view === 'otp' ? "Verify & Register" : "Send Reset Link"}
          </button>
          <div className="mt-6 text-center border-t border-white/10 pt-4 font-inter">
            <p className="text-xs text-slate-400">{view==='login' ? "New User? " : "Already have an account? "}<button onClick={()=>setView(view==='login'?'register':'login')} className="text-white hover:text-orange-500 font-bold underline ml-1">{view==='login' ? "Create Account" : "Back to Login"}</button></p>
          </div>
          <div className="mt-8 pt-6 border-t border-white/10 text-center font-inter">
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Developed By Engineers</p>
            <p className="text-[11px] text-slate-300 font-bold font-hindi">अशोक सैनी • दीपक चौहान • दिव्यांक सिंह राजपूत</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- GLOBAL SEARCH VIEW (FONT UPDATED) ---
function GlobalSearchView({ profile }: any) {
  const [items, setItems] = useState<any[]>([]); 
  const [search, setSearch] = useState(""); 
  const [selCat, setSelCat] = useState("all");
  const [requestItem, setRequestItem] = useState<any>(null);
  const [reqForm, setReqForm] = useState({ qty: "", comment: "" });

  useEffect(() => { fetchAll(); }, []);
  const fetchAll = async () => { const { data } = await supabase.from("inventory").select("*"); if (data) setItems(data); };

  const handleSendRequest = async () => {
    if (!reqForm.qty || Number(reqForm.qty) <= 0 || Number(reqForm.qty) > requestItem.qty) { alert("Invalid quantity!"); return; }
    const { error } = await supabase.from("requests").insert([{
        item_id: requestItem.id, item_name: requestItem.item, item_spec: requestItem.spec, item_unit: requestItem.unit, req_qty: Number(reqForm.qty), req_comment: reqForm.comment, from_name: profile.name, from_uid: profile.id, from_unit: profile.unit, to_name: requestItem.holder_name, to_uid: requestItem.holder_uid, to_unit: requestItem.holder_unit, status: 'pending', viewed_by_requester: false
    }]);
    if (!error) { alert("Request Sent Successfully!"); setRequestItem(null); setReqForm({ qty: "", comment: "" }); } else alert(error.message);
  };

  const filtered = items.filter((i: any) => (i.item.toLowerCase().includes(search.toLowerCase()) || i.spec.toLowerCase().includes(search.toLowerCase())) && (selCat === "all" ? true : i.cat === selCat));

  return (
    <div className="space-y-6 animate-fade-in font-inter uppercase font-bold">
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b bg-slate-50/80 flex flex-wrap items-center gap-2">
             <div className="relative flex-grow md:w-80 font-bold"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Global Search..." className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none focus:ring-1 font-bold uppercase" onChange={e=>setSearch(e.target.value)} /></div>
             <select className="border rounded-md text-xs font-bold p-2 bg-white uppercase" onChange={e=>setSelCat(e.target.value)}><option value="all">All Items</option>{[...new Set(items.map(i => i.cat))].sort().map(c => <option key={c} value={c}>{c}</option>)}</select>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left font-industrial tracking-tight"><thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black border-b tracking-widest"><tr><th className="p-4 pl-6 font-bold">Item Detail</th><th className="p-4 font-bold">Spec</th><th className="p-4 text-center font-bold">Total Stock</th><th className="p-4 text-center font-bold">Action</th></tr></thead>
          <tbody className="divide-y text-sm">
            {filtered.map((i: any, idx: number) => (
              <tr key={idx} className={`hover:bg-slate-50 transition border-b border-slate-50 ${i.qty === 0 ? 'bg-red-50/20' : ''}`}>
                <td className="p-4 pl-6 font-bold leading-tight uppercase font-inter">
                  <div className="text-slate-800 font-bold text-sm tracking-tight">{i.item}</div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">{i.cat}</div>
                </td>
                <td className="p-4"><span className="bg-white border px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 shadow-sm uppercase font-inter">{i.spec}</span></td>
                <td className="p-4 text-center font-mono font-bold whitespace-nowrap text-slate-700">{i.qty} {i.unit}</td>
                <td className="p-4 text-center">
                    {i.holder_uid === profile?.id ? <span className="text-[10px] font-black text-green-600 italic tracking-tighter uppercase font-bold">MY STORE</span> : <button onClick={()=>setRequestItem(i)} className="bg-orange-500 text-white px-3 py-1 rounded text-[10px] font-black shadow-sm uppercase font-industrial tracking-widest font-bold">Request</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>
    </div>
  );
}

// --- MY STORE VIEW (FONT UPDATED) ---
function MyStoreView({ profile, fetchProfile }: any) {
  const [myItems, setMyItems] = useState<any[]>([]); const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ cat: "", sub: "", make: "", model: "", spec: "", qty: "", isManual: false });

  useEffect(() => { if (profile) fetch(); }, [profile]);
  const fetch = async () => { const { data } = await supabase.from("inventory").select("*").eq("holder_uid", profile.id).order("id", { ascending: false }); if (data) setMyItems(data); };

  const handleSave = async () => {
    if (!form.spec || !form.qty) return alert("Sari details bhariye!");
    const itemName = `${form.make} ${form.sub} ${form.model}`.trim();
    const { error } = await supabase.from("inventory").insert([{ item: itemName, cat: form.cat, sub: form.sub, make: form.make, model: form.model, spec: form.spec, qty: parseInt(form.qty), unit: 'Nos', holder_unit: profile.unit, holder_uid: profile.id, holder_name: profile.name }]);
    if (!error) { alert("Stock Inward Success!"); fetch(); setShowAddModal(false); setForm({ cat: "", sub: "", make: "", model: "", spec: "", qty: "", isManual: false }); await supabase.from("profiles").update({ item_count: (profile.item_count || 0) + 1 }).eq('id', profile.id); fetchProfile(); } else alert(error.message);
  };

  return (
    <div className="animate-fade-in space-y-6 pb-10 uppercase font-inter font-bold">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl border shadow-sm font-industrial">
        <div><h2 className="text-xl font-bold text-slate-800 uppercase tracking-widest leading-none font-black uppercase">My Local Store</h2><p className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded mt-2 uppercase tracking-widest font-industrial uppercase font-bold tracking-tighter">ZONE: {profile?.unit}</p></div>
        <button onClick={() => setShowAddModal(true)} className="iocl-btn text-white px-6 py-2.5 rounded-xl font-bold shadow-md flex items-center gap-2"><i className="fa-solid fa-plus"></i> Add New Stock</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden font-mono uppercase font-bold">
        <div className="overflow-x-auto"><table className="w-full text-left font-industrial tracking-tight font-inter"><thead className="bg-slate-50 text-slate-500 text-[10px] font-bold border-b uppercase font-industrial tracking-widest"><tr><th className="p-5 pl-8">Category</th><th className="p-5">Item Name</th><th className="p-5">Spec</th><th className="p-5 text-center">Qty</th></tr></thead>
          <tbody className="divide-y text-sm">
              {myItems.map(i => (<tr key={i.id} className="hover:bg-slate-50 transition border-b border-slate-50 font-bold">
                <td className="p-5 pl-8 text-[9px] font-bold text-slate-400 uppercase leading-none">{i.cat}</td>
                <td className="p-5 leading-tight uppercase font-inter"><div className="text-slate-800 font-bold text-sm tracking-tight">{i.item}</div></td>
                <td className="p-5 font-mono uppercase font-bold"><span className="bg-white border px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 shadow-sm uppercase">{i.spec}</span></td>
                <td className="p-5 font-bold text-center font-mono uppercase whitespace-nowrap text-slate-700">{i.qty} {i.unit}</td>
              </tr>))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

// --- USAGE HISTORY & ANALYSIS ---
function UsageHistoryView({ profile }: any) {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => { if (profile) fetch(); }, [profile]);
  const fetch = async () => { const { data } = await supabase.from("usage_logs").select("*").eq("consumer_uid", profile.id).order("timestamp", { ascending: false }); if (data) setLogs(data); };
  return (<section className="bg-white rounded-xl border border-slate-200 shadow-sm font-mono uppercase font-bold"><div className="p-5 border-b bg-slate-50/50 flex justify-between font-inter"><h2 className="text-lg font-bold text-slate-800 uppercase font-industrial tracking-wider">Log: Usage Feed</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-xs uppercase font-mono font-bold"><thead className="bg-slate-50 border-b text-[10px] font-black uppercase tracking-widest font-industrial"><tr><th className="p-4 pl-8">Date</th><th className="p-4">Details</th><th className="p-4 text-center">Qty</th></tr></thead><tbody className="divide-y text-slate-600">{logs.map(l => (<tr key={l.id} className="hover:bg-slate-50 transition border-b border-slate-100"><td className="p-4 pl-8 uppercase font-mono">{new Date(Number(l.timestamp)).toLocaleDateString()}</td><td className="p-4 font-inter font-bold uppercase leading-tight"><div className="text-slate-800 font-bold text-sm tracking-tight">{l.item_name}</div><div className="text-[9px] text-slate-400 uppercase mt-0.5 tracking-tighter font-bold">{l.category}</div></td><td className="p-4 text-center font-black text-red-600">-{l.qty_consumed} Nos</td></tr>))}</tbody></table></div></section>);
}

function MonthlyAnalysisView({ profile }: any) {
  const [analysis, setAnalysis] = useState<any[]>([]);
  useEffect(() => { const f = async () => { const { data } = await supabase.from("usage_logs").select("*").eq("consumer_uid", profile.id); if (data) { const stats: any = {}; data.forEach((l: any) => { const month = new Date(Number(l.timestamp)).toLocaleString('default', { month: 'long', year: 'numeric' }); if (!stats[month]) stats[month] = { month, total: 0, count: 0 }; stats[month].total += Number(l.qty_consumed); stats[month].count += 1; }); setAnalysis(Object.values(stats)); } }; if (profile) f(); }, [profile]);
  return (<div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-industrial uppercase tracking-tight font-bold"><div className="col-span-3 pb-4 text-xs font-black text-slate-400 tracking-widest text-center border-b font-industrial">Analytical Summary</div>{analysis.map((a, idx) => (<div key={idx} className="bg-white p-6 rounded-2xl border shadow-sm text-center transition hover:shadow-md uppercase font-bold"><div className="text-xs font-black text-slate-400 uppercase mb-4 tracking-[0.2em] font-industrial">{a.month}</div><div className="w-16 h-16 bg-blue-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner font-bold"><i className="fa-solid fa-chart-line font-bold"></i></div><div className="text-3xl font-black text-slate-800 font-industrial">{a.total} <small className="text-[10px] text-slate-400 font-bold uppercase font-industrial tracking-widest">Nos</small></div><div className="text-[10px] font-bold text-emerald-500 mt-2 uppercase font-industrial tracking-tighter">{a.count} Logged Records</div></div>))}</div>);
}

// --- UPDATED RETURNS & UDHAARI VIEW (FONT + ARCHIVE COLUMN UPDATED) ---
function ReturnsLedgerView({ profile, onAction }: any) { 
    const [pending, setPending] = useState<any[]>([]);
    const [given, setGiven] = useState<any[]>([]);
    const [taken, setTaken] = useState<any[]>([]);
    const [givenHistory, setGivenHistory] = useState<any[]>([]);
    const [takenHistory, setTakenHistory] = useState<any[]>([]);
    const [actionModal, setActionModal] = useState<any>(null); 
    const [form, setForm] = useState({ comment: "", qty: "" });

    const fetchAll = async () => {
        const { data: p } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).in("status", ["pending", "return_requested"]).order("id", { ascending: false });
        const { data: g } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).eq("status", "approved").order("id", { ascending: false });
        const { data: t } = await supabase.from("requests").select("*").eq("from_unit", profile.unit).eq("status", "approved").order("id", { ascending: false });
        const { data: gh } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).in("status", ["returned", "rejected"]).order("id", { ascending: false });
        const { data: th } = await supabase.from("requests").select("*").eq("from_unit", profile.unit).in("status", ["returned", "rejected"]).order("id", { ascending: false });
        if (p) setPending(p); if (g) setGiven(g); if (t) setTaken(t);
        if (gh) setGivenHistory(gh); if (th) setTakenHistory(th);
    };

    useEffect(() => {
        if (!profile) return; fetchAll();
        const channel = supabase.channel('sparesetu-global-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => { fetchAll(); if(onAction) onAction(); }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [profile]);

    const formatTS = (ts: any) => new Date(Number(ts)).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });

    const handleProcess = async () => {
        const { type, data } = actionModal;
        if (type.includes('reject') && !form.comment.trim()) { alert("Provide a reason/log comment!"); return; }
        const actionQty = Number(form.qty || data.req_qty);

        if (type === 'approve') {
            const { error } = await supabase.from("requests").update({ status: 'approved', approve_comment: form.comment, to_uid: profile.id, to_name: profile.name, req_qty: actionQty, viewed_by_requester: false }).eq("id", data.id);
            if (!error) {
                const { data: inv } = await supabase.from("inventory").select("qty").eq("id", data.item_id).single();
                if (inv) await supabase.from("inventory").update({ qty: inv.qty - actionQty }).eq("id", data.item_id);
            }
        } 
        else if (type === 'reject') {
            await supabase.from("requests").update({ status: 'rejected', approve_comment: form.comment, to_uid: profile.id, to_name: profile.name, viewed_by_requester: false }).eq("id", data.id);
        }
        else if (type === 'return') {
            const { error } = await supabase.from("requests").insert([{ 
                item_id: data.item_id, item_name: data.item_name, item_spec: data.item_spec, item_unit: data.item_unit, req_qty: actionQty, status: 'return_requested', return_comment: form.comment, from_uid: profile.id, from_name: profile.name, from_unit: profile.unit, to_uid: data.to_uid, to_name: data.to_name, to_unit: data.to_unit, viewed_by_requester: false, approve_comment: `VERIFY_LINK_ID:${data.id}` 
            }]);
            if (!error) alert("Return initiated! Lender will verify now.");
        }
        else if (type === 'verify') {
            const parentId = data.approve_comment?.match(/VERIFY_LINK_ID:(\d+)/)?.[1];
            if (parentId) {
                const { data: parent } = await supabase.from("requests").select("req_qty").eq("id", parentId).single();
                if (parent) {
                    const newBal = parent.req_qty - data.req_qty;
                    if (newBal <= 0) await supabase.from("requests").delete().eq("id", parentId);
                    else await supabase.from("requests").update({ req_qty: newBal }).eq("id", parentId);
                }
            }
            await supabase.from("requests").update({ status: 'returned', approve_comment: `Verified By ${profile.name}: ${form.comment}`, to_uid: profile.id, to_name: profile.name, viewed_by_requester: false }).eq("id", data.id);
            const { data: inv } = await supabase.from("inventory").select("qty").eq("id", data.item_id).single();
            if (inv) await supabase.from("inventory").update({ qty: inv.qty + data.req_qty }).eq("id", data.item_id);
        }
        else if (type === 'reject_return') {
            await supabase.from("requests").update({ status: 'approved', approve_comment: `Denied: ${form.comment}`, to_uid: profile.id, to_name: profile.name, viewed_by_requester: false }).eq("id", data.id);
        }
        setActionModal(null); setForm({comment:"", qty:""});
    };

    return (
        <div className="space-y-10 animate-fade-in pb-20 font-industrial tracking-tight font-inter uppercase font-bold">
            <h2 className="text-2xl font-bold text-slate-800 uppercase flex items-center gap-2 font-industrial"><i className="fa-solid fa-handshake-angle text-orange-500"></i> Udhaari Dashboard</h2>

            {/* ATTENTION REQUIRED */}
            <section className="bg-white rounded-xl border-t-4 border-orange-500 shadow-xl overflow-hidden font-industrial uppercase font-bold">
                <div className="p-4 bg-orange-50/50 flex justify-between border-b uppercase font-bold"><div className="flex items-center gap-2 text-orange-900 font-black uppercase text-[10px] tracking-widest font-inter uppercase font-bold"><i className="fa-solid fa-bolt animate-pulse"></i> Attention Required (Incoming Actions)</div><span className="bg-orange-600 text-white px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase font-bold">{pending.length}</span></div>
                <div className="overflow-x-auto"><table className="w-full text-left text-sm divide-y font-mono font-bold">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase font-industrial tracking-widest"><tr><th className="p-4 pl-6">Material Detail</th><th className="p-4">Counterparty</th><th className="p-4 text-center">Qty</th><th className="p-4 text-center">Action</th></tr></thead>
                    <tbody className="divide-y text-slate-600 uppercase font-bold">
                        {pending.map(r => (
                            <tr key={r.id} className={`${r.status==='return_requested' ? 'bg-orange-50 animate-pulse' : 'bg-white'} transition border-b`}>
                                <td className="p-4 pl-6 leading-tight uppercase font-inter">
                                  <div className="text-slate-800 font-bold text-sm tracking-tight">{r.item_name}</div>
                                  <div className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase tracking-tighter font-mono">{r.item_spec}</div>
                                  <div className="text-[8px] text-slate-300 italic mt-1 font-mono">{formatTS(r.timestamp)}</div>
                                </td>
                                <td className="p-4 font-bold text-slate-700 uppercase font-inter leading-tight">{r.from_name}<div className="text-[10px] text-slate-400 font-normal uppercase font-mono">{r.from_unit}</div></td>
                                <td className="p-4 text-center font-black text-orange-600 text-lg font-mono whitespace-nowrap">{r.req_qty} {r.item_unit}</td>
                                <td className="p-4 flex gap-2 justify-center font-industrial"><button onClick={()=>setActionModal({type: r.status==='pending' ? 'approve' : 'verify', data:r})} className="bg-green-600 text-white px-4 py-2 rounded-lg text-[9px] font-black shadow-md hover:bg-green-700 tracking-widest font-bold uppercase font-inter"> {r.status==='pending' ? 'Issue' : 'Verify'} </button><button onClick={()=>setActionModal({type: r.status==='pending' ? 'reject' : 'reject_return', data:r})} className="bg-slate-100 text-slate-500 px-4 py-2 rounded-lg text-[9px] font-black transition tracking-widest uppercase font-bold font-inter">Reject</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table></div>
            </section>

            {/* ACTIVE LEDGER */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-inter uppercase font-bold">
                <section className="bg-white rounded-2xl border-t-4 border-blue-600 shadow-lg overflow-hidden font-mono uppercase font-bold">
                    <div className="p-5 border-b bg-blue-50/30 flex items-center gap-3 font-industrial text-xs font-black text-blue-900 tracking-widest"> <i className="fa-solid fa-arrow-up-from-bracket text-blue-600"></i> Active Ledger (Items Given)</div>
                    <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                        {given.map(r => (
                            <div key={r.id} className="p-4 border-2 border-slate-100 bg-white rounded-2xl relative shadow-sm uppercase font-bold font-inter">
                                <div className="text-slate-800 font-bold text-sm tracking-tight mb-1">{r.item_name}</div>
                                <div className="text-[9px] text-slate-400 mb-3 uppercase tracking-tighter font-bold">{r.item_spec}</div>
                                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg mb-3"><div><p className="text-[9px] font-bold text-slate-400 uppercase font-industrial">Receiver</p><p className="text-xs font-black text-slate-700 uppercase tracking-tighter">{r.from_name} ({r.from_unit})</p></div><div className="text-right font-black text-blue-600 font-mono">{r.req_qty} {r.item_unit}</div></div>
                                <div className="text-[9px] font-mono text-slate-400 space-y-1 bg-slate-50/50 p-2 rounded border border-dashed tracking-tighter">
                                    <p><span className="font-black text-blue-600/70 uppercase">ISSUED BY:</span> {r.to_name}</p>
                                    <p><span className="font-black uppercase tracking-tighter">LOG DATE:</span> {formatTS(r.timestamp)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="bg-white rounded-2xl border-t-4 border-red-600 shadow-lg overflow-hidden font-mono uppercase font-bold">
                    <div className="p-5 border-b bg-red-50/30 flex items-center gap-3 font-industrial text-xs font-black text-red-900 tracking-widest"> <i className="fa-solid fa-arrow-down-long text-red-600"></i> Active Ledger (Items Taken)</div>
                    <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                        {taken.map(r => (
                            <div key={r.id} className="p-4 border-2 border-slate-100 bg-white rounded-2xl relative uppercase font-bold font-inter">
                                <div className="text-slate-800 font-bold text-sm tracking-tight mb-1">{r.item_name}</div>
                                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg mb-3 font-bold"><div><p className="text-[9px] font-bold text-slate-400 uppercase font-industrial">Source</p><p className="text-xs font-black text-slate-700 uppercase tracking-tighter">{r.to_unit} ({r.to_name})</p></div><div className="text-right font-black text-red-600 font-mono">{r.req_qty} {r.item_unit}</div></div>
                                <div className="text-[9px] font-mono text-slate-400 mb-3 space-y-1 bg-slate-50/50 p-2 rounded border border-dashed tracking-tighter uppercase font-bold">
                                    <p><span className="font-black text-red-600/70 uppercase">TAKEN BY:</span> {r.from_name}</p>
                                    <p><span className="font-black uppercase tracking-tighter">DATE:</span> {formatTS(r.timestamp)}</p>
                                </div>
                                <button onClick={()=>setActionModal({type:'return', data:r})} className="w-full py-2 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest font-industrial shadow-md">Initiate Partial/Full Return</button>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* SETTLED HISTORY RECORD (UPDATED QTY COLUMN & FONT) */}
            <div className="pt-10 space-y-10 font-mono uppercase font-bold">
                <div className="flex items-center gap-4"><hr className="flex-1 border-slate-200"/><h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.4em] font-industrial">Digital Archive Logs</h3><hr className="flex-1 border-slate-200"/></div>
                <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-slate-800 text-white flex justify-between font-industrial text-[10px] tracking-widest uppercase"><span>Finalized Audit Trail: 7-Point Timeline Logs</span><i className="fa-solid fa-file-shield text-slate-400"></i></div>
                    <div className="overflow-x-auto"><table className="w-full text-left text-[9px] divide-y divide-slate-100 uppercase font-mono">
                        <thead className="bg-slate-50 text-[8px] font-black text-slate-400 font-industrial tracking-widest uppercase"><tr><th className="p-4">Material Details & Technical Spec</th><th className="p-4 text-center">Qty</th><th className="p-4">Receiver & Lender Info</th><th className="p-4">7-Point Audit Life-Cycle Log</th><th className="p-4 text-center">Status</th></tr></thead>
                        <tbody className="divide-y text-slate-600 font-bold uppercase">
                            {[...givenHistory, ...takenHistory].sort((a,b)=>Number(b.timestamp)-Number(a.timestamp)).map(h => (
                                <tr key={h.id} className="hover:bg-slate-50 transition border-b uppercase font-bold">
                                    <td className="p-4 leading-tight uppercase font-bold">
                                      <p className="text-slate-800 font-bold text-xs tracking-tight">{h.item_name}</p>
                                      <p className="text-[8px] text-slate-400 mt-1 uppercase">SPEC: {h.item_spec}</p>
                                    </td>
                                    {/* UPDATED QTY COLUMN: SHOWING UDH & RET TOGETHER */}
                                    <td className="p-4 text-center font-black whitespace-nowrap">
                                      <div className="flex flex-col items-center gap-0.5 leading-none">
                                        <span className="text-[9px] text-blue-600/80 font-bold uppercase tracking-tighter">UDH: {h.req_qty} {h.item_unit}</span>
                                        <span className={`text-[9px] font-black uppercase tracking-tighter ${h.status === 'returned' ? 'text-green-600' : 'text-slate-300'}`}>
                                          RET: {h.status === 'returned' ? h.req_qty : 0} {h.item_unit}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="p-4 leading-tight uppercase font-bold"><p className="text-blue-500 font-bold uppercase">BORR: {h.from_name}</p><p className="text-red-500 font-bold uppercase">LEND: {h.to_name}</p></td>
                                    <td className="p-4 leading-none space-y-1 font-bold tracking-tighter uppercase text-[8px]">
                                        <p><span className="opacity-50 font-bold">1. REQUEST BY:</span> {h.from_name} ({h.from_unit}) @ {formatTS(h.timestamp)}</p>
                                        <p><span className="opacity-50 font-bold">2. APPROVED BY:</span> {h.to_name} (Settled Qty: {h.req_qty}) @ {formatTS(h.timestamp)}</p>
                                        <p><span className="opacity-50 font-bold">3. RETURN BY:</span> {h.from_name} @ {formatTS(h.timestamp)}</p>
                                        <p><span className="opacity-50 font-black text-green-600 font-bold">4. FINAL VERIFY:</span> {h.to_name} @ {formatTS(h.timestamp)} (LOGGED)</p>
                                    </td>
                                    <td className="p-4 text-center uppercase font-bold"><span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${h.status==='returned' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{h.status}</span></td>
                                </tr>
                            ))}
                        </tbody></table></div>
                </div>
            </div>

            {/* ACTION MODAL (NO CHANGES) */}
            {actionModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-inter font-bold uppercase">
                    <div className="bg-white w-full max-w-[320px] rounded-2xl shadow-2xl p-5 animate-scale-in border-t-4 border-slate-900 font-industrial">
                        <div className="flex justify-between items-center mb-4 border-b pb-2 tracking-widest"><h3 className="text-[11px] font-black text-slate-800 uppercase">{actionModal.type.replace('_', ' ')} Portal</h3><button onClick={()=>setActionModal(null)} className="text-slate-400 hover:text-red-500">✕</button></div>
                        <div className="text-slate-800 font-bold text-sm tracking-tight mb-1">{actionModal.data.item_name}</div>
                        <div className="text-[9px] text-slate-400 mb-5 font-mono truncate">{actionModal.data.item_spec}</div>
                        <div className="space-y-4">
                            {(actionModal.type === 'approve' || actionModal.type === 'return' || actionModal.type === 'verify') && (
                                <div className="bg-slate-50 p-3 rounded-xl text-center shadow-inner">
                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Set Verify Quantity</label>
                                    <input type="number" defaultValue={actionModal.data.req_qty} className="w-full bg-white p-2 border-2 rounded-lg text-center text-lg font-black outline-none focus:border-slate-800 shadow-sm font-mono h-[38px]" onChange={e=>setForm({...form, qty: e.target.value})} />
                                    <p className="text-[8px] text-slate-400 mt-1">Max Limit: {actionModal.data.req_qty} {actionModal.data.item_unit}</p>
                                </div>
                            )}
                            <div><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 font-industrial">Audit Log Comment</label><textarea className="w-full p-2 border-2 rounded-lg text-xs h-16 outline-none focus:border-slate-800 mt-1 font-mono leading-tight shadow-inner uppercase font-bold" placeholder="Reason/Ref..." onChange={e=>setForm({...form, comment: e.target.value})}></textarea></div>
                            <div className="flex flex-col gap-2 pt-1 font-industrial">
                                <button onClick={handleProcess} className={`w-full py-2.5 font-black rounded-xl uppercase text-[10px] shadow-lg text-white ${actionModal.type.includes('reject') ? 'bg-red-600' : 'bg-slate-900'} hover:opacity-90 transition-all`}>Confirm System Logic</button>
                                <button onClick={()=>setActionModal(null)} className="w-full py-1 text-slate-400 text-[9px] font-bold uppercase tracking-widest font-industrial">Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    ); 
}
