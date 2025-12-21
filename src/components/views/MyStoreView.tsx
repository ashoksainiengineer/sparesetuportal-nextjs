"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Engineering Master Data for Dropdowns (As per your request)
const MASTER_DATA = {
    categories: ["Electrical", "Mechanical", "Instrumentation", "Civil", "Safety", "Others"],
    subCategories: {
        "Electrical": ["Motors", "Cables", "Switchgear", "Lighting", "Transformers"],
        "Mechanical": ["Bearings", "Pumps", "Valves", "Gaskets", "Couplings"],
        "Instrumentation": ["Transmitters", "Gauges", "PLC Modules", "Control Valves"],
        "Civil": ["Hardware", "Cement Products", "Pipes"],
        "Safety": ["PPE", "Fire Extinguishers", "Signage"],
        "Others": ["General", "Consumables"]
    },
    makes: ["Sulzer", "SKF", "Siemens", "L&T", "ABB", "Kirloskar", "Honeywell", "Emerson"]
};

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

  useEffect(() => { if (profile) fetchStore(); }, [profile]);

  const fetchStore = async () => { 
    const { data } = await supabase.from("inventory").select("*").eq("holder_uid", profile.id).order("created_at", { ascending: false }); 
    if (data) setMyItems(data); 
  };

  // --- FEATURE 3: ADD / EDIT LOGIC (MASTER DATA & MANUAL) ---
  const handleSaveItem = async () => {
    if (!form.cat || !form.qty || !form.spec) return alert("Please fill mandatory fields!");
    
    const itemName = form.isManual ? form.model : `${form.make} ${form.sub} ${form.model}`.trim();
    const payload = {
        item: itemName, cat: form.cat, sub: form.sub, make: form.make, model: form.model, 
        spec: form.spec, qty: parseInt(form.qty), unit: form.unit, is_manual: form.isManual,
        holder_unit: profile.unit, holder_uid: profile.id, holder_name: profile.name
    };

    try {
        if (editItem) {
            await supabase.from("inventory").update(payload).eq("id", editItem.id);
            alert("Item Updated!");
        } else {
            await supabase.from("inventory").insert([payload]);
            await supabase.from("profiles").update({ item_count: (profile.item_count || 0) + 1 }).eq('id', profile.id);
            alert("Stock Added!");
        }
        resetForm(); fetchStore(); fetchProfile();
    } catch(e) { alert("Error saving data"); }
  };

  // --- FEATURE 5: DELETE ITEM ---
  const handleDeleteItem = async (id: number) => {
    if (confirm("Are you sure you want to delete this item?")) {
      try {
        await supabase.from("inventory").delete().eq("id", id);
        alert("Item Deleted!");
        resetForm(); fetchStore(); fetchProfile();
      } catch (e) { alert("Error deleting item"); }
    }
  };

  // --- FEATURE 4: CONSUME LOGIC WITH NOTE ---
  const handleConsume = async () => {
    const q = parseInt(consumeForm.qty);
    if (!q || q <= 0 || q > consumeItem.qty) return alert("Invalid Quantity");

    try {
        // 1. Update Inventory
        await supabase.from("inventory").update({ qty: consumeItem.qty - q }).eq("id", consumeItem.id);
        // 2. Log Usage
        await supabase.from("usage_logs").insert([{
            consumer_uid: profile.id, item_name: consumeItem.item, category: consumeItem.cat, 
            qty_consumed: q, timestamp: Date.now().toString(), purpose: consumeForm.note
        }]);
        alert("Stock Consumed & Logged!");
        setConsumeItem(null); setConsumeForm({ qty: "", note: "" }); fetchStore();
    } catch(e) { alert("Failed to consume stock"); }
  };

  // --- FEATURE 1: STOCK SUMMARY LOGIC (Same as Global Search) ---
  const getSummaryData = () => {
    const summary: any = {};
    myItems.forEach(i => {
      const key = `${i.cat} > ${i.sub || 'General'}`;
      if (!summary[key]) summary[key] = { cat: i.cat, sub: i.sub || 'General', total: 0 };
      summary[key].total += Number(i.qty);
    });
    return Object.values(summary).sort((a: any, b: any) => a.cat.localeCompare(b.cat));
  };

  const resetForm = () => {
    setShowAddModal(false); setEditItem(null);
    setForm({cat:"", sub:"", make:"", model:"", spec:"", qty:"", unit:"Nos", isManual:false});
  };

  const filteredItems = myItems.filter(i => 
    (i.item.toLowerCase().includes(search.toLowerCase()) || i.spec.toLowerCase().includes(search.toLowerCase())) &&
    (selCat === "all" || i.cat === selCat) && (selSub === "all" || i.sub === selSub)
  );

  // --- FEATURE 7: PAGINATION ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  return (
    <div className="animate-fade-in space-y-6 pb-20 font-roboto font-bold uppercase">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-widest leading-none font-black">My Local Store</h2>
          <p className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded mt-2 tracking-tighter">ZONE: {profile?.unit}</p>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          <button onClick={() => setShowSummary(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-[10px] font-black shadow-md flex items-center gap-2"><i className="fa-solid fa-chart-bar"></i> Stock Summary</button>
          <button onClick={() => { resetForm(); setShowAddModal(true); }} className="iocl-btn text-white px-4 py-2 rounded-lg text-[10px] shadow-md"><i className="fa-solid fa-plus mr-2"></i>Add New Stock</button>
        </div>
      </div>

      {/* FEATURE 2: FILTERS FROM MASTER DATA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border">
        <div className="relative"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Search my items..." className="w-full pl-9 pr-4 py-2 border rounded-md text-xs outline-none font-bold" onChange={e=>setSearch(e.target.value)} /></div>
        <select className="border rounded-md text-[10px] p-2 bg-white font-bold" onChange={e=>setSelCat(e.target.value)}><option value="all">All Categories</option>{MASTER_DATA.categories.map(c=><option key={c} value={c}>{c}</option>)}</select>
        <select className="border rounded-md text-[10px] p-2 bg-white font-bold" onChange={e=>setSelSub(e.target.value)}><option value="all">All Sub-Categories</option>{Object.values(MASTER_DATA.subCategories).flat().map(s=><option key={s} value={s}>{s}</option>)}</select>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left tracking-tight">
            <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold border-b tracking-widest uppercase"><tr><th className="p-5 pl-8">Item Detail</th><th className="p-5">Spec</th><th className="p-5 text-center">Qty</th><th className="p-5 text-center">Actions</th></tr></thead>
            <tbody className="divide-y text-sm">
                {currentItems.map(i => (
                  <tr key={i.id} className="hover:bg-slate-50 border-b">
                    <td className="p-5 pl-8 leading-tight">
                        <div className="text-slate-800 font-bold text-[14px] flex items-center gap-2">
                          {i.item}
                          {/* FEATURE 3: MANUAL ITEM BADGE */}
                          {i.is_manual && <span className="bg-slate-200 text-slate-600 text-[9px] px-1 rounded font-black">M</span>}
                        </div>
                        <div className="text-[9px] text-slate-400 mt-1 uppercase">{i.cat} &gt; {i.sub}</div>
                        {/* FEATURE 6: DATE & ADDED BY */}
                        <div className="text-[8px] text-slate-400 mt-1 font-medium">Added on {new Date(i.created_at).toLocaleDateString()} by {i.holder_name}</div>
                    </td>
                    <td className="p-5 font-mono"><span className="bg-white border px-2 py-1 rounded-[4px] text-[10px] text-slate-500 font-bold">{i.spec}</span></td>
                    <td className="p-5 font-bold text-center text-slate-800">{i.qty} {i.unit}</td>
                    <td className="p-5 text-center flex justify-center gap-2">
                        <button onClick={()=>{setConsumeItem(i)}} className="bg-orange-100 text-orange-700 px-3 py-1 rounded text-[10px] font-black hover:bg-orange-200">CONSUME</button>
                        <button onClick={()=>{setEditItem(i); setForm({cat:i.cat, sub:i.sub, make:i.make, model:i.model, spec:i.spec, qty:i.qty.toString(), unit:i.unit, isManual:i.is_manual}); setShowAddModal(true);}} className="bg-slate-100 text-slate-700 px-3 py-1 rounded text-[10px] font-black hover:bg-slate-200">EDIT</button>
                    </td>
                  </tr>
                ))}
            </tbody>
        </table></div>
        {/* FEATURE 7: PAGINATION CONTROLS */}
        <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-xs font-bold">
            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-3 py-1 bg-white border rounded disabled:opacity-50">Previous</button>
            <span>Page {currentPage} of {totalPages}</span>
            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-3 py-1 bg-white border rounded disabled:opacity-50">Next</button>
        </div>
      </div>

      {/* MODAL: ADD / EDIT STOCK (FEATURE 3 & 5) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase">
             <div className="p-6 border-b bg-slate-50 flex justify-between items-center"><h3 className="font-black text-slate-800 text-lg">{editItem ? 'Edit Item' : 'Add New Stock'}</h3><button onClick={resetForm}><i className="fa-solid fa-xmark"></i></button></div>
             <div className="p-6 space-y-3 font-bold">
                {/* FEATURE 5: EDIT MESSAGE & FEATURE 3: MANUAL TOGGLE */}
                {editItem && !form.isManual && <div className="bg-blue-50 p-2 text-[10px] text-blue-700 flex items-center gap-2"><i className="fa-solid fa-lock"></i> Standard Item: Only Quantity & Unit editable.</div>}
                {!editItem && (
                    <div className="flex justify-between items-center bg-yellow-50 p-2 rounded-lg border border-yellow-200 mb-4">
                        <span className="text-[10px] flex items-center gap-2"><i className="fa-solid fa-circle-info text-yellow-600"></i> Item not in list?</span>
                        <div className="flex items-center gap-2"><span className="text-[10px]">Manual Entry</span><button onClick={()=>setForm({...form, isManual:!form.isManual})} className={`w-10 h-5 rounded-full relative transition ${form.isManual ? 'bg-orange-500' : 'bg-slate-300'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${form.isManual ? 'left-6' : 'left-1'}`}></div></button></div>
                    </div>
                )}

                {/* FORM FIELDS */}
                <label className="text-[9px] text-slate-400">Category</label>
                {form.isManual ? <input type="text" disabled={editItem && !form.isManual} className="w-full p-2 border rounded-md text-xs font-bold" value={form.cat} onChange={e=>setForm({...form, cat:e.target.value})} />
                : <select disabled={editItem && !form.isManual} className="w-full p-2 border rounded-md text-xs font-bold" value={form.cat} onChange={e=>setForm({...form, cat:e.target.value})}><option value="">-- Select --</option>{MASTER_DATA.categories.map(c=><option key={c} value={c}>{c}</option>)}</select>}

                <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-[9px] text-slate-400">Sub Category</label>
                    {form.isManual ? <input type="text" disabled={editItem && !form.isManual} className="w-full p-2 border rounded-md text-xs font-bold" value={form.sub} onChange={e=>setForm({...form, sub:e.target.value})} />
                    : <select disabled={editItem && !form.isManual} className="w-full p-2 border rounded-md text-xs font-bold" value={form.sub} onChange={e=>setForm({...form, sub:e.target.value})}><option value="">-- Select --</option>{(MASTER_DATA.subCategories as any)[form.cat]?.map((s:string)=><option key={s} value={s}>{s}</option>)}</select>}</div>
                    <div><label className="text-[9px] text-slate-400">Make</label>
                    {form.isManual ? <input type="text" disabled={editItem && !form.isManual} className="w-full p-2 border rounded-md text-xs font-bold" value={form.make} onChange={e=>setForm({...form, make:e.target.value})} />
                    : <select disabled={editItem && !form.isManual} className="w-full p-2 border rounded-md text-xs font-bold" value={form.make} onChange={e=>setForm({...form, make:e.target.value})}><option value="">-- Select --</option>{MASTER_DATA.makes.map(m=><option key={m} value={m}>{m}</option>)}</select>}</div>
                </div>

                <label className="text-[9px] text-slate-400">Model</label>
                <input disabled={editItem && !form.isManual} type="text" className="w-full p-2 border rounded-md text-xs font-bold" value={form.model} onChange={e=>setForm({...form, model:e.target.value})} />
                
                <label className="text-[9px] text-slate-400">Specification</label>
                <input disabled={editItem && !form.isManual} type="text" className="w-full p-2 border rounded-md text-xs font-bold" value={form.spec} onChange={e=>setForm({...form, spec:e.target.value})} />
                
                <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-[9px] text-slate-400">Quantity</label><input type="number" className="w-full p-2 border rounded-md text-xs font-bold" value={form.qty} onChange={e=>setForm({...form, qty:e.target.value})} /></div>
                    <div><label className="text-[9px] text-slate-400">Unit</label><select className="w-full p-2 border rounded-md text-xs font-bold" value={form.unit} onChange={e=>setForm({...form, unit:e.target.value})}><option value="Nos">Nos</option><option value="Sets">Sets</option><option value="Mtrs">Mtrs</option></select></div>
                </div>

                <div className="flex gap-2 mt-4">
                    {editItem && <button onClick={()=>handleDeleteItem(editItem.id)} className="flex-1 py-3 bg-red-50 text-red-600 font-black rounded-xl uppercase tracking-widest hover:bg-red-100"><i className="fa-solid fa-trash mr-2"></i>Delete</button>}
                    <button onClick={handleSaveItem} className="flex-[2] py-3 iocl-btn text-white font-black rounded-xl shadow-lg uppercase tracking-widest">{editItem ? 'Update Item' : 'Save Stock'}</button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* MODAL: CONSUME STOCK (FEATURE 4) */}
      {consumeItem && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-scale-in uppercase font-bold">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-black text-slate-800">Consume Item</h3><button onClick={()=>{setConsumeItem(null); setConsumeForm({qty:"", note:""});}}><i className="fa-solid fa-xmark text-slate-400"></i></button></div>
            <p className="text-sm text-slate-700 mb-1">{consumeItem.item}</p>
            <p className="text-[10px] text-green-600 mb-4">Available: {consumeItem.qty} {consumeItem.unit}</p>
            
            <div className="space-y-3">
                <div><label className="text-[10px] text-slate-400">Quantity Used</label><input type="number" className="w-full p-3 border rounded-lg font-bold focus:border-orange-500" value={consumeForm.qty} onChange={e=>setConsumeForm({...consumeForm, qty:e.target.value})} /></div>
                <div><label className="text-[10px] text-slate-400">Purpose / Note</label><textarea className="w-full p-3 border rounded-lg font-bold h-24 focus:border-orange-500" value={consumeForm.note} onChange={e=>setConsumeForm({...consumeForm, note:e.target.value})}></textarea></div>
                <button onClick={handleConsume} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm shadow-md font-black tracking-widest hover:bg-indigo-700">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUMMARY (FEATURE 1) */}
      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase font-bold">
                <div className="p-6 border-b bg-indigo-50 flex justify-between items-center"><h3 className="font-black text-indigo-900 text-lg tracking-tight"><i className="fa-solid fa-boxes-stacked mr-2"></i> Store Stock Summary</h3><button onClick={()=>setShowSummary(false)}><i className="fa-solid fa-xmark text-slate-400"></i></button></div>
                <div className="p-6 max-h-[60vh] overflow-y-auto"><table className="w-full text-left text-xs font-bold uppercase"><thead className="border-b text-slate-400 uppercase"><tr><th className="pb-2">Category &gt; Sub-Category</th><th className="pb-2 text-right">Total Available Stock</th></tr></thead>
                    <tbody className="divide-y">{getSummaryData().map((s: any, idx) => (
                        <tr key={idx} className="hover:bg-slate-50"><td className="py-3 text-slate-700">{s.cat} <i className="fa-solid fa-chevron-right text-[8px] mx-1 opacity-50"></i> {s.sub}</td><td className="py-3 text-right font-black text-indigo-600 text-sm">{s.total} Nos</td></tr>
                    ))}</tbody></table></div>
                <div className="p-4 bg-slate-50 text-center"><button onClick={()=>setShowSummary(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Close Summary</button></div>
            </div>
        </div>
      )}
    </div>
  );
}
