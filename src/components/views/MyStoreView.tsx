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

  // Pagination Fix
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
      // ORDER BY ID (As per your original working code to avoid column errors)
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("holder_uid", profile.id)
        .order("id", { ascending: false });
      
      if (data) setMyItems(data);
      if (error) console.error("Database Error:", error.message);
    } catch (e) { console.error("Fetch failed"); }
  };

  // --- 1. LOGIC: MASTER DATA DROPDOWNS (From masterdata.js) ---
  const uniqueCats = [...new Set(masterCatalog.map(i => i.cat))].sort();
  const availableSubs = masterCatalog.filter(i => i.cat === form.cat).map(i => i.sub).filter((v, i, a) => a.indexOf(v) === i).sort();
  const availableMakes = masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub).map(i => i.make).filter((v, i, a) => a.indexOf(v) === i).sort();
  const availableModels = masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub && i.make === form.make).map(i => i.model).filter((v, i, a) => a.indexOf(v) === i).sort();
  const availableSpecs = masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub && i.make === form.make && i.model === form.model).map(i => i.spec).filter((v, i, a) => a.indexOf(v) === i).sort();

  // --- 2. LOGIC: FILTERS (As per Global Search logic) ---
  const filterCategories = uniqueCats;
  const filterSubCategories = selCat !== "all" ? [...new Set(masterCatalog.filter(i => i.cat === selCat).map(i => i.sub))].sort() : [];

  // --- 3. LOGIC: SAVE / UPDATE ---
  const handleSaveItem = async () => {
    if (!form.cat || !form.qty || !form.spec) return alert("Please fill all mandatory fields!");
    const itemName = form.isManual ? form.model : `${form.make} ${form.sub} ${form.model}`.trim();
    
    const payload = {
      item: itemName, cat: form.cat, sub: form.sub, make: form.make, model: form.model,
      spec: form.spec, qty: parseInt(form.qty), unit: form.unit, is_manual: form.isManual,
      holder_unit: profile.unit, holder_uid: profile.id, holder_name: profile.name
    };

    try {
      if (editItem) {
        await supabase.from("inventory").update(payload).eq("id", editItem.id);
        alert("Stock Updated!");
      } else {
        await supabase.from("inventory").insert([payload]);
        await supabase.from("profiles").update({ item_count: (profile.item_count || 0) + 1 }).eq('id', profile.id);
        alert("Success: Material Added!");
      }
      resetForm(); fetchStore(); fetchProfile();
    } catch (e) { alert("Save Error"); }
  };

  const handleDeleteItem = async (id: number) => {
    if (confirm("Permanently Delete this item from your store?")) {
      await supabase.from("inventory").delete().eq("id", id);
      resetForm(); fetchStore(); fetchProfile();
    }
  };

  // --- 4. LOGIC: CONSUME WITH NOTE ---
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
      alert("Material usage logged successfully!");
    } catch (e) { alert("Error recording consumption"); }
  };

  // --- 5. LOGIC: STOCK SUMMARY (Cat > Sub-Cat) ---
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

  // --- FILTER & PAGINATION ENGINE ---
  const filteredItems = myItems.filter(i => {
    const itemStr = (i.item || "").toLowerCase();
    const specStr = (i.spec || "").toLowerCase();
    const s = search.toLowerCase();
    const matchSearch = itemStr.includes(s) || specStr.includes(s);
    const matchCat = selCat === "all" || i.cat === selCat;
    const matchSub = selSub === "all" || i.sub === selSub;
    return matchSearch && matchCat && matchSub;
  });

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const currentItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="animate-fade-in space-y-6 pb-20 font-roboto font-bold uppercase">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
        <div><h2 className="text-xl font-bold text-slate-800 uppercase tracking-widest leading-none font-black">My Local Store</h2><p className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded mt-2 tracking-tighter uppercase">ZONE: {profile?.unit}</p></div>
        <div className="flex gap-2 mt-4 md:mt-0">
          <button onClick={() => setShowSummary(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-[10px] font-black shadow-md flex items-center gap-2 uppercase tracking-widest transition-all hover:bg-indigo-700"><i className="fa-solid fa-chart-bar"></i> Stock Summary</button>
          <button onClick={() => { resetForm(); setShowAddModal(true); }} className="iocl-btn text-white px-4 py-2 rounded-lg text-[10px] font-black shadow-md flex items-center gap-2 uppercase tracking-widest"><i className="fa-solid fa-plus"></i> Add New Stock</button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div className="relative"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Search Material Name or Spec..." className="w-full pl-9 pr-4 py-2 border rounded-md text-xs outline-none font-bold uppercase" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="border rounded-md text-[10px] p-2 bg-white font-bold uppercase cursor-pointer" value={selCat} onChange={e => { setSelCat(e.target.value); setSelSub("all"); }}><option value="all">Category: All</option>{filterCategories.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select className="border rounded-md text-[10px] p-2 bg-white font-bold uppercase cursor-pointer" value={selSub} onChange={e => setSelSub(e.target.value)}><option value="all">Sub-Category: All</option>{filterSubCategories.map(s => <option key={s} value={s}>{s}</option>)}</select>
      </div>

      {/* Main Stock Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left tracking-tight">
          <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold border-b tracking-widest uppercase"><tr><th className="p-5 pl-8">Material Detail</th><th className="p-5">Spec</th><th className="p-5 text-center">Qty</th><th className="p-5 text-center">Actions</th></tr></thead>
          <tbody className="divide-y text-sm">
            {currentItems.length > 0 ? currentItems.map(i => (
              <tr key={i.id} className="hover:bg-slate-50 transition border-b uppercase">
                <td className="p-5 pl-8 leading-tight">
                  <div className="text-slate-800 font-bold text-[14px] flex items-center gap-2">{i.item}{i.is_manual && <span className="bg-orange-100 text-orange-600 text-[8px] px-1.5 py-0.5 rounded font-black border border-orange-200 tracking-tighter">M</span>}</div>
                  <div className="text-[9px] text-slate-400 mt-1">{i.cat} &gt; {i.sub}</div>
                  <div className="text-[8px] text-slate-400 mt-1 italic font-medium">Recorded by {i.holder_name}</div>
                </td>
                <td className="p-5 font-mono"><span className="bg-white border px-2 py-1 rounded-[4px] text-[10px] text-slate-500 font-bold shadow-sm">{i.spec}</span></td>
                <td className="p-5 font-bold text-center text-slate-800 text-[14px] whitespace-nowrap">{i.qty} {i.unit}</td>
                <td className="p-5 text-center flex justify-center gap-2">
                  <button onClick={() => { setConsumeItem(i) }} className="bg-orange-50 text-orange-600 px-3 py-1 rounded text-[10px] font-black border border-orange-100 hover:bg-orange-100 uppercase transition-colors">Consume</button>
                  <button onClick={() => { setEditItem(i); setForm({ cat: i.cat, sub: i.sub, make: i.make, model: i.model, spec: i.spec, qty: i.qty.toString(), unit: i.unit, isManual: i.is_manual }); setShowAddModal(true); }} className="bg-slate-50 text-slate-600 px-3 py-1 rounded text-[10px] font-black border border-slate-200 hover:bg-slate-100 uppercase transition-colors">Edit</button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={4} className="p-20 text-center text-slate-400 font-bold tracking-widest animate-pulse">NO ITEMS FOUND IN YOUR LOCAL STORE</td></tr>
            )}
          </tbody>
        </table></div>
        {/* Pagination Toolbar */}
        <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-xs font-bold uppercase tracking-widest">
          <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-4 py-1.5 bg-white border rounded shadow-sm disabled:opacity-30 hover:bg-slate-50">Prev</button>
          <span className="text-slate-500">Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-1.5 bg-white border rounded shadow-sm disabled:opacity-30 hover:bg-slate-50">Next</button>
        </div>
      </div>

      {/* Modal: Add/Edit Material */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase font-bold">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center"><h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{editItem ? 'Edit Item Details' : 'Add New Stock'}</h3><button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark text-xl"></i></button></div>
            <div className="p-6 space-y-4 font-bold">
              {editItem && !form.isManual && <div className="bg-blue-50 p-3 rounded-lg text-[9.5px] text-blue-700 flex items-center gap-2 border border-blue-100 uppercase"><i className="fa-solid fa-lock text-sm"></i> Standard Catalog Item: Only Quantity & Unit are editable.</div>}
              {!editItem && (
                <div className="flex justify-between items-center bg-orange-50 p-3 rounded-xl border border-orange-100 mb-2 shadow-inner">
                  <div className="flex flex-col"><span className="text-[10px] text-orange-800 font-black">Item not in list?</span><span className="text-[8px] text-orange-600 font-medium lowercase">enable manual mode to type details</span></div>
                  <button onClick={() => setForm({ ...form, isManual: !form.isManual, cat: "", sub: "", make: "", model: "", spec: "" })} className={`w-12 h-6 rounded-full relative transition-colors ${form.isManual ? 'bg-orange-500' : 'bg-slate-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.isManual ? 'left-7' : 'left-1'}`}></div></button>
                </div>
              )}

              <div className="space-y-3">
                <div><label className="text-[9px] text-slate-400 block mb-1 uppercase tracking-widest">Category</label>
                  {form.isManual ? <input type="text" disabled={!!editItem && !form.isManual} className="w-full p-2.5 border rounded-lg text-xs font-bold shadow-sm" placeholder="Type Category..." value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value })} />
                    : <select disabled={!!editItem} className="w-full p-2.5 border rounded-lg text-xs font-bold uppercase shadow-sm cursor-pointer" value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value, sub: "", make: "", model: "", spec: "" })}><option value="">-- Choose Category --</option>{uniqueCats.map(c => <option key={c} value={c}>{c}</option>)}</select>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase tracking-widest">Sub Category</label>
                    {form.isManual ? <input type="text" disabled={!!editItem && !form.isManual} className="w-full p-2.5 border rounded-lg text-xs font-bold shadow-sm" placeholder="Type Sub-Cat..." value={form.sub} onChange={e => setForm({ ...form, sub: e.target.value })} />
                      : <select disabled={!!editItem} className="w-full p-2.5 border rounded-lg text-xs font-bold uppercase shadow-sm cursor-pointer" value={form.sub} onChange={e => setForm({ ...form, sub: e.target.value, make: "", model: "", spec: "" })}><option value="">-- Select Sub --</option>{availableSubs.map(s => <option key={s} value={s}>{s}</option>)}</select>}
                  </div>
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase tracking-widest">Make</label>
                    {form.isManual ? <input type="text" disabled={!!editItem && !form.isManual} className="w-full p-2.5 border rounded-lg text-xs font-bold shadow-sm" placeholder="Manufacturer..." value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} />
                      : <select disabled={!!editItem} className="w-full p-2.5 border rounded-lg text-xs font-bold uppercase shadow-sm cursor-pointer" value={form.make} onChange={e => setForm({ ...form, make: e.target.value, model: "", spec: "" })}><option value="">-- Select Make --</option>{availableMakes.map(m => <option key={m} value={m}>{m}</option>)}</select>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase tracking-widest">Model / Series</label>
                    {form.isManual ? <input type="text" disabled={!!editItem && !form.isManual} className="w-full p-2.5 border rounded-lg text-xs font-bold shadow-sm" placeholder="Model Name..." value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
                      : <select disabled={!!editItem} className="w-full p-2.5 border rounded-lg text-xs font-bold uppercase shadow-sm cursor-pointer" value={form.model} onChange={e => setForm({ ...form, model: e.target.value, spec: "" })}><option value="">-- Select Model --</option>{availableModels.map(mo => <option key={mo} value={mo}>{mo}</option>)}</select>}
                  </div>
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase tracking-widest">Specification</label>
                    {form.isManual ? <input type="text" disabled={!!editItem && !form.isManual} className="w-full p-2.5 border rounded-lg text-xs font-bold shadow-sm" placeholder="Exact Spec..." value={form.spec} onChange={e => setForm({ ...form, spec: e.target.value })} />
                      : <select disabled={!!editItem} className="w-full p-2.5 border rounded-lg text-xs font-bold uppercase shadow-sm cursor-pointer" value={form.spec} onChange={e => setForm({ ...form, spec: e.target.value })}><option value="">-- Select Spec --</option>{availableSpecs.map(sp => <option key={sp} value={sp}>{sp}</option>)}</select>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase tracking-widest">Quantity</label><input type="number" className="w-full p-3 border-2 border-slate-100 rounded-xl text-lg font-black text-indigo-600 focus:border-indigo-400 outline-none shadow-inner" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} /></div>
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase tracking-widest">Unit</label><select className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs uppercase font-bold cursor-pointer" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}><option value="Nos">Nos</option><option value="Sets">Sets</option><option value="Mtrs">Mtrs</option></select></div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                {editItem && <button onClick={() => handleDeleteItem(editItem.id)} className="flex-1 py-4 bg-red-50 text-red-600 rounded-2xl shadow-sm hover:bg-red-100 transition-all font-black uppercase text-[10px] tracking-widest border border-red-100"><i className="fa-solid fa-trash mr-2"></i>Delete</button>}
                <button onClick={handleSaveItem} className="flex-[3] py-4 iocl-btn text-white rounded-2xl shadow-lg font-black uppercase tracking-[0.2em] text-sm hover:opacity-90">{editItem ? 'Update Stock' : 'Save To Store'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Consume Stock with Note (Image 2) */}
      {consumeItem && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-scale-in uppercase font-bold">
            <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Consume Material</h3><button onClick={() => { setConsumeItem(null); setConsumeForm({ qty: "", note: "" }); }}><i className="fa-solid fa-xmark text-slate-400"></i></button></div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
              <p className="text-[10px] text-slate-400 font-black mb-1 uppercase tracking-widest">Material Detail</p>
              <p className="text-sm font-black text-slate-700">{consumeItem.item}</p>
              <p className="text-[9px] text-green-600 mt-2 tracking-widest uppercase font-black">Stock Available: {consumeItem.qty} {consumeItem.unit}</p>
            </div>
            <div className="space-y-4">
              <div><label className="text-[10px] text-slate-500 font-black uppercase mb-1 tracking-widest">Quantity To Be Used</label><input type="number" className="w-full p-4 border-2 rounded-2xl font-black text-xl text-center focus:border-orange-500 outline-none shadow-sm" value={consumeForm.qty} onChange={e => setConsumeForm({ ...consumeForm, qty: e.target.value })} /></div>
              <div><label className="text-[10px] text-slate-500 font-black uppercase mb-1 tracking-widest">Purpose / Note / Comment</label><textarea placeholder="Specify maintenance job description or reason for use..." className="w-full p-4 border-2 rounded-2xl font-bold h-24 focus:border-orange-500 outline-none text-xs shadow-sm" value={consumeForm.note} onChange={e => setConsumeForm({ ...consumeForm, note: e.target.value })}></textarea></div>
              <button onClick={handleConsume} className="w-full py-4 bg-slate-900 text-white rounded-2xl shadow-xl font-black tracking-widest hover:bg-black transition-all uppercase">Confirm Transaction</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Summary (Image 1 Style) */}
      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase font-bold">
            <div className="p-6 border-b bg-indigo-50 flex justify-between items-center"><h3 className="font-black text-indigo-900 text-lg tracking-tight uppercase"><i className="fa-solid fa-boxes-stacked mr-2"></i> My Store Summary</h3><button onClick={() => setShowSummary(false)}><i className="fa-solid fa-xmark text-slate-400"></i></button></div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-xs font-bold uppercase">
                <thead className="border-b text-slate-400 uppercase tracking-widest"><tr><th className="pb-3">Category &gt; Sub-Category</th><th className="pb-3 text-right">Total Balance</th></tr></thead>
                <tbody className="divide-y">{getSummaryData().map((s: any, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition"><td className="py-4 text-slate-700">{s.cat} <i className="fa-solid fa-chevron-right text-[8px] mx-1 opacity-40"></i> {s.sub}</td><td className="py-4 text-right font-black text-indigo-600 text-sm">{s.total} Nos</td></tr>
                ))}</tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50 text-center"><button onClick={() => setShowSummary(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] hover:text-indigo-600 transition">Close Summary</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
