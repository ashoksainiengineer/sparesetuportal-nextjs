"use client";

import { useState, useEffect, useMemo } from "react";
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
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) { setUser(session.user); fetchProfile(session.user.id); }
        setLoading(false);
      } catch (err) {
        console.error("Session Error:", err);
        setLoading(false);
      }
    };
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) { setUser(session.user); fetchProfile(session.user.id); }
      else { setUser(null); setProfile(null); }
      setLoading(false);
    });
    getSession();
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!profile?.id || !profile?.unit) return;
    const fetchAllCounts = async () => {
        try {
            const { count: incoming } = await supabase.from("requests").select("*", { count: 'exact', head: true }).eq("to_unit", profile.unit).in("status", ["pending", "return_requested"]);
            const { count: updates } = await supabase.from("requests").select("*", { count: 'exact', head: true }).eq("from_uid", profile.id).eq("viewed_by_requester", false).in("status", ["approved", "rejected", "returned"]);
            setPendingCount((incoming || 0) + (updates || 0));
        } catch (err) { console.error("Notif Error:", err); }
    };
    fetchAllCounts();
    const channel = supabase.channel('global-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => { fetchAllCounts(); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const fetchProfile = async (uid: string) => {
    try {
        const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
        if (data) setProfile(data);
    } catch (err) { console.error("Profile Fetch Error:", err); }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return alert("No data to export!");
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(","));
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return (
    <div className="fixed inset-0 z-[10000] bg-[#0f172a] flex flex-col items-center justify-center font-roboto">
      <div className="iocl-logo-container mb-4 animate-pulse" style={{ fontSize: '20px' }}>
        <div className="iocl-circle"><div className="iocl-band"><span className="iocl-hindi-text">इंडियनऑयल</span></div></div>
      </div>
      <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.3em]">SpareSetu Loading...</p>
    </div>
  );

  if (!user) return <AuthView />;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f1f5f9] font-roboto font-bold uppercase">
      <aside className="w-64 bg-white hidden md:flex flex-col flex-shrink-0 z-20 shadow-xl border-r border-slate-200 font-bold uppercase">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-orange-600"><i className="fa-solid fa-layer-group"></i></div>
          <span className="text-lg font-bold text-slate-800 uppercase tracking-wide">Menu</span>
        </div>
        <nav className="flex-1 px-3 space-y-1 mt-4 overflow-y-auto">
          {[
            { id: 'search', label: 'Global Search', icon: 'fa-globe', badge: 0 },
            { id: 'mystore', label: 'My Local Store', icon: 'fa-warehouse', badge: 0 },
            { id: 'analysis', label: 'Monthly Analysis', icon: 'fa-chart-pie', badge: 0 },
            { id: 'usage', label: 'My Usage History', icon: 'fa-clock-rotate-left', badge: 0 },
            { id: 'returns', label: 'Returns & Udhaari', icon: 'fa-hand-holding-hand', badge: pendingCount }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-bold relative ${activeTab === tab.id ? 'active-nav' : 'text-slate-600 hover:bg-slate-50'}`}>
              <i className={`fa-solid ${tab.icon} w-5`}></i> 
              <span>{tab.label}</span>
              {(tab.badge || 0) > 0 && <span className="absolute right-3 top-3.5 bg-orange-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black animate-bounce">{tab.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100 bg-slate-50 font-bold uppercase">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white border mb-2 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-xs">{profile?.name?.charAt(0)}</div>
            <div className="overflow-hidden"><p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Logged in</p><div className="text-xs font-bold text-slate-700 truncate">{profile?.name}</div></div>
          </div>
          <button onClick={() => supabase.auth.signOut().then(()=>window.location.reload())} className="w-full py-2 text-xs text-red-500 hover:bg-red-50 font-bold rounded-lg transition border border-red-100 text-center block uppercase">Logout</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-y-auto relative pb-20 md:pb-0 font-bold uppercase font-roboto">
        <header className="header-bg text-white sticky top-0 z-30 shadow-md">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="iocl-logo-container hidden md:flex" style={{ fontSize: '10px' }}>
                <div className="iocl-circle"><div className="iocl-band"><span className="iocl-hindi-text">इंडियनऑयल</span></div></div>
                <div className="iocl-english-text" style={{ color: 'white' }}>IndianOil</div>
                <div className="font-script text-orange-400 text-[10px] mt-1 whitespace-nowrap font-bold uppercase">The Energy of India</div>
              </div>
              <div className="flex flex-col items-center text-center font-bold"> 
                <h1 className="text-2xl md:text-3xl uppercase tracking-wider leading-none">Gujarat Refinery</h1>
                <p className="font-hindi text-blue-400 text-xs font-bold tracking-wide mt-1">जहाँ प्रगति ही जीवन सार है</p>
              </div>
            </div>
            <h2 className="text-xl text-orange-500 tracking-[0.1em] font-bold uppercase hidden md:block">SPARE SETU PORTAL</h2>
          </div>
        </header>

        <div className="p-4 md:p-10 max-w-7xl mx-auto w-full space-y-8">
          {activeTab === "search" && <GlobalSearchView profile={profile} onExport={exportToCSV} />}
          {activeTab === "mystore" && <MyStoreView profile={profile} fetchProfile={()=>fetchProfile(user.id)} onExport={exportToCSV} />}
          {activeTab === "usage" && <UsageHistoryView profile={profile} />}
          {activeTab === "analysis" && <MonthlyAnalysisView profile={profile} />}
          {activeTab === "returns" && <ReturnsLedgerView profile={profile} />}
        </div>
      </main>
    </div>
  );
}

// --- AUTH VIEW ---
function AuthView() {
  const [view, setView] = useState<"login" | "register" | "otp" | "forgot">("login");
  const [form, setForm] = useState({ email: "", pass: "", name: "", unit: "", enteredOtp: "", generatedOtp: "" });
  const [authLoading, setAuthLoading] = useState(false);

  const handleAuth = async () => {
    setAuthLoading(true);
    try {
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
    } catch (err) { alert("Network Connection Error"); }
    setAuthLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 login-bg font-bold uppercase">
      <div className="w-full max-w-md login-card rounded-2xl shadow-2xl p-8 border-t-4 border-orange-500 text-center relative animate-fade-in font-roboto">
        <div className="mb-8">
            <div className="flex justify-center mb-4">
              <div className="iocl-logo-container" style={{ fontSize: '14px' }}>
                <div className="iocl-circle"><div className="iocl-band"><span className="iocl-hindi-text">इंडियनऑयल</span></div></div>
                <div className="iocl-english-text" style={{ color: 'white' }}>IndianOil</div>
                <div className="font-script text-orange-400 text-[10px] mt-1 whitespace-nowrap">The Energy of India</div>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white uppercase tracking-wider leading-tight font-roboto">Gujarat Refinery</h1>
            <p className="font-hindi text-blue-400 text-sm font-bold mt-1 tracking-wide">जहाँ प्रगति ही जीवन सार है</p>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-4">Spare Setu Portal</p>
        </div>
        <div className="space-y-4">
          {(view === "register") && (
            <>
              <div className="relative"><i className="fa-solid fa-user absolute left-4 top-3.5 text-slate-400"></i><input type="text" placeholder="Engineer Full Name" className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm font-bold font-roboto" onChange={e=>setForm({...form, name:e.target.value})} /></div>
              <div className="relative"><i className="fa-solid fa-building absolute left-4 top-3.5 text-slate-400"></i><select className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm bg-slate-900 text-slate-300 font-bold font-roboto" onChange={e=>setForm({...form, unit:e.target.value})}><option value="">Select Your Zone</option>{["RUP - South Block", "RUP - North Block", "LAB", "MSQU", "AU-5", "BS-VI", "GR-II & NBA", "GR-I", "OM&S", "OLD SRU & CETP", "Electrical Planning", "Electrical Testing", "Electrical Workshop", "FCC", "GRE", "CGP-I", "CGP-II & TPS", "Water Block & Bitumen", "Township - Estate Office", "AC Section", "GHC", "DHUMAD"].map(z=><option key={z} value={z}>{z}</option>)}</select></div>
            </>
          )}
          {view === "otp" ? (
             <div className="relative"><i className="fa-solid fa-key absolute left-4 top-3.5 text-slate-400"></i><input type="text" placeholder="######" maxLength={6} className="w-full p-3 rounded-lg login-input text-center text-2xl tracking-[0.5em] font-bold text-white outline-none font-mono" onChange={e=>setForm({...form, enteredOtp:e.target.value})} /></div>
          ) : (
             <div className="relative"><i className="fa-solid fa-envelope absolute left-4 top-3.5 text-slate-400"></i><input type="email" value={form.email} className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm font-bold font-roboto" placeholder="Official Email ID" onChange={e=>setForm({...form, email:e.target.value})} /></div>
          )}
          {(view === "login" || view === "register") && <div className="relative"><i className="fa-solid fa-lock absolute left-4 top-3.5 text-slate-400"></i><input type="password" placeholder="Password" className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm font-bold font-roboto" onChange={e=>setForm({...form, pass:e.target.value})} /></div>}
          {view === "login" && (
            <div className="text-right"><button onClick={()=>setView('forgot')} className="text-xs text-orange-500 hover:text-orange-400 font-bold transition font-roboto">Forgot Password?</button></div>
          )}
          <button onClick={handleAuth} disabled={authLoading} className="w-full h-12 mt-4 iocl-btn text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 uppercase tracking-widest text-sm font-roboto">
            {authLoading ? "Processing..." : view === 'login' ? "Secure Login →" : view === 'register' ? "Create Account" : view === 'otp' ? "Verify & Register" : "Send Reset Link"}
          </button>
          <div className="mt-6 text-center border-t border-white/10 pt-4">
            <p className="text-xs text-slate-400 font-roboto">{view==='login' ? "New User? " : "Already have an account? "}<button onClick={()=>setView(view==='login'?'register':'login')} className="text-white hover:text-orange-500 font-bold underline ml-1">{view==='login' ? "Create Account" : "Back to Login"}</button></p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- GLOBAL SEARCH VIEW ---
function GlobalSearchView({ profile, onExport }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [contributors, setContributors] = useState<any[]>([]);
  const [search, setSearch] = useState(""); 
  const [selCat, setSelCat] = useState("all");
  const [requestItem, setRequestItem] = useState<any>(null);
  const [reqForm, setReqForm] = useState({ qty: "", comment: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchAll(); lead(); }, []);
  const fetchAll = async () => { try { const { data } = await supabase.from("inventory").select("*").order("id", { ascending: false }); if (data) setItems(data); } catch(e){} };
  const lead = async () => { try { const { data } = await supabase.from("profiles").select("name, unit, item_count").order("item_count", { ascending: false }).limit(3); if (data) setContributors(data); } catch(e){} };

  const handleSendRequest = async () => {
    if (!reqForm.qty || Number(reqForm.qty) <= 0 || Number(reqForm.qty) > requestItem.qty) { alert("Invalid quantity!"); return; }
    setSubmitting(true);
    try {
        const { error } = await supabase.from("requests").insert([{
            item_id: requestItem.id, item_name: requestItem.item, item_spec: requestItem.spec, item_unit: requestItem.unit, req_qty: Number(reqForm.qty), req_comment: reqForm.comment, from_name: profile.name, from_uid: profile.id, from_unit: profile.unit, to_name: requestItem.holder_name, to_uid: requestItem.holder_uid, to_unit: requestItem.holder_unit, status: 'pending', viewed_by_requester: false
        }]);
        if (!error) { alert("Request Sent!"); setRequestItem(null); setReqForm({ qty: "", comment: "" }); } else alert(error.message);
    } catch (err) { alert("Check your internet connection!"); }
    setSubmitting(false);
  };

  const filtered = items.filter((i: any) => (i.item.toLowerCase().includes(search.toLowerCase()) || i.spec.toLowerCase().includes(search.toLowerCase())) && (selCat === "all" ? true : i.cat === selCat));

  return (
    <div className="space-y-6 animate-fade-in font-roboto font-bold uppercase">
      <section className="bg-white p-4 rounded-xl border flex flex-wrap items-center gap-4 shadow-sm">
         <h2 className="text-sm font-bold uppercase text-slate-700 tracking-tight font-roboto"><i className="fa-solid fa-trophy text-yellow-500 mr-2"></i> Top Contributors</h2>
         <div className="flex gap-3 overflow-x-auto flex-1 pb-1">{contributors.map((c, idx) => (<div key={idx} className="bg-slate-50 p-2 rounded-lg border flex items-center gap-3 min-w-[180px] shadow-sm"><div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs border-2 border-orange-400">{c.name.charAt(0)}</div><div><p className="text-xs font-bold text-slate-800 truncate">{c.name}</p><p className="text-[9px] text-slate-400 uppercase tracking-tighter">{c.unit}</p><p className="text-[9px] font-bold text-green-600">{c.item_count || 0} Items</p></div></div>))}</div>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex flex-wrap items-center justify-between gap-4">
             <div className="flex flex-wrap items-center gap-2">
                <div className="relative md:w-80 font-bold"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Search Global Spares..." className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none font-bold uppercase font-roboto" onChange={e=>setSearch(e.target.value)} /></div>
                <select className="border rounded-md text-xs font-bold p-2 bg-white uppercase font-roboto" onChange={e=>setSelCat(e.target.value)}><option value="all">Category: All</option>{[...new Set(items.map(i => i.cat))].sort().map(c => <option key={c} value={c}>{c}</option>)}</select>
             </div>
             <button onClick={() => onExport(filtered, "Global_Inventory")} className="text-[10px] bg-emerald-600 text-white px-4 py-2 rounded-lg font-black tracking-widest hover:bg-emerald-700"><i className="fa-solid fa-file-excel mr-2"></i> Export Data</button>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left tracking-tight font-roboto font-bold uppercase"><thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b tracking-widest"><tr><th className="p-4 pl-6 font-bold">Item Detail</th><th className="p-4 font-bold">Spec</th><th className="p-4 text-center font-bold">Qty</th><th className="p-4 text-center font-bold">Action</th></tr></thead>
          <tbody className="divide-y text-sm">
            {filtered.map((i: any, idx: number) => (
              <tr key={idx} className={`hover:bg-slate-50 transition border-b border-slate-50 ${idx === 0 ? 'bg-orange-50/30' : ''}`}>
                <td className="p-4 pl-6 leading-tight">
                  <div className="text-slate-800 font-bold text-[14px] tracking-tight uppercase font-roboto">{i.item}</div>
                  <div className="text-[9.5px] text-slate-400 font-bold uppercase mt-1 tracking-wider font-roboto">{i.cat} | {i.holder_unit}</div>
                </td>
                <td className="p-4">
                  <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-[4px] text-[10.5px] font-bold text-slate-500 shadow-sm uppercase inline-block font-roboto">{i.spec}</span>
                </td>
                <td className="p-4 text-center font-bold whitespace-nowrap text-slate-800 text-[14px] font-roboto">{i.qty} {i.unit}</td>
                <td className="p-4 text-center font-roboto font-bold uppercase">
                    {i.holder_uid === profile?.id ? <span className="text-[10px] font-black text-green-600 italic">MY STORE</span> : <button onClick={()=>setRequestItem(i)} className="bg-[#ff6b00] text-white px-4 py-1.5 rounded-[4px] text-[10.5px] font-black shadow-sm uppercase tracking-widest">Request</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>

      {/* GLOBAL SEARCH MODAL */}
      {requestItem && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-lg shadow-xl overflow-hidden animate-fade-in border border-slate-200">
            <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Raise Material Request</h3>
              <button onClick={()=>setRequestItem(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded border border-slate-200">
                <p className="text-[10px] text-slate-400 font-black mb-1">SELECTED ITEM</p>
                <p className="text-sm font-bold text-slate-800 uppercase">{requestItem.item}</p>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tight">{requestItem.spec}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Quantity (Max: {requestItem.qty})</label>
                <input type="number" placeholder="Enter needed quantity" className="w-full mt-1 p-3 border border-slate-300 rounded outline-none font-bold text-slate-800 focus:ring-1 focus:ring-orange-500" onChange={e=>setReqForm({...reqForm, qty:e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Purpose / Reason</label>
                <textarea placeholder="Briefly state why this is required..." className="w-full mt-1 p-3 border border-slate-300 rounded outline-none font-bold text-xs h-24 text-slate-800 focus:ring-1 focus:ring-orange-500" onChange={e=>setReqForm({...reqForm, comment:e.target.value})}></textarea>
              </div>
              <button onClick={handleSendRequest} disabled={submitting} className="w-full py-3 bg-slate-800 text-white font-bold rounded shadow hover:bg-slate-900 transition-colors uppercase tracking-widest text-xs">
                {submitting ? "Processing..." : "Submit Global Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- MY STORE VIEW ---
function MyStoreView({ profile, fetchProfile, onExport }: any) {
  const [myItems, setMyItems] = useState<any[]>([]); 
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConsumeModal, setShowConsumeModal] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [isManual, setIsManual] = useState(false);
  const [form, setForm] = useState({ cat: "", sub: "", make: "", model: "", spec: "", qty: "", unit: "Nos" });
  const [consumeForm, setConsumeForm] = useState({ qty: "", comment: "" });

  useEffect(() => { if (profile) fetch(); }, [profile]);
  const fetch = async () => { try { const { data } = await supabase.from("inventory").select("*").eq("holder_uid", profile.id).order("id", { ascending: false }); if (data) setMyItems(data); } catch(e){} };

  const catList = useMemo(() => [...new Set(masterCatalog.map(x => x.cat))].sort(), []);
  const subList = useMemo(() => [...new Set(masterCatalog.filter(x => x.cat === form.cat).map(x => x.sub))].sort(), [form.cat]);
  const makeList = useMemo(() => [...new Set(masterCatalog.filter(x => x.cat === form.cat && x.sub === form.sub).map(x => x.make))].sort(), [form.cat, form.sub]);
  const modelList = useMemo(() => [...new Set(masterCatalog.filter(x => x.cat === form.cat && x.sub === form.sub && x.make === form.make).map(x => x.model))].sort(), [form.cat, form.sub, form.make]);
  const specList = useMemo(() => [...new Set(masterCatalog.filter(x => x.cat === form.cat && x.sub === form.sub && x.make === form.make && x.model === form.model).map(x => x.spec))].sort(), [form.cat, form.sub, form.make, form.model]);

  useEffect(() => {
    if (!isManual) {
      if (subList.length === 1 && !form.sub) setForm(f => ({ ...f, sub: subList[0] }));
      if (makeList.length === 1 && !form.make) setForm(f => ({ ...f, make: makeList[0] }));
      if (modelList.length === 1 && !form.model) setForm(f => ({ ...f, model: modelList[0] }));
      if (specList.length === 1 && !form.spec) setForm(f => ({ ...f, spec: specList[0] }));
    }
  }, [subList, makeList, modelList, specList, isManual]);

  const handleSave = async () => {
    const { cat, sub, make, model, spec, qty } = form;
    if (!cat || !spec || !qty) return alert("Fill mandatory details!");
    setSaving(true);
    const itemName = `${make} ${sub} ${model}`.trim();

    try {
        const { error } = await supabase.from("inventory").insert([{ 
          item: itemName, cat, sub, make, model, spec, qty: parseInt(qty), unit: form.unit, 
          holder_unit: profile.unit, holder_uid: profile.id, holder_name: profile.name,
          manual_add: isManual 
        }]);
        if (!error) {
            alert("Stock Added!");
            fetch(); setShowAddModal(false);
            setForm({ cat: "", sub: "", make: "", model: "", spec: "", qty: "", unit: "Nos" });
            await supabase.from("profiles").update({ item_count: (profile.item_count || 0) + 1 }).eq('id', profile.id);
            fetchProfile();
        }
    } catch(e){}
    setSaving(false);
  };

  const handleConsume = async () => {
    if (!consumeForm.qty || !consumeForm.comment) return alert("Qty and Comment are mandatory!");
    if (Number(consumeForm.qty) > showConsumeModal.qty) return alert("Insufficient Stock!");
    setSaving(true);
    try {
        const remaining = showConsumeModal.qty - Number(consumeForm.qty);
        await supabase.from("inventory").update({ qty: remaining }).eq("id", showConsumeModal.id);
        await supabase.from("usage_logs").insert([{
          inventory_id: showConsumeModal.id, item_name: showConsumeModal.item, category: showConsumeModal.cat,
          qty_consumed: Number(consumeForm.qty), consumer_name: profile.name, consumer_uid: profile.id,
          timestamp: Date.now().toString(), comment: consumeForm.comment
        }]);
        alert("Consumption Recorded!");
        fetch(); setShowConsumeModal(null); setConsumeForm({ qty: "", comment: "" });
    } catch(e){}
    setSaving(false);
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
        const { error } = await supabase.from("inventory").update({
            cat: showEditModal.cat, sub: showEditModal.sub, make: showEditModal.make,
            model: showEditModal.model, spec: showEditModal.spec, qty: Number(showEditModal.qty), unit: showEditModal.unit,
            item: `${showEditModal.make} ${showEditModal.sub} ${showEditModal.model}`.trim()
        }).eq("id", showEditModal.id);
        if (!error) { alert("Stock Entry Updated!"); fetch(); setShowEditModal(null); }
    } catch(e){}
    setSaving(false);
  };

  return (
    <div className="animate-fade-in space-y-6 pb-10 uppercase font-roboto font-bold">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
        <div><h2 className="text-xl font-bold text-slate-800 tracking-widest uppercase leading-none">My Local Store</h2><p className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded mt-2 uppercase tracking-tighter font-roboto">ZONE: {profile?.unit}</p></div>
        <div className="flex gap-2">
           <button onClick={() => onExport(myItems, "My_Unit_Stock")} className="bg-slate-800 text-white px-6 py-2.5 rounded-lg font-bold shadow-md text-[10px] tracking-widest hover:bg-slate-900 transition-colors"><i className="fa-solid fa-file-excel mr-2"></i> EXPORT STORE</button>
           <button onClick={() => setShowAddModal(true)} className="iocl-btn text-white px-6 py-2.5 rounded-lg font-bold shadow-md flex items-center gap-2"><i className="fa-solid fa-plus"></i> ADD NEW STOCK</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden uppercase font-roboto">
        <div className="overflow-x-auto"><table className="w-full text-left tracking-tight"><thead className="bg-slate-50 text-slate-500 text-[10px] font-bold border-b uppercase tracking-widest"><tr><th className="p-5 pl-8">Category / Item Detail</th><th className="p-5">Technical Spec</th><th className="p-5 text-center">Available Qty</th><th className="p-5 text-center">Actions</th></tr></thead>
          <tbody className="divide-y text-sm">
              {myItems.map((i, idx) => (<tr key={i.id} className={`hover:bg-slate-50 transition border-b border-slate-50 ${idx === 0 ? 'bg-orange-50/20' : ''}`}>
                <td className="p-5 pl-8 leading-tight">
                    <div className="text-[9.5px] font-bold text-slate-400 mb-1">{i.cat}</div>
                    <div className="text-slate-800 font-bold text-[14px] tracking-tight">{i.item}</div>
                </td>
                <td className="p-5"><span className="bg-white border border-slate-200 px-2.5 py-1 rounded-[4px] text-[10.5px] font-bold text-slate-500 shadow-sm uppercase">{i.spec}</span></td>
                <td className="p-5 font-bold text-center whitespace-nowrap text-slate-800 text-[14px]">{i.qty} {i.unit}</td>
                <td className="p-5 text-center flex justify-center gap-2">
                   <button onClick={() => setShowConsumeModal(i)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded text-[9px] font-black tracking-widest border border-red-100 uppercase hover:bg-red-100">Consume</button>
                   <button onClick={() => setShowEditModal(i)} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded text-[9px] font-black tracking-widest border border-blue-100 uppercase hover:bg-blue-100">Edit</button>
                </td>
              </tr>))}
          </tbody>
        </table></div>
      </div>

      {/* CONSUME STOCK MODAL */}
      {showConsumeModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-bold uppercase">
           <div className="bg-white w-full max-w-md rounded-lg shadow-xl overflow-hidden border border-slate-200">
              <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                 <h3 className="font-bold text-slate-800 text-sm tracking-wider">Stock Consumption Log</h3>
                 <button onClick={() => setShowConsumeModal(null)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
              </div>
              <div className="p-6 space-y-5">
                 <div className="bg-slate-50 p-4 border rounded text-xs leading-relaxed">
                    <span className="text-slate-400 text-[10px] block font-black mb-1 uppercase tracking-widest">CONSUMING MATERIAL</span>
                    <span className="text-slate-700 block mb-1">{showConsumeModal.item}</span>
                    <span className="text-slate-500 text-[10px]">{showConsumeModal.spec}</span>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Quantity (Max: {showConsumeModal.qty})</label>
                      <input type="number" className="w-full p-3 border border-slate-300 rounded mt-1 font-bold text-lg text-slate-800 focus:ring-1 focus:ring-red-500" onChange={e=>setConsumeForm({...consumeForm, qty:e.target.value})} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Consumption Purpose / Site Location</label>
                      <textarea placeholder="Example: Used in AU-5 MCC Panel #4" className="w-full p-3 border border-slate-300 rounded mt-1 h-24 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-red-500" onChange={e=>setConsumeForm({...consumeForm, comment:e.target.value})}></textarea>
                    </div>
                 </div>
                 <button onClick={handleConsume} disabled={saving} className="w-full py-3.5 bg-red-600 text-white font-bold rounded shadow hover:bg-red-700 transition-colors uppercase tracking-widest text-xs">{saving ? "PROCESSING..." : "CONFIRM CONSUMPTION"}</button>
              </div>
           </div>
        </div>
      )}

      {/* EDIT STOCK MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-bold uppercase">
           <div className="bg-white w-full max-w-lg rounded-lg shadow-xl overflow-hidden border border-slate-200">
              <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                 <h3 className="font-bold text-slate-800 text-sm tracking-wider">Update Stock Entry</h3>
                 <button onClick={() => setShowEditModal(null)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
              </div>
              <div className="p-6 space-y-5">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Category</label><input disabled={!showEditModal.manual_add} type="text" value={showEditModal.cat} className="w-full p-3 bg-slate-50 border border-slate-200 rounded font-bold text-xs disabled:bg-slate-100 disabled:text-slate-400" onChange={e=>setShowEditModal({...showEditModal, cat:e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Sub Category</label><input disabled={!showEditModal.manual_add} type="text" value={showEditModal.sub} className="w-full p-3 bg-slate-50 border border-slate-200 rounded font-bold text-xs disabled:bg-slate-100 disabled:text-slate-400" onChange={e=>setShowEditModal({...showEditModal, sub:e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Make / Brand</label><input disabled={!showEditModal.manual_add} type="text" value={showEditModal.make} className="w-full p-3 bg-slate-50 border border-slate-200 rounded font-bold text-xs disabled:bg-slate-100 disabled:text-slate-400" onChange={e=>setShowEditModal({...showEditModal, make:e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Model / Series</label><input disabled={!showEditModal.manual_add} type="text" value={showEditModal.model} className="w-full p-3 bg-slate-50 border border-slate-200 rounded font-bold text-xs disabled:bg-slate-100 disabled:text-slate-400" onChange={e=>setShowEditModal({...showEditModal, model:e.target.value})} /></div>
                    <div className="col-span-2 space-y-1"><label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Technical Specification</label><input disabled={!showEditModal.manual_add} type="text" value={showEditModal.spec} className="w-full p-3 bg-slate-50 border border-slate-200 rounded font-bold text-xs disabled:bg-slate-100 disabled:text-slate-400" onChange={e=>setShowEditModal({...showEditModal, spec:e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-orange-600 uppercase ml-1">Current Quantity</label><input type="number" value={showEditModal.qty} className="w-full p-3 border border-orange-200 rounded font-bold text-lg text-slate-800" onChange={e=>setShowEditModal({...showEditModal, qty:e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-orange-600 uppercase ml-1">Measurement Unit</label><input type="text" value={showEditModal.unit} className="w-full p-3 border border-orange-200 rounded font-bold text-slate-800" onChange={e=>setShowEditModal({...showEditModal, unit:e.target.value})} /></div>
                 </div>
                 <button onClick={handleUpdate} disabled={saving} className="w-full py-3.5 bg-slate-800 text-white font-bold rounded shadow hover:bg-slate-900 transition-colors uppercase tracking-widest text-xs">{saving ? "SAVING..." : "CONFIRM UPDATE"}</button>
              </div>
           </div>
        </div>
      )}

      {/* ADD NEW STOCK MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-bold uppercase">
          <div className="bg-white w-full max-w-2xl rounded-lg shadow-xl overflow-hidden border border-slate-200 border-t-4 border-orange-500">
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
               <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Inward Local Stock Entry</h3>
               <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded border border-slate-200">
                <div className="flex items-center gap-3">
                  <i className={`fa-solid ${isManual ? 'fa-keyboard text-indigo-600' : 'fa-list-check text-orange-600'}`}></i>
                  <span className="text-[10px] font-black uppercase tracking-widest">{isManual ? 'Manual Technical Entry' : 'Smart Catalog Selection'}</span>
                </div>
                <button onClick={() => { setIsManual(!isManual); setForm({ cat: "", sub: "", make: "", model: "", spec: "", qty: "", unit: "Nos" }); }} className={`relative w-12 h-6 rounded-full transition-colors ${isManual ? 'bg-indigo-600' : 'bg-orange-500'}`}><div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${isManual ? 'translate-x-6' : ''}`}></div></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isManual ? (
                  <>
                    <div className="space-y-1"><label className="text-[9px] font-bold text-slate-500 ml-1">Category</label><input type="text" className="w-full p-3 border rounded text-xs" onChange={e=>setForm({...form, cat: e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[9px] font-bold text-slate-500 ml-1">Sub Category</label><input type="text" className="w-full p-3 border rounded text-xs" onChange={e=>setForm({...form, sub: e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[9px] font-bold text-slate-500 ml-1">Make</label><input type="text" className="w-full p-3 border rounded text-xs" onChange={e=>setForm({...form, make: e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[9px] font-bold text-slate-500 ml-1">Model</label><input type="text" className="w-full p-3 border rounded text-xs" onChange={e=>setForm({...form, model: e.target.value})} /></div>
                    <div className="md:col-span-2 space-y-1"><label className="text-[9px] font-bold text-slate-500 ml-1">Technical Spec</label><input type="text" className="w-full p-3 border rounded text-xs" onChange={e=>setForm({...form, spec: e.target.value})} /></div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1"><label className="text-[9px] font-bold text-slate-500 ml-1">Category</label><select className="w-full p-3 border rounded text-xs font-bold" value={form.cat} onChange={e=>setForm({ ...form, cat: e.target.value, sub: "", make: "", model: "", spec: "" })}><option value="">-Select-</option>{catList.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div className="space-y-1"><label className="text-[9px] font-bold text-slate-500 ml-1">Sub-Cat</label><select disabled={!form.cat} className="w-full p-3 border rounded text-xs font-bold" value={form.sub} onChange={e=>setForm({ ...form, sub: e.target.value, make: "", model: "", spec: "" })}><option value="">-Select-</option>{subList.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    <div className="space-y-1"><label className="text-[9px] font-bold text-slate-500 ml-1">Make</label><select disabled={!form.sub} className="w-full p-3 border rounded text-xs font-bold" value={form.make} onChange={e=>setForm({ ...form, make: e.target.value, model: "", spec: "" })}><option value="">-Select-</option>{makeList.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                    <div className="space-y-1"><label className="text-[9px] font-bold text-slate-500 ml-1">Model</label><select disabled={!form.make} className="w-full p-3 border rounded text-xs font-bold" value={form.model} onChange={e=>setForm({ ...form, model: e.target.value, spec: "" })}><option value="">-Select-</option>{modelList.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                    <div className="md:col-span-2 space-y-1"><label className="text-[9px] font-bold text-slate-500 ml-1">Final Spec</label><select disabled={!form.model} className="w-full p-3 border rounded text-xs font-bold" value={form.spec} onChange={e=>setForm({ ...form, spec: e.target.value })}><option value="">-Select Precise Specification-</option>{specList.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                  </>
                )}
                <div className="md:col-span-2 flex gap-4 mt-2">
                   <div className="flex-1 space-y-1">
                     <label className="text-[9px] font-black text-orange-600 ml-1">PHYSICAL QTY</label>
                     <input type="number" placeholder="00" className="w-full p-3 border border-orange-200 rounded font-black text-xl text-orange-600 outline-none focus:ring-1 focus:ring-orange-500" onChange={e=>setForm({...form, qty: e.target.value})} />
                   </div>
                   <div className="w-24 space-y-1">
                     <label className="text-[9px] font-black text-slate-400 ml-1">UNIT</label>
                     <input type="text" value={form.unit} className="w-full p-3 border border-slate-200 rounded font-black text-center text-slate-700" onChange={e=>setForm({...form, unit: e.target.value})} />
                   </div>
                </div>
              </div>
              <button onClick={handleSave} disabled={saving} className="w-full py-4 bg-slate-800 text-white font-bold rounded shadow hover:bg-slate-900 transition-colors uppercase tracking-[0.2em] text-xs">{saving ? "SAVING DATA..." : "CONFIRM INWARD"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- USAGE HISTORY VIEW ---
function UsageHistoryView({ profile }: any) {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => { if (profile) fetch(); }, [profile]);
  const fetch = async () => { try { const { data } = await supabase.from("usage_logs").select("*").eq("consumer_uid", profile.id).order("timestamp", { ascending: false }); if (data) setLogs(data); } catch(e){} };
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm font-roboto font-bold uppercase">
      <div className="p-5 border-b bg-slate-50/50"><h2 className="text-lg font-bold text-slate-800 uppercase tracking-wider">Store Consumption Audit Feed</h2></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs font-mono font-bold uppercase"><thead className="bg-slate-50 border-b text-[10px] font-black uppercase tracking-widest"><tr><th className="p-4 pl-8">Entry Timestamp</th><th className="p-4">Material Details</th><th className="p-4">Consumption Log</th><th className="p-4 text-center">Net Qty</th></tr></thead>
        <tbody className="divide-y text-slate-600">
          {logs.map(l => (
            <tr key={l.id} className="hover:bg-slate-50 transition border-b border-slate-100">
              <td className="p-4 pl-8 uppercase font-mono leading-tight">
                <div className="text-slate-800 font-bold">{new Date(Number(l.timestamp)).toLocaleDateString('en-IN')}</div>
                <div className="text-[9px] text-slate-400 font-medium">{new Date(Number(l.timestamp)).toLocaleTimeString('en-IN')}</div>
              </td>
              <td className="p-4 font-bold uppercase leading-tight">
                <div className="text-slate-800 text-[13px] tracking-tight">{l.item_name}</div>
                <div className="text-[9px] text-slate-400 uppercase mt-0.5">{l.category}</div>
              </td>
              <td className="p-4 italic text-slate-500 text-[10px] font-bold max-w-xs truncate">{l.comment || '--'}</td>
              <td className="p-4 text-center font-black text-red-600">-{l.qty_consumed} Nos</td>
            </tr>
          ))}
        </tbody></table></div></section>);
}

function MonthlyAnalysisView({ profile }: any) {
  const [analysis, setAnalysis] = useState<any[]>([]);
  useEffect(() => { const f = async () => { try { const { data } = await supabase.from("usage_logs").select("*").eq("consumer_uid", profile.id); if (data) { const stats: any = {}; data.forEach((l: any) => { const month = new Date(Number(l.timestamp)).toLocaleString('default', { month: 'long', year: 'numeric' }); if (!stats[month]) stats[month] = { month, total: 0, count: 0 }; stats[month].total += Number(l.qty_consumed); stats[month].count += 1; }); setAnalysis(Object.values(stats)); } } catch(e){} }; if (profile) f(); }, [profile]);
  return (<div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-roboto uppercase tracking-tight font-bold"><div className="col-span-3 pb-4 text-xs font-black text-slate-400 tracking-widest text-center border-b uppercase">Analytical Consumption Summary</div>{analysis.map((a, idx) => (<div key={idx} className="bg-white p-6 rounded-2xl border shadow-sm text-center transition hover:shadow-md uppercase"><div className="text-xs font-black text-slate-400 uppercase mb-4 tracking-[0.2em]">{a.month}</div><div className="w-16 h-16 bg-blue-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner font-bold"><i className="fa-solid fa-chart-line"></i></div><div className="text-3xl font-black text-slate-800">{a.total} <small className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nos</small></div><div className="text-[10px] font-bold text-emerald-500 mt-2 uppercase tracking-tighter">{a.count} Logged Records</div></div>))}</div>);
}

// --- RETURNS LEDGER ---
function ReturnsLedgerView({ profile, onAction }: any) { 
    const [pending, setPending] = useState<any[]>([]);
    const [given, setGiven] = useState<any[]>([]);
    const [taken, setTaken] = useState<any[]>([]);
    const [givenHistory, setGivenHistory] = useState<any[]>([]);
    const [takenHistory, setTakenHistory] = useState<any[]>([]);
    const [actionModal, setActionModal] = useState<any>(null); 
    const [form, setForm] = useState({ comment: "", qty: "" });

    const fetchAll = async () => {
        try {
            const { data: p } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).in("status", ["pending", "return_requested"]).order("id", { ascending: false });
            const { data: g } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).eq("status", "approved").order("id", { ascending: false });
            const { data: t = [] } = await supabase.from("requests").select("*").eq("from_unit", profile.unit).eq("status", "approved").order("id", { ascending: false });
            const { data: gh } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).in("status", ["returned", "rejected"]).order("id", { ascending: false });
            const { data: th = [] } = await supabase.from("requests").select("*").eq("from_unit", profile.unit).in("status", ["returned", "rejected"]).order("id", { ascending: false });
            if (p) setPending(p); if (g) setGiven(g); if (t) setTaken(t);
            if (gh) setGivenHistory(gh); if (th) setTakenHistory(th);
        } catch(e){}
    };

    useEffect(() => {
        if (!profile) return; fetchAll();
        const channel = supabase.channel('requests-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => { fetchAll(); if(onAction) onAction(); }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [profile]);

    const formatTS = (ts: any) => new Date(Number(ts)).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

    const handleProcess = async () => {
        const { type, data } = actionModal;
        const actionQty = Number(form.qty || data.req_qty);
        if (!form.comment.trim()) { alert("Provide a reason!"); return; }

        try {
            if (type === 'approve') {
                const newTxnId = `#TXN-${Date.now().toString().slice(-6)}`;
                const { error } = await supabase.from("requests").update({ status: 'approved', approve_comment: form.comment, txn_id: newTxnId, to_uid: profile.id, to_name: profile.name, req_qty: actionQty, viewed_by_requester: false }).eq("id", data.id);
                if (!error) {
                    const { data: inv } = await supabase.from("inventory").select("qty").eq("id", data.item_id).single();
                    if (inv) await supabase.from("inventory").update({ qty: inv.qty - actionQty }).eq("id", data.item_id);
                }
            } 
            else if (type === 'reject') {
                await supabase.from("requests").update({ status: 'rejected', approve_comment: form.comment, to_uid: profile.id, to_name: profile.name, viewed_by_requester: false }).eq("id", data.id);
            }
            else if (type === 'return') {
                await supabase.from("requests").insert([{ 
                    item_id: data.item_id, item_name: data.item_name, item_spec: data.item_spec, item_unit: data.item_unit, req_qty: actionQty, status: 'return_requested', return_comment: form.comment, from_uid: profile.id, from_name: profile.name, from_unit: profile.unit, to_uid: data.to_uid, to_name: data.to_name, to_unit: data.to_unit, viewed_by_requester: false, approve_comment: `VERIFY_LINK_ID:${data.id}`, txn_id: data.txn_id 
                }]);
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
                await supabase.from("requests").update({ status: 'returned', approve_comment: `Verified: ${form.comment}`, to_uid: profile.id, to_name: profile.name, viewed_by_requester: false }).eq("id", data.id);
                const { data: inv } = await supabase.from("inventory").select("qty").eq("id", data.item_id).single();
                if (inv) await supabase.from("inventory").update({ qty: inv.qty + data.req_qty }).eq("id", data.item_id);
            }
            alert("Action Processed!"); fetchAll();
        } catch(e){ alert("Action failed."); }
        setActionModal(null); setForm({comment:"", qty:""});
    };

    return (
        <div className="space-y-10 animate-fade-in pb-20 font-roboto uppercase font-bold tracking-tight">
            <h2 className="text-2xl font-bold text-slate-800 uppercase flex items-center gap-2"><i className="fa-solid fa-handshake-angle text-orange-500"></i> Udhaari Management Dashboard</h2>
            
            <section className="bg-white rounded-xl border-t-4 border-orange-500 shadow-xl overflow-hidden">
                <div className="p-4 bg-orange-50/50 flex justify-between uppercase font-bold text-[10px] tracking-widest text-orange-900 border-b"><span>Action Required Spares</span><span>{pending.length} ITEMS</span></div>
                <div className="overflow-x-auto"><table className="w-full text-left text-sm divide-y font-mono uppercase"><thead className="bg-slate-50 text-[10px] font-bold text-slate-400 tracking-widest uppercase"><tr><th className="p-4 pl-6">Material Detail</th><th className="p-4">Counterparty</th><th className="p-4 text-center">Qty</th><th className="p-4 text-center">Process</th></tr></thead>
                    <tbody className="divide-y text-slate-600 uppercase font-bold">
                        {pending.map(r => (
                            <tr key={r.id} className={`${r.status==='return_requested' ? 'bg-orange-50 animate-pulse' : 'bg-white'} border-b uppercase hover:bg-slate-50 transition-colors`}>
                                <td className="p-4 pl-6 leading-tight uppercase font-bold"><div className="text-slate-800 text-[14px]">{r.item_name}</div><div className="text-[10px] text-slate-400 mt-1 font-mono">{r.item_spec}</div><div className="text-[8.5px] text-orange-600 mt-1 font-black">{formatTS(r.timestamp)}</div></td>
                                <td className="p-4 text-slate-700 leading-tight">{r.from_name}<div className="text-[10px] text-slate-400">{r.from_unit}</div></td>
                                <td className="p-4 text-center font-black text-orange-600 text-[14px]">{r.req_qty} {r.item_unit}</td>
                                <td className="p-4 flex gap-2 justify-center"><button onClick={()=>setActionModal({type: r.status==='pending' ? 'approve' : 'verify', data:r})} className="bg-slate-800 text-white px-4 py-2 rounded text-[10px] font-black shadow hover:bg-black tracking-widest uppercase"> {r.status==='pending' ? 'Issue' : 'Verify'} </button><button onClick={()=>setActionModal({type: 'reject', data:r})} className="bg-slate-100 text-slate-500 px-4 py-2 rounded text-[9px] font-black transition tracking-widest uppercase hover:bg-slate-200">Reject</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table></div>
            </section>

            {/* ACTION (ISSUE/VERIFY) MODAL */}
            {actionModal && (
              <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-bold uppercase">
                <div className="bg-white w-full max-w-md rounded-lg shadow-xl overflow-hidden border border-slate-200">
                  <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-sm tracking-wider uppercase">
                      {actionModal.type === 'approve' ? 'Approve Spare Issuance' : actionModal.type === 'return' ? 'Request Return' : actionModal.type === 'verify' ? 'Confirm Return Verify' : 'Reject Action'}
                    </h3>
                    <button onClick={()=>setActionModal(null)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
                  </div>
                  <div className="p-6 space-y-5 font-roboto font-bold uppercase">
                    <div className="bg-slate-50 p-4 border rounded">
                      <p className="text-[9px] text-slate-400 font-black mb-1 uppercase tracking-widest">TRANSACTION INFO</p>
                      <p className="text-[13px] font-bold text-slate-800">{actionModal.data.item_name}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{actionModal.data.item_spec}</p>
                    </div>
                    {(actionModal.type === 'approve' || actionModal.type === 'return') && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Quantity {actionModal.type === 'return' ? '(Max Borrowed:' : '(Requested:'} {actionModal.data.req_qty})</label>
                        <input type="number" defaultValue={actionModal.data.req_qty} className="w-full mt-1 p-3 border border-slate-300 rounded font-black text-slate-800 outline-none focus:ring-1 focus:ring-slate-800" onChange={e=>setForm({...form, qty:e.target.value})} />
                      </div>
                    )}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Audit Log / Remarks</label>
                        <textarea placeholder="Enter official remarks for this transaction..." className="w-full mt-1 p-3 border border-slate-300 rounded outline-none font-bold text-xs h-24 text-slate-800 focus:ring-1 focus:ring-slate-800 uppercase" onChange={e=>setForm({...form, comment:e.target.value})}></textarea>
                    </div>
                    <button onClick={handleProcess} className={`w-full py-3.5 ${actionModal.type === 'reject' ? 'bg-red-600' : 'bg-slate-800'} text-white font-bold rounded shadow hover:opacity-90 transition-opacity uppercase tracking-widest text-xs`}>
                        {actionModal.type === 'return' ? 'SEND RETURN REQUEST' : 'CONFIRM TRANSACTION'}
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>
    ); 
}
