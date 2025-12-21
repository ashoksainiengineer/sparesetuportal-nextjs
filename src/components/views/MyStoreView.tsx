"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { masterCatalog } from "@/lib/masterdata"; //

export default function MyStoreView({ profile, fetchProfile }: any) {
  const [myItems, setMyItems] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [consumeItem, setConsumeItem] = useState<any>(null);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [selCat, setSelCat] = useState("all");
  const [selSub, setSelSub] = useState("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Form States
  const [form, setForm] = useState({
    cat: "", sub: "", make: "", model: "", spec: "", qty: "", unit: "Nos", isManual: false
  });
  const [consumeForm, setConsumeForm] = useState({ qty: "", note: "" });

  useEffect(() => { 
    if (profile?.id) fetchStore(); 
  }, [profile]);

  const fetchStore = async () => {
    try {
      const { data } = await supabase.from("inventory").select("*").eq("holder_uid", profile.id).order("id", { ascending: false });
      if (data) setMyItems(data);
    } catch (e) { console.error("Fetch failed"); }
  };

  // Master Data logic for Dropdowns
  const uniqueCats = [...new Set(masterCatalog.map(i => i.cat))].sort();
  const availableSubs = masterCatalog.filter(i => i.cat === form.cat).map(i => i.sub).filter((v, i, a) => a.indexOf(v) === i).sort();
  const availableMakes = masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub).map(i => i.make).filter((v, i, a) => a.indexOf(v) === i).sort();
  const availableModels = masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub && i.make === form.make).map(i => i.model).filter((v, i, a) => a.indexOf(v) === i).sort();
  const availableSpecs = masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub && i.make === form.make && i.model === form.model).map(i => i.spec).filter((v, i, a) => a.indexOf(v) === i).sort();

  // --- FEATURE 1: MANUAL NAME CONSTRUCTION ---
  const handleSaveItem = async () => {
    if (!form.cat || !form.qty || !form.spec) return alert("All fields are mandatory!");
    
    // For Manual items, name is Make + Model + Spec
    const itemName = form.isManual 
      ? `${form.make} ${form.model} ${form.spec}`.trim() 
      : `${form.make} ${form.sub} ${form.model}`.trim();

    const payload = {
      item: itemName, cat: form.cat, sub: form.sub, make: form.make, model: form.model,
      spec: form.spec, qty: parseInt(form.qty), unit: form.unit, is_manual: form.isManual,
      holder_unit: profile.unit, holder_uid: profile.id, holder_name: profile.name
    };

    try {
      if (editItem) {
        await supabase.from("inventory").update(payload).eq("id", editItem.id);
      } else {
        await supabase.from("inventory").insert([payload]);
        await supabase.from("profiles").update({ item_count: (profile.item_count || 0) + 1 }).eq('id', profile.id);
      }
      resetForm(); fetchStore(); fetchProfile();
      alert("Material Saved Successfully!");
    } catch (e) { alert("Save Error"); }
  };

  const handleConsume = async () => {
    const q = parseInt(consumeForm.qty);
    if (!q || q <= 0 || q > consumeItem.qty) return alert("Invalid Quantity!");
    try {
      await supabase.from("inventory").update({ qty: consumeItem.qty - q }).eq("id", consumeItem.id);
      await supabase.from("usage_logs").insert([{
        consumer_uid: profile.id, item_name: consumeItem.item, category: consumeItem.cat,
        qty_consumed: q, timestamp: Date.now().toString(), purpose: consumeForm.note
      }]);
      setConsumeItem(null); setConsumeForm({ qty: "", note: "" }); fetchStore();
      alert("Consumed!");
    } catch (e) { alert("Error"); }
  };

  // --- FEATURE 2: EXPORT TO SHEET ---
  const exportStoreCSV = () => {
    const headers = "Category,Sub-Category,Item Detail,Specification,Quantity,Unit,Recorded By\n";
    const rows = filteredItems.map(i => `"${i.cat}","${i.sub}","${i.item}","${i.spec}","${i.qty}","${i.unit}","${i.holder_name}"\n`);
    const blob = new Blob([headers + rows.join("")], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MyStore_${profile.unit}_${new Date().toLocaleDateString()}.csv`;
    a.click();
  };

  const getSummaryData = () => {
    const summary: any = {};
    myItems.forEach(i => {
      const key = `${i.cat} > ${i.sub}`;
      if (!summary[key]) summary[key] = { cat: i.cat, sub: i.sub, total: 0 };
      summary[key].total += Number(i.qty);
    });
    return Object.values(summary).sort((a: any, b: any) => a.cat.localeCompare(b.cat));
  };

  const resetForm = () => {
    setShowAddModal(false); setEditItem(null);
    setForm({ cat: "", sub: "", make: "", model: "", spec: "", qty: "", unit: "Nos", isManual: false });
  };

  const filteredItems = myItems.filter(i => {
    const matchSearch = (i.item || "").toLowerCase().includes(search.toLowerCase()) || (i.spec || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = selCat === "all" || i.cat === selCat;
    const matchSub = selSub === "all" || i.sub === selSub;
    return matchSearch && matchCat && matchSub;
  });

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const currentItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="animate-fade-in space-y-6 pb-20 font-roboto font-bold uppercase">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest leading-none">My Local Store</h2>
        <p className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded mt-2 inline-block">ZONE: {profile?.unit}</p>
      </div>

      {/* FEATURE 4: REORDERED TOOLBAR & LONGER SEARCH BAR */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border shadow-sm items-center">
        {/* Search Bar - Expanded */}
        <div className="relative flex-1 md:flex-[2.5] w-full">
            <i className="fa-solid fa-search absolute left-3 top-3.5 text-slate-400"></i>
            <input 
              type="text" 
              placeholder="Search My Items..." 
              className="w-full pl-10 pr-4 py-3 border-2 border-slate-100 rounded-xl text-xs outline-none focus:border-orange-400 font-bold uppercase transition-all" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
        </div>

        {/* Buttons in specified order */}
        <div className="flex gap-2 w-full md:w-auto">
            <button onClick={exportStoreCSV} className="bg-emerald-600 text-white px-4 py-3 rounded-xl text-[10px] font-black shadow-md flex items-center justify-center gap-2 uppercase tracking-widest flex-1 md:flex-none">
                <i className="fa-solid fa-file-csv"></i> Export Sheet
            </button>
            <button onClick={() => setShowSummary(true)} className="bg-indigo-600 text-white px-4 py-3 rounded-xl text-[10px] font-black shadow-md flex items-center justify-center gap-2 uppercase tracking-widest flex-1 md:flex-none">
                <i className="fa-solid fa-chart-bar"></i> Stock Summary
            </button>
            <button onClick={() => { resetForm(); setShowAddModal(true); }} className="iocl-btn text-white px-5 py-3 rounded-xl text-[10px] font-black shadow-md flex items-center justify-center gap-2 uppercase tracking-widest flex-1 md:flex-none">
                <i className="fa-solid fa-plus"></i> Add Stock
            </button>
        </div>
      </div>

      {/* Filters (Master Data based) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-xl border">
        <select className="border rounded-lg text-[10px] p-3 bg-white font-bold uppercase" value={selCat} onChange={e => { setSelCat(e.target.value); setSelSub("all"); }}><option value="all">Category: All</option>{uniqueCats.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select className="border rounded-lg text-[10px] p-3 bg-white font-bold uppercase" value={selSub} onChange={e => setSelSub(e.target.value)}><option value="all">Sub-Category: All</option>{([...new Set(masterCatalog.filter(i => selCat === "all" || i.cat === selCat).map(i => i.sub))].sort()).map(s => <option key={s} value={s}>{s}</option>)}</select>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left tracking-tight">
          <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold border-b tracking-widest uppercase"><tr><th className="p-5 pl-8">Material Detail</th><th className="p-5">Spec</th><th className="p-5 text-center">Qty</th><th className="p-5 text-center">Actions</th></tr></thead>
          <tbody className="divide-y text-sm">
            {currentItems.length > 0 ? currentItems.map(i => (
              <tr key={i.id} className="hover:bg-slate-50 transition border-b uppercase">
                <td className="p-5 pl-8 leading-tight">
                  <div className="text-slate-800 font-bold text-[14px] flex items-center gap-2">
                    {i.item}
                    {i.is_manual && <span className="bg-orange-100 text-orange-600 text-[8px] px-1.5 py-0.5 rounded font-black border border-orange-200 tracking-tighter">M</span>}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-1 uppercase tracking-tighter font-bold">{i.cat} &gt; {i.sub}</div>
                  <div className="text-[8px] text-slate-400 mt-1 italic font-medium">Added on {new Date(i.created_at).toLocaleDateString()}</div>
                </td>
                <td className="p-5 font-mono"><span className="bg-white border px-2 py-1 rounded-[4px] text-[10px] text-slate-500 font-bold shadow-sm">{i.spec}</span></td>
                <td className="p-5 font-bold text-center text-slate-800 text-[14px] whitespace-nowrap">{i.qty} {i.unit}</td>
                <td className="p-5 text-center flex justify-center gap-2">
                  <button onClick={() => { setConsumeItem(i) }} className="bg-orange-50 text-orange-600 px-3 py-1 rounded text-[10px] font-black border border-orange-100 hover:bg-orange-100 uppercase transition-colors tracking-tighter">Consume</button>
                  <button onClick={() => { setEditItem(i); setForm({ cat: i.cat, sub: i.sub, make: i.make, model: i.model, spec: i.spec, qty: i.qty.toString(), unit: i.unit, isManual: i.is_manual }); setShowAddModal(true); }} className="bg-slate-50 text-slate-600 px-3 py-1 rounded text-[10px] font-black border border-slate-200 hover:bg-slate-100 uppercase transition-colors tracking-tighter">Edit</button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={4} className="p-20 text-center text-slate-400 font-bold tracking-widest animate-pulse">NO ITEMS FOUND IN YOUR LOCAL STORE</td></tr>
            )}
          </tbody>
        </table></div>
        <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-xs font-bold uppercase tracking-widest">
          <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-4 py-1.5 bg-white border rounded shadow-sm disabled:opacity-30">Prev</button>
          <span className="text-slate-500">Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-1.5 bg-white border rounded shadow-sm disabled:opacity-30">Next</button>
        </div>
      </div>

      {/* Modal: Add Stock (FEATURE 3: MANUAL PLACEHOLDERS) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase font-bold">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center"><h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{editItem ? 'Edit Item' : 'Add New Material'}</h3><button onClick={resetForm}><i className="fa-solid fa-xmark text-slate-400"></i></button></div>
            <div className="p-6 space-y-4 font-bold">
              {!editItem && (
                <div className="flex justify-between items-center bg-orange-50 p-3 rounded-xl border border-orange-100 mb-2 shadow-inner">
                  <div className="flex flex-col"><span className="text-[10px] text-orange-800 font-black uppercase">Item not in list?</span><span className="text-[8px] text-orange-600 font-medium lowercase">enable manual mode</span></div>
                  <button onClick={() => setForm({ ...form, isManual: !form.isManual, cat: "", sub: "", make: "", model: "", spec: "" })} className={`w-12 h-6 rounded-full relative transition-colors ${form.isManual ? 'bg-orange-500' : 'bg-slate-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.isManual ? 'left-7' : 'left-1'}`}></div></button>
                </div>
              )}

              <div className="space-y-3">
                {/* Fields with examples in manual mode */}
                <div>
                  <label className="text-[9px] text-slate-400 block mb-1 uppercase tracking-widest">Category</label>
                  {form.isManual ? <input type="text" className="w-full p-2.5 border-2 border-slate-100 rounded-lg text-xs font-bold" placeholder="e.g. Electrical / Mechanical" value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value })} />
                    : <select className="w-full p-2.5 border-2 border-slate-100 rounded-lg text-xs font-bold uppercase shadow-sm cursor-pointer" value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value, sub: "", make: "", model: "", spec: "" })}><option value="">-- Select Category --</option>{uniqueCats.map(c => <option key={c} value={c}>{c}</option>)}</select>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase tracking-widest">Sub Category</label>
                    {form.isManual ? <input type="text" className="w-full p-2.5 border-2 border-slate-100 rounded-lg text-xs font-bold" placeholder="e.g. Bearings / Pumps" value={form.sub} onChange={e => setForm({ ...form, sub: e.target.value })} />
                      : <select className="w-full p-2.5 border-2 border-slate-100 rounded-lg text-xs font-bold uppercase shadow-sm cursor-pointer" value={form.sub} onChange={e => setForm({ ...form, sub: e.target.value, make: "", model: "", spec: "" })}><option value="">-- Select Sub --</option>{availableSubs.map(s => <option key={s} value={s}>{s}</option>)}</select>}
                  </div>
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase tracking-widest">Make</label>
                    {form.isManual ? <input type="text" className="w-full p-2.5 border-2 border-slate-100 rounded-lg text-xs font-bold" placeholder="e.g. SKF / Sulzer" value={form.make} onChange={e => setForm({ ...form, make: e.target.value, model: "", spec: "" })} />
                      : <select className="w-full p-2.5 border-2 border-slate-100 rounded-lg text-xs font-bold uppercase shadow-sm cursor-pointer" value={form.make} onChange={e => setForm({ ...form, make: e.target.value, model: "", spec: "" })}><option value="">-- Select Make --</option>{availableMakes.map(m => <option key={m} value={m}>{m}</option>)}</select>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase tracking-widest">Model Name</label>
                    {form.isManual ? <input type="text" className="w-full p-2.5 border-2 border-slate-100 rounded-lg text-xs font-bold" placeholder="e.g. 6200 Series" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
                      : <select className="w-full p-2.5 border-2 border-slate-100 rounded-lg text-xs font-bold uppercase shadow-sm cursor-pointer" value={form.model} onChange={e => setForm({ ...form, model: e.target.value, spec: "" })}><option value="">-- Select Model --</option>{availableModels.map(mo => <option key={mo} value={mo}>{mo}</option>)}</select>}
                  </div>
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase tracking-widest">Specification</label>
                    {form.isManual ? <input type="text" className="w-full p-2.5 border-2 border-slate-100 rounded-lg text-xs font-bold" placeholder="e.g. 6205 ZZ C3" value={form.spec} onChange={e => setForm({ ...form, spec: e.target.value })} />
                      : <select className="w-full p-2.5 border-2 border-slate-100 rounded-lg text-xs font-bold uppercase shadow-sm cursor-pointer" value={form.spec} onChange={e => setForm({ ...form, spec: e.target.value })}><option value="">-- Select Spec --</option>{availableSpecs.map(sp => <option key={sp} value={sp}>{sp}</option>)}</select>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase tracking-widest">Quantity</label><input type="number" className="w-full p-3 border-2 border-slate-100 rounded-xl text-lg font-black text-indigo-600 focus:border-indigo-400 outline-none shadow-inner" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} /></div>
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase tracking-widest">Unit</label><select className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs uppercase font-bold cursor-pointer" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}><option value="Nos">Nos</option><option value="Sets">Sets</option><option value="Mtrs">Mtrs</option></select></div>
                </div>
              </div>

              <button onClick={handleSaveItem} className="w-full py-4 iocl-btn text-white rounded-2xl shadow-lg font-black uppercase tracking-[0.2em] text-sm mt-4">{editItem ? 'Confirm Update' : 'Save To Store'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Consume & Summary remains identical but updated UI colors */}
      {consumeItem && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-scale-in uppercase font-bold">
            <h3 className="text-xl font-black text-slate-800 uppercase mb-6">Consume Stock</h3>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
              <p className="text-[10px] text-slate-400 font-black mb-1 uppercase tracking-widest">Item</p>
              <p className="text-sm font-black text-slate-700">{consumeItem.item}</p>
              <p className="text-[9px] text-green-600 mt-2 tracking-widest uppercase font-black">Balance: {consumeItem.qty} {consumeItem.unit}</p>
            </div>
            <div className="space-y-4">
              <div><label className="text-[10px] text-slate-500 font-black uppercase mb-1 tracking-widest">Qty Used</label><input type="number" className="w-full p-4 border-2 rounded-2xl font-black text-xl text-center focus:border-orange-500 outline-none shadow-sm" value={consumeForm.qty} onChange={e => setConsumeForm({ ...consumeForm, qty: e.target.value })} /></div>
              <div><label className="text-[10px] text-slate-500 font-black uppercase mb-1 tracking-widest">Purpose / Log</label><textarea placeholder="Specify maintenance job description..." className="w-full p-4 border-2 rounded-2xl font-bold h-24 focus:border-orange-500 outline-none text-xs shadow-sm" value={consumeForm.note} onChange={e => setConsumeForm({ ...consumeForm, note: e.target.value })}></textarea></div>
              <button onClick={handleConsume} className="w-full py-4 bg-slate-900 text-white rounded-2xl shadow-xl font-black tracking-widest uppercase">Confirm Consume</button>
            </div>
          </div>
        </div>
      )}

      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase font-bold">
            <div className="p-6 border-b bg-indigo-50 flex justify-between items-center"><h3 className="font-black text-indigo-900 text-lg tracking-tight uppercase"><i className="fa-solid fa-boxes-stacked mr-2"></i> Store Inventory Summary</h3><button onClick={() => setShowSummary(false)}><i className="fa-solid fa-xmark text-slate-400"></i></button></div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-xs font-bold uppercase">
                <thead className="border-b text-slate-400 uppercase tracking-widest"><tr><th className="pb-3">Category &gt; Sub-Category</th><th className="pb-3 text-right">Stock Count</th></tr></thead>
                <tbody className="divide-y">{getSummaryData().map((s: any, idx) => (
                  <tr key={idx} className="hover:bg-slate-50"><td className="py-4 text-slate-700">{s.cat} <i className="fa-solid fa-chevron-right text-[8px] mx-1 opacity-40"></i> {s.sub}</td><td className="py-4 text-right font-black text-indigo-600 text-sm">{s.total} Nos</td></tr>
                ))}</tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50 text-center"><button onClick={() => setShowSummary(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] hover:text-indigo-600">Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
