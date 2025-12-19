"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { masterCatalog } from "@/lib/masterdata";

// --- TYPES ---
interface Profile { id: string; name: string; unit: string; item_count: number; email: string; }
interface InventoryItem { id: number; item: string; spec: string; qty: number; unit: string; cat: string; sub: string; make: string; model: string; holder_uid: string; holder_name: string; holder_unit: string; is_manual: boolean; }

// --- MAIN PORTAL ---
export default function SpareSetuPortal() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState("search");
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
    if (data) setProfile(data as Profile);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setUser(session.user); fetchProfile(session.user.id); }
      setLoading(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
    });
    return () => authListener.subscription.unsubscribe();
  }, [fetchProfile]);

  if (loading) return <FullScreenLoader />;
  if (!user) return <AuthSystem />;

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar - As per Image 4 */}
      <aside className="w-64 bg-white border-r flex flex-col shadow-sm z-20">
        <div className="p-4 border-b flex items-center gap-3">
            <img src="https://upload.wikimedia.org/wikipedia/en/thumb/8/8c/Indian_Oil_Logo.svg/1200px-Indian_Oil_Logo.svg.png" className="h-8" alt="IOCL" />
            <span className="font-black text-slate-800 text-sm tracking-tighter uppercase">Menu</span>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {[
            { id: 'search', label: 'Global Search', icon: 'fa-globe' },
            { id: 'mystore', label: 'My Local Store', icon: 'fa-warehouse' },
            { id: 'analysis', label: 'Monthly Analysis', icon: 'fa-chart-pie' },
            { id: 'usage', label: 'My Usage', icon: 'fa-box-open' },
            { id: 'returns', label: 'Returns & Udhaari', icon: 'fa-handshake' }
          ].map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[13px] font-bold transition-all ${
                activeTab === item.id ? 'bg-orange-50 text-orange-600' : 'text-slate-500 hover:bg-slate-50'
              }`}>
              <i className={`fa-solid ${item.icon} w-5`}></i> {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t bg-slate-50 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Logged In As</p>
            <p className="text-xs font-black text-slate-700 mb-1">{profile?.name}</p>
            <p className="text-[9px] text-slate-400 mb-4">{profile?.unit}</p>
            <button onClick={() => supabase.auth.signOut()} className="text-[10px] text-red-500 font-black uppercase hover:underline">Logout</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header - Image 4 Theme */}
        <header className="bg-[#00205B] text-white py-3 px-6 shadow-md border-b-4 border-[#F37021]">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
               <img src="https://upload.wikimedia.org/wikipedia/en/thumb/8/8c/Indian_Oil_Logo.svg/1200px-Indian_Oil_Logo.svg.png" className="h-10 brightness-200" alt="logo" />
               <div>
                  <h1 className="text-xl font-black uppercase tracking-tight leading-none">Gujarat Refinery</h1>
                  <p className="text-[10px] text-blue-300 font-hindi mt-1">जहाँ प्रगति ही जीवन सार है</p>
               </div>
            </div>
            <div className="text-right">
              <p className="text-[#F37021] text-xs font-black uppercase tracking-widest">Spare Setu Portal</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="max-w-7xl mx-auto h-full">
            {activeTab === 'search' && profile && <GlobalSearchSection profile={profile} />}
            {activeTab === 'mystore' && profile && <MyStoreSection profile={profile} refreshProfile={() => fetchProfile(user.id)} />}
          </div>
        </div>
      </main>
    </div>
  );
}

// --- 1. GLOBAL SEARCH SECTION (Image 4, 5, 6) ---
function GlobalSearchSection({ profile }: { profile: Profile }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filters, setFilters] = useState({ search: "", cat: "All", sub: "All" });
  const [showSummary, setShowSummary] = useState(false);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    fetchInventory();
  }, []);

  async function fetchInventory() {
    const { data } = await supabase.from('inventory').select('*');
    if (data) setItems(data as InventoryItem[]);
  }

  // Logic to group items by Name & Spec for Global Stock
  const groupedData = useMemo(() => {
    const map: Record<string, any> = {};
    items.forEach(i => {
      const key = `${i.item}-${i.spec}`.toLowerCase();
      if (!map[key]) map[key] = { ...i, totalQty: 0, holders: [] };
      map[key].totalQty += Number(i.qty);
      map[key].holders.push(i);
    });
    return Object.values(map);
  }, [items]);

  const filtered = groupedData.filter(i => 
    (filters.search === "" || i.item.toLowerCase().includes(filters.search.toLowerCase()) || i.spec.toLowerCase().includes(filters.search.toLowerCase())) &&
    (filters.cat === "All" || i.cat === filters.cat) &&
    (filters.sub === "All" || i.sub === filters.sub)
  );

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const exportCSV = () => {
    const headers = "Category,Item Name,Specification,Total Stock\n";
    const rows = filtered.map(i => `${i.cat},${i.item},${i.spec},${i.totalQty}`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'global_inventory.csv'; a.click();
  };

  return (
    <div className="space-y-6">
      {/* Search & Filters - Image 4 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <input type="text" placeholder="Search Item Name (Server-Side)..." 
            className="flex-1 p-2 border rounded-lg text-sm outline-none focus:ring-2 ring-blue-900"
            onChange={(e) => setFilters({...filters, search: e.target.value})} />
          <div className="flex gap-2">
            <button className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2" onClick={exportCSV}>
              <i className="fa-solid fa-file-csv"></i> Export CSV
            </button>
            <button className="bg-[#4f46e5] text-white px-4 py-2 rounded-lg text-xs font-bold" onClick={() => setShowSummary(true)}>
              Stock Summary
            </button>
            <select className="border p-2 rounded-lg text-xs font-bold" onChange={(e) => setFilters({...filters, cat: e.target.value})}>
               <option>Category: All</option>
               {[...new Set(items.map(m => m.cat))].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="bg-[#F37021] text-white px-6 py-2 rounded-lg text-xs font-black uppercase">Search</button>
            <button className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-xs font-bold" onClick={() => setFilters({search:"", cat:"All", sub:"All"})}>Reset</button>
          </div>
        </div>
      </div>

      {/* Table - Image 4 Layout */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full iocl-table">
          <thead>
            <tr>
              <th>Item Details</th>
              <th>Spec</th>
              <th className="text-center">Total Stock</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="max-w-xs">
                  <p className="font-black text-slate-800 leading-tight uppercase text-xs">{item.item}</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">{item.cat}</p>
                </td>
                <td><span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">{item.spec}</span></td>
                <td className="text-center">
                   <button onClick={() => setBreakdown(item)} className="text-blue-700 font-black text-sm hover:underline">
                      {item.totalQty} {item.unit} <i className="fa-solid fa-chevron-right text-[10px] ml-1"></i>
                   </button>
                </td>
                <td className="text-center"><span className="text-[10px] text-slate-400 font-bold uppercase italic cursor-pointer">Click Qty</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Pagination - Image 7 */}
        <div className="p-4 border-t flex justify-center items-center gap-2">
           <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(v => v-1)}>Prev</button>
           <span className="text-xs font-bold text-slate-400 uppercase">Page {currentPage}</span>
           <button className="page-btn active-page" onClick={() => {}}>1</button>
           <button className="page-btn" disabled={paginated.length < itemsPerPage} onClick={() => setCurrentPage(v => v+1)}>Next</button>
        </div>
      </div>

      {/* Stock Summary Modal - Image 6 */}
      {showSummary && (
        <div className="fixed inset-0 z-[100] modal-overlay flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-scale-in">
              <div className="p-4 border-b bg-indigo-50 flex justify-between items-center">
                 <h3 className="font-black text-[#00205B] uppercase">Total Stock Summary (All Zones)</h3>
                 <button onClick={() => setShowSummary(false)} className="text-slate-400">✕</button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                       <tr><th className="p-4">Category</th><th className="p-4">Sub-Category</th><th className="p-4 text-right">Total Qty</th></tr>
                    </thead>
                    <tbody className="divide-y text-[11px] font-bold uppercase">
                       {groupedData.slice(0,15).map((s,i) => (
                         <tr key={i} className="hover:bg-slate-50">
                            <td className="p-4 text-slate-400">{s.cat}</td>
                            <td className="p-4">{s.item}</td>
                            <td className="p-4 text-right text-indigo-700">{s.totalQty}</td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {/* Zone Breakdown Modal - Image 5 */}
      {breakdown && (
        <div className="fixed inset-0 z-[100] modal-overlay flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-scale-in">
              <div className="p-4 border-b flex justify-between items-center">
                 <div>
                    <h3 className="font-black text-[#00205B] text-lg leading-none">{breakdown.item}</h3>
                    <p className="text-[10px] text-blue-600 font-bold uppercase mt-1">{breakdown.spec}</p>
                 </div>
                 <button onClick={() => setBreakdown(null)}>✕</button>
              </div>
              <div className="p-4">
                 <table className="w-full text-left">
                    <thead className="text-[10px] font-bold text-slate-400 uppercase">
                       <tr className="border-b">
                          <th className="pb-2">Location</th>
                          <th className="pb-2">Engineer</th>
                          <th className="pb-2 text-center">Qty</th>
                          <th className="pb-2 text-center">Action</th>
                       </tr>
                    </thead>
                    <tbody>
                       {breakdown.holders.map((h: any, i: number) => (
                          <tr key={i} className="border-b last:border-0 h-14 text-xs font-bold">
                             <td>{h.holder_unit}</td>
                             <td className="flex items-center gap-2 mt-3 text-slate-500">
                                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px]">{h.holder_name.charAt(0)}</div>
                                {h.holder_name}
                             </td>
                             <td className="text-center font-black">{h.qty} {h.unit}</td>
                             <td className="text-center">
                                {h.holder_uid === profile.id ? <span className="text-[10px] text-green-600 uppercase">Your Zone</span> : 
                                 <button className="text-indigo-600 border border-indigo-100 bg-indigo-50 px-3 py-1 rounded text-[10px] uppercase">Request</button>}
                             </td>
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

// --- 2. MY STORE SECTION (Image 8, 9, 10) ---
function MyStoreSection({ profile, refreshProfile }: { profile: Profile, refreshProfile: () => void }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [isManual, setIsManual] = useState(false);
  const [form, setForm] = useState({ cat: "", sub: "", make: "", model: "", spec: "", qty: 0, unit: "Nos" });

  useEffect(() => { fetchMyItems(); }, [profile]);

  async function fetchMyItems() {
    const { data } = await supabase.from('inventory').select('*').eq('holder_uid', profile.id);
    if (data) setItems(data as InventoryItem[]);
  }

  const handleSave = async () => {
    const itemName = isManual ? form.model : `${form.make} ${form.sub} ${form.model}`.trim();
    const { error } = await supabase.from('inventory').insert([{
      ...form, item: itemName, holder_uid: profile.id, holder_name: profile.name, holder_unit: profile.unit, is_manual: isManual
    }]);
    if (!error) {
      await supabase.from('profiles').update({ item_count: (profile.item_count || 0) + 1 }).eq('id', profile.id);
      refreshProfile(); fetchMyItems(); setShowAdd(false);
    }
  };

  const zeroStockItems = items.filter(i => i.qty <= 0);

  return (
    <div className="space-y-6">
      {/* Zero Stock Warning - Image 8 */}
      {zeroStockItems.length > 0 && (
         <div className="bg-red-50 border border-red-100 p-4 rounded-lg flex items-center gap-3">
            <i className="fa-solid fa-triangle-exclamation text-red-500 text-xl"></i>
            <div>
               <p className="text-sm font-black text-red-700 uppercase">Action Needed: Restock Required</p>
               <p className="text-xs text-red-500 font-bold uppercase">{zeroStockItems.length} items are out of stock. Use the filter to view them.</p>
            </div>
         </div>
      )}

      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase leading-none">My Local Store</h2>
          <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">Managing: <span className="text-blue-900">{profile.unit}</span></p>
        </div>
        <div className="flex gap-2">
           <button className="bg-green-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2"><i className="fa-solid fa-file-csv"></i> Export CSV</button>
           <button onClick={() => setShowAdd(true)} className="bg-[#F37021] text-white px-4 py-2 rounded-lg text-xs font-black uppercase">+ Add New Stock</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full iocl-table">
          <thead>
            <tr><th>Category</th><th>Item Name</th><th>Spec</th><th>Qty</th><th className="text-right">Manage</th></tr>
          </thead>
          <tbody>
            {items.map((i,idx) => (
              <tr key={idx} className="text-xs font-bold h-16 hover:bg-slate-50">
                 <td className="text-slate-400 uppercase">{i.cat}</td>
                 <td className="uppercase">{i.item} <br/><span className="text-[9px] text-blue-600">(You)</span></td>
                 <td>{i.spec}</td>
                 <td className={`${i.qty <= 0 ? 'text-red-500' : 'text-green-600'} font-black text-sm`}>{i.qty} {i.unit}</td>
                 <td className="text-right flex justify-end gap-3 p-4">
                    <button className="text-blue-700 hover:bg-blue-50 p-2 rounded"><i className="fa-solid fa-box-archive text-lg"></i></button>
                    <button className="text-slate-300 hover:bg-red-50 hover:text-red-500 p-2 rounded"><i className="fa-solid fa-edit text-lg"></i></button>
                 </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add New Stock Modal - Image 9 & 10 */}
      {showAdd && (
        <div className="fixed inset-0 z-[100] modal-overlay flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-scale-in">
              <div className="p-4 border-b flex justify-between items-center">
                 <h3 className="font-black text-[#00205B] uppercase">Add New Stock</h3>
                 <button onClick={() => setShowAdd(false)}>✕</button>
              </div>
              <div className="p-8 space-y-4">
                 {/* Manual Entry Toggle */}
                 <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100 mb-6">
                    <div className="flex items-center gap-2 text-[11px] font-black text-amber-700 uppercase">
                       <i className="fa-solid fa-circle-info"></i> Item not in list?
                    </div>
                    <label className="flex items-center cursor-pointer">
                       <span className="mr-2 text-[10px] font-bold uppercase text-slate-500">Manual Entry</span>
                       <input type="checkbox" checked={isManual} onChange={(e) => setIsManual(e.target.checked)} className="w-10 h-5 accent-[#F37021] cursor-pointer" />
                    </label>
                 </div>

                 {!isManual ? (
                   <>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Category</label>
                       <select className="w-full p-2 border rounded-lg text-sm bg-slate-50" onChange={(e) => setForm({...form, cat: e.target.value})}>
                          <option>-- Select --</option>
                          {[...new Set(masterCatalog.map(m => m.cat))].map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Sub Category</label>
                          <select className="w-full p-2 border rounded-lg text-sm bg-slate-50" onChange={(e) => setForm({...form, sub: e.target.value})}>
                             {masterCatalog.filter(m => m.cat === form.cat).map((m, i) => <option key={i} value={m.sub}>{m.sub}</option>)}
                          </select>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Make</label>
                          <select className="w-full p-2 border rounded-lg text-sm bg-slate-50" onChange={(e) => setForm({...form, make: e.target.value})}>
                             {masterCatalog.filter(m => m.sub === form.sub).map((m, i) => <option key={i} value={m.make}>{m.make}</option>)}
                          </select>
                       </div>
                    </div>
                   </>
                 ) : (
                    <input type="text" placeholder="CATEGORY" className="w-full p-3 border rounded-lg uppercase text-sm font-bold bg-slate-50" onChange={(e) => setForm({...form, cat: e.target.value})} />
                 )}
                 
                 <input type="text" placeholder="MODEL" className="w-full p-3 border rounded-lg uppercase text-sm font-bold bg-slate-50" onChange={(e) => setForm({...form, model: e.target.value})} />
                 <input type="text" placeholder="SPECIFICATION" className="w-full p-3 border rounded-lg uppercase text-sm font-bold bg-slate-50" onChange={(e) => setForm({...form, spec: e.target.value})} />
                 
                 <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="QUANTITY" className="w-full p-3 border rounded-lg uppercase text-sm font-bold bg-slate-50" onChange={(e) => setForm({...form, qty: Number(e.target.value)})} />
                    <select className="w-full p-3 border rounded-lg text-sm font-bold" onChange={(e) => setForm({...form, unit: e.target.value})}>
                       <option>Nos</option><option>Mtrs</option><option>Sets</option>
                    </select>
                 </div>
                 <button onClick={handleSave} className="w-full py-4 bg-[#00205B] text-white font-black uppercase rounded-lg text-xs mt-4">
                    {isManual ? 'Save Custom Item' : 'Save Stock'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

// --- AUTH SYSTEM (Image 1, 2, 3) ---
function AuthSystem() {
  const [mode, setMode] = useState<'login'|'register'|'forgot'>('login');
  const [form, setForm] = useState({ email: '', password: '', name: '', unit: '' });

  // Handle Enter key for login
  useEffect(() => {
    const handleEnter = (e: KeyboardEvent) => { if (e.key === 'Enter') handleAuth(); };
    window.addEventListener('keydown', handleEnter);
    return () => window.removeEventListener('keydown', handleEnter);
  }, [form, mode]);

  const handleAuth = async () => {
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
      if (error) alert(error.message);
    } else if (mode === 'register') {
      const { data: allowed } = await supabase.from('allowed_users').select('*').eq('email', form.email).single();
      if (!allowed || allowed.unit !== form.unit) return alert("Unauthorized access.");
      const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password, options: { data: { name: form.name, unit: form.unit } } });
      if (data.user) {
         await supabase.from('profiles').insert([{ id: data.user.id, name: form.name, email: form.email, unit: form.unit }]);
         alert("Registered! Please login."); setMode('login');
      }
    }
  };

  return (
    <div className="fixed inset-0 login-bg flex items-center justify-center p-4">
       <div className="w-full max-w-sm bg-[#1e293b]/90 border border-slate-700/50 rounded-2xl p-10 shadow-2xl backdrop-blur-md">
          <div className="text-center mb-8">
             <img src="https://upload.wikimedia.org/wikipedia/en/thumb/8/8c/Indian_Oil_Logo.svg/1200px-Indian_Oil_Logo.svg.png" className="h-16 mx-auto mb-4" alt="logo" />
             <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Gujarat Refinery</h2>
             <p className="text-[11px] text-[#F37021] font-black uppercase tracking-widest leading-none mt-1">जहाँ प्रगति ही जीवन सार है</p>
             <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase">Spare Setu Portal</p>
          </div>

          <div className="space-y-4">
             <h3 className="text-center text-white font-black uppercase text-sm border-b border-slate-700 pb-2 mb-6">
                {mode === 'login' ? 'Login' : mode === 'register' ? 'Register' : 'Reset Password'}
             </h3>

             {mode === 'register' && (
                <>
                  <input type="text" placeholder="Full Name" className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-bold outline-none focus:border-orange-500" onChange={e => setForm({...form, name: e.target.value})} />
                  <select className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-bold outline-none" onChange={e => setForm({...form, unit: e.target.value})}>
                     <option>Select Your Zone</option>
                     {["OLD SRU & CETP", "RUP - South Block", "GR-I", "DHUMAD"].map(z => <option key={z} value={z}>{z}</option>)}
                  </select>
                </>
             )}

             <input type="email" placeholder={mode === 'forgot' ? "Registered Email" : "Official Email ID"} className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-bold outline-none focus:border-orange-500" onChange={e => setForm({...form, email: e.target.value})} />
             
             {mode !== 'forgot' && (
                <input type="password" placeholder={mode === 'register' ? "Create Password" : "Password"} className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-bold outline-none focus:border-orange-500" onChange={e => setForm({...form, password: e.target.value})} />
             )}

             {mode === 'login' && <p onClick={() => setMode('forgot')} className="text-right text-[10px] font-black text-orange-500 cursor-pointer hover:underline uppercase">Forgot Password?</p>}

             <button onClick={handleAuth} className="w-full py-4 bg-[#F37021] text-white font-black uppercase rounded-lg text-xs tracking-widest hover:bg-orange-600 transition-all shadow-lg shadow-orange-900/20">
                {mode === 'login' ? 'Secure Login →' : mode === 'register' ? 'Register Now' : 'Send OTP'}
             </button>

             <p className="text-center text-slate-500 text-[10px] font-bold uppercase mt-6">
                {mode === 'login' ? "New User? " : "Already have an account? "}
                <span onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-orange-500 cursor-pointer hover:underline ml-1 uppercase">{mode === 'login' ? 'Create Account' : 'Back to Login'}</span>
             </p>

             <div className="mt-8 pt-6 border-t border-slate-700 text-center">
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-1">Developed By</p>
                <p className="text-[10px] text-slate-400 font-black font-hindi">अशोक सैनी • दीपक चौहान • दिव्यांक सिंह राजपूत</p>
             </div>
          </div>
       </div>
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="fixed inset-0 bg-[#0f172a] flex items-center justify-center z-[100]">
      <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}
