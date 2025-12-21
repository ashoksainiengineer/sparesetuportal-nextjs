"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { masterCatalog } from "@/lib/masterdata"; //

export default function MyStoreView({ profile, fetchProfile }: any) {
  const [myItems, setMyItems] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [bifurcationItem, setBifurcationItem] = useState<any>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const [consumeItem, setConsumeItem] = useState<any>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [selCat, setSelCat] = useState("all");
  const [selSub, setSelSub] = useState("all");
  const [selEngineer, setSelEngineer] = useState("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Form States
  const [form, setForm] = useState({
    cat: "", sub: "", make: "", model: "", spec: "", qty: "", unit: "Nos", isManual: false
  });
  const [consumeForm, setConsumeForm] = useState({ qty: "", note: "" });

  useEffect(() => { if (profile?.unit) fetchStore(); }, [profile]);

  const fetchStore = async () => {
    try {
      const { data } = await supabase.from("inventory").select("*").eq("holder_unit", profile.unit).order("id", { ascending: false });
      if (data) setMyItems(data);
    } catch (e) { console.error("Fetch failed"); }
  };

  // --- 1. ENGINE: AGGREGATION & SORTING ---
  const groupedItems = myItems.reduce((acc: any, item: any) => {
    const key = `${item.item}-${item.spec}`;
    if (!acc[key]) {
      acc[key] = { ...item, totalQty: 0, records: [] };
    }
    acc[key].totalQty += Number(item.qty);
    acc[key].records.push(item);
    return acc;
  }, {});

  const aggregatedList = Object.values(groupedItems);

  // --- 2. ENGINE: FILTER & SORTING (Out of Stock logic) ---
  const filteredList = aggregatedList.filter((i: any) => {
    const s = search.toLowerCase();
    const matchSearch = i.item.toLowerCase().includes(s) || i.spec.toLowerCase().includes(s);
    
    let matchCat = selCat === "all" || i.cat === selCat;
    if (selCat === "OUT_OF_STOCK") matchCat = (i.totalQty === 0);

    const matchSub = selSub === "all" || i.sub === selSub;
    const matchEngineer = selEngineer === "all" || i.records.some((r: any) => r.holder_name === selEngineer);
    
    return matchSearch && matchCat && matchSub && matchEngineer;
  }).sort((a: any, b: any) => {
    if (a.totalQty === 0 && b.totalQty !== 0) return 1;
    if (a.totalQty !== 0 && b.totalQty === 0) return -1;
    return 0;
  });

  const outOfStockCount = aggregatedList.filter((i: any) => i.totalQty === 0).length;
  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;
  const currentItems = filteredList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // --- 3. MASTER DATA DROPDOWNS ---
  const uniqueCats = [...new Set(masterCatalog.map(i => i.cat))].sort();
  const availableSubs = masterCatalog.filter(i => i.cat === form.cat).map(i => i.sub).filter((v, i, a) => a.indexOf(v) === i).sort();
  const availableMakes = masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub).map(i => i.make).filter((v, i, a) => a.indexOf(v) === i).sort();
  const availableModels = masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub && i.make === form.make).map(i => i.model).filter((v, i, a) => a.indexOf(v) === i).sort();
  const availableSpecs = masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub && i.make === form.make && i.model === form.model).map(i => i.spec).filter((v, i, a) => a.indexOf(v) === i).sort();

  const filterCategories = uniqueCats;
  const filterSubCategories = selCat !== "all" && selCat !== "OUT_OF_STOCK" ? [...new Set(masterCatalog.filter(i => i.cat === selCat).map(i => i.sub))].sort() : [];
  const filterEngineers = [...new Set(myItems.map(i => i.holder_name))].sort();

  // --- 4. HANDLERS (The Fix is Here) ---
  const handleSaveItem = async () => {
    if (!form.cat || !form.qty || !form.spec) return alert("All fields are mandatory!");
    const itemName = form.isManual ? `${form.make} ${form.model} ${form.spec}`.trim() : `${form.make} ${form.sub} ${form.model}`.trim();
    const payload = {
      item: itemName, cat: form.cat, sub: form.sub, make: form.make, model: form.model,
      spec: form.spec, qty: parseInt(form.qty), unit: form.unit, is_manual: form.isManual,
      holder_unit: profile.unit, holder_uid: profile.id, holder_name: profile.name
    };
    try {
      if (editItem) await supabase.from("inventory").update(payload).eq("id", editItem.id);
      else {
        await supabase.from("inventory").insert([payload]);
        await supabase.from("profiles").update({ item_count: (profile.item_count || 0) + 1 }).eq('id', profile.id);
      }
      resetForm(); fetchStore(); fetchProfile(); alert("Success!");
    } catch (e) { alert("Save Error"); }
  };

  const handleDeleteItem = async (id: number) => {
    if (confirm("Permanently delete this entry?")) {
      try {
        await supabase.from("inventory").delete().eq("id", id);
        resetForm(); setBifurcationItem(null); fetchStore(); fetchProfile();
        alert("Entry Deleted.");
      } catch (e) { alert("Delete Error"); }
    }
  };

  const handleConsume = async () => {
    const q = parseInt(consumeForm.qty);
    if (!q || q <= 0 || q > consumeItem.qty) return alert("Invalid Qty");
    try {
      await supabase.from("inventory").update({ qty: consumeItem.qty - q }).eq("id", consumeItem.id);
      await supabase.from("usage_logs").insert([{
        consumer_uid: profile.id, item_name: consumeItem.item, category: consumeItem.cat,
        qty_consumed: q, timestamp: Date.now().toString(), purpose: consumeForm.note
      }]);
      setConsumeItem(null); setConsumeForm({ qty: "", note: "" }); fetchStore(); alert("Usage Logged!");
    } catch (e) { alert("Error logging usage"); }
  };

  const getSummaryData = () => {
    const summary: any = {};
    filteredList.forEach((i: any) => {
      const key = `${i.cat} > ${i.sub}`;
      if (!summary[key]) summary[key] = { cat: i.cat, sub: i.sub, total: 0 };
      summary[key].total += Number(i.totalQty);
    });
    return Object.values(summary).sort((a: any, b: any) => a.cat.localeCompare(b.cat));
  };

  const resetForm = () => {
    setShowAddModal(false); setEditItem(null);
    setForm({ cat: "", sub: "", make: "", model: "", spec: "", qty: "", unit: "Nos", isManual: false });
  };

  const exportCSV = () => {
    const headers = "Category,Sub-Cat,Item,Spec,Qty,Unit,By,Date\n";
    const rows = filteredList.flatMap((i: any) => i.records.map((r: any) => `"${r.cat}","${r.sub}","${r.item}","${r.spec}","${r.qty}","${r.unit}","${r.holder_name}","${new Date(r.created_at).toLocaleDateString()}"`)).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `StoreAudit.csv`; a.click();
  };

  return (
    <div className="animate-fade-in space-y-6 pb-20 font-roboto font-bold uppercase">
      {/* HEADER SECTION */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="text-xl font-black text-slate-800 uppercase leading-none">My Local Store</h2>
        <p className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded mt-2 inline-block uppercase">ZONE: {profile?.unit}</p>
      </div>

      {/* Point 5: WARNING BANNER */}
      {outOfStockCount > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg flex items-center gap-3 animate-pulse shadow-sm">
            <i className="fa-solid fa-triangle-exclamation text-orange-600 text-xl"></i>
            <div>
                <p className="text-orange-900 text-xs font-black uppercase tracking-widest leading-none">ACTION REQUIRED: {outOfStockCount} items are completely out of stock</p>
                <p className="text-orange-700 text-[10px] font-bold lowercase mt-1">use '!!! OUT OF STOCK !!!' category filter to identify items</p>
            </div>
        </div>
      )}

      {/* TOOLBAR: REORDERED (Search -> Export -> Summary -> Add) */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border shadow-sm items-center">
        <div className="relative flex-1 md:flex-[3] w-full">
            <i className="fa-solid fa-search absolute left-3 top-3.5 text-slate-400"></i>
            <input type="text" placeholder="Search Master Material or Spec..." className="w-full pl-10 pr-4 py-3 border-2 border-slate-100 rounded-xl text-xs outline-none focus:border-orange-400 font-bold uppercase shadow-inner transition-all" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
            <button onClick={exportCSV} className="bg-emerald-600 text-white px-4 py-3 rounded-xl text-[10px] font-black shadow-md flex items-center justify-center gap-2 flex-1 md:flex-none uppercase tracking-widest"><i className="fa-solid fa-file-csv"></i> Export</button>
            <button onClick={() => setShowSummary(true)} className="bg-indigo-600 text-white px-4 py-3 rounded-xl text-[10px] font-black shadow-md flex items-center justify-center gap-2 flex-1 md:flex-none uppercase tracking-widest"><i className="fa-solid fa-chart-bar"></i> Stock Summary</button>
            <button onClick={() => { resetForm(); setShowAddModal(true); }} className="iocl-btn text-white px-5 py-3 rounded-xl text-[10px] font-black shadow-md flex items-center justify-center gap-2 flex-1 md:flex-none uppercase tracking-widest"><i className="fa-solid fa-plus"></i> Add Stock</button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-xl border shadow-sm">
        <select className="border-2 border-white rounded-lg text-[10px] p-3 bg-white font-bold uppercase shadow-sm cursor-pointer" value={selCat} onChange={e => { setSelCat(e.target.value); setSelSub("all"); }}>
            <option value="all">Category: All</option>
            <option value="OUT_OF_STOCK" className="text-red-600 font-black">!!! OUT OF STOCK !!!</option>
            {filterCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select disabled={selCat === "all" || selCat === "OUT_OF_STOCK"} className="border-2 border-white rounded-lg text-[10px] p-3 bg-white font-bold uppercase shadow-sm" value={selSub} onChange={e => setSelSub(e.target.value)}><option value="all">Sub-Category: All</option>{filterSubCategories.map(s => <option key={s} value={s}>{s}</option>)}</select>
        <select className="border-2 border-white rounded-lg text-[10px] p-3 bg-white font-bold uppercase shadow-sm" value={selEngineer} onChange={e => setSelEngineer(e.target.value)}><option value="all">Engineer: Team View</option>{filterEngineers.map(name => <option key={name} value={name}>{name === profile?.name ? "Added By: You" : name}</option>)}</select>
      </div>

      {/* TABLE (Point 6: Total Qty Header) */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left tracking-tight">
          <thead className="bg-slate-50 text-slate-500 text-[10px] font-black border-b tracking-widest uppercase"><tr><th className="p-5 pl-8">Material Detail</th><th className="p-5">Spec</th><th className="p-5 text-center">Total Qty</th><th className="p-5 text-center">Action</th></tr></thead>
          <tbody className="divide-y text-sm">
            {currentItems.length > 0 ? currentItems.map((i: any) => (
              <tr key={`${i.item}-${i.spec}`} className={`hover:bg-blue-50/50 transition border-b uppercase group cursor-pointer ${i.totalQty === 0 ? 'bg-red-50/30' : ''}`} onClick={() => setBifurcationItem(i)}>
                <td className="p-5 pl-8 leading-tight">
                  <div className="text-slate-800 font-bold text-[14px] flex items-center gap-2">{i.item}{i.is_manual && <span className="bg-orange-100 text-orange-600 text-[8px] px-1.5 py-0.5 rounded font-black border border-orange-200">M</span>}</div>
                  <div className="text-[9px] text-slate-400 mt-1 uppercase font-bold">{i.cat} &gt; {i.sub}</div>
                  <div className="text-[8px] text-indigo-500 mt-1 font-black tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity">Click for bifurcation view →</div>
                </td>
                <td className="p-5 font-mono"><span className="bg-white border px-2 py-1 rounded-[4px] text-[10.5px] text-slate-600 font-bold shadow-sm">{i.spec}</span></td>
                <td className={`p-5 font-bold text-center text-[16px] whitespace-nowrap ${i.totalQty === 0 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>
                    {i.totalQty === 0 ? "ZERO STOCK" : `${i.totalQty} ${i.unit}`}
                </td>
                <td className="p-5 text-center"><button className="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-lg text-[10px] font-black border border-indigo-100 uppercase tracking-tighter shadow-sm group-hover:bg-indigo-600 group-hover:text-white">View Split</button></td>
              </tr>
            )) : <tr><td colSpan={4} className="p-20 text-center text-slate-300 font-black tracking-[0.2em]">NO DATA FOUND</td></tr>}
          </tbody>
        </table></div>
        <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
          <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-5 py-2 bg-white border-2 rounded-lg shadow-sm disabled:opacity-30">Prev</button>
          <span>Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-5 py-2 bg-white border-2 rounded-lg shadow-sm disabled:opacity-30">Next</button>
        </div>
      </div>

      {/* MODAL: BIFURCATION (Point 3) */}
      {bifurcationItem && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase font-bold">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                <div><h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Material Split-up</h3><p className="text-[10px] text-slate-400">Spec: {bifurcationItem.item} | {bifurcationItem.spec}</p></div>
                <button onClick={() => setBifurcationItem(null)} className="text-slate-400 hover:text-red-500 transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div className="p-0 max-h-[60vh] overflow-y-auto">
                <table className="w-full text-left text-xs uppercase">
                    <thead className="bg-slate-50 border-b text-[10px] text-slate-400 tracking-widest font-black uppercase"><tr><th className="p-4 pl-6">Added By</th><th className="p-4">Date & Time</th><th className="p-4 text-center">Qty</th><th className="p-4 text-center">Action</th></tr></thead>
                    <tbody className="divide-y">
                        {bifurcationItem.records.map((r: any) => (
                            <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 pl-6">
                                    <span className={`px-2 py-1 rounded text-[10px] font-black block w-fit mb-1 ${r.holder_uid === profile?.id ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-slate-100 text-slate-600'}`}>{r.holder_uid === profile?.id ? "YOU" : r.holder_name}</span>
                                </td>
                                <td className="p-4 text-[10px] text-slate-500 font-medium">
                                    {r.created_at ? new Date(r.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '--'}
                                </td>
                                <td className="p-4 text-center font-black text-slate-800 text-[14px]">{r.qty} {r.unit}</td>
                                <td className="p-4 text-center flex justify-center gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); setConsumeItem(r); }} className="bg-orange-600 text-white px-3 py-1.5 rounded text-[9px] font-black uppercase shadow-sm">Consume</button>
                                    <button onClick={(e) => { e.stopPropagation(); setEditItem(r); setForm({ cat: r.cat, sub: r.sub, make: r.make, model: r.model, spec: r.spec, qty: r.qty.toString(), unit: r.unit, isManual: r.is_manual }); setShowAddModal(true); }} className="bg-slate-800 text-white px-3 py-1.5 rounded text-[9px] font-black uppercase shadow-sm">Edit</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-4 bg-slate-50 text-center"><button onClick={() => setBifurcationItem(null)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600">Close</button></div>
          </div>
        </div>
      )}

      {/* MODAL: ADD MATERIAL (Point 2) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase font-bold">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center"><h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{editItem ? 'Edit Details' : 'Add Stock'}</h3><button onClick={resetForm} className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-xmark text-xl"></i></button></div>
            <div className="p-6 space-y-4 font-bold">
              {!editItem && (
                <div className="flex justify-between items-center bg-orange-50 p-4 rounded-xl border-2 border-dashed border-orange-200 mb-2 shadow-inner">
                  <div className="flex flex-col"><span className="text-[10px] text-orange-800 font-black tracking-tight uppercase tracking-widest leading-none">ITEM NOT IN LIST?</span><span className="text-[8.5px] text-orange-600 font-medium lowercase mt-1">enable manual mode to type name</span></div>
                  <button onClick={() => setForm({ ...form, isManual: !form.isManual, cat: "", sub: "", make: "", model: "", spec: "" })} className={`w-12 h-6 rounded-full relative transition-colors ${form.isManual ? 'bg-orange-500' : 'bg-slate-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.isManual ? 'left-7' : 'left-1'}`}></div></button>
                </div>
              )}
              <div className="space-y-3">
                <div><label className="text-[9px] text-slate-400 block mb-1 uppercase tracking-widest">Category</label>
                  {form.isManual ? <input type="text" disabled={!!editItem} className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold" placeholder="e.g. Electrical" value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value })} />
                    : <select disabled={!!editItem} className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold uppercase shadow-sm" value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value, sub: "", make: "", model: "", spec: "" })}><option value="">-- Choose --</option>{uniqueCats.map(c => <option key={c} value={c}>{c}</option>)}</select>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase tracking-widest">Sub-Cat</label>
                    {form.isManual ? <input type="text" disabled={!!editItem} className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold" placeholder="e.g. Bearings" value={form.sub} onChange={e => setForm({ ...form, sub: e.target.value })} />
                      : <select disabled={!!editItem} className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold uppercase shadow-sm" value={form.sub} onChange={e => setForm({ ...form, sub: e.target.value, make: "", model: "", spec: "" })}><option value="">-- Select --</option>{availableSubs.map(s => <option key={s} value={s}>{s}</option>)}</select>}
                  </div>
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase tracking-widest">Make</label>
                    {form.isManual ? <input type="text" disabled={!!editItem} className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold" placeholder="e.g. SKF" value={form.make} onChange={e => setForm({ ...form, make: e.target.value, model: "", spec: "" })} />
                      : <select disabled={!!editItem} className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold uppercase shadow-sm" value={form.make} onChange={e => setForm({ ...form, make: e.target.value, model: "", spec: "" })}><option value="">-- Select --</option>{availableMakes.map(m => <option key={m} value={m}>{m}</option>)}</select>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase tracking-widest">Quantity</label><input type="number" className="w-full p-3 border-2 border-slate-100 rounded-xl text-lg font-black text-indigo-600 focus:border-indigo-400 outline-none shadow-sm" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} /></div>
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase tracking-widest">Unit</label><select className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs uppercase font-black shadow-sm" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}><option value="Nos">Nos</option><option value="Sets">Sets</option><option value="Mtrs">Mtrs</option></select></div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                {editItem && <button onClick={()=>handleDeleteItem(editItem.id)} className="flex-1 py-4 bg-red-50 text-red-600 rounded-2xl shadow-sm hover:bg-red-100 uppercase tracking-widest font-black text-[10px] border border-red-100"><i className="fa-solid fa-trash mr-2"></i>Delete</button>}
                <button onClick={handleSaveItem} className="flex-[3] py-4 iocl-btn text-white rounded-2xl shadow-lg font-black uppercase tracking-[0.2em] text-sm hover:opacity-90">Confirm Stock</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONSUME MATERIAL (Point 1: Close button fix) */}
      {consumeItem && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[10001] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-scale-in uppercase font-bold relative">
            <button onClick={() => setConsumeItem(null)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h3 className="text-xl font-black text-slate-800 uppercase mb-6 tracking-tight">Consume Material</h3>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 shadow-inner">
              <p className="text-[10px] text-slate-400 font-black mb-1 uppercase tracking-widest font-black">Record Detail</p>
              <p className="text-sm font-black text-slate-700 leading-tight">{consumeItem.item}</p>
              <p className="text-[9px] text-green-600 mt-2 tracking-widest uppercase font-black">Sub-Balance: {consumeItem.qty} {consumeItem.unit}</p>
            </div>
            <div className="space-y-4">
              <div><label className="text-[10px] text-slate-500 font-black uppercase mb-1 tracking-widest">Qty to use</label><input type="number" className="w-full p-4 border-2 rounded-2xl font-black text-xl text-center focus:border-orange-500 outline-none shadow-sm" value={consumeForm.qty} onChange={e => setConsumeForm({ ...consumeForm, qty: e.target.value })} /></div>
              <div><label className="text-[10px] text-slate-500 font-black uppercase mb-1 tracking-widest">Purpose / Note</label><textarea placeholder="Specify maintenance job description..." className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold h-24 focus:border-orange-500 outline-none text-xs shadow-sm" value={consumeForm.note} onChange={e => setConsumeForm({ ...consumeForm, note: e.target.value })}></textarea></div>
              <button onClick={handleConsume} className="w-full py-4 bg-slate-900 text-white rounded-2xl shadow-xl font-black tracking-widest uppercase hover:bg-black transition-all">Confirm Usage</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUMMARY (Point 6 logic) */}
      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase font-bold">
            <div className="p-6 border-b bg-indigo-50 flex justify-between items-center"><h3 className="font-black text-indigo-900 text-lg tracking-tight uppercase"><i className="fa-solid fa-boxes-stacked mr-2"></i> Inventory Balance Summary</h3><button onClick={() => setShowSummary(false)} className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-xmark text-xl"></i></button></div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-xs font-bold uppercase">
                <thead className="border-b text-slate-400 uppercase tracking-widest"><tr><th className="pb-3 text-[10px]">Category &gt; Sub-Category</th><th className="pb-3 text-right text-[10px]">Total Balance</th></tr></thead>
                <tbody className="divide-y">{getSummaryData().map((s: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 transition border-b"><td className="py-4 text-slate-700 text-[11px]">{s.cat} <i className="fa-solid fa-chevron-right text-[8px] mx-1 opacity-40"></i> {s.sub}</td><td className="py-4 text-right font-black text-indigo-600 text-sm">{s.total} Nos</td></tr>
                ))}</tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50 text-center"><button onClick={() => setShowSummary(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-all">Close Summary</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
