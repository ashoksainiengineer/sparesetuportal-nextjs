"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { masterCatalog } from "@/lib/masterdata";

export default function SpareSetuApp() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("search");
  const [loading, setLoading] = useState(true);

  // --- 1. AUTH LOGIC ---
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

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#0f172a] text-white font-bold uppercase tracking-widest">SpareSetu Loading...</div>;
  if (!user) return <AuthView />;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f1f5f9]">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white hidden md:flex flex-col shadow-xl border-r border-slate-200">
        <div className="p-6 border-b font-industrial font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
           <i className="fa-solid fa-layer-group text-orange-500"></i> SPARESETU
        </div>
        <nav className="flex-1 px-3 mt-4 space-y-1">
          <button onClick={() => setActiveTab("search")} className={`nav-item w-full text-left p-3 rounded-lg flex items-center gap-3 font-medium text-sm transition ${activeTab === "search" ? "active-nav" : "text-slate-600"}`}>
            <i className="fa-solid fa-globe"></i> Global Search
          </button>
          <button onClick={() => setActiveTab("mystore")} className={`nav-item w-full text-left p-3 rounded-lg flex items-center gap-3 font-medium text-sm transition ${activeTab === "mystore" ? "active-nav" : "text-slate-600"}`}>
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
          <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="w-full py-2 text-xs text-red-500 hover:bg-red-50 font-bold rounded-lg transition">Logout</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-y-auto relative">
        <header className="header-bg text-white sticky top-0 z-30 shadow-md">
          <div className="max-w-7xl mx-auto px-6 py-4 text-center">
            <h1 className="font-industrial text-3xl uppercase tracking-wider font-bold">Gujarat Refinery</h1>
            <p className="font-hindi text-blue-400 text-sm font-bold tracking-wide">जहाँ प्रगति ही जीवन सार है</p>
          </div>
        </header>
        <div className="p-4 md:p-10 max-w-7xl mx-auto w-full space-y-8">
          {activeTab === "search" ? <InventoryView /> : <MyStoreView profile={profile} />}
        </div>
      </main>
    </div>
  );
}

// --- MY STORE: DATA ENTRY VIA DROPDOWNS ---
function MyStoreView({ profile }: any) {
  const [myItems, setMyItems] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  
  // State for Cascading Selects
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

  // Dropdown Logic based on masterdata.js
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
      qty: parseInt(qty), unit: 'Nos', holder_unit: profile.unit, holder_uid: profile.id,
      holder_name: profile.name, timestamp: new Date().toISOString()
    }]);

    if (!error) {
      alert("Stock Saved! Aap agla item add kar sakte hain."); 
      fetchMyStock(); 
      setQty(""); // Reset quantity for next entry, modal stays open
    } else alert(error.message);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800">My Local Store</h2>
          <p className="text-xs text-slate-500 font-bold bg-blue-50 px-2 rounded mt-1 uppercase tracking-tighter">Location: {profile?.unit}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="iocl-btn text-white px-6 py-2.5 rounded-xl font-bold shadow-md hover:shadow-lg transition">Add New Stock</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold border-b">
            <tr><th className="p-5">Item Details</th><th className="p-5">Spec</th><th className="p-5 text-center">Stock</th></tr>
          </thead>
          <tbody className="divide-y text-sm">
            {myItems.length === 0 ? (
              <tr><td colSpan={3} className="p-10 text-center text-slate-400">Aapka store khali hai. Stock add karein.</td></tr>
            ) : myItems.map(i => (
              <tr key={i.id} className="hover:bg-slate-50"><td className="p-5 font-bold text-slate-800">{i.item}<div className="text-[10px] text-slate-400 font-bold uppercase">{i.cat}</div></td><td className="p-5"><span className="bg-slate-100 border px-2 py-0.5 rounded text-[11px] font-medium text-slate-600">{i.spec}</span></td><td className="p-5 text-center font-bold text-emerald-600">{i.qty}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 relative modal-container scale-100">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 font-bold text-xl">✕</button>
            <h3 className="text-lg font-bold text-slate-800 mb-6 border-b pb-2 uppercase tracking-wide">Select Items to Add</h3>
            <div className="space-y-4">
              <select className="w-full p-3 border rounded-lg text-sm bg-slate-50" onChange={(e)=>{setSelCat(e.target.value); setSelSub(""); setSelMake(""); setSelModel(""); setSelSpec("");}}>
                <option value="">-- Category --</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="w-full p-3 border rounded-lg text-sm bg-white" disabled={!selCat} onChange={(e)=>{setSelSub(e.target.value); setSelMake(""); setSelModel(""); setSelSpec("");}}>
                <option value="">-- Sub-Category --</option>
                {subs.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="w-full p-3 border rounded-lg text-sm bg-white" disabled={!selSub} onChange={(e)=>{setSelMake(e.target.value); setSelModel(""); setSelSpec("");}}>
                <option value="">-- Make --</option>
                {makes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select className="w-full p-3 border rounded-lg text-sm bg-white" disabled={!selMake} onChange={(e)=>{setSelModel(e.target.value); setSelSpec("");}}>
                <option value="">-- Model --</option>
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select className="w-full p-3 border rounded-lg text-sm bg-white" disabled={!selModel} onChange={(e)=>setSelSpec(e.target.value)}>
                <option value="">-- Specification --</option>
                {specs.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="number" placeholder="Quantity" value={qty} className="w-full p-3 border rounded-lg text-lg font-bold outline-none focus:border-orange-500" onChange={(e)=>setQty(e.target.value)} />
              <button onClick={handleSave} className="w-full py-4 iocl-btn text-white font-bold rounded-xl shadow-lg uppercase tracking-wider">Save & Add More</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- GLOBAL SEARCH: ONLY SHOWS USER-ADDED DATA ---
function InventoryView() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      // Seed push karne ki zaroorat nahi, ye wahi dikhayega jo database mein hai
      const { data } = await supabase.from("inventory").select("*").order("item", { ascending: true });
      if (data) setItems(data);
      setFetching(false);
    };
    fetchAll();
  }, []);

  const filtered = items.filter(i => 
    i.item.toLowerCase().includes(search.toLowerCase()) || 
    i.spec.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-lg font-bold text-slate-800 mb-4 tracking-tight">Global Inventory Search</h2>
        <div className="relative">
          <i className="fa-solid fa-search absolute left-4 top-3.5 text-slate-400"></i>
          <input type="text" placeholder="Search Part Name or Specification..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg focus:border-orange-500 outline-none text-sm transition shadow-sm" onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold border-b">
            <tr><th className="p-5 pl-8">Item Description</th><th className="p-5">Spec</th><th className="p-5 text-center">Stock</th><th className="p-5 pr-8 text-center">Location</th></tr>
          </thead>
          <tbody className="divide-y text-sm text-slate-700 bg-white">
            {fetching ? (
              <tr><td colSpan={4} className="p-10 text-center text-slate-400 italic">Syncing with Refinery database...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="p-10 text-center text-slate-400">Koi stock nahi mila. Users ke data add karne ka intezaar karein.</td></tr>
            ) : filtered.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition border-b border-slate-50">
                <td className="p-5 pl-8 font-bold text-slate-800">{item.item}<div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{item.cat}</div></td>
                <td className="p-5"><span className="bg-slate-100 border px-2 py-1 rounded text-[11px] font-medium text-slate-600 shadow-sm">{item.spec}</span></td>
                <td className="p-5 text-center font-bold text-blue-600">{item.qty} Nos</td>
                <td className="p-5 pr-8 text-center text-[10px] font-bold text-slate-500 uppercase tracking-tighter bg-slate-50 border">{item.holder_unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// --- AUTH VIEW (LOGIN/REGISTER) ---
function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");

  const handleAuth = async () => {
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) alert(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password: pass, options: { data: { name, unit } } });
      if (error) alert(error.message); else alert("Registration successful! Login karein.");
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center login-bg p-4">
      <div className="w-full max-w-md login-card rounded-2xl p-8 border-t-4 border-orange-500 shadow-2xl animate-fade-in">
        <h1 className="text-center font-industrial text-2xl font-bold text-white mb-6 uppercase tracking-widest">{isLogin ? "Secure Login" : "Register"}</h1>
        <div className="space-y-4">
          {!isLogin && (
            <>
              <input type="text" placeholder="Full Name" className="w-full p-3 rounded-lg login-input text-sm outline-none" onChange={(e) => setName(e.target.value)} />
              <select className="w-full p-3 rounded-lg login-input text-sm outline-none bg-slate-900 text-white" onChange={(e) => setUnit(e.target.value)}>
                <option value="">Select Your Zone</option>
                <option value="RUP - South Block">RUP - South Block</option>
                <option value="Electrical Planning">Electrical Planning</option>
                <option value="LAB">LAB</option>
                <option value="MSQU">MSQU</option>
                {/* Aap baaki zones bhi yahan add kar sakte hain index.html ke hisaab se */}
              </select>
            </>
          )}
          <input type="email" placeholder="Official Email" className="w-full p-3 rounded-lg login-input text-sm outline-none" onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" className="w-full p-3 rounded-lg login-input text-sm outline-none" onChange={(e) => setPass(e.target.value)} />
          <button onClick={handleAuth} className="w-full h-12 iocl-btn text-white font-bold rounded-lg shadow-lg uppercase">{isLogin ? "Secure Access" : "Register Now"}</button>
          <div className="text-center mt-4 border-t border-white/10 pt-4">
            <button onClick={() => setIsLogin(!isLogin)} className="text-white text-xs font-bold underline">{isLogin ? "Need an Account? Create One" : "Already Registered? Login"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}