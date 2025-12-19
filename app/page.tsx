"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { masterCatalog } from "@/lib/masterdata";

export default function SpareSetuApp() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("search");
  const [loading, setLoading] = useState(true);

  // --- 1. AUTH & PROFILE LISTENER ---
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
      setLoading(false);
    };

    const { data: authListener } = supabase.auth.onAuthStateChanged(async (event, session) => {
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
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();
    if (!error) setProfile(data);
  };

  // --- 2. SEEDING LOGIC (Master Data Push Karne Ke Liye) ---
  const seedDatabase = async () => {
    if (!confirm("Kya aap pura Master Catalog Supabase mein upload karna chahte hain?")) return;
    
    // Data format change for Supabase
    const formattedData = masterCatalog.map(item => ({
      item: `${item.make} ${item.sub} ${item.model}`.trim(),
      cat: item.cat,
      sub: item.sub,
      make: item.make,
      model: item.model,
      spec: item.spec,
      qty: 0,
      unit: 'Nos',
      holder_unit: 'Master Catalog'
    }));

    // Batch insert: Supabase handles bulk insert like this
    const { error } = await supabase.from('inventory').insert(formattedData);
    
    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("Success! Pura catalog upload ho gaya. Ab aap Global Search mein items dekh sakte hain.");
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#0f172a] flex flex-col items-center justify-center text-white">
        <div className="animate-pulse mb-4 text-orange-500 text-4xl">
          <i className="fa-solid fa-layer-group"></i>
        </div>
        <p className="text-xs font-bold tracking-[0.3em] uppercase">SpareSetu Loading...</p>
      </div>
    );
  }

  if (!user) return <AuthView />;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f1f5f9]">
      <aside className="w-64 bg-white hidden md:flex flex-col shadow-xl border-r border-slate-200 z-20">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-orange-600">
            <i className="fa-solid fa-layer-group"></i>
          </div>
          <span className="text-lg font-bold text-slate-800 font-industrial uppercase tracking-wide">Menu</span>
        </div>
        
        <nav className="flex-1 px-3 space-y-1 mt-4">
          <button onClick={() => setActiveTab("search")} className={`nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition ${activeTab === "search" ? "active-nav" : "text-slate-600"}`}>
            <i className="fa-solid fa-globe w-5"></i> Global Search
          </button>
          <button onClick={() => setActiveTab("mystore")} className={`nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition ${activeTab === "mystore" ? "active-nav" : "text-slate-600"}`}>
            <i className="fa-solid fa-warehouse w-5"></i> My Local Store
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100">
          {/* TEMPORARY SEED BUTTON - Iska use karke data push karein */}
          <button 
            onClick={seedDatabase}
            className="w-full mb-3 py-2 text-[10px] bg-orange-100 text-orange-600 font-bold rounded-lg border border-orange-200 hover:bg-orange-200 transition"
          >
            <i className="fa-solid fa-cloud-arrow-up mr-1"></i> SYNC MASTER DATA
          </button>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-xs">
              {profile?.name?.charAt(0) || "U"}
            </div>
            <div className="overflow-hidden">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Logged in</p>
              <div className="text-xs font-bold text-slate-700 truncate">{profile?.name || "User"}</div>
            </div>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="w-full py-2 text-xs text-red-500 hover:bg-red-50 font-bold rounded-lg transition">Logout</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-y-auto relative">
        <header className="header-bg text-white sticky top-0 z-30 shadow-md">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex flex-col items-center">
              <h1 className="font-industrial text-3xl uppercase tracking-wider font-bold">Gujarat Refinery</h1>
              <p className="font-hindi text-blue-400 text-sm font-bold tracking-wide mt-1">जहाँ प्रगति ही जीवन सार है</p>
            </div>
            <h2 className="font-industrial text-2xl text-orange-500 tracking-[0.1em] font-bold hidden md:block">SPARE SETU PORTAL</h2>
          </div>
        </header>

        <div className="p-4 md:p-10 max-w-7xl mx-auto w-full space-y-8">
          {activeTab === "search" ? <InventoryView /> : <div className="text-center p-20 text-slate-400">My Store coming soon...</div>}
        </div>
      </main>
    </div>
  );
}

// (AuthView aur InventoryView components wahi rahenge jo pichle code mein the)
function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !pass) return alert("Fields are required");
    setAuthLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) alert(error.message);
    } else {
      if (!name || !unit) return alert("Name and Zone are required");
      const { error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: { data: { name, unit } }
      });
      if (error) alert(error.message);
      else alert("Registration successful! Ab aap login karein.");
    }
    setAuthLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 login-bg">
      <div className="w-full max-w-md login-card rounded-2xl shadow-2xl p-8 border-t-4 border-orange-500 fade-in">
        <div className="text-center mb-6">
          <h1 className="font-industrial text-2xl font-bold text-white uppercase tracking-wider">Gujarat Refinery</h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Spare Setu Portal</p>
        </div>

        <div className="space-y-4">
          {!isLogin && (
            <>
              <div className="relative">
                <i className="fa-solid fa-user absolute left-4 top-3.5 text-slate-400"></i>
                <input type="text" placeholder="Full Name" className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm" onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="relative">
                <i className="fa-solid fa-building absolute left-4 top-3.5 text-slate-400"></i>
                <select className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm bg-slate-900 text-white" onChange={(e) => setUnit(e.target.value)}>
                  <option value="">Select Your Zone</option>
                  <option value="Electrical Planning">Electrical Planning</option>
                  <option value="RUP - South Block">RUP - South Block</option>
                  <option value="LAB">LAB</option>
                </select>
              </div>
            </>
          )}
          <div className="relative">
            <i className="fa-solid fa-envelope absolute left-4 top-3.5 text-slate-400"></i>
            <input type="email" placeholder="Official Email" className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm" onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="relative">
            <i className="fa-solid fa-lock absolute left-4 top-3.5 text-slate-400"></i>
            <input type="password" placeholder="Password" className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm" onChange={(e) => setPass(e.target.value)} />
          </div>
        </div>

        <button 
          onClick={handleAuth} 
          disabled={authLoading}
          className="w-full h-12 mt-6 iocl-btn text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2"
        >
          {authLoading ? "Processing..." : isLogin ? "Secure Login" : "Create Account"}
        </button>

        <div className="mt-6 text-center pt-4 border-t border-white/10">
          <p className="text-xs text-slate-400">
            {isLogin ? "New User?" : "Already Registered?"}
            <button onClick={() => setIsLogin(!isLogin)} className="text-white hover:text-orange-500 font-bold underline ml-1 transition">
              {isLogin ? "Create Account" : "Back to Login"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function InventoryView() {
  const [items, setItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const { data, error } = await supabase.from("inventory").select("*").order("item", { ascending: true });
      if (!error) setItems(data);
      setFetching(false);
    };
    fetchAll();
  }, []);

  const filtered = items.filter(i => 
    i.item.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.spec.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fade-in space-y-6">
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Global Inventory Search</h2>
          <div className="relative">
            <i className="fa-solid fa-search absolute left-4 top-3.5 text-slate-400"></i>
            <input 
              type="text" 
              placeholder="Search Parts (Bearing, Cable, Motor)..." 
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg focus:border-orange-500 outline-none text-sm transition shadow-sm"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold border-b">
              <tr>
                <th className="p-5 pl-8">Item Description</th>
                <th className="p-5">Specification</th>
                <th className="p-5 text-center">Stock</th>
                <th className="p-5 pr-8">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm text-slate-700 bg-white">
              {fetching ? (
                <tr><td colSpan={4} className="p-10 text-center text-slate-400 italic">Connecting to database...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="p-10 text-center text-slate-400">No matching items found.</td></tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition border-b border-slate-50">
                    <td className="p-5 pl-8">
                      <div className="font-bold text-slate-800">{item.item}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{item.cat}</div>
                    </td>
                    <td className="p-5">
                      <span className="bg-slate-100 border px-2 py-1 rounded text-[11px] font-medium text-slate-600 shadow-sm">{item.spec}</span>
                    </td>
                    <td className="p-5 text-center font-bold text-blue-600">{item.qty} {item.unit}</td>
                    <td className="p-5 pr-8">
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border uppercase">{item.holder_unit || "Master"}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}