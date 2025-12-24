"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { masterCatalog } from "@/lib/masterdata";

export default function MyStoreView({ profile, fetchProfile }: any) {
  const [myItems, setMyItems] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0); 
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false); 
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [bifurcationItem, setBifurcationItem] = useState<any>(null); 
  const [editItem, setEditItem] = useState<any>(null);
  const [consumeItem, setConsumeItem] = useState<any>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(""); 
  const [selCat, setSelCat] = useState("all");
  const [selSub, setSelSub] = useState("all");
  const [selEngineer, setSelEngineer] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [form, setForm] = useState({
    cat: "", sub: "", make: "", model: "", spec: "", qty: "", unit: "Nos", note: "", isManual: false
  });
  const [consumeForm, setConsumeForm] = useState({ qty: "", note: "" });

  const formatTS = (ts: any) => {
    if (!ts) return "--";
    return new Date(Number(ts)).toLocaleString('en-IN', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
  };

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchStore = useCallback(async () => {
    if (!profile?.unit) return;
    setLoading(true);
    try {
      let query = supabase.from("inventory").select("*", { count: "exact" }).eq("holder_unit", profile.unit);
      const cleanSearch = debouncedSearch.trim();
      if (cleanSearch) query = query.or(`item.ilike.%${cleanSearch}%,spec.ilike.%${cleanSearch}%`);
      if (selCat !== "all" && selCat !== "OUT_OF_STOCK") query = query.eq("cat", selCat);
      if (selCat === "OUT_OF_STOCK") query = query.eq("qty", 0);
      if (selSub !== "all") query = query.eq("sub", selSub);
      if (selEngineer !== "all") query = query.eq("holder_name", selEngineer);

      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      const { data, count, error } = await query.range(from, to).order("id", { ascending: false });
      if (error) throw error;
      setMyItems(data || []);
      setTotalCount(count || 0);
    } catch (e: any) { console.error("Fetch failed", e); }
    finally { setLoading(false); }
  }, [profile?.unit, debouncedSearch, selCat, selSub, selEngineer, currentPage]);

  useEffect(() => { fetchStore(); }, [fetchStore]);

  const naturalSort = (arr: string[]) => arr.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const uniqueCats = useMemo(() => naturalSort([...new Set(masterCatalog.map(i => i.cat))]), []);
  const availableSubs = useMemo(() => form.cat ? naturalSort([...new Set(masterCatalog.filter(i => i.cat === form.cat).map(i => i.sub))]) : [], [form.cat]);
  const availableMakes = useMemo(() => (form.cat && form.sub) ? naturalSort([...new Set(masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub).map(i => i.make))]) : [], [form.cat, form.sub]);
  const availableModels = useMemo(() => (form.cat && form.sub && form.make) ? naturalSort([...new Set(masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub && i.make === form.make).map(i => i.model))]) : [], [form.cat, form.sub, form.make]);
  const availableSpecs = useMemo(() => (form.cat && form.sub && form.make && form.model) ? naturalSort([...new Set(masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub && i.make === form.make && i.model === form.model).map(i => i.spec))]) : [], [form.cat, form.sub, form.make, form.model]);
  const filterSubCategories = useMemo(() => selCat !== "all" && selCat !== "OUT_OF_STOCK" ? naturalSort([...new Set(myItems.filter(i => i.cat === selCat).map(i => i.sub))]) : [], [selCat, myItems]);

  useEffect(() => {
    if (form.isManual || editItem) return;
    if (!form.cat && uniqueCats.length === 1) setForm(f => ({ ...f, cat: uniqueCats[0] }));
    else if (form.cat && !form.sub && availableSubs.length === 1) setForm(f => ({ ...f, sub: availableSubs[0] }));
    else if (form.sub && !form.make && availableMakes.length === 1) setForm(f => ({ ...f, make: availableMakes[0] }));
    else if (form.make && !form.model && availableModels.length === 1) setForm(f => ({ ...f, model: availableModels[0] }));
    else if (form.model && !form.spec && availableSpecs.length === 1) setForm(f => ({ ...f, spec: availableSpecs[0] }));
  }, [form.cat, form.sub, form.make, form.model, uniqueCats, availableSubs, availableMakes, availableModels, availableSpecs, form.isManual, editItem]);

  const currentItems = useMemo(() => {
    const grouped = myItems.reduce((acc: any, item: any) => {
        const key = `${item.item || 'N/A'}-${item.spec || 'N/A'}`;
        if (!acc[key]) acc[key] = { ...item, totalQty: 0, records: [] };
        acc[key].totalQty += Number(item.qty || 0);
        acc[key].records.push(item);
        return acc;
      }, {});
    return Object.values(grouped).sort((a: any, b: any) => (a.totalQty > 0 && b.totalQty === 0 ? -1 : a.totalQty === 0 && b.totalQty > 0 ? 1 : 0));
  }, [myItems]);

  const outOfStockCount = useMemo(() => currentItems.filter((i: any) => i.totalQty === 0).length, [currentItems]);
  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;

  const resetForm = () => { setShowAddModal(false); setEditItem(null); setForm({ cat: "", sub: "", make: "", model: "", spec: "", qty: "", unit: "Nos", note: "", isManual: false }); };

  const handleSaveItem = async () => {
    let rawQty = parseFloat(form.qty);
    if (!form.cat || isNaN(rawQty) || rawQty <= 0 || !form.spec) return alert("Kripya details bhariye!");
    const finalQty = (form.unit === "Nos" || form.unit === "Sets") ? Math.round(rawQty) : rawQty;
    setSubmitting(true);
    const itemName = form.isManual ? `${form.make} ${form.model} ${form.spec}`.trim() : `${form.make} ${form.sub} ${form.model}`.trim();
    const payload = { item: itemName, cat: form.cat, sub: form.sub, make: form.make, model: form.model, spec: form.spec, qty: finalQty, unit: form.unit, note: form.note, is_manual: form.isManual, holder_unit: profile.unit, holder_uid: profile.id, holder_name: profile.name, timestamp: editItem ? editItem.timestamp : Date.now() };
    try {
      if (editItem) await supabase.from("inventory").update(payload).eq("id", editItem.id);
      else {
        await supabase.from("inventory").insert([payload]);
        await supabase.from("profiles").update({ item_count: (profile.item_count || 0) + 1 }).eq('id', profile.id);
      }
      resetForm(); await fetchStore(); if(fetchProfile) fetchProfile();
    } catch (e: any) { alert("Save Error"); } finally { setSubmitting(false); }
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm("Permanently delete entry?")) return;
    setSubmitting(true);
    try {
        await supabase.from("inventory").delete().eq("id", id);
        resetForm(); await fetchStore(); if(fetchProfile) fetchProfile();
    } catch (e: any) { alert("Delete failed"); } finally { setSubmitting(false); }
  };

 const handleConsume = async () => {
    if (!profile?.id || !consumeItem) return;
    
    let rawQty = parseFloat(consumeForm.qty);
    if (isNaN(rawQty) || rawQty <= 0) return alert("ERROR: QUANTITY SAHI DAALO!");

    const finalConsumeQty = (consumeItem.unit === "Nos" || consumeItem.unit === "Sets") 
      ? Math.round(rawQty) 
      : rawQty;

    setSubmitting(true); 
    try {
      // 1. LIVE DATA FETCH (Cross-consumption ke liye ID se fetch)
      const { data: live, error: fetchErr } = await supabase
        .from("inventory")
        .select("qty")
        .eq("id", consumeItem.id)
        .single();

      if (fetchErr || !live) throw new Error("ITEM DATABASE MEIN NAHI MILA!");

      if (finalConsumeQty > live.qty) {
        alert(`STOCK SHORTAGE! Sirf ${live.qty} bacha hai.`);
        setSubmitting(false); return;
      }

      // 2. INVENTORY UPDATE (Ye hai Cross-Engineer Logic)
      // Ye command kisi bhi engineer ka item update karegi (bas RLS policy enable honi chahiye)
      const newQty = Number((live.qty - finalConsumeQty).toFixed(3));
      const { error: updErr } = await supabase
        .from("inventory")
        .update({ qty: newQty })
        .eq("id", consumeItem.id);

      if (updErr) {
        // Agar yahan error aaye toh iska matlab RLS update block kar raha hai
        alert("DATABASE ERROR: Stock update fail! RLS check karo.");
        setSubmitting(false); return;
      }

      // 3. USAGE LOGS (Sab items log honge, Manual Tag ke saath)
      await supabase.from("usage_logs").insert([{ 
        item_id: consumeItem.id, 
        item_name: consumeItem.item, 
        cat: consumeItem.cat, 
        sub: consumeItem.sub, 
        spec: consumeItem.spec, 
        qty_consumed: finalConsumeQty, 
        unit: consumeItem.unit, 
        purpose: consumeForm.note, 
        consumer_uid: profile.id, 
        consumer_name: profile.name, 
        consumer_unit: profile.unit, 
        timestamp: Date.now(), 
        make: consumeItem.make || '-', 
        model: consumeItem.model || '-', 
        holder_name: consumeItem.holder_name,
        is_manual: consumeItem.is_manual // Analysis filtering ke liye
      }]);

      // 4. UI REFRESH
      alert("Success: Stock kam ho gaya aur record log ho gaya!");
      setConsumeItem(null); 
      setBifurcationItem(null); 
      setConsumeForm({ qty: "", note: "" });
      await fetchStore(); 

    } catch (e: any) { 
      alert(`System Error: ${e.message}`); 
    } finally { 
      setSubmitting(false); 
    }
  };
       

     

  const exportToSheet = async () => {
    const { data } = await supabase.from("inventory").select("*").eq("holder_unit", profile.unit);
    if (!data) return;
    const headers = "Category,Sub-Cat,Item,Spec,Qty,Unit,Added By,Date,Note\n";
    const rows = data.map((r: any) => `"${r.cat}","${r.sub}","${r.item}","${r.spec}","${r.qty}","${r.unit}","${r.holder_name}","${r.timestamp ? new Date(Number(r.timestamp)).toLocaleDateString() : ''}","${r.note || ''}"`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Zone_Audit.csv`; a.click();
  };

  const getSummaryData = () => {
    const summary: any = {};
    myItems.forEach((i: any) => {
      if (Number(i.qty) > 0) {
        const key = `${i.cat} > ${i.sub} (${i.unit})`;
        if (!summary[key]) summary[key] = { cat: i.cat, sub: i.sub, total: 0, unit: i.unit || 'Nos' };
        summary[key].total += Number(i.qty);
      }
    });
    return Object.values(summary).sort((a: any, b: any) => a.cat.localeCompare(b.cat));
  };

  return (
    <div className="animate-fade-in space-y-6 pb-20 font-roboto font-bold uppercase tracking-tight font-black">
      <div className="bg-white p-6 rounded-xl border shadow-sm flex justify-between items-center border-t-4 border-orange-500 font-black">
        <div><h2 className="text-xl font-black text-slate-800 uppercase tracking-widest leading-none">My Local Store</h2><p className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded mt-2 inline-block uppercase">ZONE: {profile?.unit}</p></div>
      </div>

      {outOfStockCount > 0 && (
        <section className="bg-white rounded-xl border-t-4 border-orange-500 shadow-xl overflow-hidden animate-fade-in uppercase">
            <div className="p-4 bg-orange-50/50 flex justify-between items-center border-b font-black">
               <div className="flex items-center gap-3 text-orange-900 font-black text-[11px] tracking-widest leading-tight"><i className="fa-solid fa-triangle-exclamation animate-pulse text-lg text-orange-600"></i><span>Action Required: {outOfStockCount} Items reached Zero Stock.</span></div>
               <span className="bg-orange-600 text-white px-2.5 py-0.5 rounded-full font-black text-[10px]">CRITICAL</span>
            </div>
        </section>)}

      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden font-black uppercase font-black">
        <div className="p-4 border-b bg-slate-50/80 space-y-4 font-black">
          <div className="flex flex-wrap items-center gap-4 font-black">
            <div className="relative flex-grow md:w-80 font-black"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Search Material..." className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none font-black uppercase font-black" value={search} onChange={e=>setSearch(e.target.value)} /></div>
            <div className="flex gap-2">
              <button onClick={() => setShowSummary(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-md flex items-center gap-2 hover:bg-indigo-700 transition-all font-black uppercase tracking-widest"><i className="fa-solid fa-chart-pie"></i> Stock Summary</button>
              <button onClick={exportToSheet} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-md flex items-center gap-2 hover:bg-emerald-700 transition-all font-black uppercase tracking-widest"><i className="fa-solid fa-file-excel"></i> Export to sheet</button>
              <button onClick={() => { resetForm(); setShowAddModal(true); }} className="bg-[#ff6b00] text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-md flex items-center gap-2 hover:opacity-90 transition-all font-black uppercase tracking-widest"><i className="fa-solid fa-plus"></i> Add Stock</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
             <select className="border-2 rounded-md text-[10px] font-black p-2.5 uppercase bg-white cursor-pointer" value={selCat} onChange={e => { setSelCat(e.target.value); setSelSub("all"); }}><option value="all">Category: All</option><option value="OUT_OF_STOCK" className="text-red-600 font-black font-black">!!! OUT OF STOCK !!!</option>{uniqueCats.map(c => <option key={c} value={c}>{c}</option>)}</select>
             <select disabled={selCat === "all"} className="border-2 rounded-md text-[10px] font-black p-2.5 uppercase bg-white cursor-pointer disabled:opacity-50" value={selSub} onChange={e => setSelSub(e.target.value)}><option value="all">Sub-Category: All</option>{filterSubCategories.map(s => <option key={s} value={s}>{s}</option>)}</select>
             <select className="border-2 rounded-md text-[10px] font-black p-2.5 uppercase bg-white cursor-pointer font-black" value={selEngineer} onChange={e => setSelEngineer(e.target.value)}><option value="all">Engineer: Team View</option>{naturalSort([...new Set(myItems.map(i => i.holder_name))]).map((name: any) => <option key={name} value={name}>{name}</option>)}</select>
          </div>
        </div>
        
        <div className="overflow-x-auto font-black font-black">
          <table className="w-full text-left tracking-tight font-black uppercase font-black"><thead className="bg-slate-50 text-slate-500 text-[10px] font-black border-b tracking-widest uppercase font-black font-black"><tr><th className="p-5 pl-8">Material Detail</th><th className="p-5">Spec Details</th><th className="p-5 text-center">Zone Stock</th><th className="p-5 text-center">Action</th></tr></thead><tbody className="divide-y text-sm font-black font-black">
               {currentItems.map((i: any) => (
                <tr key={`${i.item}-${i.spec}`} className={`hover:bg-blue-50/50 transition border-b group cursor-pointer ${i.totalQty === 0 ? 'bg-red-50/30' : ''}`} onClick={() => setBifurcationItem(i)}>
                  <td className="p-5 pl-8 leading-tight font-black uppercase font-black"><div className="text-slate-800 font-bold text-[14px] flex items-center gap-2 uppercase font-black">{i.item}{i.is_manual && <span className="bg-orange-100 text-orange-600 text-[8px] px-1.5 py-0.5 rounded font-black border border-orange-200">M</span>}</div><div className="text-[9px] text-slate-400 mt-1 uppercase font-bold">{i.cat} &gt; {i.sub}</div></td>
                  <td className="p-5 font-mono font-black uppercase font-black"><span className="bg-white border px-2 py-0.5 rounded-[4px] text-[10.5px] text-slate-600 font-bold shadow-sm inline-block font-black font-black">{i.make || '-'} | {i.model || '-'} | {i.spec}</span></td>
                  <td className={`p-5 font-bold text-center text-[16px] whitespace-nowrap uppercase ${i.totalQty === 0 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>{i.totalQty === 0 ? "ZERO STOCK" : `${i.totalQty} ${i.unit}`}</td>
                  <td className="p-5 text-center font-black font-black"><button className="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-lg text-[10px] font-black border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm font-black uppercase">View Split</button></td>
                </tr>
              ))}
            </tbody></table>
        </div>

        <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-[10px] font-black uppercase tracking-widest font-black font-black">
          <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-4 py-2 bg-white border-2 rounded-lg shadow-sm font-black uppercase font-black font-black">Prev</button>
          <div className="flex items-center gap-1 font-black">
            {Array.from({ length: totalPages }, (_, idx) => (<button key={idx} onClick={() => setCurrentPage(idx + 1)} className={`w-8 h-8 rounded border font-black ${currentPage === idx + 1 ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>{idx + 1}</button>))}
          </div>
          <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2 bg-white border-2 rounded-lg shadow-sm font-black uppercase font-black font-black">Next</button>
        </div>
      </section>

      {/* VIEW SPLIT MODAL */}
      {bifurcationItem && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 uppercase font-black font-black font-black">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in font-black uppercase font-black">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center font-black uppercase font-black font-black"><div><h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Material Split-up</h3><p className="text-[10px] text-slate-400 uppercase font-black">Ref: {bifurcationItem.item}</p></div><button onClick={() => setBifurcationItem(null)} className="text-slate-400 hover:text-red-500 transition-colors uppercase font-black font-black font-black font-black font-black"><i className="fa-solid fa-xmark text-xl font-black"></i></button></div>
            <div className="p-0 max-h-[60vh] overflow-y-auto uppercase font-black font-black font-black font-black font-black font-black"><table className="w-full text-left text-xs uppercase font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black"><thead className="bg-slate-50 border-b text-[10px] text-slate-400 tracking-widest font-black uppercase font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black"><tr><th className="p-4 pl-6 uppercase font-black font-black font-black">Added By</th><th className="p-4 text-center font-black font-black font-black">Date Audit</th><th className="p-4 text-center font-black font-black font-black">Qty</th><th className="p-4 text-center font-black font-black font-black font-black font-black font-black">Action</th></tr></thead><tbody className="divide-y font-black font-black font-black font-black font-black font-black font-black font-black">
                {bifurcationItem.records.filter((r:any) => r.qty > 0).map((r: any) => (<tr key={r.id} className="hover:bg-slate-50 transition-colors font-black uppercase font-black font-black font-black font-black font-black"><td className="p-4 pl-6 leading-tight font-black uppercase font-black font-black font-black font-black font-black"><div className="flex items-center gap-2 mb-1 uppercase font-black font-black font-black font-black font-black"><span className={`px-2 py-1 rounded text-[10px] font-black block w-fit ${r.holder_uid === profile?.id ? 'bg-orange-100 text-orange-700 border border-orange-200 font-black' : 'bg-slate-100 text-slate-600'}`}>{r.holder_uid === profile?.id ? "YOU" : r.holder_name}</span></div>{r.note && <p className="text-[8px] text-slate-400 lowercase italic truncate font-black font-black">note: {r.note}</p>}</td><td className="p-4 text-center text-[10px] text-slate-500 font-black font-black font-black">{formatTS(r.timestamp)}</td><td className="p-4 text-center font-black text-slate-800 text-[14px] uppercase font-black font-black font-black">{r.qty} {r.unit}</td><td className="p-4 text-center flex justify-center gap-2 uppercase font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black"><button onClick={(e) => { e.stopPropagation(); setConsumeItem(r); }} className="bg-orange-600 text-white px-3 py-1.5 rounded text-[9px] font-black uppercase shadow-sm font-black font-black font-black">Consume</button><button onClick={(e) => { e.stopPropagation(); setEditItem(r); setForm({ ...r, qty: r.qty.toString(), isManual: r.is_manual }); setShowAddModal(true); }} className="bg-slate-800 text-white px-3 py-1.5 rounded text-[9px] font-black uppercase shadow-sm font-black font-black font-black font-black">Edit</button></td></tr>))}
            </tbody></table></div>
          </div>
        </div>)}

      {/* CONSUME MODAL */}
      {consumeItem && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[10001] flex items-center justify-center p-4 uppercase font-bold font-black">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative animate-scale-in font-black font-black font-black">
            <button onClick={() => setConsumeItem(null)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors uppercase font-black font-black font-black font-black"><i className="fa-solid fa-xmark text-xl font-black font-black"></i></button>
            <h3 className="text-xl font-black text-slate-800 uppercase mb-6 tracking-tight font-black uppercase font-black font-black font-black">Consume Material</h3>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 shadow-inner leading-tight font-black uppercase font-black font-black font-black"><p className="text-sm font-black text-slate-700 uppercase font-black font-black font-black">{consumeItem.item}</p>
                <p className="text-[9px] text-indigo-600 mt-2 font-black uppercase font-black font-black font-black font-black font-black">
                    {consumeItem.make} | {consumeItem.model} | {consumeItem.spec} | Balance: {consumeItem.qty} {consumeItem.unit}
                </p>
            </div>
            <div className="space-y-4 font-black uppercase font-black font-black font-black font-black font-black font-black font-black"><div><label className="text-[10px] text-slate-500 uppercase mb-1 block font-black font-black font-black font-black">Qty used</label><input type="number" step="any" className="w-full p-4 border-2 border-slate-100 rounded-2xl font-black text-xl text-center focus:border-orange-500 outline-none shadow-sm uppercase font-black font-black font-black font-black font-black" value={consumeForm.qty} onChange={e => setConsumeForm({ ...consumeForm, qty: e.target.value })} /></div><div><label className="text-[10px] text-slate-500 mb-1 block uppercase font-black font-black font-black font-black font-black font-black font-black">Purpose / Note</label><textarea placeholder="..." className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold h-24 text-xs outline-none focus:border-orange-500 shadow-sm uppercase font-black font-black font-black font-black font-black font-black" value={consumeForm.note} onChange={e => setConsumeForm({ ...consumeForm, note: e.target.value })}></textarea></div><button disabled={submitting} onClick={handleConsume} className="w-full py-3 bg-slate-900 text-white rounded-2xl shadow-xl font-black tracking-widest uppercase hover:bg-black transition-all font-black font-black font-black font-black font-black font-black font-black font-black">Confirm Consumption</button></div>
          </div>
        </div>)}

      {/* ADD/EDIT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 uppercase font-black font-black font-black font-black font-black">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-in font-black uppercase font-black font-black font-black font-black font-black">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center font-black uppercase font-black font-black font-black font-black font-black font-black font-black">
                <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight font-black uppercase font-black font-black font-black font-black font-black">{editItem ? 'Edit Entry' : 'Add Stock'}</h3>
                <button onClick={resetForm} className="text-slate-400 hover:text-red-500 transition-colors uppercase font-black font-black font-black font-black font-black font-black font-black font-black"><i className="fa-solid fa-xmark text-xl font-black font-black font-black"></i></button>
            </div>
            <div className="p-6 space-y-4 font-bold font-black uppercase font-black font-black font-black font-black font-black font-black font-black">
              {!editItem && (<div className="flex justify-between items-center bg-orange-50 p-4 rounded-xl border-2 border-dashed border-orange-200 mb-2 shadow-inner font-black uppercase font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black"><div className="flex flex-col uppercase font-black font-black font-black font-black font-black font-black font-black font-black font-black"><span className="text-[10px] text-orange-800 font-black uppercase tracking-tight">ITEM NOT IN LIST? (Manual Mode)</span><span className="text-[8.5px] text-orange-600 font-medium lowercase mt-1 font-black font-black uppercase font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black">toggle manual mode to enter details</span></div><button onClick={() => setForm({ ...form, isManual: !form.isManual, cat: "", sub: "", make: "", model: "", spec: "", unit: "Nos" })} className={`w-12 h-6 rounded-full relative transition-colors ${form.isManual ? 'bg-orange-500' : 'bg-slate-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.isManual ? 'left-7' : 'left-1'}`}></div></button></div>)}
              
              <div className="space-y-3 font-black uppercase font-black font-black">
                <div><label className="text-[9px] text-slate-400 block mb-1 uppercase font-black tracking-widest font-black uppercase">Category</label>{form.isManual ? <input type="text" className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm font-bold uppercase font-black font-black font-black font-black font-black font-black" placeholder="e.g. Electrical" value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value })} /> : <select disabled={!!editItem} className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm font-bold uppercase cursor-pointer font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black" value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value, sub: "", make: "", model: "", spec: "" })}><option value="">-- Choose Category --</option>{uniqueCats.map((c:any) => <option key={c} value={c}>{c}</option>)}</select>}</div>
                <div className="grid grid-cols-2 gap-3 uppercase font-black font-black font-black">
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase font-black tracking-widest font-black uppercase">Sub-Cat</label>{form.isManual ? <input type="text" className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm font-bold uppercase font-black font-black font-black font-black font-black font-black font-black" placeholder="e.g. Pumps" value={form.sub} onChange={e => setForm({ ...form, sub: e.target.value })} /> : <select disabled={!!editItem} className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm font-bold uppercase cursor-pointer font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black" value={form.sub} onChange={e => setForm({ ...form, sub: e.target.value, make: "", model: "", spec: "" })}><option value="">-- Select --</option>{availableSubs.map((s:any) => <option key={s} value={s}>{s}</option>)}</select>}</div>
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase font-black tracking-widest font-black uppercase">Make</label>{form.isManual ? <input type="text" className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm font-bold uppercase font-black font-black font-black font-black font-black font-black font-black" placeholder="e.g. SKF" value={form.make} onChange={e => setForm({ ...form, make: e.target.value, model: "", spec: "" })} /> : <select disabled={!!editItem} className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm font-bold uppercase cursor-pointer font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black" value={form.make} onChange={e => setForm({ ...form, make: e.target.value, model: "", spec: "" })}><option value="">-- Select --</option>{availableMakes.map((m:any) => <option key={m} value={m}>{m}</option>)}</select>}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 uppercase font-black font-black font-black">
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase font-black tracking-widest font-black uppercase">Model</label>{form.isManual ? <input type="text" className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm font-bold uppercase font-black font-black font-black font-black font-black font-black font-black" placeholder="e.g. ML-2" value={form.model} onChange={e => setForm({ ...form, model: e.target.value, spec: "" })} /> : <select disabled={!!editItem} className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm font-bold uppercase cursor-pointer font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black" value={form.model} onChange={e => setForm({ ...form, model: e.target.value, spec: "" })}><option value="">-- Select --</option>{availableModels.map((m:any) => <option key={m} value={m}>{m}</option>)}</select>}</div>
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase font-black tracking-widest font-black uppercase">Spec</label>{form.isManual ? <input type="text" className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm font-bold uppercase font-black font-black font-black font-black font-black font-black font-black" placeholder="e.g. 240V" value={form.spec} onChange={e => setForm({ ...form, spec: e.target.value })} /> : <select disabled={!!editItem} className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm font-bold uppercase cursor-pointer font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black" value={form.spec} onChange={e => setForm({ ...form, spec: e.target.value })}><option value="">-- Select --</option>{availableSpecs.map((s:any) => <option key={s} value={s}>{s}</option>)}</select>}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 font-black uppercase font-black font-black">
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase font-black tracking-widest font-black uppercase">Quantity</label><input type="number" step="any" className="w-full p-3 border-2 border-slate-100 rounded-xl text-lg font-black text-indigo-600 focus:border-indigo-400 outline-none shadow-sm uppercase font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} /></div>
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase font-black tracking-widest font-black uppercase">Unit</label>{form.isManual ? <input type="text" className="w-full p-3 border-2 border-slate-100 rounded-xl font-black font-black font-black font-black font-black uppercase font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black" placeholder="e.g. Mtrs" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /> : <select className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs uppercase font-black cursor-pointer font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}><option value="Nos">Nos</option><option value="Sets">Sets</option><option value="Mtrs">Mtrs</option></select>}</div>
                </div>
                <div className="col-span-2 font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black"><label className="text-[9px] text-slate-400 block mb-1 uppercase font-black tracking-widest font-black uppercase">Audit Remarks (Note)</label><textarea placeholder="Reason/Ref No..." className="w-full p-3 border-2 border-slate-100 rounded-xl text-[10px] h-16 font-bold uppercase focus:border-orange-300 outline-none font-black uppercase font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}></textarea></div>
              </div>

              <div className="flex gap-2 font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black">
                {editItem && <button disabled={submitting} onClick={() => handleDeleteItem(editItem.id)} className="flex-1 py-3 bg-red-50 text-red-600 rounded-2xl shadow-sm hover:bg-red-100 uppercase tracking-widest font-black text-[10px] border border-red-100 transition-all font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black">DELETE</button>}
                <button disabled={submitting} onClick={handleSaveItem} className="flex-[3] py-3 bg-slate-900 text-white rounded-2xl shadow-lg font-black uppercase tracking-widest font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black">CONFIRM STOCK</button>
              </div>
            </div>
          </div>
        </div>)}

      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 uppercase font-black font-black font-black font-black font-black font-black font-black font-black">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in font-black uppercase font-black font-black font-black font-black font-black font-black font-black font-black">
            <div className="p-6 border-b bg-indigo-50 flex justify-between items-center font-black uppercase font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black"><h3><i className="fa-solid fa-boxes-stacked mr-2 uppercase"></i> Zone Balance Summary</h3><button onClick={() => setShowSummary(false)} className="text-xl font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black">×</button></div>
            <div className="p-6 max-h-[60vh] overflow-y-auto uppercase font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black"><table className="w-full text-left text-xs font-bold uppercase font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black"><thead className="border-b text-slate-400 uppercase tracking-widest text-[10px] font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black"><tr><th className="pb-3 uppercase font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black">Category &gt; Sub-Category</th><th className="pb-3 text-right uppercase font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black">Total Balance</th></tr></thead><tbody className="divide-y font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black">
                {getSummaryData().map((s: any, idx: number) => (<tr key={idx} className="hover:bg-slate-50 transition border-b uppercase font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black">
                    <td className="py-4 text-slate-700 text-[11px] font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black">{s.cat} &gt; {s.sub}</td>
                    <td className="py-4 text-right font-black text-indigo-600 text-sm font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black font-black">{s.total} {s.unit}</td>
                </tr>))}
            </tbody></table></div>
          </div>
        </div>)}
    </div>
  );
}
