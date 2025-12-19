"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { masterCatalog } from "@/lib/masterdata";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

// --- TYPES & INTERFACES ---
interface Profile {
  id: string;
  name: string;
  unit: string;
  item_count: number;
  email: string;
}

interface InventoryItem {
  id: number;
  item: string;
  spec: string;
  qty: number;
  unit: string;
  cat: string;
  sub?: string;
  make?: string;
  model?: string;
  holder_uid: string;
  holder_name: string;
  holder_unit: string;
  is_manual?: boolean;
}

interface RequestItem {
  id: number;
  item_id: number;
  item_name: string;
  item_spec: string;
  item_unit: string;
  req_qty: number;
  req_comment: string;
  from_uid: string;
  from_name: string;
  from_unit: string;
  to_uid: string;
  to_name: string;
  to_unit: string;
  status: string;
}

interface UsageLog {
  id: number;
  timestamp: string;
  item_name: string;
  cat: string;
  qty: number;
  unit: string;
  note: string;
  consumer_name: string;
}

// --- MAIN APP COMPONENT ---
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
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
      setLoading(false);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
    });

    initSession();
    return () => authListener.subscription.unsubscribe();
  }, [fetchProfile]);

  if (loading) return <FullScreenLoader />;
  if (!user) return <AuthSystem />;

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r hidden md:flex flex-col shadow-sm">
        <div className="p-6 border-b bg-slate-50 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <i className="fa-solid fa-bridge text-xl"></i>
          </div>
          <div>
            <h1 className="font-bold text-slate-800 leading-none">SpareSetu</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Inventory v2.0</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {[
            { id: 'search', label: 'Global Search', icon: 'fa-search' },
            { id: 'mystore', label: 'My Local Store', icon: 'fa-warehouse' },
            { id: 'returns', label: 'Returns & Udhaari', icon: 'fa-hand-holding-hand' },
            { id: 'usage', label: 'Usage Logs', icon: 'fa-history' },
            { id: 'analysis', label: 'Analysis', icon: 'fa-chart-bar' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === item.id ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <i className={`fa-solid ${item.icon} w-5`}></i> {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t bg-slate-50">
          <div className="flex items-center gap-3 p-3 bg-white rounded-xl border shadow-sm mb-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
              {profile?.name?.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-[10px] text-slate-400 font-bold uppercase">{profile?.unit}</p>
              <p className="text-xs font-bold text-slate-700 truncate">{profile?.name}</p>
            </div>
          </div>
          <button 
            onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
            className="w-full py-2.5 text-xs text-red-500 font-bold hover:bg-red-50 border border-red-100 rounded-xl transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-[#00205B] text-white p-4 shadow-lg z-10">
          <div className="max-w-6xl mx-auto flex justify-between items-center px-4">
            <div className="flex items-center gap-4">
              <div className="text-left">
                <h2 className="text-lg font-black uppercase tracking-tighter leading-none">Gujarat Refinery</h2>
                <p className="text-[10px] text-blue-300 font-hindi mt-1">जहाँ प्रगति ही जीवन सार है</p>
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className="text-orange-400 text-xs font-black uppercase tracking-widest">Spare Setu Portal</span>
              <span className="text-[10px] text-slate-300 opacity-60">IndianOil Corporation Ltd.</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
            {activeTab === 'search' && profile && <GlobalSearchSection profile={profile} />}
            {activeTab === 'mystore' && profile && <MyStoreSection profile={profile} refreshProfile={() => fetchProfile(user.id)} />}
            {activeTab === 'returns' && profile && <ReturnsSection profile={profile} />}
            {activeTab === 'usage' && profile && <UsageLogsSection profile={profile} />}
            {activeTab === 'analysis' && profile && <AnalysisSection profile={profile} />}
          </div>
        </div>
      </main>
    </div>
  );
}

// --- 1. GLOBAL SEARCH SECTION ---
function GlobalSearchSection({ profile }: { profile: Profile }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [breakdown, setBreakdown] = useState<any>(null);
  const [requestItem, setRequestItem] = useState<InventoryItem | null>(null);
  const [reqQty, setReqQty] = useState(1);
  const [comment, setComment] = useState("");

  const fetchInventory = useCallback(async () => {
    const { data } = await supabase.from('inventory').select('*');
    if (data) setItems(data as InventoryItem[]);
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const grouped = useMemo(() => {
    const map: Record<string, any> = {};
    items.forEach(i => {
      const key = `${i.item}-${i.spec}`.toLowerCase();
      if (!map[key]) map[key] = { ...i, totalQty: 0, holders: [] };
      map[key].totalQty += Number(i.qty);
      map[key].holders.push(i);
    });
    return Object.values(map);
  }, [items]);

  const filtered = grouped.filter((i: any) => 
    i.item.toLowerCase().includes(search.toLowerCase()) || 
    i.spec.toLowerCase().includes(search.toLowerCase())
  );

  const submitRequest = async () => {
    if (!requestItem) return;
    if (reqQty <= 0 || reqQty > requestItem.qty) return alert("Invalid Quantity");
    const { error } = await supabase.from('requests').insert([{
      item_id: requestItem.id,
      item_name: requestItem.item,
      item_spec: requestItem.spec,
      item_unit: requestItem.unit,
      req_qty: reqQty,
      req_comment: comment,
      from_uid: profile.id,
      from_name: profile.name,
      from_unit: profile.unit,
      to_uid: requestItem.holder_uid,
      to_name: requestItem.holder_name,
      to_unit: requestItem.holder_unit,
      status: 'pending'
    }]);
    if (!error) {
      alert("Request Sent Successfully!");
      setRequestItem(null);
    }
  };

  return (
    <div className="space-y-6">
      <Leaderboard />

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
        <i className="fa-solid fa-search text-slate-400 ml-2"></i>
        <input 
          type="text" 
          placeholder="Search by Item Name or Specification..." 
          className="flex-1 outline-none text-sm font-medium"
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider">
            <tr>
              <th className="p-4 pl-8">Item Description</th>
              <th className="p-4">Specification</th>
              <th className="p-4 text-center">Global Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((item: any, idx: number) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                <td className="p-4 pl-8 font-bold text-slate-800">
                  {item.item}
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{item.cat}</div>
                </td>
                <td className="p-4">
                  <span className="bg-white border px-2 py-1 rounded-md text-[11px] font-bold text-slate-600 shadow-sm">{item.spec}</span>
                </td>
                <td className="p-4 text-center">
                  <button 
                    onClick={() => setBreakdown(item)}
                    className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-xs font-black border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                  >
                    {item.totalQty} {item.unit} <i className="fa-solid fa-chevron-right ml-1 text-[10px]"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {breakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-slate-800">{breakdown.item}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase">{breakdown.spec}</p>
              </div>
              <button onClick={() => setBreakdown(null)} className="w-8 h-8 rounded-full hover:bg-slate-200 transition-colors">✕</button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-[10px] font-bold uppercase text-slate-500">
                  <tr><th className="p-4 pl-6">Unit Zone</th><th className="p-4">Engineer</th><th className="p-4 text-center">Qty</th><th className="p-4 pr-6 text-center">Action</th></tr>
                </thead>
                <tbody className="divide-y">
                  {breakdown.holders.map((h: InventoryItem, i: number) => (
                    <tr key={i} className="hover:bg-indigo-50/50">
                      <td className="p-4 pl-6 font-black text-slate-700">{h.holder_unit}</td>
                      <td className="p-4 text-sm text-slate-500 font-medium">{h.holder_name}</td>
                      <td className="p-4 text-center font-black text-indigo-600">{h.qty} {h.unit}</td>
                      <td className="p-4 pr-6 text-center">
                        {h.holder_uid === profile.id ? (
                          <span className="text-[10px] font-black text-green-600 italic uppercase">Your Stock</span>
                        ) : (
                          <button 
                            disabled={h.qty <= 0}
                            onClick={() => setRequestItem(h)}
                            className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md hover:bg-orange-600 disabled:opacity-50"
                          >
                            Borrow
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {requestItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center relative animate-scale-in">
            <h4 className="text-xl font-black text-slate-800 mb-2">Request Material</h4>
            <p className="text-xs text-slate-400 font-bold uppercase mb-6">From: {requestItem.holder_unit}</p>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block text-left mb-1 ml-1">Quantity Required</label>
                <input 
                  type="number" 
                  max={requestItem.qty}
                  className="w-full p-4 border-2 border-slate-100 rounded-2xl text-2xl font-black text-center focus:border-orange-500 outline-none shadow-inner"
                  value={reqQty}
                  onChange={(e) => setReqQty(Number(e.target.value))}
                />
              </div>
              <textarea 
                placeholder="Purpose of requirement..."
                className="w-full p-4 bg-slate-50 rounded-2xl text-sm border-none focus:ring-2 ring-orange-500 min-h-[100px] outline-none"
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="flex gap-3 pt-4">
                <button onClick={() => setRequestItem(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl uppercase text-xs">Cancel</button>
                <button onClick={submitRequest} className="flex-2 py-4 bg-orange-600 text-white font-black rounded-2xl shadow-lg uppercase text-xs hover:bg-orange-700 transition-all">Send Request</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 2. MY STORE SECTION ---
function MyStoreSection({ profile, refreshProfile }: { profile: Profile, refreshProfile: () => void }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [consumeItem, setConsumeItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<any>({ cat: "", sub: "", make: "", model: "", spec: "", qty: 0, is_manual: false, unit: "Nos" });
  const [useQty, setUseQty] = useState(1);
  const [useNote, setUseNote] = useState("");

  const fetchMyInventory = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('inventory').select('*').eq('holder_uid', profile.id).order('id', { ascending: false });
    if (data) setItems(data as InventoryItem[]);
  }, [profile]);

  useEffect(() => {
    fetchMyInventory();
  }, [fetchMyInventory]);

  const handleSave = async () => {
    const itemName = form.is_manual ? form.model : `${form.make} ${form.sub} ${form.model}`.trim();
    const { error } = await supabase.from('inventory').insert([{
      ...form,
      item: itemName,
      holder_uid: profile.id,
      holder_name: profile.name,
      holder_unit: profile.unit
    }]);
    if (!error) {
      await supabase.from('profiles').update({ item_count: (profile.item_count || 0) + 1 }).eq('id', profile.id);
      refreshProfile();
      fetchMyInventory();
      setShowAdd(false);
      setForm({ cat: "", sub: "", make: "", model: "", spec: "", qty: 0, is_manual: false, unit: "Nos" });
    }
  };

  const handleConsume = async () => {
    if (!consumeItem) return;
    if (useQty <= 0 || useQty > consumeItem.qty) return alert("Invalid Qty");
    const newQty = consumeItem.qty - useQty;
    const { error } = await supabase.from('inventory').update({ qty: newQty }).eq('id', consumeItem.id);
    if (!error) {
      await supabase.from('usage_logs').insert([{
        item_id: consumeItem.id,
        item_name: consumeItem.item,
        cat: consumeItem.cat,
        spec: consumeItem.spec,
        qty: useQty,
        unit: consumeItem.unit,
        note: useNote,
        consumer_uid: profile.id,
        consumer_name: profile.name,
        consumer_unit: profile.unit
      }]);
      fetchMyInventory();
      setConsumeItem(null);
    }
  };

  const deleteItem = async (id: number) => {
    if (!confirm("Confirm Delete?")) return;
    const { error } = await supabase.from('inventory').delete().eq('id', id);
    if (!error) {
      await supabase.from('profiles').update({ item_count: Math.max(0, profile.item_count - 1) }).eq('id', profile.id);
      refreshProfile();
      fetchMyInventory();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl border shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">My Local Store</h2>
          <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mt-1">Authorized Zone: {profile?.unit}</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs shadow-xl hover:bg-slate-800 transition-all flex items-center gap-2"
        >
          <i className="fa-solid fa-plus"></i> Add New Stock
        </button>
      </div>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b">
            <tr><th className="p-5 pl-8">Category</th><th className="p-5">Material Description</th><th className="p-5 text-center">Stock</th><th className="p-5 pr-8 text-center">Manage</th></tr>
          </thead>
          <tbody className="divide-y text-sm">
            {items.map(item => (
              <tr key={item.id} className={`${item.qty <= 0 ? 'bg-red-50/30' : 'hover:bg-slate-50'} transition-all border-b border-slate-50`}>
                <td className="p-5 pl-8 text-[10px] font-black text-slate-400 uppercase italic tracking-tighter">{item.cat}</td>
                <td className="p-5">
                  <p className="font-bold text-slate-800 leading-tight">{item.item}</p>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">{item.spec}</span>
                </td>
                <td className="p-5 text-center">
                   <span className={`text-lg font-black tracking-tighter ${item.qty <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>{item.qty} {item.unit}</span>
                </td>
                <td className="p-5 pr-8 flex gap-4 justify-center items-center">
                  <button onClick={() => setConsumeItem(item)} className="text-indigo-600 hover:scale-125 transition-transform"><i className="fa-solid fa-box-open text-lg"></i></button>
                  <button onClick={() => deleteItem(item.id)} className="text-slate-300 hover:text-red-500 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div className="p-20 text-center text-slate-400 italic">No items found in your store.</div>}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 relative my-auto animate-scale-in">
            <button onClick={() => setShowAdd(false)} className="absolute top-4 right-4 text-slate-300 hover:text-slate-500">✕</button>
            <h3 className="text-xl font-black text-slate-800 mb-6 border-b pb-2 uppercase tracking-wide text-center italic">Register Stock</h3>
            
            <div className="flex items-center justify-between bg-orange-50 p-3 rounded-2xl border border-orange-100 mb-6">
               <span className="text-[10px] font-black text-orange-800 uppercase tracking-tighter">Manual Entry?</span>
               <input type="checkbox" className="w-5 h-5 accent-orange-500" onChange={(e) => setForm({...form, is_manual: e.target.checked})} />
            </div>

            <div className="space-y-4">
              {!form.is_manual ? (
                <>
                  <select className="w-full p-3 border rounded-xl bg-slate-50 text-sm font-bold" onChange={(e) => setForm({...form, cat: e.target.value})}>
                    <option value="">Select Category</option>
                    {[...new Set(masterCatalog.map(m => m.cat))].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="w-full p-3 border rounded-xl bg-white text-sm" onChange={(e) => setForm({...form, sub: e.target.value})}>
                    <option value="">Sub Category</option>
                    {masterCatalog.filter(m => m.cat === form.cat).map((m, i) => <option key={i} value={m.sub}>{m.sub}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Make" className="w-full p-3 border rounded-xl text-sm" onChange={(e) => setForm({...form, make: e.target.value})} />
                    <input type="text" placeholder="Model" className="w-full p-3 border rounded-xl text-sm" onChange={(e) => setForm({...form, model: e.target.value})} />
                  </div>
                </>
              ) : (
                <input type="text" placeholder="Material Name" className="w-full p-3 border rounded-xl font-bold" onChange={(e) => setForm({...form, model: e.target.value, cat: 'Manual Entry'})} />
              )}
              <input type="text" placeholder="Tech Specification" className="w-full p-3 border rounded-xl text-sm" onChange={(e) => setForm({...form, spec: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="Initial Qty" className="w-full p-4 bg-indigo-50 border-none rounded-2xl text-center text-xl font-black" onChange={(e) => setForm({...form, qty: Number(e.target.value)})} />
                <select className="w-full p-3 border rounded-xl bg-white font-bold text-center" onChange={(e) => setForm({...form, unit: e.target.value})}>
                   <option>Nos</option><option>Mtrs</option><option>Sets</option>
                </select>
              </div>
              <button onClick={handleSave} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-xs mt-4">Save to Local Store</button>
            </div>
          </div>
        </div>
      )}

      {consumeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center animate-scale-in">
            <h3 className="text-xl font-black text-slate-800 mb-2">Consume Material</h3>
            <p className="text-xs font-bold text-indigo-600 mb-6 uppercase tracking-tighter">{consumeItem.item}</p>
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-3xl border-2 border-dashed border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Stock Availability</p>
                <p className="text-4xl font-black text-slate-800">{consumeItem.qty} {consumeItem.unit}</p>
              </div>
              <input 
                type="number" 
                className="w-full p-5 border-2 border-slate-100 rounded-3xl text-3xl font-black text-center focus:border-indigo-500 outline-none"
                value={useQty}
                onChange={(e) => setUseQty(Number(e.target.value))}
              />
              <textarea 
                placeholder="Job description / Job number..."
                className="w-full p-4 bg-slate-50 rounded-2xl text-sm border-none focus:ring-2 ring-indigo-500 min-h-[80px] outline-none"
                onChange={(e) => setUseNote(e.target.value)}
              />
              <div className="flex gap-2 pt-2">
                <button onClick={() => setConsumeItem(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl text-xs uppercase">Back</button>
                <button onClick={handleConsume} className="flex-2 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg text-xs uppercase">Confirm Use</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 3. RETURNS & UDHAARI SECTION ---
function ReturnsSection({ profile }: { profile: Profile }) {
  const [requests, setRequests] = useState<RequestItem[]>([]);

  const fetchRequests = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('requests').select('*')
      .or(`from_uid.eq.${profile.id},to_uid.eq.${profile.id}`)
      .order('id', { ascending: false });
    if (data) setRequests(data as RequestItem[]);
  }, [profile]);

  useEffect(() => {
    fetchRequests();
    const sub = supabase.channel('requests_change')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => fetchRequests())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchRequests]);

  const handleAction = async (id: number, status: string, item_id: number, qty: number) => {
    if (status === 'approved') {
      const { data: item, error } = await supabase.from('inventory').select('qty').eq('id', item_id).single();

      if (error || !item) {
        return alert("Error checking stock!");
      }

      if (item.qty < qty) {
        return alert("Low Stock!");
      }

      await supabase.from('inventory').update({ qty: item.qty - qty }).eq('id', item_id);
    }
    
    if (status === 'returned') {
      const { data: item } = await supabase.from('inventory').select('qty').eq('id', item_id).single();
      if (!item) return;
      await supabase.from('inventory').update({ qty: item.qty + qty }).eq('id', item_id);
      await supabase.from('requests').delete().eq('id', id);
      fetchRequests();
      return;
    }
    await supabase.from('requests').update({ status }).eq('id', id);
    fetchRequests();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <section className="space-y-4">
        <h3 className="font-black text-red-600 flex items-center gap-2 uppercase tracking-tighter"><i className="fa-solid fa-arrow-right-to-bracket"></i> Borrowed From Units</h3>
        {requests.filter(r => r.from_uid === profile.id).map(r => (
          <div key={r.id} className="bg-white p-5 rounded-2xl border shadow-sm flex justify-between items-center group relative">
            <div>
              <p className="font-bold text-slate-800 text-sm">{r.item_name}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zone: {r.to_unit}</p>
              <p className={`text-[9px] font-black uppercase mt-2 ${r.status === 'approved' ? 'text-green-600' : 'text-orange-500'}`}>{r.status.replace('_', ' ')}</p>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-slate-800 block leading-none">{r.req_qty}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{r.item_unit}</span>
              {r.status === 'approved' && (
                <button 
                  onClick={() => handleAction(r.id, 'return_requested', r.item_id, r.req_qty)}
                  className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase mt-2 border border-red-100 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                >
                  Return
                </button>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h3 className="font-black text-emerald-600 flex items-center gap-2 uppercase tracking-tighter"><i className="fa-solid fa-arrow-up-from-bracket"></i> Lended to Units</h3>
        {requests.filter(r => r.to_uid === profile.id).map(r => (
          <div key={r.id} className="bg-white p-5 rounded-2xl border shadow-sm flex justify-between items-center">
            <div>
              <p className="font-bold text-slate-800 text-sm">{r.item_name}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">To: {r.from_unit} ({r.from_name})</p>
              {r.req_comment && <p className="text-[10px] text-slate-400 italic mt-1">&quot;{r.req_comment}&quot;</p>}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="text-xl font-black text-slate-800">{r.req_qty} <small className="text-[10px]">{r.item_unit}</small></span>
              <div className="flex gap-2">
                {r.status === 'pending' && (
                  <>
                    <button onClick={() => handleAction(r.id, 'approved', r.item_id, r.req_qty)} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase shadow-md">Approve</button>
                    <button onClick={() => handleAction(r.id, 'rejected', 0, 0)} className="bg-slate-200 text-slate-500 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase">Reject</button>
                  </>
                )}
                {r.status === 'return_requested' && (
                  <button onClick={() => handleAction(r.id, 'returned', r.item_id, r.req_qty)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase shadow-lg animate-pulse">Verify Return</button>
                )}
                {r.status === 'approved' && <span className="text-[10px] font-black text-emerald-600 uppercase border border-emerald-100 px-2 py-1 rounded bg-emerald-50">Lended Out</span>}
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

// --- 4. USAGE LOGS SECTION ---
function UsageLogsSection({ profile }: { profile: Profile }) {
  const [logs, setLogs] = useState<UsageLog[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!profile) return;
      const { data } = await supabase.from('usage_logs').select('*')
        .eq('consumer_unit', profile.unit)
        .order('id', { ascending: false });
      if (data) setLogs(data as UsageLog[]);
    };
    fetchLogs();
  }, [profile]);

  return (
    <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
      <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Consumption Records</h2>
        <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-widest">Zone History</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b tracking-wider">
            <tr><th className="p-5 pl-8">Timestamp</th><th className="p-5">Material Details</th><th className="p-5 text-center">Qty</th><th className="p-5 pr-8">Job Note</th></tr>
          </thead>
          <tbody className="divide-y text-sm">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50">
                <td className="p-5 pl-8">
                  <p className="font-black text-slate-600 text-xs leading-none">{new Date(log.timestamp).toLocaleDateString()}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{new Date(log.timestamp).toLocaleTimeString()}</p>
                </td>
                <td className="p-5 font-bold text-slate-800">
                  {log.item_name}
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{log.cat} ({log.consumer_name})</div>
                </td>
                <td className="p-5 text-center font-black text-red-600">-{log.qty} {log.unit}</td>
                <td className="p-5 pr-8 text-xs text-slate-400 italic max-w-xs truncate">&quot;{log.note || 'No Job Note'}&quot;</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <div className="p-20 text-center text-slate-400 italic">No records found.</div>}
      </div>
    </div>
  );
}

// --- 5. ANALYSIS SECTION ---
function AnalysisSection({ profile }: { profile: Profile }) {
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
      const { data } = await supabase.from('usage_logs').select('cat, qty').eq('consumer_unit', profile.unit);
      if (data) {
        const stats: Record<string, number> = {};
        data.forEach((d: any) => {
          stats[d.cat] = (stats[d.cat] || 0) + Number(d.qty);
        });
        setChartData({
          labels: Object.keys(stats),
          datasets: [{
            label: 'Qty Consumed',
            data: Object.values(stats),
            backgroundColor: 'rgba(79, 70, 229, 0.6)',
            borderColor: 'rgb(79, 70, 229)',
            borderWidth: 2,
            borderRadius: 12
          }]
        });
      }
    };
    if (profile) fetchAnalysis();
  }, [profile]);

  if (!chartData) return <div className="text-center p-20 text-slate-400 italic">Calculating Analysis...</div>;

  return (
    <div className="bg-white p-8 rounded-3xl border shadow-sm">
      <h2 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter">Unit Consumption Analysis</h2>
      <div className="h-[400px]">
        <Bar 
          data={chartData} 
          options={{ 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { 
              legend: { display: false },
              datalabels: { color: '#4f46e5', font: { weight: 'bold' }, anchor: 'end', align: 'top' }
            },
            scales: {
              y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { weight: 'bold' } } },
              x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' } } }
            }
          }} 
        />
      </div>
    </div>
  );
}

// --- HELPERS ---
function Leaderboard() {
  const [top, setTop] = useState<any[]>([]);
  useEffect(() => {
    const fetchLead = async () => {
      const { data } = await supabase.from('profiles').select('name, unit, item_count').order('item_count', { ascending: false }).limit(3);
      if (data) setTop(data);
    };
    fetchLead();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {top.map((u, i) => (
        <div key={i} className="bg-white p-4 rounded-2xl border-2 border-slate-50 shadow-sm flex items-center gap-4 relative overflow-hidden group">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-white shadow-lg ${i === 0 ? 'bg-yellow-500 ring-4 ring-yellow-100' : 'bg-slate-700'}`}>
            {u.name.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-slate-800 leading-tight">{u.name}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">{u.unit}</p>
            <p className="text-[11px] font-black text-orange-600 uppercase mt-1 tracking-tighter">{u.item_count} Items Added</p>
          </div>
          {i === 0 && <i className="fa-solid fa-crown absolute -right-2 -top-2 text-yellow-100 text-6xl opacity-40 group-hover:rotate-12 transition-transform"></i>}
        </div>
      ))}
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="fixed inset-0 bg-[#0f172a] flex flex-col items-center justify-center z-[100]">
      <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-6 shadow-2xl"></div>
      <p className="text-white text-xs font-black uppercase tracking-[0.5em] animate-pulse">SpareSetu Loading...</p>
    </div>
  );
}

function AuthSystem() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ email: '', password: '', name: '', unit: '' });
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    setLoading(true);
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
      if (error) alert(error.message);
    } else {
      const { data: allowed } = await supabase.from('allowed_users').select('*').eq('email', form.email).single();
      if (!allowed) {
        alert("This Official Email ID is not authorized for SpareSetu access.");
        setLoading(false);
        return;
      }
      if (allowed.unit !== form.unit) {
        alert("Zone mismatch. Please select the correct zone assigned to your email.");
        setLoading(false);
        return;
      }
      
      const { data: authUser, error: signUpError } = await supabase.auth.signUp({ 
        email: form.email, 
        password: form.password,
        options: { data: { name: form.name, unit: form.unit } }
      });

      if (signUpError) {
        alert(signUpError.message);
      } else if (authUser.user) {
        const { error: profileError } = await supabase.from('profiles').insert([{
          id: authUser.user.id,
          name: form.name,
          email: form.email,
          unit: form.unit
        }]);
        if (profileError) alert("Profile creation failed: " + profileError.message);
        else alert("Account created! Please login.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-[#0f172a] flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 md:p-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-orange-600"></div>
        
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-orange-600 text-3xl mx-auto mb-4 shadow-inner">
            <i className="fa-solid fa-user-shield"></i>
          </div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Gujarat Refinery</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">IndianOil Corporation Ltd.</p>
        </div>

        <div className="space-y-4">
          {mode === 'register' && (
            <>
              <div className="relative group">
                <i className="fa-solid fa-id-card absolute left-4 top-4 text-slate-300 group-focus-within:text-orange-600 transition-colors"></i>
                <input 
                  type="text" 
                  placeholder="Full Name" 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 ring-orange-500 outline-none" 
                  onChange={(e) => setForm({...form, name: e.target.value})}
                />
              </div>
              <div className="relative group">
                <i className="fa-solid fa-building absolute left-4 top-4 text-slate-300 group-focus-within:text-orange-600 transition-colors"></i>
                <select 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 ring-orange-500 outline-none appearance-none"
                  onChange={(e) => setForm({...form, unit: e.target.value})}
                >
                  <option value="">Select Your Unit Zone</option>
                  {[
                    "RUP - South Block", "RUP - North Block", "LAB", "MSQU", "AU-5", "BS-VI", 
                    "GR-II & NBA", "GR-I", "OM&S", "OLD SRU & CETP", "Electrical Planning", 
                    "Electrical Testing", "Electrical Workshop", "FCC", "GRE", "CGP-I", 
                    "CGP-II & TPS", "Water Block & Bitumen", "Township - Estate Office", 
                    "AC Section", "GHC", "DHUMAD"
                  ].map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
            </>
          )}
          <div className="relative group">
            <i className="fa-solid fa-at absolute left-4 top-4 text-slate-300 group-focus-within:text-orange-600 transition-colors"></i>
            <input 
              type="email" 
              placeholder="Official Email ID" 
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 ring-orange-500 outline-none" 
              onChange={(e) => setForm({...form, email: e.target.value})}
            />
          </div>
          <div className="relative group">
            <i className="fa-solid fa-lock absolute left-4 top-4 text-slate-300 group-focus-within:text-orange-600 transition-colors"></i>
            <input 
              type="password" 
              placeholder="Account Password" 
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 ring-orange-500 outline-none" 
              onChange={(e) => setForm({...form, password: e.target.value})}
            />
          </div>

          <button 
            disabled={loading}
            onClick={handleAuth}
            className="w-full h-16 bg-slate-900 text-white font-black rounded-3xl shadow-xl uppercase tracking-widest text-xs mt-6 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
          >
            {loading ? "Verifying..." : mode === 'login' ? "Secure Access Login →" : "Create My Account"}
          </button>
          
          <button 
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="w-full text-center text-slate-400 text-[10px] font-black uppercase tracking-widest mt-6 hover:text-orange-600 transition-colors"
          >
            {mode === 'login' ? "New User? Register Now" : "Back to Login"}
          </button>

          <div className="mt-8 pt-8 border-t border-slate-50 text-center">
            <p className="text-[9px] text-slate-300 font-bold uppercase tracking-[0.2em] mb-2 leading-none">Developed By</p>
            <p className="text-[11px] text-slate-400 font-bold font-hindi">अशोक सैनी • दीपक चौहान • दिव्यांक सिंह राजपूत</p>
          </div>
        </div>
      </div>
    </div>
  );
}
