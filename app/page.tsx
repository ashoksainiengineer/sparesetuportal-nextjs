"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { masterCatalog } from "@/lib/masterdata";

export default function SpareSetuApp() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("search");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
        setProfile(data);
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#0f172a] text-white">
      <p className="animate-pulse font-industrial tracking-widest uppercase">Gujarat Refinery Loading...</p>
    </div>
  );

  if (!user) return <AuthView />;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f1f5f9]">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white hidden md:flex flex-col shadow-xl border-r border-slate-200 z-20">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-orange-600">
            <i className="fa-solid fa-layer-group"></i>
          </div>
          <span className="text-lg font-bold text-slate-800 font-industrial uppercase tracking-wide">Menu</span>
        </div>
        
        <nav className="flex-1 px-3 mt-4 space-y-1">
          <button onClick={() => setActiveTab("search")} className={`nav-item w-full text-left p-3 rounded-lg flex items-center gap-3 font-medium text-sm ${activeTab === "search" ? "active-nav" : "text-slate-600"}`}>
            <i className="fa-solid fa-globe"></i> Global Search
          </button>
          <button onClick={() => setActiveTab("mystore")} className={`nav-item w-full text-left p-3 rounded-lg flex items-center gap-3 font-medium text-sm ${activeTab === "mystore" ? "active-nav" : "text-slate-600"}`}>
            <i className="fa-solid fa-warehouse"></i> My Local Store
          </button>
        </nav>

        <div className="p-4 border-t">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-xs">{profile?.name?.charAt(0)}</div>
            <div className="overflow-hidden">
              <p className="text-[9px] text-slate-400 font-bold uppercase">Logged in</p>
              <div className="text-xs font-bold text-slate-700 truncate">{profile?.name}</div>
            </div>
          </div>
          <button onClick={() => supabase.auth.signOut().then(()=>window.location.reload())} className="w-full py-2 text-xs text-red-500 hover:bg-red-50 font-bold rounded-lg transition">Logout</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-y-auto relative">
        <header className="header-bg text-white sticky top-0 z-30 shadow-md">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              {/* CSS LOGO START */}
              <div className="iocl-logo-container scale-75 origin-left">
                <div className="iocl-circle">
                  <div className="iocl-band">
                    <span className="iocl-hindi-text">इंडियन ऑयल</span>
                  </div>
                </div>
              </div>
              {/* CSS LOGO END */}
              <div>
                <h1 className="font-industrial text-2xl uppercase tracking-wider font-bold">Gujarat Refinery</h1>
                <p className="font-hindi text-blue-400 text-xs font-bold">जहाँ प्रगति ही जीवन सार है</p>
              </div>
            </div>
            <h2 className="font-industrial text-xl text-orange-500 tracking-[0.1em] font-bold hidden md:block">SPARE SETU PORTAL</h2>
          </div>
        </header>

        <div className="p-4 md:p-10 max-w-7xl mx-auto w-full">
          {activeTab === "search" ? <InventoryView /> : <MyStoreView profile={profile} />}
        </div>
      </main>
    </div>
  );
}

// --- AUTH VIEW (Login/Register/Forgot) ---
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
      const { error } = await supabase.auth.signUp({ email, password: pass, options: { data: { name, unit } } });
      if (error) alert(error.message); else { alert("Account Created! Now Login."); setView("login"); }
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) alert(error.message); else alert("Reset link sent to email!");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 login-bg">
      <div className="w-full max-w-md login-card rounded-2xl p-8 border-t-4 border-orange-500 shadow-2xl fade-in text-center">
        {/* CSS LOGO BIG */}
        <div className="iocl-logo-container mb-4">
          <div className="iocl-circle">
            <div className="iocl-band">
              <span className="iocl-hindi-text">इंडियन ऑयल</span>
            </div>
          </div>
        </div>
        <h1 className="font-industrial text-2xl font-bold text-white uppercase tracking-widest">Gujarat Refinery</h1>
        <p className="font-hindi text-blue-400 text-sm font-bold mb-4">जहाँ प्रगति ही जीवन सार है</p>
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-6">Spare Setu Portal</p>

        <div className="space-y-4">
          {view === "register" && (
            <>
              <input type="text" placeholder="Full Name" className="w-full p-3 rounded login-input text-sm" onChange={(e)=>setName(e.target.value)} />
              <select className="w-full p-3 rounded login-input text-sm bg-slate-900" onChange={(e)=>setUnit(e.target.value)}>
                <option value="">Select Zone</option>
                <option value="Electrical Planning">Electrical Planning</option>
                <option value="RUP - South Block">RUP - South Block</option>
                <option value="LAB">LAB</option>
              </select>
            </>
          )}
          <input type="email" placeholder="Official Email ID" className="w-full p-3 rounded login-input text-sm" onChange={(e)=>setEmail(e.target.value)} />
          {view !== "forgot" && <input type="password" placeholder="Password" className="w-full p-3 rounded login-input text-sm" onChange={(e)=>setPass(e.target.value)} />}
          
          {view === "login" && (
            <div className="text-right">
              <button onClick={()=>setView("forgot")} className="text-[10px] text-orange-500 font-bold underline">Forgot Password?</button>
            </div>
          )}

          <button onClick={handleAuth} className="w-full h-12 iocl-btn text-white font-bold rounded shadow-lg uppercase tracking-wider">
            {view === "login" ? "Secure Login →" : view === "register" ? "Create Account" : "Send Reset Link"}
          </button>

          <div className="pt-4 border-t border-white/10 space-y-2">
            <p className="text-xs text-slate-400">
              {view === "login" ? "New User?" : "Already Registered?"}
              <button onClick={() => setView(view === "login" ? "register" : "login")} className="text-white font-bold underline ml-1">
                {view === "login" ? "Create Account" : "Back to Login"}
              </button>
            </p>
          </div>
          
          <div className="text-[8px] text-slate-500 font-bold uppercase mt-6 opacity-50">
            Developed by: A M Siddeequi (905636) - EP-LU&M
          </div>
        </div>
      </div>
    </div>
  );
}

// --- MY STORE VIEW (Dropdown logic as requested) ---
function MyStoreView({ profile }: any) {
  const [myItems, setMyItems] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selCat, setSelCat] = useState("");
  const [selSub, setSelSub] = useState("");
  const [selMake, setSelMake] = useState("");
  const [selModel, setSelModel] = useState("");
  const [selSpec, setSelSpec] = useState("");
  const [qty, setQty] = useState<any>("");

  useEffect(() => { fetchMyStock(); }, [profile]);

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
      qty: parseInt(qty), unit: 'Nos', holder_unit: profile.unit, holder_uid: profile.id
    }]);
    if (!error) { alert("Stock Saved!"); fetchMyStock(); setQty(""); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="text-xl font-bold text-slate-800">My Unit Inventory: {profile?.unit}</h2>
        <button onClick={() => setShowModal(true)} className="iocl-btn text-white px-6 py-2.5 rounded font-bold shadow-md">Add New Stock</button>
      </div>
      <table className="w-full bg-white rounded-xl shadow-sm border overflow-hidden">
        <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b">
          <tr><th className="p-4 text-left">Item Details</th><th className="p-4">Spec</th><th className="p-4 text-center">Qty</th></tr>
        </thead>
        <tbody className="divide-y text-sm">
          {myItems.map(i => (
            <tr key={i.id} className="hover:bg-slate-50">
              <td className="p-4 font-bold">{i.item} <br/><span className="text-[10px] text-slate-400">{i.cat}</span></td>
              <td className="p-4"><span className="bg-slate-100 border px-2 py-0.5 rounded text-[11px]">{i.spec}</span></td>
              <td className="p-4 text-center font-bold text-emerald-600">{i.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl p-8 relative shadow-2xl">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 font-bold">✕</button>
            <h3 className="text-lg font-bold mb-6 text-slate-800 border-b pb-2 uppercase tracking-wide">Select Item to Add</h3>
            <div className="space-y-4">
              <select className="w-full p-3 border rounded text-sm bg-slate-50" onChange={(e)=>{setSelCat(e.target.value); setSelSub(""); setSelMake(""); setSelModel(""); setSelSpec("");}}>
                <option value="">-- Category --</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="w-full p-3 border rounded text-sm bg-white" disabled={!selCat} onChange={(e)=>{setSelSub(e.target.value); setSelMake(""); setSelModel(""); setSelSpec("");}}>
                <option value="">-- Sub-Category --</option>
                {subs.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="w-full p-3 border rounded text-sm bg-white" disabled={!selSub} onChange={(e)=>{setSelMake(e.target.value); setSelModel(""); setSelSpec("");}}>
                <option value="">-- Make --</option>
                {makes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select className="w-full p-3 border rounded text-sm bg-white" disabled={!selMake} onChange={(e)=>{setSelModel(e.target.value); setSelSpec("");}}>
                <option value="">-- Model --</option>
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select className="w-full p-3 border rounded text-sm bg-white" disabled={!selModel} onChange={(e)=>setSelSpec(e.target.value)}>
                <option value="">-- Specification --</option>
                {specs.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="number" placeholder="Quantity" value={qty} className="w-full p-3 border rounded text-lg font-bold outline-orange-500" onChange={(e)=>setQty(e.target.value)} />
              <button onClick={handleSave} className="w-full py-4 iocl-btn text-white font-bold rounded shadow-lg uppercase tracking-wider">Save & Add More</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- GLOBAL SEARCH VIEW (User items only) ---
function InventoryView() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => {
    const fetchAll = async () => {
      const { data } = await supabase.from("inventory").select("*").order("item", { ascending: true });
      if (data) setItems(data);
    };
    fetchAll();
  }, []);
  const filtered = items.filter(i => i.item.toLowerCase().includes(search.toLowerCase()) || i.spec.toLowerCase().includes(search.toLowerCase()));
  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Global Inventory Search</h2>
        <div className="relative search-bar">
          <i className="fa-solid fa-search absolute left-4 top-3.5 text-slate-400"></i>
          <input type="text" placeholder="Search Part Name..." className="w-full pl-10 pr-4 py-3 border rounded outline-none focus:border-orange-500 text-sm transition" onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
            <tr><th className="p-5">Description</th><th className="p-5">Spec</th><th className="p-5 text-center">Stock</th><th className="p-5">Location</th></tr>
          </thead>
          <tbody className="divide-y text-sm">
            {filtered.map(item => (
              <tr key={item.id} className="hover:bg-slate-50 border-b border-slate-50">
                <td className="p-5 font-bold text-slate-800">{item.item}</td>
                <td className="p-5 text-xs text-slate-600">{item.spec}</td>
                <td className="p-5 text-center font-bold text-blue-600">{item.qty}</td>
                <td className="p-5"><span className="text-[10px] font-bold text-slate-400 uppercase border px-1 rounded">{item.holder_unit}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}