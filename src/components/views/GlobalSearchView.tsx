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
  const [selStock, setSelStock] = useState("all");

  // Pagination & Drill-down State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [bifurcateItem, setBifurcateItem] = useState<any>(null); 
  const [expandedZone, setExpandedZone] = useState<string | null>(null); 
  const [requestItem, setRequestItem] = useState<any>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [reqForm, setReqForm] = useState({ qty: "", comment: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  // RESTORED: Leaderboard logic with non-zero check
  useEffect(() => {
    if (items.length > 0) {
      const zoneMap: any = {};
      items.forEach(i => {
        if (Number(i.qty) > 0) {
          zoneMap[i.holder_unit] = (zoneMap[i.holder_unit] || 0) + 1;
        }
      });
      const sortedZones = Object.keys(zoneMap).map(unit => ({ unit, total: zoneMap[unit] })).sort((a, b) => b.total - a.total).slice(0, 4);
      setContributors(sortedZones);
    }
  }, [items]);

  useEffect(() => { setCurrentPage(1); }, [search, selZone, selCat, selSubCat, selStock]);

  const fetchAll = async () => { 
    try { 
      const { data } = await supabase.from("inventory").select("*"); 
      if (data) setItems(data); 
    } catch(e){} 
  };

  const formatTS = (ts: any) => new Date(Number(ts)).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

  // RESTORED: Export to Sheet functionality
  const exportToSheet = () => {
    const groupedForExport = getGroupedData(true); 
    const headers = ["Material", "Specification", "Make", "Model", "Total Qty", "Unit", "Category", "Sub-Category", "Mode"];
    const rows = groupedForExport.map((i: any) => [
      `"${i.item || ''}"`, `"${i.spec || ''}"`, `"${i.make || ''}"`, `"${i.model || ''}"`, i.totalQty, `"${i.unit || ''}"`, `"${i.cat || ''}"`, `"${i.sub || ''}"`, i.is_manual ? "Manual" : "Catalog"
    ]);
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Global_Stock_Report_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getGroupedData = (ignoreStockFilter = false) => {
    const filtered = items.filter((i: any) => {
      const matchesSearch = (i.item.toLowerCase().includes(search.toLowerCase()) || i.spec.toLowerCase().includes(search.toLowerCase()));
      const matchesZone = (selZone === "all" || i.holder_unit === selZone);
      const matchesSub = (selSubCat === "all" || i.sub === selSubCat);
      let matchesCat = (selCat === "all" || i.cat === selCat);
      if (selCat === "OUT_OF_STOCK") matchesCat = true; 
      return matchesSearch && matchesZone && matchesCat && matchesSub;
    });

    const groups: any = {};
    filtered.forEach(item => {
      const key = `${item.item}-${item.spec}-${item.make}-${item.model}-${item.unit}`.toLowerCase();
      if (!groups[key]) { groups[key] = { ...item, totalQty: 0, occurrences: [], latestTS: 0 }; }
      groups[key].totalQty += Number(item.qty);
      groups[key].occurrences.push(item);
      const itemTS = Number(item.timestamp) || 0;
      if (itemTS > groups[key].latestTS) groups[key].latestTS = itemTS;
    });

    let result = Object.values(groups);
    if (selCat === "OUT_OF_STOCK") result = result.filter((g: any) => g.totalQty === 0);
    else if (!ignoreStockFilter && selStock === "out") result = result.filter((g: any) => g.totalQty <= 0);
    else if (!ignoreStockFilter && selStock === "available") result = result.filter((g: any) => g.totalQty > 0);
    
    // SORTING LOGIC: NON-ZERO FIRST, THEN LATEST TIMESTAMP
    return result.sort((a: any, b: any) => {
        if (a.totalQty > 0 && b.totalQty === 0) return -1;
        if (a.totalQty === 0 && b.totalQty > 0) return 1;
        return b.latestTS - a.latestTS;
    });
  };

  const groupedItems = getGroupedData();
  const totalPages = Math.ceil(groupedItems.length / itemsPerPage) || 1;
  const currentItems = groupedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // RESTORED: Summary logic respects Zone Filter & Only Non-Zero
  const getSummaryData = () => {
    const summary: any = {};
    const itemsForSummary = items.filter(i => (selZone === "all" || i.holder_unit === selZone));
    itemsForSummary.forEach(i => {
      if (Number(i.qty) > 0) {
        const key = `${i.cat} > ${i.sub}`;
        if (!summary[key]) summary[key] = { cat: i.cat, sub: i.sub, total: 0, unit: i.unit || 'Nos' };
        summary[key].total += Number(i.qty);
      }
    });
    return Object.values(summary).sort((a: any, b: any) => a.cat.localeCompare(b.cat));
  };

  const handleSendRequest = async () => {
    if (!reqForm.qty || Number(reqForm.qty) <= 0 || Number(reqForm.qty) > requestItem.qty) { alert("Invalid quantity!"); return; }
    setSubmitting(true);
    try {
        const initialTxnId = `#TXN-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*99)}`;
        const { error } = await supabase.from("requests").insert([{
            txn_id: initialTxnId,
            item_id: requestItem.id, item_name: requestItem.item, item_spec: requestItem.spec, item_unit: requestItem.unit, req_qty: Number(reqForm.qty), req_comment: reqForm.comment, from_name: profile.name, from_uid: profile.id, from_unit: profile.unit, to_name: requestItem.holder_name, to_uid: requestItem.holder_uid, to_unit: requestItem.holder_unit, status: 'pending', viewed_by_requester: false
        }]);
        if (!error) { alert("Request Sent!"); setRequestItem(null); setReqForm({ qty: "", comment: "" }); }
    } catch (err) { alert("Error!"); }
    setSubmitting(false);
  };

  // RESTORED: Page Number generation logic
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else {
      if (currentPage <= 3) pages.push(1, 2, 3, '...', totalPages);
      else if (currentPage >= totalPages - 2) pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
      else pages.push(1, '...', currentPage, '...', totalPages);
    }
    return pages;
  };

  return (
    <div className="space-y-6 animate-fade-in font-roboto font-bold uppercase tracking-tight">
      {/* ZONE LEADERBOARD SECTION */}
      <section className="bg-slate-900 py-4 px-6 rounded-2xl border-b-4 border-orange-500 shadow-2xl overflow-hidden text-white">
        <div className="relative z-10 flex flex-col lg:flex-row items-center gap-6">
            <h2 className="text-lg font-black tracking-widest leading-none shrink-0"><i className="fa-solid fa-trophy text-orange-400 mr-2"></i> ZONE LEADERBOARD</h2>
            <div className="flex gap-3 overflow-x-auto no-scrollbar w-full py-1">
                {contributors.map((c, idx) => (
                    <div key={idx} className="min-w-[180px] flex-1 bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs border border-orange-500/30"><i className="fa-solid fa-shield-halved"></i></div>
                        <div className="flex-1 truncate">
                            <p className="text-[12px] font-black truncate">{c.unit}</p>
                            <p className="text-green-400 text-[10px] font-black">{c.total} Items</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* FILTER & SEARCH PANEL */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b bg-slate-50/80 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-grow md:w-80"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Search Material..." className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none font-black uppercase" value={search} onChange={e=>setSearch(e.target.value)} /></div>
            <div className="flex gap-2">
              <button onClick={() => setShowSummary(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-[10px] font-black shadow-md flex items-center gap-2 uppercase tracking-widest hover:bg-indigo-700 transition-all"><i className="fa-solid fa-chart-pie"></i> Stock Summary</button>
              <button onClick={exportToSheet} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-[10px] font-black shadow-md flex items-center gap-2 uppercase tracking-widest hover:bg-emerald-700 transition-all"><i className="fa-solid fa-file-excel"></i> Export to Sheet</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <select className="border rounded-md text-[10px] font-bold p-2 uppercase bg-white cursor-pointer" onChange={e=>setSelZone(e.target.value)} value={selZone}><option value="all">All Zones</option>{[...new Set(items.map(i => i.holder_unit))].sort().map(z => <option key={z} value={z}>{z}</option>)}</select>
            <select className="border rounded-md text-[10px] font-bold p-2 uppercase bg-white cursor-pointer" onChange={e=> {setSelCat(e.target.value); setSelSubCat("all");}} value={selCat}><option value="all">Category: All</option><option value="OUT_OF_STOCK" className="text-red-600 font-black">!!! OUT OF STOCK !!!</option>{[...new Set(items.map(i => i.cat))].sort().map(c => <option key={c} value={c}>{c}</option>)}</select>
            <select disabled={selCat === "all" || selCat === "OUT_OF_STOCK"} className="border rounded-md text-[10px] font-bold p-2 uppercase bg-white cursor-pointer disabled:opacity-50" onChange={e=>setSelSubCat(e.target.value)} value={selSubCat}><option value="all">Sub-Category: All</option>{[...new Set(items.filter(i => i.cat === selCat).map(i => i.sub).filter(s => s))].sort().map(s => <option key={s} value={s}>{s}</option>)}</select>
            <select className="border rounded-md text-[10px] font-bold p-2 uppercase bg-white cursor-pointer" onChange={e=>setSelStock(e.target.value)} value={selStock}><option value="all">Stock: All</option><option value="available">Available Only</option><option value="out">Out of Stock</option></select>
          </div>
        </div>

        {/* TABLE SECTION */}
        <div className="overflow-x-auto"><table className="w-full text-left font-bold uppercase tracking-tighter">
            <thead className="bg-slate-50 text-slate-500 text-[10px] border-b tracking-widest"><tr><th className="p-4 pl-6">Material Detail</th><th className="p-4">Spec Details</th><th className="p-4 text-center">Refinery Stock</th><th className="p-4 text-center">Status</th><th className="p-4 text-center">Action</th></tr></thead>
            <tbody className="divide-y text-sm">
              {currentItems.map((group: any, idx: number) => (
                <tr key={idx} className={`hover:bg-slate-50 transition border-b group cursor-pointer ${group.totalQty === 0 ? 'bg-red-50/30' : ''}`} onClick={()=>{setBifurcateItem(group); setExpandedZone(null);}}>
                  <td className="p-4 pl-6 leading-tight"><div className="text-slate-800 font-bold text-[14px] flex items-center gap-2">{group.item}{group.is_manual && <span className="bg-orange-100 text-orange-600 text-[8px] px-1.5 py-0.5 rounded font-black border border-orange-200">M</span>}</div><div className="text-[10px] text-slate-400 mt-1 uppercase font-bold">{group.cat} &gt; {group.sub}</div></td>
                  <td className="p-4 font-mono"><span className="bg-white border px-2 py-1 rounded-[4px] text-[10.5px] text-slate-600 font-bold shadow-sm inline-block">{group.make} | {group.model} | {group.spec}</span></td>
                  <td className={`p-4 text-center font-bold text-[16px] whitespace-nowrap ${group.totalQty === 0 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>{group.totalQty === 0 ? "ZERO STOCK" : `${group.totalQty} ${group.unit}`}</td>
                  <td className="p-4 text-center"><span className={`px-2 py-0.5 rounded text-[9px] font-black ${group.totalQty > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{group.totalQty > 0 ? 'AVAILABLE' : 'OUT OF STOCK'}</span></td>
                  <td className="p-4 text-center"><button className="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-lg text-[10px] font-black border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all uppercase shadow-sm">View Split</button></td>
                </tr>))}
            </tbody></table></div>

        {/* PAGINATION FOOTER */}
        <div className="p-4 bg-slate-50 border-t flex justify-between items-center">
          <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase">Showing {currentItems.length} Materials</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="w-8 h-8 flex items-center justify-center rounded border bg-white disabled:opacity-30 hover:bg-slate-50"><i className="fa-solid fa-chevron-left text-[10px]"></i></button>
            {getPageNumbers().map((p, idx) => (
              <button key={idx} onClick={() => typeof p === 'number' && setCurrentPage(p)} disabled={p === '...'} className={`w-8 h-8 text-[10px] font-black rounded border transition-all ${p === currentPage ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-600 hover:border-slate-400'}`}>{p}</button>
            ))}
            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="w-8 h-8 flex items-center justify-center rounded border bg-white disabled:opacity-30 hover:bg-slate-50"><i className="fa-solid fa-chevron-right text-[10px]"></i></button>
          </div>
        </div>
      </section>

      {/* MODALS */}
      {bifurcateItem && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-scale-in border-t-8 border-indigo-600 uppercase font-bold">
                <div className="p-6 bg-slate-50 flex justify-between items-center border-b font-black"><div><h3 className="text-slate-800 text-lg tracking-tight">{bifurcateItem.item}</h3><p className="text-[10px] text-slate-500 mt-1 uppercase">MAKE: {bifurcateItem.make || '-'} | MODEL: {bifurcateItem.model || '-'} | SPEC: {bifurcateItem.spec || '-'}</p></div><button onClick={()=>setBifurcateItem(null)} className="w-10 h-10 bg-white shadow-sm border rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"><i className="fa-solid fa-xmark text-lg"></i></button></div>
                <div className="p-6 overflow-y-auto max-h-[70vh] space-y-3"><p className="text-[10px] text-slate-400 font-black mb-4 tracking-[0.2em]">ZONE-WISE SPLIT</p>
                    {Object.entries(bifurcateItem.occurrences.filter((o: any) => Number(o.qty) > 0).reduce((acc: any, curr: any) => {
                        if (!acc[curr.holder_unit]) acc[curr.holder_unit] = { total: 0, entries: [] };
                        acc[curr.holder_unit].total += Number(curr.qty);
                        acc[curr.holder_unit].entries.push(curr);
                        return acc;
                    }, {})).map(([zoneName, zoneData]: any) => (
                        <div key={zoneName} className="border-2 border-slate-100 rounded-2xl overflow-hidden">
                            <div onClick={() => setExpandedZone(expandedZone === zoneName ? null : zoneName)} className={`p-4 flex justify-between items-center cursor-pointer transition-all ${expandedZone === zoneName ? 'bg-slate-900 text-white' : 'bg-white text-slate-800 hover:bg-slate-50'}`}>
                                <div className="flex items-center gap-3"><i className={`fa-solid ${expandedZone === zoneName ? 'fa-square-minus' : 'fa-square-plus'} text-[12px] opacity-70`}></i><span className="font-black text-sm tracking-widest">{zoneName}</span></div>
                                <div className="text-right flex items-center gap-4"><div><p className="text-xs font-black">{zoneData.total} {bifurcateItem.unit}</p><p className={`text-[8px] font-bold ${expandedZone === zoneName ? 'text-white/50' : 'text-slate-400'}`}>TOTAL ZONE STOCK</p></div><i className="fa-solid fa-chevron-down text-[8px] opacity-30"></i></div>
                            </div>
                            {expandedZone === zoneName && (
                                <div className="bg-slate-50 p-2 animate-fade-in border-t border-slate-200"><table className="w-full text-left text-[10px] font-bold uppercase"><thead className="text-slate-400 border-b tracking-widest text-[9px]"><tr><th className="p-3">Added By</th><th className="p-3">Time Audit</th><th className="p-3 text-center">Individual Qty</th><th className="p-3 text-center">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{zoneData.entries.map((ent: any, i: number) => (
                                      <tr key={i} className="hover:bg-white transition-colors"><td className="p-3 text-slate-700 font-black"><div className="flex items-center gap-2">{ent.holder_name}{ent.is_manual && <span className="bg-orange-100 text-orange-600 text-[7px] px-1.5 py-0.5 rounded font-black border border-orange-200">M</span>}</div></td><td className="p-3 text-slate-400 text-[9px]">{formatTS(ent.timestamp)}</td><td className="p-3 text-center font-black text-slate-900 text-xs">{ent.qty} {ent.unit}</td><td className="p-3 text-center">{ent.holder_uid === profile?.id ? <span className="text-[9px] text-green-600 font-black">MY ITEM</span> : <button onClick={(e)=>{ e.stopPropagation(); setRequestItem(ent);}} className="bg-[#ff6b00] text-white px-3 py-1 rounded-[4px] text-[9px] font-black tracking-widest shadow-md hover:bg-orange-600 uppercase">Request</button>}</td></tr>))}</tbody></table></div>
                            )}
                        </div>))}
                </div>
            </div>
        </div>
      )}

      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase font-bold">
                <div className="p-6 border-b bg-indigo-50 flex justify-between items-center"><h3 className="font-black text-indigo-900 text-lg tracking-tight uppercase"><i className="fa-solid fa-boxes-stacked mr-2"></i> {selZone === 'all' ? 'Refinery' : `${selZone} Zone`} Stock Summary</h3><button onClick={()=>setShowSummary(false)} className="text-slate-400 hover:text-red-500 transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button></div>
                <div className="p-6 max-h-[60vh] overflow-y-auto font-black uppercase"><table className="w-full text-left text-xs font-bold"><thead className="border-b text-slate-400 uppercase tracking-widest text-[10px]"><tr><th className="pb-3">Category &gt; Sub-Category</th><th className="pb-3 text-right">Balance Total</th></tr></thead><tbody className="divide-y">{getSummaryData().map((s: any, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors"><td className="py-4 text-slate-700 text-[11px]">{s.cat} <i className="fa-solid fa-chevron-right text-[8px] mx-1 opacity-40"></i> {s.sub}</td><td className="py-4 text-right font-black text-indigo-600 text-sm">{s.total} <span className="text-[10px] text-slate-400">{s.unit}</span></td></tr>))}</tbody></table></div>
                <div className="p-4 bg-slate-50 text-center uppercase"><button onClick={()=>setShowSummary(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-all">Close</button></div>
            </div>
        </div>
      )}

      {requestItem && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 uppercase font-black">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center"><h3 className="text-slate-800 text-lg tracking-tight">Raise Request</h3><button onClick={()=>setRequestItem(null)} className="text-slate-400 hover:text-red-500 transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button></div>
            <div className="p-6 space-y-4 font-bold uppercase"><div className="bg-orange-50 p-4 rounded-xl border border-orange-100 shadow-inner leading-tight"><p className="text-[10px] text-orange-600 font-black mb-1 uppercase tracking-widest">Target: {requestItem.holder_name} ({requestItem.holder_unit})</p><p className="text-sm font-bold text-slate-800 leading-tight">{requestItem.item}</p><p className="text-[9px] text-slate-400 mt-1">SPEC: {requestItem.spec}</p></div>
              <div><label className="text-[10px] text-slate-500 mb-1 block uppercase">Requested Qty</label><input type="number" placeholder="Qty" className="w-full p-3 border-2 border-slate-100 rounded-xl font-black text-slate-800 focus:border-orange-500 outline-none" value={reqForm.qty} onChange={e=>setReqForm({...reqForm, qty:e.target.value})} /></div>
              <div><label className="text-[10px] text-slate-500 mb-1 block uppercase">Comment / Purpose</label><textarea placeholder="..." className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-xs h-24 text-slate-800 focus:border-orange-500 outline-none uppercase" value={reqForm.comment} onChange={e=>setReqForm({...reqForm, comment:e.target.value})}></textarea></div>
              <button onClick={handleSendRequest} disabled={submitting} className="w-full py-4 bg-[#ff6b00] text-white rounded-2xl shadow-lg uppercase tracking-[0.2em] text-sm hover:bg-orange-600 transition-all disabled:opacity-50">{submitting ? "Processing..." : "Submit Request"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
