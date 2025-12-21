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

  // Modals State
  const [requestItem, setRequestItem] = useState<any>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [reqForm, setReqForm] = useState({ qty: "", comment: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { 
    fetchAll(); 
    lead(); 
  }, []);
  
  const fetchAll = async () => { 
    try { 
      const { data } = await supabase.from("inventory").select("*"); 
      if (data) setItems(data); 
    } catch(e){} 
  };
  
  const lead = async () => { 
    try { 
      const { data } = await supabase.from("profiles").select("unit, item_count"); 
      if (data) {
        const zoneMap: any = {};
        data.forEach(p => {
          if (p.unit) {
            zoneMap[p.unit] = (zoneMap[p.unit] || 0) + (p.item_count || 0);
          }
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

  const exportToCSV = () => {
    const headers = ["Item Name,Category,Sub-Category,Specification,Quantity,Unit,Zone,Holder\n"];
    const rows = filtered.map(i => 
      `"${i.item}","${i.cat}","${i.sub || '--'}","${i.spec}","${i.qty}","${i.unit}","${i.holder_unit}","${i.holder_name}"\n`
    );
    const blob = new Blob([headers + rows.join("")], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SpareSetu_Inventory_${new Date().toLocaleDateString()}.csv`;
    a.click();
  };

  const getSummaryData = () => {
    const summary: any = {};
    items.forEach(i => {
      const key = `${i.cat} > ${i.sub || 'General'}`;
      if (!summary[key]) summary[key] = { cat: i.cat, sub: i.sub || 'General', total: 0 };
      summary[key].total += Number(i.qty);
    });
    return Object.values(summary).sort((a: any, b: any) => a.cat.localeCompare(b.cat));
  };

  const handleSendRequest = async () => {
    if (!reqForm.qty || Number(reqForm.qty) <= 0 || Number(reqForm.qty) > requestItem.qty) { alert("Invalid quantity!"); return; }
    setSubmitting(true);
    try {
        const { error } = await supabase.from("requests").insert([{
            item_id: requestItem.id, item_name: requestItem.item, item_spec: requestItem.spec, item_unit: requestItem.unit, req_qty: Number(reqForm.qty), req_comment: reqForm.comment, from_name: profile.name, from_uid: profile.id, from_unit: profile.unit, to_name: requestItem.holder_name, to_uid: requestItem.holder_uid, to_unit: requestItem.holder_unit, status: 'pending', viewed_by_requester: false
        }]);
        if (!error) { alert("Request Sent!"); setRequestItem(null); setReqForm({ qty: "", comment: "" }); } else alert(error.message);
    } catch (err) { alert("Connection Error!"); }
    setSubmitting(false);
  };

  const filtered = items.filter((i: any) => {
    const matchesSearch = (i.item.toLowerCase().includes(search.toLowerCase()) || i.spec.toLowerCase().includes(search.toLowerCase()));
    const matchesZone = (selZone === "all" || i.holder_unit === selZone);
    const matchesSub = (selSubCat === "all" || i.sub === selSubCat);
    let matchesCat = (selCat === "all" || i.cat === selCat);
    if (selCat === "OUT_OF_STOCK") matchesCat = (i.qty === 0);
    return matchesSearch && matchesZone && matchesCat && matchesSub;
  }).sort((a, b) => {
    if (a.qty === 0 && b.qty !== 0) return 1;
    if (a.qty !== 0 && b.qty === 0) return -1;
    return 0;
  });

  return (
    <div className="space-y-6 animate-fade-in font-roboto font-bold uppercase tracking-tight">
      
      {/* 1. Optimized Zone Leaderboard Banner (Compact Height) */}
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
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-green-400 text-[10px] font-black">{c.total} Items</span>
                      </div>
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

      {/* SEARCH, FILTERS & ACTIONS */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b bg-slate-50/80 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-grow md:w-80"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Search Material Name / Spec..." className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none focus:ring-1 font-bold uppercase" onChange={e=>setSearch(e.target.value)} /></div>
            
            <div className="flex gap-2">
               <button onClick={exportToCSV} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-[10px] font-black shadow-md flex items-center gap-2 hover:opacity-90 transition-opacity"><i className="fa-solid fa-file-excel"></i> Export Sheet</button>
               <button onClick={() => setShowSummary(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-[10px] font-black shadow-md flex items-center gap-2 hover:opacity-90 transition-opacity"><i className="fa-solid fa-chart-bar"></i> Stock Summary</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select className="border rounded-md text-[10px] font-bold p-2 bg-white uppercase outline-none cursor-pointer" onChange={e=>setSelZone(e.target.value)} value={selZone}>
                <option value="all">Filter: All Zones</option>
                {[...new Set(items.map(i => i.holder_unit))].sort().map(z => <option key={z} value={z}>{z}</option>)}
            </select>

            <select className="border rounded-md text-[10px] font-bold p-2 bg-white uppercase outline-none cursor-pointer" onChange={e=>setSelCat(e.target.value)} value={selCat}>
                <option value="all">Category: All</option>
                <option value="OUT_OF_STOCK" className="text-red-600 font-black">!!! OUT OF STOCK !!!</option>
                {[...new Set(items.map(i => i.cat))].sort().map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select className="border rounded-md text-[10px] font-bold p-2 bg-white uppercase outline-none cursor-pointer" onChange={e=>setSelSubCat(e.target.value)} value={selSubCat}>
                <option value="all">Sub-Category: All</option>
                {[...new Set(items.map(i => i.sub).filter(s => s))].sort().map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left tracking-tight font-bold uppercase">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b tracking-widest">
              <tr><th className="p-4 pl-6">Material Detail</th><th className="p-4">Spec</th><th className="p-4">Zone</th><th className="p-4 text-center">Qty</th><th className="p-4 text-center">Action</th></tr>
            </thead>
            <tbody className="divide-y text-sm">
              {filtered.map((i: any, idx: number) => (
                <tr key={idx} className={`hover:bg-slate-50 transition border-b ${i.qty === 0 ? 'bg-red-50/40 opacity-70' : 'bg-white'}`}>
                  <td className="p-4 pl-6 leading-tight">
                    <div className="text-slate-800 font-bold text-[13px] tracking-tight">{i.item}</div>
                    <div className="text-[9px] text-slate-400 mt-1 uppercase">{i.cat} | {i.sub || '--'}</div>
                  </td>
                  <td className="p-4">
                    <span className="bg-white border px-2 py-1 rounded-[4px] text-[10px] text-slate-500 shadow-sm">{i.spec}</span>
                  </td>
                  <td className="p-4 text-[10px] text-slate-600 font-black">{i.holder_unit}</td>
                  <td className="p-4 text-center font-black whitespace-nowrap text-[14px]">
                    {i.qty === 0 ? <span className="text-red-600 animate-pulse">ZERO STOCK</span> : <span>{i.qty} {i.unit}</span>}
                  </td>
                  <td className="p-4 text-center uppercase">
                      {i.holder_uid === profile?.id ? <span className="text-[10px] font-black text-green-600 italic">MY STORE</span> : i.qty === 0 ? <span className="text-[9px] text-slate-400">N/A</span> : <button onClick={()=>setRequestItem(i)} className="bg-[#ff6b00] text-white px-4 py-1.5 rounded-[4px] text-[10px] font-black shadow-sm tracking-widest hover:bg-orange-600 transition-colors">Request</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
                <p className="text-[10px] text-orange-600 font-black uppercase mb-1 tracking-widest">Requesting Material</p>
                <p className="text-sm font-bold text-slate-800">{requestItem.item}</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter">{requestItem.spec}</p>
              </div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity (Available: {requestItem.qty})</label><input type="number" placeholder="Enter Qty" className="w-full mt-1 p-3 border-2 rounded-lg outline-none font-bold text-slate-800 focus:border-orange-500 transition-all" onChange={e=>setReqForm({...reqForm, qty:e.target.value})} /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purpose / Log Comment</label><textarea placeholder="Why do you need this?" className="w-full mt-1 p-3 border-2 rounded-lg outline-none font-bold text-xs h-24 text-slate-800 focus:border-orange-500 transition-all uppercase" onChange={e=>setReqForm({...reqForm, comment:e.target.value})}></textarea></div>
              <button onClick={handleSendRequest} disabled={submitting} className="w-full py-3 bg-[#ff6b00] text-white font-black rounded-xl shadow-lg uppercase tracking-widest disabled:opacity-50 hover:opacity-90 transition-opacity">
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
