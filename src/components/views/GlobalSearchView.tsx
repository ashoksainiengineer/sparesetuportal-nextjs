"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function GlobalSearchView({ profile }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [contributors, setContributors] = useState<any[]>([]);
  const [search, setSearch] = useState(""); 
  
  // Filters State
  const [selZone, setSelZone] = useState("all");
  const [selCat, setSelCat] = useState("all");
  const [selSubCat, setSelSubCat] = useState("all");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Modals State
  const [bifurcateItem, setBifurcateItem] = useState<any>(null); // For Drill-down breakdown
  const [requestItem, setRequestItem] = useState<any>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [reqForm, setReqForm] = useState({ qty: "", comment: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { 
    fetchAll(); 
    lead(); 
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selZone, selCat, selSubCat]);
  
  const fetchAll = async () => { 
    try { 
      const { data } = await supabase.from("inventory").select("*"); 
      if (data) setItems(data); 
    } catch(e){} 
  };
  
  // --- 1. ZONE LEADERBOARD LOGIC ---
  const lead = async () => { 
    try { 
      const { data } = await supabase.from("profiles").select("unit, item_count"); 
      if (data) {
        const zoneMap: any = {};
        data.forEach(p => {
          if (p.unit) zoneMap[p.unit] = (zoneMap[p.unit] || 0) + (p.item_count || 0);
        });
        const sortedZones = Object.keys(zoneMap)
          .map(unit => ({ unit, total: zoneMap[unit] }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 4);
        setContributors(sortedZones);
      } 
    } catch(e){} 
  };

  const getRankStyle = (idx: number) => {
    if (idx === 0) return { label: "Legend", color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-400", icon: "fa-crown" };
    if (idx === 1) return { label: "Elite", color: "text-slate-500", bg: "bg-slate-50", border: "border-slate-300", icon: "fa-medal" };
    return { label: "Active", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100", icon: "fa-shield-halved" };
  };

  const formatTS = (ts: any) => new Date(Number(ts)).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

  // --- 2. GLOBAL GROUPING ENGINE ---
  const getGroupedData = () => {
    const filtered = items.filter((i: any) => {
      const matchesSearch = (i.item.toLowerCase().includes(search.toLowerCase()) || i.spec.toLowerCase().includes(search.toLowerCase()));
      const matchesZone = (selZone === "all" || i.holder_unit === selZone);
      const matchesSub = (selSubCat === "all" || i.sub === selSubCat);
      let matchesCat = (selCat === "all" || i.cat === selCat);
      if (selCat === "OUT_OF_STOCK") matchesCat = (i.qty === 0);
      return matchesSearch && matchesZone && matchesCat && matchesSub;
    });

    const groups: any = {};
    filtered.forEach(item => {
      // Grouping key: Item + Cat + Sub + Spec + Unit
      const key = `${item.item}-${item.cat}-${item.sub}-${item.spec}-${item.unit}`.toLowerCase();
      if (!groups[key]) {
        groups[key] = { ...item, totalQty: 0, occurrences: [] };
      }
      groups[key].totalQty += Number(item.qty);
      groups[key].occurrences.push(item);
    });

    return Object.values(groups).sort((a: any, b: any) => b.totalQty - a.totalQty);
  };

  const groupedItems = getGroupedData();
  const totalPages = Math.ceil(groupedItems.length / itemsPerPage) || 1;
  const currentItems = groupedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // --- 3. PAGINATION UI HELPER ---
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) pages.push(1, 2, 3, '...', totalPages);
      else if (currentPage >= totalPages - 2) pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
      else pages.push(1, '...', currentPage, '...', totalPages);
    }
    return pages;
  };

  const handleSendRequest = async () => {
    if (!reqForm.qty || Number(reqForm.qty) <= 0 || Number(reqForm.qty) > requestItem.qty) { alert("Invalid quantity!"); return; }
    setSubmitting(true);
    try {
        const { error } = await supabase.from("requests").insert([{
            item_id: requestItem.id, item_name: requestItem.item, item_spec: requestItem.spec, item_unit: requestItem.unit, req_qty: Number(reqForm.qty), req_comment: reqForm.comment, from_name: profile.name, from_uid: profile.id, from_unit: profile.unit, to_name: requestItem.holder_name, to_uid: requestItem.holder_uid, to_unit: requestItem.holder_unit, status: 'pending', viewed_by_requester: false
        }]);
        if (!error) { alert("Request Sent!"); setRequestItem(null); setReqForm({ qty: "", comment: "" }); }
    } catch (err) { alert("Error!"); }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6 animate-fade-in font-roboto font-bold uppercase tracking-tight">
      
      {/* 1. COMPACT ZONE LEADERBOARD */}
      <section className="bg-slate-900 py-4 px-6 rounded-2xl border-b-4 border-orange-500 shadow-2xl overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
           <i className="fa-solid fa-ranking-star text-7xl text-white"></i>
        </div>
        <div className="relative z-10 flex flex-col lg:flex-row items-center gap-6">
          <div className="shrink-0">
            <h2 className="text-white text-lg font-black flex items-center gap-3 tracking-widest leading-none">
              <i className="fa-solid fa-trophy text-orange-400"></i> ZONE LEADERBOARD
            </h2>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar w-full py-1">
            {contributors.map((c, idx) => {
              const rank = getRankStyle(idx);
              return (
                <div key={idx} className={`min-w-[180px] flex-1 bg-white/5 border ${rank.border} rounded-xl p-3 flex items-center gap-3 hover:bg-white/10 transition-all cursor-default`}>
                   <div className={`w-8 h-8 shrink-0 rounded-lg ${rank.bg} ${rank.color} flex items-center justify-center text-sm shadow-lg`}>
                      <i className={`fa-solid ${rank.icon}`}></i>
                   </div>
                   <div className="flex-1 truncate">
                      <p className="text-white text-[12px] font-black truncate">{c.unit}</p>
                      <div className="flex items-center justify-between mt-0.5"><span className="text-green-400 text-[10px] font-black">{c.total} Items</span></div>
                      <div className="w-full bg-slate-700 h-1 mt-1.5 rounded-full overflow-hidden">
                        <div className="bg-orange-400 h-full transition-all duration-1000" style={{ width: `${contributors[0].total > 0 ? (c.total / contributors[0].total) * 100 : 0}%` }}></div>
                      </div>
                   </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. SEARCH & DEPENDENT FILTERS */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b bg-slate-50/80 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-grow md:w-80"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Search Material..." className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none font-black uppercase" onChange={e=>setSearch(e.target.value)} /></div>
            <button onClick={() => setShowSummary(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-[10px] font-black shadow-md flex items-center gap-2"><i className="fa-solid fa-chart-pie"></i> Summary</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select className="border rounded-md text-[10px] font-bold p-2 bg-white uppercase outline-none" onChange={e=>setSelZone(e.target.value)} value={selZone}>
                <option value="all">Filter: All Zones</option>
                {[...new Set(items.map(i => i.holder_unit))].sort().map(z => <option key={z} value={z}>{z}</option>)}
            </select>
            {/* Category selection resets sub-category */}
            <select className="border rounded-md text-[10px] font-bold p-2 bg-white uppercase outline-none" onChange={e=> {setSelCat(e.target.value); setSelSubCat("all");}} value={selCat}>
                <option value="all">Category: All</option>
                {[...new Set(items.map(i => i.cat))].sort().map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {/* Sub-Category enabled ONLY IF Category is selected */}
            <select 
                disabled={selCat === "all"} 
                className={`border rounded-md text-[10px] font-bold p-2 uppercase outline-none ${selCat === "all" ? 'bg-slate-100 opacity-50 cursor-not-allowed' : 'bg-white cursor-pointer'}`} 
                onChange={e=>setSelSubCat(e.target.value)} 
                value={selSubCat}
            >
                <option value="all">Sub-Category: All</option>
                {[...new Set(items.filter(i => i.cat === selCat).map(i => i.sub).filter(s => s))].sort().map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* 3. GROUPED MATERIAL TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left font-bold uppercase">
            <thead className="bg-slate-50 text-slate-500 text-[10px] border-b tracking-widest">
              <tr><th className="p-4 pl-6">Grouped Material</th><th className="p-4">Specification</th><th className="p-4 text-center">Refinery Stock</th><th className="p-4 text-center">Action</th></tr>
            </thead>
            <tbody className="divide-y text-sm">
              {currentItems.map((group: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50 transition border-b">
                  <td className="p-4 pl-6 leading-tight">
                    <div className="text-slate-800 font-bold text-[13px] tracking-tight">{group.item}</div>
                    <div className="text-[9px] text-slate-400 mt-1 uppercase">{group.cat} | {group.sub || '--'}</div>
                  </td>
                  <td className="p-4"><span className="text-[10px] text-slate-500 border px-2 py-0.5 rounded">{group.spec}</span></td>
                  <td className="p-4 text-center font-black text-[14px] text-indigo-600 leading-none">
                    {group.totalQty} {group.unit}
                    <div className="text-[8px] text-slate-300 mt-1 uppercase">Across {group.occurrences.length} Engineers</div>
                  </td>
                  <td className="p-4 text-center">
                      <button onClick={()=>setBifurcateItem(group)} className="bg-slate-900 text-white px-4 py-1.5 rounded-[4px] text-[10px] font-black shadow-md tracking-widest hover:bg-slate-700">Check Stock</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. PAGINATION TOOLBAR */}
        <div className="p-4 bg-slate-50 border-t flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Showing {currentItems.length} of {groupedItems.length} Groups</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="w-8 h-8 flex items-center justify-center rounded border bg-white disabled:opacity-30 hover:bg-slate-50"><i className="fa-solid fa-chevron-left text-[10px]"></i></button>
            {getPageNumbers().map((p, idx) => (
              <button key={idx} onClick={() => typeof p === 'number' && setCurrentPage(p)} disabled={p === '...'} className={`w-8 h-8 text-[10px] font-black rounded border transition-all ${p === currentPage ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{p}</button>
            ))}
            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="w-8 h-8 flex items-center justify-center rounded border bg-white disabled:opacity-30 hover:bg-slate-50"><i className="fa-solid fa-chevron-right text-[10px]"></i></button>
          </div>
        </div>
      </section>

      {/* DRILL-DOWN MODAL (Bifurcation) */}
      {bifurcateItem && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-scale-in border-t-8 border-indigo-600">
                <div className="p-6 bg-slate-50 flex justify-between items-center border-b">
                    <div>
                        <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{bifurcateItem.item}</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Refinery-Wide Stock Breakdown</p>
                    </div>
                    <button onClick={()=>setBifurcateItem(null)} className="w-10 h-10 bg-white shadow-sm border rounded-full flex items-center justify-center text-slate-400 hover:text-red-500"><i className="fa-solid fa-xmark"></i></button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    <table className="w-full text-left text-xs uppercase font-bold">
                        <thead className="text-slate-400 border-b tracking-widest text-[9px]">
                            <tr><th className="pb-3">Zone (Unit)</th><th className="pb-3">Holder/Engineer</th><th className="pb-3">Qty</th><th className="pb-3">Added At</th><th className="pb-3 text-center">Action</th></tr>
                        </thead>
                        <tbody className="divide-y">
                            {bifurcateItem.occurrences.map((entry: any, i: number) => (
                                <tr key={i} className="hover:bg-slate-50 transition">
                                    <td className="py-4 text-slate-800 font-black">{entry.holder_unit}</td>
                                    <td className="py-4 text-slate-600">{entry.holder_name}</td>
                                    <td className="py-4 text-indigo-600 font-black text-sm">{entry.qty} {entry.unit}</td>
                                    <td className="py-4 text-slate-400 text-[10px]">{formatTS(entry.timestamp)}</td>
                                    <td className="py-4 text-center">
                                        {entry.holder_uid === profile?.id ? 
                                            <span className="text-[9px] text-green-600 font-black">MY ITEM</span> : 
                                            <button onClick={()=>setRequestItem(entry)} className="bg-[#ff6b00] text-white px-3 py-1.5 rounded text-[9px] font-black tracking-widest shadow-md hover:bg-orange-600 transition-colors">Request</button>
                                        }
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {/* REQUEST MODAL */}
      {requestItem && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Raise Request</h3>
              <button onClick={()=>setRequestItem(null)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6 space-y-4 font-bold uppercase">
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                <p className="text-[10px] text-orange-600 font-black uppercase mb-1 tracking-widest">Target: {requestItem.holder_name} ({requestItem.holder_unit})</p>
                <p className="text-sm font-bold text-slate-800">{requestItem.item}</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter">{requestItem.spec}</p>
              </div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity (Available: {requestItem.qty})</label><input type="number" placeholder="Enter Qty" className="w-full mt-1 p-3 border-2 rounded-lg font-bold text-slate-800 focus:border-orange-500 outline-none" onChange={e=>setReqForm({...reqForm, qty:e.target.value})} /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purpose</label><textarea placeholder="Purpose..." className="w-full mt-1 p-3 border-2 rounded-lg font-bold text-xs h-24 text-slate-800 focus:border-orange-500 outline-none uppercase" onChange={e=>setReqForm({...reqForm, comment:e.target.value})}></textarea></div>
              <button onClick={handleSendRequest} disabled={submitting} className="w-full py-3 bg-[#ff6b00] text-white font-black rounded-xl shadow-lg uppercase tracking-widest disabled:opacity-50 hover:opacity-90 transition-opacity">
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STOCK SUMMARY MODAL */}
      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                <div className="p-6 border-b bg-indigo-50 flex justify-between items-center">
                    <h3 className="font-black text-indigo-900 text-lg uppercase tracking-tight"><i className="fa-solid fa-boxes-stacked mr-2"></i> Refinery Stock Summary</h3>
                    <button onClick={()=>setShowSummary(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    <table className="w-full text-left text-xs font-bold uppercase">
                        <thead className="border-b text-slate-400 uppercase">
                          <tr><th className="pb-2">Category &gt; Sub-Category</th><th className="pb-2 text-right">Total Available Stock</th></tr>
                        </thead>
                        <tbody className="divide-y">
                            {getSummaryData().map((s: any, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-3 text-slate-700">{s.cat} <i className="fa-solid fa-chevron-right text-[8px] mx-1 opacity-50"></i> {s.sub}</td>
                                    <td className="py-3 text-right font-black text-indigo-600 text-sm">{s.total} Nos</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 bg-slate-50 text-center"><button onClick={()=>setShowSummary(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Close Summary</button></div>
            </div>
        </div>
      )}
    </div>
  );
}
