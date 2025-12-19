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

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] bg-[#0f172a] flex flex-col items-center justify-center">
        <div className="iocl-logo-container mb-4 animate-pulse" style={{ fontSize: '20px' }}>
          <div className="iocl-circle"><div className="iocl-band"><span className="iocl-hindi-text">इंडियनऑयल</span></div></div>
        </div>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.3em]">SpareSetu Loading...</p>
      </div>
    );
  }

  if (!user) return <AuthView />;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f1f5f9]">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white hidden md:flex flex-col flex-shrink-0 z-20 shadow-xl border-r border-slate-200">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-orange-600">
              <i className="fa-solid fa-layer-group"></i>
            </div>
            <span className="text-lg font-bold text-slate-800 font-industrial uppercase tracking-wide">Menu</span>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1 mt-4">
          <button onClick={() => setActiveTab("search")} className={`nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all group text-sm font-medium ${activeTab === 'search' ? 'active-nav' : 'text-slate-600'}`}>
            <i className="fa-solid fa-globe w-5"></i> <span>Global Search</span>
          </button>
          <button onClick={() => setActiveTab("mystore")} className={`nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all group text-sm font-medium ${activeTab === 'mystore' ? 'active-nav' : 'text-slate-600'}`}>
            <i className="fa-solid fa-warehouse w-5"></i> <span>My Local Store</span>
          </button>
        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-xs">{profile?.name?.charAt(0) || "U"}</div>
            <div className="overflow-hidden">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Logged in</p>
              <div className="text-xs font-bold text-slate-700 truncate">{profile?.name}</div>
            </div>
          </div>
          <button onClick={() => supabase.auth.signOut().then(()=>window.location.reload())} className="w-full mt-2 py-2 text-xs text-red-500 hover:bg-red-50 font-bold rounded-lg transition">Logout</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-y-auto relative pb-20 md:pb-0">
        <header className="header-bg text-white sticky top-0 z-30 shadow-md">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="iocl-logo-container hidden md:flex" style={{ fontSize: '10px' }}>
                <div className="iocl-circle"><div className="iocl-band"><span className="iocl-hindi-text">इंडियनऑयल</span></div></div>
                <div className="iocl-english-text" style={{ color: 'white', fontWeight: 800 }}>IndianOil</div>
                <div className="font-script text-orange-400 text-[10px] mt-1 whitespace-nowrap">The Energy of India</div>
              </div>
              <div className="flex flex-col items-center"> 
                <h1 className="font-industrial text-3xl md:text-4xl uppercase tracking-wider leading-none font-bold text-center">Gujarat Refinery</h1>
                <p className="font-hindi text-blue-400 text-sm font-bold tracking-wide mt-1 text-center">जहाँ प्रगति ही जीवन सार है</p>
              </div>
            </div>
            <h2 className="font-industrial text-2xl text-orange-500 tracking-[0.1em] font-bold hidden md:block">SPARE SETU PORTAL</h2>
          </div>
        </header>

        <div className="p-4 md:p-10 max-w-7xl mx-auto w-full mt-2">
          {activeTab === "search" ? <InventoryView /> : <MyStoreView profile={profile} />}
        </div>
      </main>
    </div>
  );
}

function AuthView() {
  const [view, setView] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");

  const handleAuth = async () => {
    if (view === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) alert(error.message);
    } else if (view === "register") {
      const { error } = await supabase.auth.signUp({ 
        email, password: pass, options: { data: { name, unit } } 
      });
      if (error) alert(error.message); else { alert("Account Created! Login karein."); setView("login"); }
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) alert(error.message); else alert("Link Sent to Email!");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 login-bg">
      <div className="w-full max-w-md login-card rounded-2xl shadow-2xl p-8 fade-in border-t-4 border-orange-500 text-center relative">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="iocl-logo-container" style={{ fontSize: '14px' }}>
              <div className="iocl-circle"><div className="iocl-band"><span className="iocl-hindi-text">इंडियनऑयल</span></div></div>
              <div className="iocl-english-text" style={{ marginTop: '8px' }}>IndianOil</div>
            </div>
          </div>
          <h1 className="font-industrial text-2xl font-bold text-white uppercase tracking-wider leading-tight">Gujarat Refinery</h1>
          <p className="font-hindi text-blue-400 text-sm font-bold mt-1 tracking-wide">जहाँ प्रगति ही जीवन सार है</p>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-4">Spare Setu Portal</p>
        </div>

        <div className="space-y-4">
          {view === "register" && (
            <>
              <div className="relative"><i className="fa-solid fa-user absolute left-4 top-3.5 text-slate-400"></i><input type="text" placeholder="Full Name" className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm" onChange={(e)=>setName(e.target.value)} /></div>
              <div className="relative">
                <i className="fa-solid fa-building absolute left-4 top-3.5 text-slate-400"></i>
                <select className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm bg-slate-900 text-slate-300" onChange={(e)=>setUnit(e.target.value)}>
                  <option value="">Select Your Zone</option>
                  <option value="RUP - South Block">RUP - South Block</option>
                  <option value="RUP - North Block">RUP - North Block</option>
                  <option value="LAB">LAB</option>
                  <option value="MSQU">MSQU</option>
                  <option value="AU-5">AU-5</option>
                  <option value="BS-VI">BS-VI</option>
                  <option value="GR-II & NBA">GR-II & NBA</option>
                  <option value="GR-I">GR-I</option>
                  <option value="OM&S">OM&S</option>
                  <option value="OLD SRU & CETP">OLD SRU & CETP</option>
                  <option value="Electrical Planning">Electrical Planning</option>
                  <option value="Electrical Testing">Electrical Testing</option>
                  <option value="Electrical Workshop">Electrical Workshop</option>
                  <option value="FCC">FCC</option>
                  <option value="GRE">GRE</option>
                  <option value="CGP-I">CGP-I</option>
                  <option value="CGP-II & TPS">CGP-II & TPS</option>
                  <option value="Water Block & Bitumen">Water Block & Bitumen</option>
                  <option value="Township - Estate Office">Township - Estate Office</option>
                  <option value="AC Section">AC Section</option>
                  <option value="GHC">GHC</option>
                  <option value="DHUMAD">DHUMAD</option>
                </select>
              </div>
            </>
          )}
          <div className="relative"><i className="fa-solid fa-envelope absolute left-4 top-3.5 text-slate-400"></i><input type="email" placeholder="Official Email ID" className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm" onChange={(e)=>setEmail(e.target.value)} /></div>
          {view !== "forgot" && <div className="relative"><i className="fa-solid fa-lock absolute left-4 top-3.5 text-slate-400"></i><input type="password" placeholder="Password" className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm" onChange={(e)=>setPass(e.target.value)} /></div>}
          
          {view === "login" && <div className="text-right"><button onClick={()=>setView("forgot")} className="text-xs text-orange-500 font-bold hover:text-orange-400 transition underline">Forgot Password?</button></div>}

          <button onClick={handleAuth} className="w-full h-12 mt-6 iocl-btn text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 uppercase">
            {view === "login" ? "Secure Login →" : view === "register" ? "Create Account" : "Send Link"}
          </button>

          <div className="mt-6 text-center border-t border-white/10 pt-4">
            <p className="text-xs text-slate-400">{view === "login" ? "New User? " : "Already registered? "}<button onClick={() => setView(view === "login" ? "register" : "login")} className="text-white hover:text-orange-500 font-bold underline ml-1">{view === "login" ? "Create Account" : "Back to Login"}</button></p>
          </div>
          
          <div className="mt-8 pt-4 border-t border-white/10 text-center">
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Developed By</p>
            <p className="text-[11px] text-slate-300 font-bold tracking-wide font-hindi">
              अशोक सैनी <span className="text-orange-500 mx-1">•</span> दीपक चौहान <span className="text-orange-500 mx-1">•</span> दिव्यांक सिंह राजपूत
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MyStoreView({ profile }: any) {
  const [myItems, setMyItems] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selCat, setSelCat] = useState("");
  const [selSub, setSelSub] = useState("");
  const [selMake, setSelMake] = useState("");
  const [selModel, setSelModel] = useState("");
  const [selSpec, setSelSpec] = useState("");
  const [qty, setQty] = useState<any>("");

  useEffect(() => { if (profile) fetchMyStock(); }, [profile]);

  const fetchMyStock = async () => {
    const { data } = await supabase.from("inventory").select("*").eq("holder_uid", profile.id).order("id", { ascending: false });
    if (data) setMyItems(data);
  };

  const categories = [...new Set(masterCatalog.map(i => i.cat))];
  const subs = [...new Set(masterCatalog.filter(i => i.cat === selCat).map(i => i.sub))];
  const makes = [...new Set(masterCatalog.filter(i => i.cat === selCat && i.sub === selSub).map(i => i.make))];
  const models = [...new Set(masterCatalog.filter(i => i.cat === selCat && i.sub === selSub && i.make === selMake).map(i => i.model))];
  const specs = [...new Set(masterCatalog.filter(i => i.cat === selCat && i.sub === selSub && i.make === selMake && i.model === selModel).map(i => i.spec))];

  const handleSave = async () => {
    if (!selSpec || !qty) return alert("Poori details select karein!");
    const itemName = `${selMake} ${selSub} ${selModel}`.trim();
    const { error } = await supabase.from("inventory").insert([{
      item: itemName, cat: selCat, sub: selSub, make: selMake, model: selModel, spec: selSpec,
      qty: parseInt(qty), unit: 'Nos', holder_unit: profile.unit, holder_uid: profile.id, holder_name: profile.name, timestamp: new Date().toISOString()
    }]);
    if (!error) { alert("Stock Saved!"); fetchMyStock(); setQty(""); }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
        <div><h2 className="text-xl font-bold text-slate-800">My Local Store</h2><p className="text-xs text-slate-500 font-bold bg-blue-50 px-2 rounded mt-1 uppercase">Unit: {profile?.unit}</p></div>
        <button onClick={() => setShowModal(true)} className="iocl-btn text-white px-6 py-2.5 rounded-xl font-bold shadow-md">Add New Stock</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden"><table className="w-full text-left"><thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold border-b"><tr><th className="p-5 pl-8">Item</th><th className="p-5">Spec</th><th className="p-5 text-center">Stock</th></tr></thead><tbody className="divide-y text-sm">{myItems.map(i => (<tr key={i.id} className="hover:bg-slate-50 transition"><td className="p-5 pl-8 font-bold text-slate-800">{i.item}<div className="text-[10px] text-slate-400 font-bold uppercase">{i.cat}</div></td><td className="p-5"><span className="bg-slate-100 border px-2 py-0.5 rounded text-[11px] font-medium">{i.spec}</span></td><td className="p-5 text-center font-bold text-emerald-600">{i.qty} Nos</td></tr>))}</tbody></table></div>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"><div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 relative"><button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 font-bold text-xl">✕</button><h3 className="text-lg font-bold mb-6 border-b pb-2 uppercase">Add Stock</h3><div className="space-y-4"><select className="w-full p-3 border rounded-lg text-sm bg-slate-50" onChange={(e)=>{setSelCat(e.target.value); setSelSub(""); setSelMake(""); setSelModel(""); setSelSpec("");}}><option value="">Category</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select><select className="w-full p-3 border rounded-lg text-sm bg-white" disabled={!selCat} onChange={(e)=>{setSelSub(e.target.value); setSelMake(""); setSelModel(""); setSelSpec("");}}><option value="">Sub-Category</option>{subs.map(s => <option key={s} value={s}>{s}</option>)}</select><select className="w-full p-3 border rounded-lg text-sm bg-white" disabled={!selSub} onChange={(e)=>{setSelMake(e.target.value); setSelModel(""); setSelSpec("");}}><option value="">Make</option>{makes.map(m => <option key={m} value={m}>{m}</option>)}</select><select className="w-full p-3 border rounded-lg text-sm bg-white" disabled={!selMake} onChange={(e)=>{setSelModel(e.target.value); setSelSpec("");}}><option value="">Model</option>{models.map(m => <option key={m} value={m}>{m}</option>)}</select><select className="w-full p-3 border rounded-lg text-sm bg-white" disabled={!selModel} onChange={(e)=>setSelSpec(e.target.value)}><option value="">Spec</option>{specs.map(s => <option key={s} value={s}>{s}</option>)}</select><input type="number" placeholder="Quantity" value={qty} className="w-full p-3 border rounded text-lg font-bold" onChange={(e)=>setQty(e.target.value)} /><button onClick={handleSave} className="w-full py-4 iocl-btn text-white font-bold rounded-xl shadow-lg uppercase">Save & Add More</button></div></div></div>
      )}
    </div>
  );
}

function InventoryView() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => { const fetchAll = async () => { const { data } = await supabase.from("inventory").select("*").order("item", { ascending: true }); if (data) setItems(data); }; fetchAll(); }, []);
  const filtered = items.filter(i => i.item.toLowerCase().includes(search.toLowerCase()) || i.spec.toLowerCase().includes(search.toLowerCase()));
  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in"><div className="p-6 border-b border-slate-100 bg-slate-50/50"><h2 className="text-lg font-bold text-slate-800 mb-4 tracking-tight">Global Inventory Search</h2><div className="relative"><i className="fa-solid fa-search absolute left-4 top-3.5 text-slate-400"></i><input type="text" placeholder="Search Item..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg outline-none text-sm transition shadow-sm" onChange={(e) => setSearch(e.target.value)} /></div></div><div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold border-b"><tr><th className="p-5 pl-8">Item Description</th><th className="p-5">Spec</th><th className="p-5 text-center">Stock</th><th className="p-5 pr-8 text-center">Location</th></tr></thead><tbody className="divide-y text-sm text-slate-700 bg-white">{filtered.map((item) => (<tr key={item.id} className="hover:bg-slate-50 transition border-b border-slate-50"><td className="p-5 pl-8 font-bold text-slate-800">{item.item}<div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{item.cat}</div></td><td className="p-5"><span className="bg-slate-100 border px-2 py-1 rounded text-[11px] font-medium text-slate-600 shadow-sm">{item.spec}</span></td><td className="p-5 text-center font-bold text-blue-600">{item.qty} Nos</td><td className="p-5 pr-8 text-center text-[10px] font-bold text-slate-500 uppercase tracking-tighter bg-slate-50 border">{item.holder_unit}</td></tr>))}</tbody></table></div></section>
  );
}