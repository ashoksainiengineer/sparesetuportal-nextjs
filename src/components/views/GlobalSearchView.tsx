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

  useEffect(() => { fetchAll(); lead(); }, []);
  
  const fetchAll = async () => { 
    try { const { data } = await supabase.from("inventory").select("*"); if (data) setItems(data); } catch(e){} 
  };
  
  const lead = async () => { 
    try { const { data } = await supabase.from("profiles").select("name, unit, item_count").order("item_count", { ascending: false }).limit(3); if (data) setContributors(data); } catch(e){} 
  };

  // --- FEATURE 2: EXPORT TO SHEET (CSV) ---
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

  // --- FEATURE 3: STOCK SUMMARY LOGIC ---
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

  // --- FEATURE 1 & 4: FILTERING & SORTING ---
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
    <div className="space-y-6 animate-fade-in font-roboto font-bold uppercase">
      {/* Top Contributors Banner */}
      <section className="bg-white p-4 rounded-xl border flex flex-wrap items-center gap-4 shadow-sm">
         <h2 className="text-sm font-bold uppercase text-slate-700 tracking-tight"><i className="fa-solid fa-trophy text-yellow-500 mr-2"></i> Top Contributors</h2>
         <div className="flex gap-3 overflow-x-auto flex-1 pb-1">
           {contributors.map((c, idx) => (
             <div key={idx} className="bg-slate-50 p-2 rounded-lg border flex items-center gap-3 min-w-[180px] shadow-sm">
               <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs border-2 border-orange-400">{c.name.charAt(0)}</div>
               <div><p className="text-xs font-bold text-slate-800 truncate">{c.name}</p><p className="text-[9px] text-slate-400 uppercase">{c.unit}</p><p className="text-[9px] font-bold text-green-600">{c.item_count || 0} Items</p></div>
             </div>
           ))}
         </div>
      </section>

      {/* SEARCH, FILTERS & ACTIONS */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b bg-slate-50/80 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-grow md:w-80"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Search Material Name / Spec..." className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none focus:ring-1 font-bold uppercase" onChange={e=>setSearch(e.target.value)} /></div>
            
            <div className="flex gap-2">
               <button onClick={exportToCSV} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-[10px] font-black shadow-md flex items-center gap-2"><i className="fa-solid fa-file-excel"></i> Export Sheet</button>
               <button onClick={() => setShowSummary(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-[10px] font-black shadow-md flex items-center gap-2"><i className="fa-solid fa-chart-bar"></i> Stock Summary</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select className="border rounded-md text-[10px] font-bold p-2 bg-white uppercase" onChange={e=>setSelZone(e.target.value)} value={selZone}>
                <option value="all">Filter: All Zones</option>
                {[...new Set(items.map(i => i.holder_unit))].sort().map(z => <option key={z} value={z}>{z}</option>)}
            </select>

            <select className="border rounded-md text-[10px] font-bold p-2 bg-white uppercase" onChange={e=>setSelCat(e.target.value)} value={selCat}>
                <option value="all">Category: All</option>
                <option value="OUT_OF_STOCK" className="text-red-600 font-black">!!! OUT OF STOCK !!!</option>
                {[...new Set(items.map(i => i.cat))].sort().map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select className="border rounded-md text-[10px] font-bold p-2 bg-white uppercase" onChange={e=>setSelSubCat(e.target.value)} value={selSubCat}>
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
                      {i.holder_uid === profile?.id ? <span className="text-[10px] font-black text-green-600 italic">MY STORE</span> : i.qty === 0 ? <span className="text-[9px] text-slate-400">N/A</span> : <button onClick={()=>setRequestItem(i)} className="bg-[#ff6b00] text-white px-4 py-1.5 rounded-[4px] text-[10px] font-black shadow-sm tracking-widest">Request</button>}
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
                          {/* FIXED LINE BELOW: Used &gt; instead of > to avoid Vercel build error */}
                          <tr><th className="pb-2">Category &gt; Sub-Category</th><th className="pb-2 text-right">Total Available Stock</th></tr>
                        </thead>
                        <tbody className="divide-y">
                            {getSummaryData().map((s: any, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
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
                <p className="text-[10px] text-slate-400 mt-1 uppercase">{requestItem.spec}</p>
              </div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity (Available: {requestItem.qty})</label><input type="number" placeholder="Enter Qty" className="w-full mt-1 p-3 border rounded-lg outline-none font-bold text-slate-800" onChange={e=>setReqForm({...reqForm, qty:e.target.value})} /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purpose / Log Comment</label><textarea placeholder="Why do you need this?" className="w-full mt-1 p-3 border rounded-lg outline-none font-bold text-xs h-24 text-slate-800" onChange={e=>setReqForm({...reqForm, comment:e.target.value})}></textarea></div>
              <button onClick={handleSendRequest} disabled={submitting} className="w-full py-3 bg-[#ff6b00] text-white font-black rounded-xl shadow-lg uppercase tracking-widest disabled:opacity-50">
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
