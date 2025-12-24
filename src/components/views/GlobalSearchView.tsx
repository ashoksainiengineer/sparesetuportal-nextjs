"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { masterCatalog } from "@/lib/masterdata"; 

export default function GlobalSearchView({ profile }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [metaItems, setMetaItems] = useState<any[]>([]); 
  const [totalCount, setTotalCount] = useState(0); 
  const [contributors, setContributors] = useState<any[]>([]);
  const [search, setSearch] = useState(""); 
  const [debouncedSearch, setDebouncedSearch] = useState(""); 
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

  // --- Speed Optimization ---
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handler);
  }, [search]);

  const uniqueCats = useMemo(() => [...new Set(masterCatalog.map(i => i.cat))].sort(), []);
  const availableSubs = useMemo(() => selCat !== "all" 
    ? [...new Set(masterCatalog.filter(i => i.cat === selCat).map(i => i.sub))].sort()
    : [], [selCat]);

  // --- Leaderboard & Global Metadata ---
  const fetchMetadata = async () => {
    try {
      const { data } = await supabase.from("inventory").select("holder_unit, cat, sub, qty, unit");
      if (data) {
        setMetaItems(data); 
        const zoneMap: any = {};
        data.forEach(i => {
          if (Number(i.qty) > 0) {
            zoneMap[i.holder_unit] = (zoneMap[i.holder_unit] || 0) + 1;
          }
        });
        const sortedZones = Object.keys(zoneMap)
          .map(unit => ({ unit, total: zoneMap[unit] }))
          .sort((a: any, b: any) => b.total - a.total);
        setContributors(sortedZones.slice(0, 3)); 
      }
    } catch (e: any) { console.error("Meta Fetch Error"); } // Corrected spelling to 'catch'
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from("inventory").select("*", { count: "exact" });
      const cleanSearch = debouncedSearch.trim();
      if (cleanSearch) query = query.or(`item.ilike.%${cleanSearch}%,spec.ilike.%${cleanSearch}%`);
      if (selZone !== "all") query = query.eq("holder_unit", selZone);
      if (selCat !== "all" && selCat !== "OUT_OF_STOCK") query = query.eq("cat", selCat);
      if (selSubCat !== "all") query = query.eq("sub", selSubCat);
      if (selCat === "OUT_OF_STOCK" || selStock === "out") query = query.eq("qty", 0);
      else if (selStock === "available") query = query.gt("qty", 0);

      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      const { data, count, error } = await query.range(from, to).order("timestamp", { ascending: false });

      if (error) throw error;
      setItems(data || []);
      setTotalCount(count || 0);
    } catch (e: any) { console.error("Fetch error:", e); }
    finally { setLoading(false); }
  }, [debouncedSearch, selZone, selCat, selSubCat, selStock, currentPage]);

  useEffect(() => { 
    fetchData(); 
    if (metaItems.length === 0) fetchMetadata();
  }, [fetchData]);

  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, selZone, selCat, selSubCat, selStock]);

  const handleSendRequest = async () => {
    if (!reqForm.qty || Number(reqForm.qty) <= 0) { 
        alert("Enter valid quantity!"); 
        return; 
    }
    
    setSubmitting(true);
    
    try {
        // 1. LIVE AVAILABILITY CHECK
        const { data: liveStock, error: invErr } = await supabase
            .from("inventory")
            .select("qty")
            .eq("id", requestItem.id)
            .single();

        if (invErr || !liveStock) {
            alert("Error: This item has been removed from the store!");
            setRequestItem(null);
            return;
        }

        if (Number(reqForm.qty) > liveStock.qty) {
            alert(`Wait! Only ${liveStock.qty} items are left. Someone just consumed/borrowed it.`);
            setReqForm({ ...reqForm, qty: liveStock.qty.toString() });
            return;
        }

        // 2. PROCEED WITH REQUEST: Cleanup duplicate logic and ensure single block
        const initialTxnId = `#TXN-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 99)}`;
        
        const { error } = await supabase.from("requests").insert([{
            txn_id: initialTxnId,
            item_id: requestItem.id,
            item_name: requestItem.item,
            item_spec: requestItem.spec,
            item_unit: requestItem.unit,
            req_qty: Number(reqForm.qty),
            req_comment: reqForm.comment,
            from_name: profile.name,
            from_uid: profile.id,
            from_unit: profile.unit,
            to_name: requestItem.holder_name,
            to_uid: requestItem.holder_uid,
            to_unit: requestItem.holder_unit,
            status: 'pending',
            viewed_by_requester: false
        }]);

        if (error) throw error;

        alert("Request Sent Successfully!"); 
        setRequestItem(null); 
        setReqForm({ qty: "", comment: "" }); 

    } catch (err: any) { 
        console.error("Request Error:", err);
        alert(`Error: ${err.message || "Could not send request"}`); 
    } finally {
        setSubmitting(false);
    }
  };

  const getGroupedData = useMemo(() => {
    const groups: any = {};
    items.forEach(item => {
      const key = `${item.item}-${item.spec}-${item.make}-${item.model}-${item.unit}`.toLowerCase();
      if (!groups[key]) { groups[key] = { ...item, totalQty: 0, occurrences: [], latestTS: 0 }; }
      groups[key].totalQty += Number(item.qty);
      groups[key].occurrences.push(item);
      const itemTS = Number(item.timestamp) || 0;
      if (itemTS > groups[key].latestTS) groups[key].latestTS = itemTS;
    });
    return Object.values(groups).sort((a: any, b: any) => {
        if (a.totalQty > 0 && b.totalQty === 0) return -1;
        if (a.totalQty === 0 && b.totalQty > 0) return 1;
        return b.latestTS - a.latestTS;
    });
  }, [items]);

  const getSummaryData = () => {
    const summary: any = {};
    metaItems.forEach((i: any) => {
      if (Number(i.qty) > 0) {
        const key = `${i.cat} > ${i.sub} (${i.unit})`;
        if (!summary[key]) summary[key] = { cat: i.cat, sub: i.sub, total: 0, unit: i.unit || 'Nos' };
        summary[key].total += Number(i.qty);
      }
    });
    return Object.values(summary).sort((a: any, b: any) => a.cat.localeCompare(b.cat));
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
  const formatTS = (ts: any) => new Date(Number(ts)).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <div className="space-y-6 animate-fade-in font-roboto font-bold uppercase tracking-tight">
      <section className="bg-slate-900 py-4 px-6 rounded-2xl border-b-4 border-orange-500 shadow-2xl overflow-hidden text-white">
        <div className="flex flex-col lg:flex-row items-center gap-6">
            <h2 className="text-lg font-black tracking-widest leading-none shrink-0 uppercase"><i className="fa-solid fa-trophy text-orange-400 mr-2"></i> ZONE LEADERBOARD</h2>
            <div className="flex gap-3 overflow-x-auto no-scrollbar w-full py-1">
                {contributors.map((c, idx) => (
                    <div key={idx} className="min-w-[180px] flex-1 bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs border border-orange-500/30 font-black">#{idx+1}</div>
                        <div className="flex-1 truncate"><p className="text-[12px] font-black truncate uppercase">{c.unit}</p><p className="text-green-400 text-[10px] font-black uppercase">{c.total} Items</p></div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden font-black">
        <div className="p-4 border-b bg-slate-50/80 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-grow md:w-80 font-black"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Search Materials..." className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none font-black uppercase" value={search} onChange={e=>setSearch(e.target.value)} /></div>
            <div className="flex gap-2">
              <button onClick={() => setShowSummary(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase shadow-md flex items-center gap-2 hover:bg-indigo-700 transition-all tracking-widest"><i className="fa-solid fa-chart-pie"></i> Stock Summary</button>
              <button onClick={async () => {
                const { data } = await supabase.from("inventory").select("*");
                if (!data) return;
                const headers = "Material,Specification,Make,Model,Qty,Unit,Category,Sub-Category,Zone\n";
                const rows = data.map((i: any) => `"${i.item}","${i.spec}","${i.make}","${i.model}",${i.qty},"${i.unit}","${i.cat}","${i.sub}","${i.holder_unit}"`).join("\n");
                const link = document.createElement("a");
                link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + headers + rows));
                link.setAttribute("download", `Refinery_Inventory_Report.csv`);
                link.click();
              }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-[10px] font-black shadow-md flex items-center gap-2 hover:bg-emerald-700 transition-all tracking-widest"><i className="fa-solid fa-file-excel"></i> Export to Sheet</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 uppercase">
            <select className="border rounded-md text-[10px] font-bold p-2 uppercase bg-white cursor-pointer" onChange={e=>setSelZone(e.target.value)} value={selZone}><option value="all">All Zones</option>{[...new Set(metaItems.map(i => i.holder_unit))].sort().map(z => <option key={z} value={z}>{z}</option>)}</select>
            <select className="border rounded-md text-[10px] font-bold p-2 uppercase bg-white cursor-pointer" onChange={e=> {setSelCat(e.target.value); setSelSubCat("all");}} value={selCat}>
                <option value="all">Category: All</option>
                <option value="OUT_OF_STOCK" className="text-red-600 font-black">!!! OUT OF STOCK !!!</option>
                {uniqueCats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select disabled={selCat === "all" || selCat === "OUT_OF_STOCK"} className="border rounded-md text-[10px] font-bold p-2 uppercase bg-white disabled:opacity-50 cursor-pointer" onChange={e=>setSelSubCat(e.target.value)} value={selSubCat}><option value="all">Sub-Category: All</option>{availableSubs.map(s => <option key={s} value={s}>{s}</option>)}</select>
            <select className="border rounded-md text-[10px] font-bold p-2 uppercase bg-white cursor-pointer" onChange={e=>setSelStock(e.target.value)} value={selStock}><option value="all">Stock: All</option><option value="available">Available Only</option><option value="out">Out of Stock</option></select>
          </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left font-bold uppercase tracking-tight">
            <thead className="bg-slate-50 text-slate-500 text-[10px] border-b tracking-widest uppercase"><tr><th className="p-4 pl-6 uppercase">Material Detail</th><th className="p-4 uppercase">Spec Details</th><th className="p-4 text-center uppercase">Refinery Stock</th><th className="p-4 text-center uppercase">Status</th><th className="p-4 text-center uppercase">Action</th></tr></thead>
            <tbody className="divide-y text-sm">
              {loading && items.length === 0 ? (
                <tr><td colSpan={5} className="p-20 text-center animate-pulse text-slate-300 font-black uppercase tracking-widest">Connecting Database...</td></tr>
              ) : getGroupedData.map((group: any, idx: number) => (
                <tr key={idx} className={`hover:bg-slate-50 transition border-b group cursor-pointer ${group.totalQty === 0 ? 'bg-red-50/30' : ''}`} onClick={()=>{setBifurcateItem(group); setExpandedZone(null);}}>
                  <td className="p-4 pl-6 leading-tight uppercase font-black"><div className="text-slate-800 font-bold text-[14px] flex items-center gap-2 font-black">{group.item}{group.is_manual && <span className="bg-orange-100 text-orange-600 text-[8px] px-1.5 py-0.5 rounded font-black border border-orange-200">M</span>}</div><div className="text-[10px] text-slate-400 mt-1 uppercase font-black">{group.cat} &gt; {group.sub}</div></td>
                  <td className="p-4 font-mono"><span className="bg-white border px-2 py-1 rounded-[4px] text-[10.5px] text-slate-600 font-bold shadow-sm inline-block font-black">{group.make || '-'} | {group.model || '-'} | {group.spec || '-'}</span></td>
                  <td className={`p-4 text-center font-bold text-[16px] whitespace-nowrap uppercase font-black ${group.totalQty === 0 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>{group.totalQty === 0 ? "ZERO" : `${group.totalQty} ${group.unit}`}</td>
                  <td className="p-4 text-center font-black"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${group.totalQty > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{group.totalQty > 0 ? 'AVAILABLE' : 'OUT'}</span></td>
                  <td className="p-4 text-center">
                    <button className="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-lg text-[10px] font-black border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm uppercase">
                      View Split
                    </button>
                  </td>
                </tr>))}
            </tbody></table>
        </div>

        <div className="p-4 bg-slate-50 border-t flex justify-between items-center font-black">
          <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase">Showing 50 per page | Total: {totalCount}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="w-8 h-8 flex items-center justify-center rounded border bg-white disabled:opacity-30 hover:bg-slate-50 transition-all font-black"><i className="fa-solid fa-chevron-left text-[10px]"></i></button>
            <span className="text-[10px] px-4 font-black uppercase">Page {currentPage} of {totalPages}</span>
            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="w-8 h-8 flex items-center justify-center rounded border bg-white disabled:opacity-30 hover:bg-slate-50 transition-all font-black"><i className="fa-solid fa-chevron-right text-[10px]"></i></button>
          </div>
        </div>
      </section>

      {bifurcateItem && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-scale-in border-t-8 border-indigo-600 uppercase font-bold">
                <div className="p-6 bg-slate-50 flex justify-between items-center border-b font-black uppercase"><div><h3 className="text-slate-800 text-lg font-black">{bifurcateItem.item}</h3><p className="text-[10px] text-slate-500 mt-1">SPEC: {bifurcateItem.spec}</p></div><button onClick={()=>setBifurcateItem(null)} className="w-10 h-10 bg-white shadow-sm border rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors font-black"><i className="fa-solid fa-xmark text-lg"></i></button></div>
                <div className="p-6 overflow-y-auto max-h-[70vh] space-y-3 font-black">
                    {Object.entries(bifurcateItem.occurrences.filter((o: any) => Number(o.qty) > 0).reduce((acc: any, curr: any) => {
                        if (!acc[curr.holder_unit]) acc[curr.holder_unit] = { total: 0, entries: [] };
                        acc[curr.holder_unit].total += Number(curr.qty);
                        acc[curr.holder_unit].entries.push(curr);
                        return acc;
                    }, {})).map(([zoneName, zoneData]: any) => (
                        <div key={zoneName} className="border-2 border-slate-100 rounded-2xl overflow-hidden">
                            <div onClick={() => setExpandedZone(expandedZone === zoneName ? null : zoneName)} className={`p-4 flex justify-between items-center cursor-pointer transition-all ${expandedZone === zoneName ? 'bg-slate-900 text-white' : 'bg-white text-slate-800 hover:bg-slate-50'}`}>
                                <div className="flex items-center gap-3 font-black"><i className={`fa-solid ${expandedZone === zoneName ? 'fa-square-minus' : 'fa-square-plus'} text-[12px] opacity-70`}></i><span className="font-black text-sm tracking-widest">{zoneName}</span></div>
                                <div className="text-right flex items-center gap-4"><div><p className="text-xs font-black">{zoneData.total} {bifurcateItem.unit}</p><p className={`text-[8px] font-bold ${expandedZone === zoneName ? 'text-white/50' : 'text-slate-400'}`}>ZONE STOCK</p></div><i className="fa-solid fa-chevron-down text-[8px] opacity-30"></i></div>
                            </div>
                            {expandedZone === zoneName && (
                                <div className="bg-slate-50 p-2 animate-fade-in border-t border-slate-200">
                                  <table className="w-full text-left text-[10px] font-bold uppercase"><thead className="text-slate-400 border-b tracking-widest text-[9px]"><tr><th className="p-3">Added By</th><th className="p-3">Audit Date</th><th className="p-3 text-center">Qty</th><th className="p-3 text-center">Action</th></tr></thead><tbody className="divide-y divide-slate-100">
                                    {zoneData.entries.map((ent: any, i: number) => (<tr key={i} className="hover:bg-white transition-colors"><td className="p-3 text-slate-700 font-black">{ent.holder_name}{ent.is_manual && <span className="bg-orange-100 text-orange-600 text-[7px] px-1.5 py-0.5 rounded font-black border border-orange-200 ml-2">M</span>}</td><td className="p-3 text-slate-400 text-[9px]">{formatTS(ent.timestamp)}</td><td className="p-3 text-center font-black text-slate-900 text-xs">{ent.qty} {ent.unit}</td><td className="p-3 text-center font-black">{ent.holder_uid === profile?.id ? <span className="text-[9px] text-green-600 font-black uppercase">MY ITEM</span> : <button onClick={(e)=>{ e.stopPropagation(); setRequestItem(ent);}} className="bg-[#ff6b00] text-white px-3 py-1 rounded-[4px] text-[9px] font-black tracking-widest shadow-md hover:bg-orange-600">Request</button>}</td></tr>))}
                                  </tbody></table>
                                </div>
                            )}
                        </div>))}
                </div>
            </div>
        </div>
      )}

      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-6 border-b bg-indigo-50 flex justify-between items-center font-black">
              <h3><i className="fa-solid fa-boxes-stacked mr-2"></i> Refinery Balance Summary</h3>
              <button onClick={() => setShowSummary(false)} className="text-xl">×</button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-xs font-bold uppercase">
                <thead className="border-b text-slate-400 tracking-widest text-[10px]">
                  <tr><th className="pb-3">Category &gt; Sub-Category</th><th className="pb-3 text-right">Total Balance</th></tr>
                </thead>
                <tbody className="divide-y">
                  {getSummaryData().map((s: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 transition border-b">
                      <td className="py-4 text-slate-700">{s.cat} &gt; {s.sub}</td>
                      <td className="py-4 text-right font-black text-indigo-600 text-sm">{s.total} {s.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {requestItem && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[10001] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative animate-scale-in">
            <button onClick={() => setRequestItem(null)} className="absolute top-4 right-4 text-slate-400"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h3 className="text-xl font-black text-slate-800 uppercase mb-6">Request Material</h3>
            <div className="bg-slate-50 p-4 rounded-xl border mb-6 text-xs">
              <p className="font-black text-slate-700">{requestItem.item}</p>
              <p className="text-indigo-600 mt-1 uppercase font-bold">{requestItem.holder_unit} | Balance: {requestItem.qty} {requestItem.unit}</p>
            </div>
            <div className="space-y-4">
              <div><label className="text-[10px] text-slate-500 uppercase mb-1 block">Quantity Needed</label><input type="number" className="w-full p-4 border-2 rounded-2xl font-black text-xl text-center outline-none focus:border-orange-500" value={reqForm.qty} onChange={e => setReqForm({ ...reqForm, qty: e.target.value })} /></div>
              <div><label className="text-[10px] text-slate-500 uppercase mb-1 block">Comment / Purpose</label><textarea className="w-full p-4 border-2 rounded-2xl text-xs h-24 outline-none focus:border-orange-500" placeholder="Why do you need this?" value={reqForm.comment} onChange={e => setReqForm({ ...reqForm, comment: e.target.value })}></textarea></div>
              <button disabled={submitting} onClick={handleSendRequest} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black tracking-widest uppercase hover:bg-black transition-all">Send Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
