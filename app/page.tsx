"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { masterCatalog } from "@/lib/masterdata";

export default function SpareSetuApp() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("search");
  const [loading, setLoading] = useState(true);

  // Auth Listener (Supabase)
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    checkUser();
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#0f172a] text-white">SpareSetu Loading...</div>;

  if (!user) return <LoginView />;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f1f5f9]">
      {/* Sidebar - Aapka purana design */}
      <aside className="w-64 bg-white hidden md:flex flex-col shadow-xl border-r">
        <div className="p-6 border-b font-industrial font-bold uppercase tracking-wide text-slate-800">Menu</div>
        <nav className="flex-1 px-3 mt-4 space-y-1">
          <button onClick={() => setActiveTab('search')} className={`nav-item w-full text-left p-3 rounded-lg flex items-center gap-3 ${activeTab==='search'?'active-nav':''}`}>
            <i className="fa-solid fa-globe"></i> Global Search
          </button>
          <button onClick={() => setActiveTab('mystore')} className={`nav-item w-full text-left p-3 rounded-lg flex items-center gap-3 ${activeTab==='mystore'?'active-nav':''}`}>
            <i className="fa-solid fa-warehouse"></i> My Local Store
          </button>
        </nav>
        <div className="p-4 border-t">
          <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="text-red-500 font-bold w-full text-left p-2">Logout</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="header-bg p-6 text-white text-center">
          <h1 className="font-industrial text-3xl uppercase font-bold">Gujarat Refinery</h1>
          <p className="font-hindi text-blue-400 text-sm font-bold">जहाँ प्रगति ही जीवन सार है</p>
        </header>
        
        <div className="p-4 md:p-10 max-w-7xl mx-auto w-full">
           {activeTab === 'search' ? <InventoryView /> : <h2 className="text-xl">My Store (Coming Soon)</h2>}
        </div>
      </main>
    </div>
  );
}

function LoginView() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) alert(error.message);
    else window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center login-bg p-4">
      <div className="w-full max-w-md login-card rounded-2xl p-8 border-t-4 border-orange-500 shadow-2xl">
        <div className="text-center mb-6">
           <h1 className="font-industrial text-2xl font-bold text-white uppercase">Gujarat Refinery</h1>
           <p className="text-slate-400 text-[10px] font-bold uppercase mt-2">Spare Setu Portal</p>
        </div>
        <div className="space-y-4">
          <input type="email" placeholder="Official Email" className="w-full p-3 rounded login-input" onChange={(e)=>setEmail(e.target.value)} />
          <input type="password" placeholder="Password" className="w-full p-3 rounded login-input" onChange={(e)=>setPass(e.target.value)} />
          <button onClick={handleLogin} className="w-full h-12 iocl-btn text-white font-bold rounded-lg shadow-lg">Secure Login</button>
        </div>
      </div>
    </div>
  );
}

function InventoryView() {
  return (
    <div className="animate-fade-in bg-white p-6 rounded-xl border shadow-sm">
      <h2 className="text-lg font-bold text-slate-800 mb-4">Global Inventory Search</h2>
      <div className="relative">
        <input type="text" placeholder="Search Spare Parts..." className="w-full pl-10 pr-4 py-3 border rounded-lg outline-none focus:border-orange-500" />
        <i className="fa-solid fa-search absolute left-4 top-4 text-slate-400"></i>
      </div>
      <table className="w-full mt-6 text-left border-collapse">
         <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
            <tr><th className="p-4">Item Details</th><th className="p-4">Spec</th><th className="p-4 text-center">Stock</th></tr>
         </thead>
         <tbody className="divide-y text-sm">
            <tr><td colSpan={3} className="p-8 text-center text-slate-400">Searching database...</td></tr>
         </tbody>
      </table>
    </div>
  );
}