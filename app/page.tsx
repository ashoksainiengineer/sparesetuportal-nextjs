"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function SpareSetuApp() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("search");
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  // GLOBAL MODAL STATES (FOR FULL SCREEN BLUR)
  const [requestItem, setRequestItem] = useState<any>(null);
  const [actionModal, setActionModal] = useState<any>(null);
  const [modalForm, setModalForm] = useState({ qty: "", comment: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) { setUser(session.user); fetchProfile(session.user.id); }
        setLoading(false);
      } catch (err) { setLoading(false); }
    };
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) { setUser(session.user); fetchProfile(session.user.id); }
      else { setUser(null); setProfile(null); }
      setLoading(false);
    });
    getSession();
    return () => authListener.subscription.unsubscribe();
  }, []);

  // REAL-TIME NOTIFICATION ENGINE
  useEffect(() => {
    if (!profile?.id || !profile?.unit) return;
    const fetchAllCounts = async () => {
        try {
            const { count: incoming } = await supabase.from("requests").select("*", { count: 'exact', head: true }).eq("to_unit", profile.unit).in("status", ["pending", "return_requested"]);
            const { count: updates } = await supabase.from("requests").select("*", { count: 'exact', head: true }).eq("from_uid", profile.id).eq("viewed_by_requester", false).in("status", ["approved", "rejected", "returned"]);
            setPendingCount((incoming || 0) + (updates || 0));
        } catch (err) {}
    };
    fetchAllCounts();
    const channel = supabase.channel('global-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => { fetchAllCounts(); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const fetchProfile = async (uid: string) => {
    try {
        const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
        if (data) setProfile(data);
    } catch (err) {}
  };

  const formatTS = (ts: any) => new Date(Number(ts)).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

  // --- GLOBAL MODAL HANDLERS ---
  const handleGlobalRequest = async () => {
    if (!modalForm.qty || Number(modalForm.qty) <= 0 || Number(modalForm.qty) > requestItem.qty) { alert("Invalid quantity!"); return; }
    setSubmitting(true);
    try {
        const { error } = await supabase.from("requests").insert([{
            item_id: requestItem.id, item_name: requestItem.item, item_spec: requestItem.spec, item_unit: requestItem.unit, req_qty: Number(modalForm.qty), req_comment: modalForm.comment, from_name: profile.name, from_uid: profile.id, from_unit: profile.unit, to_name: requestItem.holder_name, to_uid: requestItem.holder_uid, to_unit: requestItem.holder_unit, status: 'pending', viewed_by_requester: false
        }]);
        if (!error) { alert("Request Sent!"); setRequestItem(null); setModalForm({ qty: "", comment: "" }); } else alert(error.message);
    } catch (err) { alert("Connection Error"); }
    setSubmitting(false);
  };

  const handleGlobalProcess = async () => {
    const { type, data } = actionModal;
    const actionQty = Number(modalForm.qty || data.req_qty);
    if (!modalForm.comment.trim()) { alert("Provide a comment!"); return; }
    if (actionQty <= 0 || actionQty > data.req_qty) { alert("Invalid Qty!"); return; }

    try {
        if (type === 'approve') {
            const newTxnId = `#TXN-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 99)}`;
            const { error } = await supabase.from("requests").update({ status: 'approved', approve_comment: modalForm.comment, txn_id: newTxnId, to_uid: profile.id, to_name: profile.name, req_qty: actionQty, viewed_by_requester: false }).eq("id", data.id);
            if (!error) {
                const { data: inv } = await supabase.from("inventory").select("qty").eq("id", data.item_id).single();
                if (inv) await supabase.from("inventory").update({ qty: inv.qty - actionQty }).eq("id", data.item_id);
            }
        } 
        else if (type === 'reject') {
            await supabase.from("requests").update({ status: 'rejected', approve_comment: modalForm.comment, to_uid: profile.id, to_name: profile.name, viewed_by_requester: false }).eq("id", data.id);
        }
        else if (type === 'return') {
            await supabase.from("requests").insert([{ 
                item_id: data.item_id, item_name: data.item_name, item_spec: data.item_spec, item_unit: data.item_unit, req_qty: actionQty, status: 'return_requested', return_comment: modalForm.comment, from_uid: profile.id, from_name: profile.name, from_unit: profile.unit, to_uid: data.to_uid, to_name: data.to_name, to_unit: data.to_unit, viewed_by_requester: false, 
                approve_comment: `VERIFY_LINK_ID:${data.id}`, txn_id: data.txn_id 
            }]);
            alert("Return Sent!");
        }
        else if (type === 'verify') {
            const parentId = data.approve_comment?.match(/VERIFY_LINK_ID:(\d+)/)?.[1];
            if (parentId) {
                const { data: parent } = await supabase.from("requests").select("req_qty").eq("id", parentId).single();
                if (parent && parent.req_qty - data.req_qty <= 0) await supabase.from("requests").delete().eq("id", parentId);
                else if (parent) await supabase.from("requests").update({ req_qty: parent.req_qty - data.req_qty }).eq("id", parentId);
            }
            await supabase.from("requests").update({ status: 'returned', approve_comment: `Verified: ${modalForm.comment}`, to_uid: profile.id, to_name: profile.name, viewed_by_requester: false }).eq("id", data.id);
            const { data: inv } = await supabase.from("inventory").select("qty").eq("id", data.item_id).single();
            if (inv) await supabase.from("inventory").update({ qty: inv.qty + data.req_qty }).eq("id", data.item_id);
        }
    } catch(e) { alert("Failed"); }
    setActionModal(null); setModalForm({comment:"", qty:""});
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
    <div className="flex h-screen overflow-hidden bg-[#f1f5f9] font-roboto font-bold uppercase relative">
      <aside className="w-64 bg-white hidden md:flex flex-col flex-shrink-0 z-20 shadow-xl border-r border-slate-200 font-bold uppercase">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-orange-600"><i className="fa-solid fa-layer-group"></i></div>
          <span className="text-lg font-bold text-slate-800 uppercase tracking-wide">Menu</span>
        </div>
        <nav className="flex-1 px-3 space-y-1 mt-4 overflow-y-auto">
          {[
            { id: 'search', label: 'Global Search', icon: 'fa-globe' },
            { id: 'mystore', label: 'My Local Store', icon: 'fa-warehouse' },
            { id: 'analysis', label: 'Monthly Analysis', icon: 'fa-chart-pie' },
            { id: 'usage', label: 'My Usage History', icon: 'fa-clock-rotate-left' },
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
              </div>
              <h1 className="text-2xl md:text-3xl uppercase tracking-wider leading-none">Gujarat Refinery</h1>
            </div>
            <h2 className="text-xl text-orange-500 tracking-[0.1em] font-bold uppercase hidden md:block">SPARE SETU PORTAL</h2>
          </div>
        </header>

        <div className="p-4 md:p-10 max-w-7xl mx-auto w-full space-y-8">
          {activeTab === "search" && <GlobalSearchView profile={profile} setRequestItem={setRequestItem} />}
          {activeTab === "mystore" && <MyStoreView profile={profile} fetchProfile={()=>fetchProfile(user.id)} />}
          {activeTab === "usage" && <UsageHistoryView profile={profile} />}
          {activeTab === "analysis" && <MonthlyAnalysisView profile={profile} />}
          {activeTab === "returns" && <ReturnsLedgerView profile={profile} setActionModal={setActionModal} formatTS={formatTS} />}
        </div>
      </main>

      {/* GLOBAL REQUEST MODAL - FIXED BLUR */}
      {requestItem && (
        <div className="fixed inset-0 w-full h-full bg-slate-900/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Raise Request</h3>
              <button onClick={()=>setRequestItem(null)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6 space-y-4 font-bold uppercase">
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                <p className="text-[10px] text-orange-600 font-black uppercase mb-1 tracking-widest">Material: {requestItem.item}</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase">Spec: {requestItem.spec}</p>
              </div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qty (Max: {requestItem.qty})</label><input type="number" className="w-full mt-1 p-3 border rounded-lg font-bold" onChange={e=>setModalForm({...modalForm, qty:e.target.value})} /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Log Comment</label><textarea className="w-full mt-1 p-3 border rounded-lg h-24 text-xs font-bold uppercase" onChange={e=>setModalForm({...modalForm, comment:e.target.value})}></textarea></div>
              <button onClick={handleGlobalRequest} disabled={submitting} className="w-full py-3 bg-[#ff6b00] text-white font-black rounded-xl shadow-lg uppercase tracking-widest disabled:opacity-50">{submitting ? "Sending..." : "Submit Request"}</button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL ACTION MODAL - FIXED BLUR */}
      {actionModal && (
        <div className="fixed inset-0 w-full h-full bg-slate-900/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{actionModal.type === 'approve' ? 'Issue Spare' : 'Initiate Return'}</h3>
              <button onClick={()=>setActionModal(null)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6 space-y-4 font-bold uppercase">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-[13px] font-bold text-slate-800">{actionModal.data.item_name}</p>
                <p className="text-[10px] text-slate-400 uppercase mt-1">Spec: {actionModal.data.item_spec}</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity (Available: {actionModal.data.req_qty})</label>
                <input type="number" defaultValue={actionModal.data.req_qty} className="w-full mt-1 p-3 border-2 rounded-lg font-black text-slate-800" onChange={e=>setModalForm({...modalForm, qty:e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Log / Reason</label>
                <textarea className="w-full mt-1 p-3 border-2 rounded-lg h-24 text-xs font-bold uppercase" onChange={e=>setModalForm({...modalForm, comment:e.target.value})}></textarea>
              </div>
              <button onClick={handleGlobalProcess} className="w-full py-3 bg-[#ff6b00] text-white font-black rounded-xl shadow-lg uppercase tracking-widest">Confirm Transaction</button>
            </div>
          </div>
        </div>
      )}
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
          if (!allowed) { alert("Access Denied!"); setAuthLoading(false); return; }
          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          setForm({ ...form, generatedOtp: otp });
          const res = await fetch('/api/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, email: form.email, otp }) });
          if (res.ok) { alert("OTP sent!"); setView("otp"); } else alert("Failed");
        } else if (view === "otp") {
          if (form.enteredOtp === form.generatedOtp) {
            const { error } = await supabase.auth.signUp({ email: form.email, password: form.pass, options: { data: { name: form.name, unit: form.unit } } });
            if (error) alert(error.message); else setView("login");
          } else alert("Wrong OTP");
        }
    } catch (err) { alert("Network Error"); }
    setAuthLoading(false);
  };
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 login-bg">
      <div className="w-full max-w-md login-card rounded-2xl shadow-2xl p-8 border-t-4 border-orange-500 text-center relative font-roboto font-bold uppercase">
        <div className="mb-8">
            <h1 className="text-2xl font-bold text-white uppercase tracking-wider">Gujarat Refinery</h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-4">Spare Setu Portal</p>
        </div>
        <div className="space-y-4">
          {(view === "register") && (
            <>
              <input type="text" placeholder="Engineer Name" className="w-full p-3 rounded-lg login-input font-bold" onChange={e=>setForm({...form, name:e.target.value})} />
              <select className="w-full p-3 rounded-lg login-input bg-slate-900 text-slate-300 font-bold" onChange={e=>setForm({...form, unit:e.target.value})}><option value="">Zone</option>{["RUP - South Block", "RUP - North Block", "LAB", "MSQU", "AU-5", "BS-VI", "GR-II & NBA", "GR-I", "OM&S", "OLD SRU & CETP", "Electrical Planning", "Electrical Testing", "Electrical Workshop", "FCC", "GRE", "CGP-I", "CGP-II & TPS", "Water Block & Bitumen", "Township - Estate Office", "AC Section", "GHC", "DHUMAD"].map(z=><option key={z} value={z}>{z}</option>)}</select>
            </>
          )}
          {view === "otp" ? (
             <input type="text" placeholder="OTP" className="w-full p-3 rounded-lg login-input text-center text-2xl font-bold" onChange={e=>setForm({...form, enteredOtp:e.target.value})} />
          ) : (
             <input type="email" placeholder="Official Email" className="w-full p-3 rounded-lg login-input font-bold" onChange={e=>setForm({...form, email:e.target.value})} />
          )}
          {(view === "login" || view === "register") && <input type="password" placeholder="Password" className="w-full p-3 rounded-lg login-input font-bold" onChange={e=>setForm({...form, pass:e.target.value})} />}
          <button onClick={handleAuth} disabled={authLoading} className="w-full py-3 iocl-btn text-white font-bold rounded-lg uppercase tracking-widest">{authLoading ? "..." : "Login →"}</button>
          <button onClick={()=>setView(view==='login'?'register':'login')} className="text-white text-xs underline mt-4">{view==='login'?'Create Account':'Back to Login'}</button>
        </div>
      </div>
    </div>
  );
}

// --- GLOBAL SEARCH VIEW ---
function GlobalSearchView({ profile, setRequestItem }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState(""); 
  const [selCat, setSelCat] = useState("all");
  useEffect(() => { const f = async () => { const { data } = await supabase.from("inventory").select("*"); if (data) setItems(data); }; f(); }, []);
  const filtered = items.filter((i: any) => (i.item.toLowerCase().includes(search.toLowerCase()) || i.spec.toLowerCase().includes(search.toLowerCase())) && (selCat === "all" ? true : i.cat === selCat));
  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden font-roboto font-bold uppercase">
        <div className="p-4 border-b bg-slate-50/80 flex flex-wrap gap-2">
             <input type="text" placeholder="Search..." className="flex-grow p-2 border rounded-md text-sm font-bold" onChange={e=>setSearch(e.target.value)} />
             <select className="border rounded-md text-xs font-bold p-2 bg-white" onChange={e=>setSelCat(e.target.value)}><option value="all">Category: All</option>{[...new Set(items.map(i => i.cat))].sort().map(c => <option key={c} value={c}>{c}</option>)}</select>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <tbody className="divide-y">
            {filtered.map((i: any, idx: number) => (
              <tr key={idx} className="hover:bg-slate-50 border-b">
                <td className="p-4"><div className="text-slate-800 font-bold">{i.item}</div><div className="text-[9px] text-slate-400">{i.cat}</div></td>
                <td className="p-4"><span className="border px-2 py-1 rounded text-[10px] text-slate-500">{i.spec}</span></td>
                <td className="p-4 text-center font-bold">{i.qty} {i.unit}</td>
                <td className="p-4 text-center">{i.holder_uid === profile?.id ? <span className="text-[10px] text-green-600">MY STORE</span> : <button onClick={()=>setRequestItem(i)} className="bg-[#ff6b00] text-white px-4 py-1 rounded text-[10px] font-black uppercase">Request</button>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
    </section>
  );
}

// --- MY STORE VIEW ---
function MyStoreView({ profile, fetchProfile }: any) {
  const [myItems, setMyItems] = useState<any[]>([]); 
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ cat: "", sub: "", make: "", model: "", spec: "", qty: "" });
  useEffect(() => { const f = async () => { if(profile){const { data } = await supabase.from("inventory").select("*").eq("holder_uid", profile.id).order("id", { ascending: false }); if (data) setMyItems(data);} }; f(); }, [profile]);
  const handleSave = async () => {
    if (!form.spec || !form.qty) return alert("Details!");
    const itemName = `${form.make} ${form.sub} ${form.model}`.trim();
    const { error } = await supabase.from("inventory").insert([{ item: itemName, cat: form.cat, spec: form.spec, qty: parseInt(form.qty), unit: 'Nos', holder_unit: profile.unit, holder_uid: profile.id, holder_name: profile.name }]);
    if (!error) { alert("Stock Added!"); setShowAddModal(false); fetchProfile(); }
  };
  return (
    <div className="space-y-6 font-roboto font-bold uppercase">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border">
        <h2 className="text-xl font-black">My Local Store</h2>
        <button onClick={() => setShowAddModal(true)} className="iocl-btn text-white px-6 py-2 rounded-xl font-bold">+ Add Stock</button>
      </div>
      <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-left text-sm">
          <tbody className="divide-y">{myItems.map(i => (<tr key={i.id} className="hover:bg-slate-50 border-b">
                <td className="p-4 text-slate-400 text-[9px]">{i.cat}</td>
                <td className="p-4 font-bold">{i.item}</td>
                <td className="p-4"><span className="border px-2 py-1 rounded text-[10px]">{i.spec}</span></td>
                <td className="p-4 text-center font-bold">{i.qty} {i.unit}</td>
              </tr>))}</tbody>
        </table></div>
    </div>
  );
}

// --- USAGE & ANALYSIS ---
function UsageHistoryView({ profile }: any) {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => { const f = async () => { if(profile){const { data } = await supabase.from("usage_logs").select("*").eq("consumer_uid", profile.id).order("timestamp", { ascending: false }); if (data) setLogs(data);} }; f(); }, [profile]);
  return (<section className="bg-white rounded-xl border shadow-sm font-roboto font-bold uppercase"><table className="w-full text-left text-xs"><tbody className="divide-y">{logs.map(l => (<tr key={l.id} className="hover:bg-slate-50 border-b"><td className="p-4">{new Date(Number(l.timestamp)).toLocaleDateString()}</td><td className="p-4 font-bold">{l.item_name}</td><td className="p-4 text-center text-red-600">-{l.qty_consumed} Nos</td></tr>))}</tbody></table></section>);
}

function MonthlyAnalysisView({ profile }: any) {
  const [analysis, setAnalysis] = useState<any[]>([]);
  useEffect(() => { const f = async () => { if(profile){const { data } = await supabase.from("usage_logs").select("*").eq("consumer_uid", profile.id); if (data) { const stats: any = {}; data.forEach((l: any) => { const month = new Date(Number(l.timestamp)).toLocaleString('default', { month: 'long', year: 'numeric' }); if (!stats[month]) stats[month] = { month, total: 0 }; stats[month].total += Number(l.qty_consumed); }); setAnalysis(Object.values(stats)); } } }; f(); }, [profile]);
  return (<div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-roboto font-bold uppercase">{analysis.map((a, idx) => (<div key={idx} className="bg-white p-6 rounded-2xl border text-center font-bold"><div>{a.month}</div><div className="text-3xl font-black text-slate-800 mt-2">{a.total} Nos</div></div>))}</div>);
}

// --- RETURNS LEDGER VIEW ---
function ReturnsLedgerView({ profile, setActionModal, formatTS }: any) { 
    const [pending, setPending] = useState<any[]>([]);
    const [given, setGiven] = useState<any[]>([]);
    const [taken, setTaken] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);

    const fetchAll = async () => {
        if(!profile) return;
        const { data: p } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).in("status", ["pending", "return_requested"]).order("id", { ascending: false });
        const { data: g } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).eq("status", "approved").order("id", { ascending: false });
        const { data: t } = await supabase.from("requests").select("*").eq("from_unit", profile.unit).eq("status", "approved").order("id", { ascending: false });
        const { data: gh } = await supabase.from("requests").select("*").or(`to_unit.eq."${profile.unit}",from_unit.eq."${profile.unit}"`).in("status", ["returned", "rejected"]).order("id", { ascending: false });
        if (p) setPending(p); if (g) setGiven(g); if (t) setTaken(t); if (gh) setHistory(gh);
    };

    useEffect(() => {
        fetchAll();
        const ch = supabase.channel('ledger-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => fetchAll()).subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [profile]);

    return (
        <div className="space-y-10 animate-fade-in pb-20 font-roboto uppercase font-bold tracking-tight">
            <h2 className="text-2xl font-bold text-slate-800"><i className="fa-solid fa-handshake-angle text-orange-500 mr-2"></i> Udhaari Dashboard</h2>

            {/* ATTENTION REQUIRED */}
            <section className="bg-white rounded-xl border-t-4 border-orange-500 shadow-xl overflow-hidden">
                <div className="p-4 bg-orange-50/50 flex justify-between border-b font-black text-[10px] tracking-widest text-orange-900 uppercase"><span><i className="fa-solid fa-bolt animate-pulse"></i> Attention Required</span><span>{pending.length}</span></div>
                <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                    <tbody className="divide-y">
                        {pending.map(r => (
                            <tr key={r.id} className={`${r.status==='return_requested' ? 'bg-orange-50 animate-pulse' : 'bg-white'} border-b`}>
                                <td className="p-4"><div className="font-bold text-[14px]">{r.item_name}</div><div className="text-[10px] text-slate-400">{r.item_spec}</div><div className="text-[8.5px] text-orange-600 mt-1">{formatTS(r.timestamp)}</div></td>
                                <td className="p-4 font-bold text-slate-700">{r.from_name}<div className="text-[10px] text-slate-400 font-normal">{r.from_unit}</div></td>
                                <td className="p-4 text-center font-black text-orange-600">{r.req_qty} {r.item_unit}</td>
                                <td className="p-4 flex gap-2 justify-center"><button onClick={()=>setActionModal({type: r.status==='pending' ? 'approve' : 'verify', data:r})} className="bg-[#ff6b00] text-white px-4 py-2 rounded-lg text-[10px] font-black shadow-md">{r.status==='pending' ? 'Issue' : 'Verify'}</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table></div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section className="bg-white rounded-2xl border-t-4 border-blue-600 shadow-lg overflow-hidden">
                    <div className="p-5 border-b bg-blue-50/30 text-xs font-black text-blue-900 tracking-widest uppercase">Items Given</div>
                    <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">{given.map(r => (
                            <div key={r.id} className="p-4 border-2 border-slate-100 bg-white rounded-2xl relative">
                                <div className="font-bold text-[14px]">{r.item_name}</div>
                                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg mt-2"><div><p className="text-[9px] text-slate-400">Receiver</p><p className="text-[12px] font-black">{r.from_name} ({r.from_unit})</p></div><div className="text-blue-600 font-black text-[14px]">{r.req_qty} Nos</div></div>
                                <div className="text-[9px] text-slate-400 mt-3 border-t pt-2 uppercase"><p>TXN: {r.txn_id}</p><p>DATE: {formatTS(r.timestamp)}</p></div>
                            </div>
                        ))}</div>
                </section>

                <section className="bg-white rounded-2xl border-t-4 border-red-600 shadow-lg overflow-hidden">
                    <div className="p-5 border-b bg-red-50/30 text-xs font-black text-red-900 tracking-widest uppercase">Items Taken</div>
                    <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">{taken.map(r => (
                            <div key={r.id} className="p-4 border-2 border-slate-100 bg-white rounded-2xl relative">
                                <div className="font-bold text-[14px]">{r.item_name}</div>
                                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg mt-2"><div><p className="text-[9px] text-slate-400">Source</p><p className="text-[12px] font-black">{r.to_name} ({r.to_unit})</p></div><div className="text-red-600 font-black text-[14px]">{r.req_qty} Nos</div></div>
                                <div className="text-[9px] text-slate-400 mt-3 border-t pt-2 uppercase"><p>TXN: {r.txn_id}</p><p>DATE: {formatTS(r.timestamp)}</p></div>
                                <button onClick={()=>setActionModal({type:'return', data:r})} className="w-full py-2 bg-slate-900 text-white text-[10px] font-black rounded-xl mt-4">Initiate Return</button>
                            </div>
                        ))}</div>
                </section>
            </div>

            {/* DIGITAL ARCHIVE LOGS */}
            <div className="bg-white rounded-2xl shadow-md border overflow-hidden mt-10">
                <div className="p-6 bg-slate-800 text-white text-center"><span className="text-[20px] font-bold tracking-widest">Digital Archive Logs</span></div>
                <div className="overflow-x-auto"><table className="w-full text-left text-[9px]">
                    <thead className="bg-slate-50 font-black text-slate-400 tracking-widest"><tr><th className="p-4">Txn ID</th><th className="p-4">Material Details</th><th className="p-4 text-center">Qty</th><th className="p-4">Life-Cycle Audit Log</th><th className="p-4 text-center">Status</th></tr></thead>
                    <tbody className="divide-y">{history.map(h => (
                            <tr key={h.id} className="hover:bg-slate-50 border-b">
                                <td className="p-4 font-bold text-slate-800">{h.txn_id || '--'}</td>
                                <td className="p-4 leading-tight"><p className="font-bold text-[12px]">{h.item_name}</p><p className="text-slate-400">SPEC: {h.item_spec}</p></td>
                                <td className="p-4 text-center font-black leading-none"><div>UDH: {h.req_qty}</div><div className={h.status==='returned'?'text-green-600':'text-slate-300'}>RET: {h.status==='returned'?h.req_qty:0}</div></td>
                                <td className="p-4 text-[8px] space-y-1"><p>1. REQ BY: {h.from_name} on {formatTS(h.timestamp)}</p><p>2. ISS BY: {h.to_name} on {formatTS(h.timestamp)}</p><p>3. RET BY: {h.from_name} on {formatTS(h.timestamp)}</p><p className="text-green-600 font-bold">4. VERIFIED BY: {h.to_name} on {formatTS(h.timestamp)}</p></td>
                                <td className="p-4 text-center"><span className={`px-2 py-1 rounded-full font-black ${h.status==='returned' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{h.status}</span></td>
                            </tr>
                        ))}</tbody></table></div>
            </div>
        </div>
    ); 
}
