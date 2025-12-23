"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function GlobalSearchView({ profile }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [metaItems, setMetaItems] = useState<any[]>([]); 
  const [totalCount, setTotalCount] = useState(0); 
  const [contributors, setContributors] = useState<any[]>([]);
  const [search, setSearch] = useState(""); 
  const [loading, setLoading] = useState(false);
  const [selZone, setSelZone] = useState("all");
  const [selCat, setSelCat] = useState("all");
  const [selSubCat, setSelSubCat] = useState("all");
  const [selStock, setSelStock] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [bifurcateItem, setBifurcateItem] = useState<any>(null); 
  const [expandedZone, setExpandedZone] = useState<string | null>(null); 
  const [requestItem, setRequestItem] = useState<any>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [reqForm, setReqForm] = useState({ qty: "", comment: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchMetadata = async () => {
    const { data } = await supabase.from("inventory").select("holder_unit, cat, sub, qty");
    if (data) {
      setMetaItems(data);
      const zoneMap: any = {};
      data.forEach(i => { if (Number(i.qty) > 0) zoneMap[i.holder_unit] = (zoneMap[i.holder_unit] || 0) + 1; });
      const sorted = Object.keys(zoneMap).map(unit => ({ unit, total: zoneMap[unit] })).sort((a: any, b: any) => b.total - a.total).slice(0, 3);
      setContributors(sorted);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from("inventory").select("*", { count: "exact" });
      if (search) query = query.or(`item.ilike.%${search}%,spec.ilike.%${search}%`);
      if (selZone !== "all") query = query.eq("holder_unit", selZone);
      if (selCat !== "all" && selCat !== "OUT_OF_STOCK") query = query.eq("cat", selCat);
      if (selCat === "OUT_OF_STOCK" || selStock === "out") query = query.eq("qty", 0);
      else if (selStock === "available") query = query.gt("qty", 0);
      if (selSubCat !== "all") query = query.eq("sub", selSubCat);

      const from = (currentPage - 1) * itemsPerPage;
      const { data, count, error } = await query.range(from, from + itemsPerPage - 1).order("timestamp", { ascending: false });
      if (!error) { setItems(data || []); setTotalCount(count || 0); }
    } catch (e) {} finally { setLoading(false); }
  }, [search, selZone, selCat, selSubCat, selStock, currentPage]);

  useEffect(() => { fetchData(); fetchMetadata(); }, [fetchData]);

  const handleSendRequest = async () => {
    if (!reqForm.qty || Number(reqForm.qty) <= 0 || Number(reqForm.qty) > requestItem.qty) return alert("Invalid Qty!");
    setSubmitting(true);
    try {
        const txnId = `#TXN-${Date.now().toString().slice(-6)}`;
        await supabase.from("requests").insert([{ txn_id: txnId, item_id: requestItem.id, item_name: requestItem.item, item_spec: requestItem.spec, item_unit: requestItem.unit, req_qty: Number(reqForm.qty), req_comment: reqForm.comment, from_name: profile.name, from_uid: profile.id, from_unit: profile.unit, to_name: requestItem.holder_name, to_uid: requestItem.holder_uid, to_unit: requestItem.holder_unit, status: 'pending' }]);
        alert("Request Sent!"); setRequestItem(null); setReqForm({qty:"", comment:""}); fetchData();
    } catch (err) {} finally { setSubmitting(false); }
  };

  const getGroupedData = () => {
    const groups: any = {};
    items.forEach(item => {
      const key = `${item.item}-${item.spec}-${item.make}-${item.model}-${item.unit}`.toLowerCase();
      if (!groups[key]) groups[key] = { ...item, totalQty: 0, occurrences: [], latestTS: 0 };
      groups[key].totalQty += Number(item.qty);
      groups[key].occurrences.push(item);
      if (Number(item.timestamp) > groups[key].latestTS) groups[key].latestTS = Number(item.timestamp);
    });
    return Object.values(groups).sort((a: any, b: any) => (a.totalQty > 0 ? -1 : 1) || b.latestTS - a.latestTS);
  };

  return (
    <div className="space-y-6 animate-fade-in font-roboto font-bold uppercase tracking-tight">
      <section className="bg-slate-900 py-4 px-6 rounded-2xl border-b-4 border-orange-500 text-white shadow-2xl">
        <div className="flex flex-col lg:flex-row items-center gap-6">
            <h2 className="text-lg font-black tracking-widest leading-none shrink-0"><i className="fa-solid fa-trophy text-orange-400 mr-2"></i> ZONE LEADERBOARD (TOP 3)</h2>
            <div className="flex gap-3 overflow-x-auto w-full py-1 no-scrollbar">
                {contributors.map((c, idx) => (
                    <div key={idx} className="min-w-[180px] flex-1 bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs border border-orange-500/30">#{idx+1}</div>
                        <div className="flex-1 truncate"><p className="text-[12px] font-black truncate">{c.unit}</p><p className="text-green-400 text-[10px] font-black">{c.total} Items</p></div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b bg-slate-50/80 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-grow md:w-80"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Search Material..." className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none font-black uppercase" value={search} onChange={e=>setSearch(e.target.value)} /></div>
            <div className="flex gap-2">
              <button onClick={() => setShowSummary(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase shadow-md flex items-center gap-2 hover:bg-indigo-700 transition-all"><i className="fa-solid fa-chart-pie"></i> Stock Summary</button>
              <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase shadow-md flex items-center gap-2 hover:bg-emerald-700 transition-all"><i className="fa-solid fa-file-excel"></i> Export</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <select className="border rounded-md text-[10px] font-bold p-2 uppercase bg-white" onChange={e=>setSelZone(e.target.value)} value={selZone}><option value="all">All Zones</option>{[...new Set(metaItems.map(i => i.holder_unit))].sort().map(z => <option key={z} value={z}>{z}</option>)}</select>
            <select className="border rounded-md text-[10px] font-bold p-2 uppercase bg-white" onChange={e=> {setSelCat(e.target.value); setSelSubCat("all");}} value={selCat}><option value="all">Category: All</option><option value="OUT_OF_STOCK" className="text-red-600 font-black">OUT OF STOCK</option>{[...new Set(metaItems.map(i => i.cat))].sort().map(c => <option key={c} value={c}>{c}</option>)}</select>
            <select disabled={selCat === "all" || selCat === "OUT_OF_STOCK"} className="border rounded-md text-[10px] font-bold p-2 uppercase bg-white" onChange={e=>setSelSubCat(e.target.value)} value={selSubCat}><option value="all">Sub-Cat: All</option>{[...new Set(metaItems.filter(i => i.cat === selCat).map(i => i.sub).filter(s => s))].sort().map(s => <option key={s} value={s}>{s}</option>)}</select>
            <select className="border rounded-md text-[10px] font-bold p-2 uppercase bg-white" onChange={e=>setSelStock(e.target.value)} value={selStock}><option value="all">Stock: All</option><option value="available">Available Only</option><option value="out">Out of Stock</option></select>
          </div>
        </div>

        <div className="overflow-x-auto"><table className="w-full text-left font-bold uppercase tracking-tight"><thead className="bg-slate-50 text-slate-500 text-[10px] border-b tracking-widest uppercase"><tr><th className="p-4 pl-6">Material Detail</th><th className="p-4">Spec Details</th><th className="p-4 text-center">Refinery Stock</th><th className="p-4 text-center">Status</th><th className="p-4 text-center">Action</th></tr></thead><tbody className="divide-y text-sm">
              {loading ? <tr><td colSpan={5} className="p-20 text-center animate-pulse text-slate-300">Fetching Data...</td></tr> : 
               getGroupedData().map((group: any, idx: number) => (
                <tr key={idx} className={`hover:bg-slate-50 transition border-b group cursor-pointer ${group.totalQty === 0 ? 'bg-red-50/30' : ''}`} onClick={()=>setBifurcateItem(group)}>
                  <td className="p-4 pl-6 leading-tight"><div className="text-slate-800 font-bold text-[14px]">{group.item}</div><div className="text-[10px] text-slate-400 mt-1 uppercase font-bold">{group.cat} &gt; {group.sub}</div></td>
                  <td className="p-4 font-mono"><span className="bg-white border px-2 py-1 rounded-[4px] text-[10.5px] text-slate-600 font-bold shadow-sm inline-block">{group.make} | {group.model} | {group.spec}</span></td>
                  <td className={`p-4 text-center font-bold text-[16px] whitespace-nowrap ${group.totalQty === 0 ? 'text-red-600' : 'text-slate-800'}`}>{group.totalQty} {group.unit}</td>
                  <td className="p-4 text-center"><span className={`px-2 py-0.5 rounded text-[9px] font-black ${group.totalQty > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{group.totalQty > 0 ? 'AVAILABLE' : 'OUT OF STOCK'}</span></td>
                  <td className="p-4 text-center"><button className="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-lg text-[10px] font-black border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all uppercase shadow-sm">View Split</button></td>
                </tr>))}
            </tbody></table></div>
        <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-[10px]">
          <p className="text-slate-400 font-black tracking-widest uppercase">Total Materials: {totalCount}</p>
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.max(prev - 1, 1)); }} disabled={currentPage === 1} className="w-8 h-8 rounded border bg-white disabled:opacity-30">{"<"}</button>
            <span className="px-2">Page {currentPage} of {Math.ceil(totalCount / itemsPerPage) || 1}</span>
            <button onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalCount / itemsPerPage))); }} disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)} className="w-8 h-8 rounded border bg-white disabled:opacity-30">{">"}</button>
          </div>
        </div>
      </section>

      {/* Bifurcate Modal */}
      {bifurcateItem && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-scale-in border-t-8 border-indigo-600 uppercase font-bold">
                <div className="p-6 bg-slate-50 flex justify-between items-center border-b font-black"><div><h3 className="text-slate-800 text-lg tracking-tight">{bifurcateItem.item}</h3><p className="text-[10px] text-slate-500 mt-1 uppercase">SPEC: {bifurcateItem.spec}</p></div><button onClick={()=>setBifurcateItem(null)} className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-xmark text-xl"></i></button></div>
                <div className="p-6 overflow-y-auto max-h-[70vh] space-y-3">
                    {Object.entries(bifurcateItem.occurrences.filter((o: any) => Number(o.qty) > 0).reduce((acc: any, curr: any) => {
                        if (!acc[curr.holder_unit]) acc[curr.holder_unit] = { total: 0, entries: [] };
                        acc[curr.holder_unit].total += Number(curr.qty);
                        acc[curr.holder_unit].entries.push(curr);
                        return acc;
                    }, {})).map(([zoneName, zoneData]: any) => (
                        <div key={zoneName} className="border-2 border-slate-100 rounded-2xl overflow-hidden">
                            <div onClick={() => setExpandedZone(expandedZone === zoneName ? null : zoneName)} className={`p-4 flex justify-between items-center cursor-pointer transition-all ${expandedZone === zoneName ? 'bg-slate-900 text-white' : 'bg-white text-slate-800 hover:bg-slate-50'}`}>
                                <div className="flex items-center gap-3"><i className={`fa-solid ${expandedZone === zoneName ? 'fa-square-minus' : 'fa-square-plus'} text-[12px]`}></i><span className="font-black text-sm tracking-widest">{zoneName}</span></div>
                                <div className="text-right flex items-center gap-4"><div><p className="text-xs font-black">{zoneData.total} {bifurcateItem.unit}</p><p className="text-[8px] font-bold opacity-50 uppercase">ZONE STOCK</p></div><i className="fa-solid fa-chevron-down text-[8px] opacity-30"></i></div>
                            </div>
                            {expandedZone === zoneName && (
                                <div className="bg-slate-50 p-2 animate-fade-in border-t border-slate-200">
                                  <table className="w-full text-left text-[10px] font-bold uppercase"><thead className="text-slate-400 border-b tracking-widest text-[9px]"><tr><th className="p-3">Added By</th><th className="p-3 text-center">Qty</th><th className="p-3 text-center">Action</th></tr></thead><tbody className="divide-y divide-slate-100">
                                    {zoneData.entries.map((ent: any, i: number) => (<tr key={i} className="hover:bg-white transition-colors"><td className="p-3 text-slate-700 font-black">{ent.holder_name}</td><td className="p-3 text-center font-black text-slate-900 text-xs">{ent.qty} {ent.unit}</td><td className="p-3 text-center">{ent.holder_uid === profile?.id ? <span className="text-[9px] text-green-600 font-black">MY ITEM</span> : <button onClick={(e)=>{ e.stopPropagation(); setRequestItem(ent);}} className="bg-[#ff6b00] text-white px-3 py-1 rounded-[4px] text-[9px] font-black tracking-widest shadow-md uppercase">Request</button>}</td></tr>))}
                                  </tbody></table>
                                </div>
                            )}
                        </div>))}
                </div>
            </div>
        </div>
      )}

      {/* Request Modal */}
      {requestItem && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 uppercase font-black">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center"><h3 className="text-slate-800 text-lg">Raise Request</h3><button onClick={()=>setRequestItem(null)} className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-xmark text-xl"></i></button></div>
            <div className="p-6 space-y-4 font-bold uppercase"><div className="bg-orange-50 p-4 rounded-xl border border-orange-100 leading-tight"><p className="text-[10px] text-orange-600 font-black mb-1 uppercase tracking-widest">Target: {requestItem.holder_name}</p><p className="text-sm font-bold text-slate-800 leading-tight">{requestItem.item}</p></div>
              <div><label className="text-[10px] text-slate-500 mb-1 block">Qty</label><input type="number" className="w-full p-3 border-2 border-slate-100 rounded-xl font-black text-slate-800 outline-none" value={reqForm.qty} onChange={e=>setReqForm({...reqForm, qty:e.target.value})} /></div>
              <div><label className="text-[10px] text-slate-500 mb-1 block">Comment</label><textarea className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-xs h-24 text-slate-800 outline-none uppercase" value={reqForm.comment} onChange={e=>setReqForm({...reqForm, comment:e.target.value})}></textarea></div>
              <button onClick={handleSendRequest} disabled={submitting} className="w-full py-4 bg-[#ff6b00] text-white rounded-2xl shadow-lg uppercase tracking-widest text-sm hover:bg-orange-600 transition-all shadow-md">{submitting ? "Processing..." : "Submit Request"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase font-bold">
                <div className="p-6 border-b bg-indigo-50 flex justify-between items-center"><h3 className="font-black text-indigo-900 text-lg uppercase tracking-tight tracking-widest uppercase"><i className="fa-solid fa-boxes-stacked mr-2"></i> Stock Summary</h3><button onClick={()=>setShowSummary(false)} className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-xmark text-xl"></i></button></div>
                <div className="p-6 max-h-[60vh] overflow-y-auto font-black uppercase"><table className="w-full text-left text-xs font-bold"><thead className="border-b text-slate-400 uppercase tracking-widest text-[10px]"><tr><th className="pb-3">Category &gt; Sub-Category</th><th className="pb-3 text-right">Balance Total</th></tr></thead><tbody className="divide-y">
                  {[...new Set(metaItems.map(i => `${i.cat} > ${i.sub}`))].sort().map((key, idx) => {
                    const [cat, sub] = key.split(' > ');
                    const total = metaItems.filter(i => i.cat === cat && i.sub === sub).reduce((sum, curr) => sum + Number(curr.qty), 0);
                    if (total === 0) return null;
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors"><td className="py-4 text-slate-700 text-[11px]">{cat} <i className="fa-solid fa-chevron-right text-[8px] mx-1 opacity-40"></i> {sub}</td><td className="py-4 text-right font-black text-indigo-600 text-sm">{total} Nos</td></tr>
                    );
                  })}
                </tbody></table></div>
                <div className="p-4 bg-slate-50 text-center uppercase"><button onClick={()=>setShowSummary(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-all uppercase">Close</button></div>
            </div>
        </div>
      )}
    </div>
  );
}
