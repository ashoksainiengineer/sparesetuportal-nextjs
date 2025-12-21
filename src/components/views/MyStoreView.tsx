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

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Add/Edit Form State
  const [form, setForm] = useState({
    cat: "", sub: "", make: "", model: "", spec: "", qty: "", unit: "Nos", isManual: false
  });
  const [consumeForm, setConsumeForm] = useState({ qty: "", note: "" });

  useEffect(() => { if (profile?.id) fetchStore(); }, [profile]);

  const fetchStore = async () => {
    try {
      const { data } = await supabase.from("inventory").select("*").eq("holder_uid", profile.id).order("created_at", { ascending: false });
      if (data) setMyItems(data);
    } catch (e) { console.error("Fetch Error"); }
  };

  // --- 1. LOGIC: MASTER DATA DROPDOWNS (From masterdata.js) ---
  const uniqueCats = [...new Set(masterCatalog.map(i => i.cat))].sort(); //
  const availableSubs = masterCatalog.filter(i => i.cat === form.cat).map(i => i.sub).filter((v, i, a) => a.indexOf(v) === i).sort();
  const availableMakes = masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub).map(i => i.make).filter((v, i, a) => a.indexOf(v) === i).sort();
  const availableModels = masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub && i.make === form.make).map(i => i.model).filter((v, i, a) => a.indexOf(v) === i).sort();
  const availableSpecs = masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub && i.make === form.make && i.model === form.model).map(i => i.spec).filter((v, i, a) => a.indexOf(v) === i).sort();

  // --- 2. LOGIC: FILTERS ---
  const filterCategories = uniqueCats;
  const filterSubCategories = selCat !== "all" ? [...new Set(masterCatalog.filter(i => i.cat === selCat).map(i => i.sub))].sort() : [];

  // --- 3. LOGIC: SAVE / UPDATE ---
  const handleSaveItem = async () => {
    if (!form.cat || !form.qty || !form.spec) return alert("Fill all fields!");
    const itemName = form.isManual ? form.model : `${form.make} ${form.sub} ${form.model}`.trim();
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
    } catch (e) { alert("Save Failed"); }
  };

  const handleDeleteItem = async (id: number) => {
    if (confirm("Delete Item?")) {
      await supabase.from("inventory").delete().eq("id", id);
      resetForm(); fetchStore(); fetchProfile();
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
      setConsumeItem(null); setConsumeForm({ qty: "", note: "" }); fetchStore();
      alert("Material Consumed!");
    } catch (e) { alert("Consumption Error"); }
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

  // --- FILTER & PAGINATION ENGINE ---
  const filteredItems = myItems.filter(i => {
    const matchSearch = i.item?.toLowerCase().includes(search.toLowerCase()) || i.spec?.toLowerCase().includes(search.toLowerCase());
    const matchCat = selCat === "all" || i.cat === selCat;
    const matchSub = selSub === "all" || i.sub === selSub;
    return matchSearch && matchCat && matchSub;
  });

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const currentItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="animate-fade-in space-y-6 pb-20 font-roboto font-bold uppercase">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
        <div><h2 className="text-xl font-bold text-slate-800 uppercase tracking-widest leading-none font-black">My Local Store</h2><p className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded mt-2 tracking-tighter uppercase uppercase">ZONE: {profile?.unit}</p></div>
        <div className="flex gap-2 mt-4 md:mt-0">
          <button onClick={() => setShowSummary(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-[10px] font-black shadow-md flex items-center gap-2 uppercase tracking-widest"><i className="fa-solid fa-chart-bar"></i> Stock Summary</button>
          <button onClick={() => { resetForm(); setShowAddModal(true); }} className="iocl-btn text-white px-4 py-2 rounded-lg text-[10px] font-black shadow-md flex items-center gap-2 uppercase tracking-widest"><i className="fa-solid fa-plus"></i> Add New Stock</button>
        </div>
      </div>

      {/* Filters (Same as Global Search) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border shadow-sm">
        <div className="relative"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Search Item or Spec..." className="w-full pl-9 pr-4 py-2 border rounded-md text-xs outline-none font-bold uppercase" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="border rounded-md text-[10px] p-2 bg-white font-bold uppercase" value={selCat} onChange={e => { setSelCat(e.target.value); setSelSub("all"); }}><option value="all">Category: All</option>{filterCategories.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select className="border rounded-md text-[10px] p-2 bg-white font-bold uppercase" value={selSub} onChange={e => setSelSub(e.target.value)}><option value="all">Sub-Category: All</option>{filterSubCategories.map(s => <option key={s} value={s}>{s}</option>)}</select>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left tracking-tight">
          <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold border-b tracking-widest uppercase"><tr><th className="p-5 pl-8">Material Detail</th><th className="p-5">Spec</th><th className="p-5 text-center">Qty</th><th className="p-5 text-center">Actions</th></tr></thead>
          <tbody className="divide-y text-sm">
            {currentItems.length > 0 ? currentItems.map(i => (
              <tr key={i.id} className="hover:bg-slate-50 transition border-b uppercase">
                <td className="p-5 pl-8 leading-tight">
                  <div className="text-slate-800 font-bold text-[14px] flex items-center gap-2">{i.item}{i.is_manual && <span className="bg-orange-100 text-orange-600 text-[8px] px-1 rounded font-black border border-orange-200 tracking-tighter">M</span>}</div>
                  <div className="text-[9px] text-slate-400 mt-1 uppercase">{i.cat} &gt; {i.sub}</div>
                  <div className="text-[8px] text-slate-400 mt-1 italic font-medium">Added on {new Date(i.created_at).toLocaleString('en-IN')} by {i.holder_name}</div>
                </td>
                <td className="p-5 font-mono"><span className="bg-white border px-2 py-1 rounded-[4px] text-[10px] text-slate-500 font-bold">{i.spec}</span></td>
                <td className="p-5 font-bold text-center text-slate-800 text-[14px] whitespace-nowrap">{i.qty} {i.unit}</td>
                <td className="p-5 text-center flex justify-center gap-2">
                  <button onClick={() => { setConsumeItem(i) }} className="bg-orange-100 text-orange-700 px-3 py-1 rounded text-[10px] font-black hover:bg-orange-200 uppercase tracking-tighter">Consume</button>
                  <button onClick={() => { setEditItem(i); setForm({ cat: i.cat, sub: i.sub, make: i.make, model: i.model, spec: i.spec, qty: i.qty.toString(), unit: i.unit, isManual: i.is_manual }); setShowAddModal(true); }} className="bg-slate-100 text-slate-700 px-3 py-1 rounded text-[10px] font-black hover:bg-slate-200 uppercase tracking-tighter">Edit</button>
                </td>
              </tr>
            )) : <tr><td colSpan={4} className="p-10 text-center text-slate-400 font-bold tracking-widest">NO ITEMS FOUND IN YOUR STORE</td></tr>}
          </tbody>
        </table></div>
        {/* Pagination Logic */}
        <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-xs font-bold uppercase tracking-widest">
          <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-4 py-1.5 bg-white border rounded shadow-sm disabled:opacity-30">Prev</button>
          <span className="text-slate-500">Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-1.5 bg-white border rounded shadow-sm disabled:opacity-30">Next</button>
        </div>
      </div>

      {/* Modal: Add/Edit Stock */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase font-bold">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center"><h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{editItem ? 'Edit Item' : 'Add New Material'}</h3><button onClick={resetForm}><i className="fa-solid fa-xmark text-slate-400"></i></button></div>
            <div className="p-6 space-y-4 font-bold">
              {editItem && !form.isManual && <div className="bg-blue-50 p-3 rounded-lg text-[9.5px] text-blue-700 flex items-center gap-2 border border-blue-100 uppercase"><i className="fa-solid fa-lock text-sm"></i> Standard Item: Only Qty & Unit Editable</div>}
              {!editItem && (
                <div className="flex justify-between items-center bg-orange-50 p-3 rounded-xl border border-orange-100 mb-2">
                  <div className="flex flex-col"><span className="text-[10px] text-orange-800 font-black">Item not in list?</span><span className="text-[8px] text-orange-600 font-medium lowercase">enable manual entry</span></div>
                  <button onClick={() => setForm({ ...form, isManual: !form.isManual, cat: "", sub: "", make: "", model: "", spec: "" })} className={`w-12 h-6 rounded-full relative transition-colors ${form.isManual ? 'bg-orange-500' : 'bg-slate-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.isManual ? 'left-7' : 'left-1'}`}></div></button>
                </div>
              )}

              <div className="space-y-3">
                <div><label className="text-[9px] text-slate-400 block mb-1 uppercase">Category</label>
                  {form.isManual ? <input type="text" disabled={!!editItem && !form.isManual} className="w-full p-2.5 border rounded-lg text-xs font-bold" value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value })} />
                    : <select disabled={!!editItem} className="w-full p-2.5 border rounded-lg text-xs font-bold uppercase" value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value, sub: "", make: "", model: "", spec: "" })}><option value="">-- Choose Category --</option>{uniqueCats.map(c => <option key={c} value={c}>{c}</option>)}</select>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase">Sub Category</label>
                    {form.isManual ? <input type="text" disabled={!!editItem && !form.isManual} className="w-full p-2.5 border rounded-lg text-xs font-bold" value={form.sub} onChange={e => setForm({ ...form, sub: e.target.value })} />
                      : <select disabled={!!editItem} className="w-full p-2.5 border rounded-lg text-xs font-bold uppercase" value={form.sub} onChange={e => setForm({ ...form, sub: e.target.value, make: "", model: "", spec: "" })}><option value="">-- Select Sub --</option>{availableSubs.map(s => <option key={s} value={s}>{s}</option>)}</select>}
                  </div>
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase">Make</label>
                    {form.isManual ? <input type="text" disabled={!!editItem && !form.isManual} className="w-full p-2.5 border rounded-lg text-xs font-bold" value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} />
                      : <select disabled={!!editItem} className="w-full p-2.5 border rounded-lg text-xs font-bold uppercase" value={form.make} onChange={e => setForm({ ...form, make: e.target.value, model: "", spec: "" })}><option value="">-- Select Make --</option>{availableMakes.map(m => <option key={m} value={m}>{m}</option>)}</select>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase">Model</label>
                    {form.isManual ? <input type="text" disabled={!!editItem && !form.isManual} className="w-full p-2.5 border rounded-lg text-xs font-bold" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
                      : <select disabled={!!editItem} className="w-full p-2.5 border rounded-lg text-xs font-bold uppercase" value={form.model} onChange={e => setForm({ ...form, model: e.target.value, spec: "" })}><option value="">-- Select Model --</option>{availableModels.map(mo => <option key={mo} value={mo}>{mo}</option>)}</select>}
                  </div>
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase">Spec</label>
                    {form.isManual ? <input type="text" disabled={!!editItem && !form.isManual} className="w-full p-2.5 border rounded-lg text-xs font-bold" value={form.spec} onChange={e => setForm({ ...form, spec: e.target.value })} />
                      : <select disabled={!!editItem} className="w-full p-2.5 border rounded-lg text-xs font-bold uppercase" value={form.spec} onChange={e => setForm({ ...form, spec: e.target.value })}><option value="">-- Select Spec --</option>{availableSpecs.map(sp => <option key={sp} value={sp}>{sp}</option>)}</select>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase">Quantity</label><input type="number" className="w-full p-3 border-2 border-slate-100 rounded-xl text-lg font-black text-indigo-600 focus:border-indigo-400 outline-none" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} /></div>
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase">Unit</label><select className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs uppercase font-bold" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}><option value="Nos">Nos</option><option value="Sets">Sets</option><option value="Mtrs">Mtrs</option></select></div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                {editItem && <button onClick={() => handleDeleteItem(editItem.id)} className="flex-1 py-4 bg-red-50 text-red-600 rounded-2xl shadow-sm hover:bg-red-100 transition-all font-black uppercase text-[10px] tracking-widest"><i className="fa-solid fa-trash mr-2"></i>Delete</button>}
                <button onClick={handleSaveItem} className="flex-[3] py-4 iocl-btn text-white rounded-2xl shadow-lg font-black uppercase tracking-[0.2em] text-sm">{editItem ? 'Update Stock' : 'Save Stock'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Consume Stock */}
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
              <div><label className="text-[10px] text-slate-500 font-black uppercase mb-1 tracking-widest">Quantity Used</label><input type="number" className="w-full p-4 border-2 rounded-2xl font-black text-xl text-center focus:border-orange-500 outline-none" value={consumeForm.qty} onChange={e => setConsumeForm({ ...consumeForm, qty: e.target.value })} /></div>
              <div><label className="text-[10px] text-slate-500 font-black uppercase mb-1 tracking-widest">Purpose / Log Comment</label><textarea placeholder="Specify maintenance job or reason..." className="w-full p-4 border-2 rounded-2xl font-bold h-24 focus:border-orange-500 outline-none text-xs" value={consumeForm.note} onChange={e => setConsumeForm({ ...consumeForm, note: e.target.value })}></textarea></div>
              <button onClick={handleConsume} className="w-full py-4 bg-slate-900 text-white rounded-2xl shadow-xl font-black tracking-widest hover:bg-black transition-all uppercase">Confirm Transaction</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Summary */}
      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase font-bold">
            <div className="p-6 border-b bg-indigo-50 flex justify-between items-center"><h3 className="font-black text-indigo-900 text-lg tracking-tight uppercase"><i className="fa-solid fa-boxes-stacked mr-2"></i> Local Store Stock Summary</h3><button onClick={() => setShowSummary(false)}><i className="fa-solid fa-xmark text-slate-400"></i></button></div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left text-xs font-bold uppercase">
                <thead className="border-b text-slate-400 uppercase tracking-widest"><tr><th className="pb-3">Category &gt; Sub-Category</th><th className="pb-3 text-right">Total Available</th></tr></thead>
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
