"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Engineering Master Data for Dropdowns
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
    makes: ["Sulzer", "SKF", "Siemens", "L&T", "ABB", "Kirloskar", "Honeywell", "Emerson", "Manual Entry"]
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

  // Add/Edit Form State
  const [form, setForm] = useState({ 
    cat: "", sub: "", make: "", model: "", spec: "", qty: "", unit: "Nos", isManual: false 
  });
  const [consumeQty, setConsumeQty] = useState("");

  useEffect(() => { if (profile) fetchStore(); }, [profile]);

  const fetchStore = async () => { 
    const { data } = await supabase.from("inventory").select("*").eq("holder_uid", profile.id).order("id", { ascending: false }); 
    if (data) setMyItems(data); 
  };

  // --- FEATURE 1: ADD / EDIT LOGIC ---
  const handleSaveItem = async () => {
    if (!form.cat || !form.qty || !form.spec) return alert("Please fill mandatory fields!");
    
    const itemName = form.isManual ? form.model : `${form.make} ${form.sub} ${form.model}`;
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
        setShowAddModal(false); setEditItem(null); fetchStore(); fetchProfile();
    } catch(e) { alert("Error saving data"); }
  };

  // --- FEATURE 2: CONSUME LOGIC ---
  const handleConsume = async () => {
    const q = parseInt(consumeQty);
    if (!q || q <= 0 || q > consumeItem.qty) return alert("Invalid Quantity");

    try {
        // 1. Update Inventory
        await supabase.from("inventory").update({ qty: consumeItem.qty - q }).eq("id", consumeItem.id);
        // 2. Log Usage
        await supabase.from("usage_logs").insert([{
            consumer_uid: profile.id, item_name: consumeItem.item, category: consumeItem.cat, 
            qty_consumed: q, timestamp: Date.now().toString()
        }]);
        alert("Stock Consumed & Logged!");
        setConsumeItem(null); setConsumeQty(""); fetchStore();
    } catch(e) { alert("Failed to consume stock"); }
  };

  // --- FEATURE 4: EXPORT ---
  const exportStore = () => {
    const headers = "Category,Item Name,Specification,Quantity,Unit\n";
    const rows = filteredItems.map(i => `"${i.cat}","${i.item}","${i.spec}","${i.qty}","${i.unit}"\n`);
    const blob = new Blob([headers + rows.join("")], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'MyLocalStore.csv'; a.click();
  };

  const filteredItems = myItems.filter(i => 
    (i.item.toLowerCase().includes(search.toLowerCase()) || i.spec.toLowerCase().includes(search.toLowerCase())) &&
    (selCat === "all" || i.cat === selCat) && (selSub === "all" || i.sub === selSub)
  );

  return (
    <div className="animate-fade-in space-y-6 pb-20 font-roboto font-bold uppercase">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-widest leading-none font-black">My Local Store</h2>
          <p className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded mt-2 tracking-tighter">ZONE: {profile?.unit}</p>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          <button onClick={exportStore} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-[10px] shadow-md"><i className="fa-solid fa-file-csv mr-2"></i>Export</button>
          <button onClick={() => setShowSummary(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-[10px] shadow-md"><i className="fa-solid fa-list-check mr-2"></i>Summary</button>
          <button onClick={() => { setForm({cat:"", sub:"", make:"", model:"", spec:"", qty:"", unit:"Nos", isManual:false}); setShowAddModal(true); }} className="iocl-btn text-white px-4 py-2 rounded-lg text-[10px] shadow-md"><i className="fa-solid fa-plus mr-2"></i>Add New Stock</button>
        </div>
      </div>

      {/* FEATURE 3: FILTERS & SEARCH */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border">
        <div className="relative"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Search my items..." className="w-full pl-9 pr-4 py-2 border rounded-md text-xs outline-none" onChange={e=>setSearch(e.target.value)} /></div>
        <select className="border rounded-md text-[10px] p-2 bg-white" onChange={e=>setSelCat(e.target.value)}><option value="all">All Categories</option>{MASTER_DATA.categories.map(c=><option key={c} value={c}>{c}</option>)}</select>
        <select className="border rounded-md text-[10px] p-2 bg-white" onChange={e=>setSelSub(e.target.value)}><option value="all">All Sub-Categories</option>{Object.values(MASTER_DATA.subCategories).flat().map(s=><option key={s} value={s}>{s}</option>)}</select>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left tracking-tight">
            <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold border-b tracking-widest uppercase"><tr><th className="p-5 pl-8">Item Detail</th><th className="p-5">Spec</th><th className="p-5 text-center">Qty</th><th className="p-5 text-center">Actions</th></tr></thead>
            <tbody className="divide-y text-sm">
                {filteredItems.map(i => (
                  <tr key={i.id} className="hover:bg-slate-50 border-b">
                    <td className="p-5 pl-8 leading-tight">
                        <div className="text-slate-800 font-bold text-[14px]">{i.item}</div>
                        <div className="text-[9px] text-slate-400 mt-1 uppercase">{i.cat} &gt; {i.sub}</div>
                    </td>
                    <td className="p-5 font-mono"><span className="bg-white border px-2 py-1 rounded-[4px] text-[10px] text-slate-500">{i.spec}</span></td>
                    <td className="p-5 font-bold text-center text-slate-800">{i.qty} {i.unit}</td>
                    <td className="p-5 text-center flex justify-center gap-2">
                        <button onClick={()=>{setConsumeItem(i)}} className="bg-orange-100 text-orange-700 px-3 py-1 rounded text-[10px] font-black hover:bg-orange-200">CONSUME</button>
                        <button onClick={()=>{setEditItem(i); setForm({cat:i.cat, sub:i.sub, make:i.make, model:i.model, spec:i.spec, qty:i.qty.toString(), unit:i.unit, isManual:i.is_manual}); setShowAddModal(true);}} className="bg-slate-100 text-slate-700 px-3 py-1 rounded text-[10px] font-black hover:bg-slate-200">EDIT</button>
                    </td>
                  </tr>
                ))}
            </tbody>
        </table></div>
      </div>

      {/* MODAL: ADD / EDIT STOCK */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase">
             <div className="p-6 border-b bg-slate-50 flex justify-between items-center"><h3 className="font-black text-slate-800 text-lg">{editItem ? 'Update Stock' : 'Add New Stock'}</h3><button onClick={()=>{setShowAddModal(false); setEditItem(null);}}><i className="fa-solid fa-xmark"></i></button></div>
             <div className="p-6 space-y-3 font-bold">
                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border mb-4">
                    <span className="text-[10px]">Manual Entry Mode</span>
                    <button onClick={()=>setForm({...form, isManual:!form.isManual})} className={`w-10 h-5 rounded-full relative transition ${form.isManual ? 'bg-orange-500' : 'bg-slate-300'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${form.isManual ? 'left-6' : 'left-1'}`}></div></button>
                </div>

                <label className="text-[9px] text-slate-400">Select Category</label>
                <select disabled={editItem && !form.isManual} className="w-full p-2 border rounded-md text-xs" value={form.cat} onChange={e=>setForm({...form, cat:e.target.value})}>
                    <option value="">-- Choose --</option>{MASTER_DATA.categories.map(c=><option key={c} value={c}>{c}</option>)}
                </select>

                {!form.isManual ? (
                    <>
                        <label className="text-[9px] text-slate-400">Sub-Category</label>
                        <select disabled={editItem} className="w-full p-2 border rounded-md text-xs" value={form.sub} onChange={e=>setForm({...form, sub:e.target.value})}>
                            <option value="">-- Choose --</option>
                            {(MASTER_DATA.subCategories as any)[form.cat]?.map((s:string)=><option key={s} value={s}>{s}</option>)}
                        </select>
                        <label className="text-[9px] text-slate-400">Manufacturer (Make)</label>
                        <select disabled={editItem} className="w-full p-2 border rounded-md text-xs" value={form.make} onChange={e=>setForm({...form, make:e.target.value})}>
                            <option value="">-- Choose --</option>{MASTER_DATA.makes.map(m=><option key={m} value={m}>{m}</option>)}
                        </select>
                    </>
                ) : null}

                <label className="text-[9px] text-slate-400">{form.isManual ? 'Custom Item Name' : 'Model / Part No'}</label>
                <input disabled={editItem && !form.isManual} type="text" className="w-full p-2 border rounded-md text-xs" value={form.model} onChange={e=>setForm({...form, model:e.target.value})} />
                
                <label className="text-[9px] text-slate-400">Specifications</label>
                <textarea disabled={editItem && !form.isManual} className="w-full p-2 border rounded-md text-xs" value={form.spec} onChange={e=>setForm({...form, spec:e.target.value})}></textarea>
                
                <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-[9px] text-slate-400">Qty</label><input type="number" className="w-full p-2 border rounded-md text-xs" value={form.qty} onChange={e=>setForm({...form, qty:e.target.value})} /></div>
                    <div><label className="text-[9px] text-slate-400">Unit</label><select className="w-full p-2 border rounded-md text-xs" value={form.unit} onChange={e=>setForm({...form, unit:e.target.value})}><option value="Nos">Nos</option><option value="Sets">Sets</option><option value="Mtrs">Mtrs</option></select></div>
                </div>

                <button onClick={handleSaveItem} className="w-full py-3 iocl-btn text-white font-black rounded-xl shadow-lg uppercase tracking-widest mt-4">{editItem ? 'Apply Changes' : 'Save Stock'}</button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL: CONSUME STOCK */}
      {consumeItem && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-scale-in uppercase font-bold text-center">
            <h3 className="text-orange-600 text-lg mb-2">Consume Stock</h3>
            <p className="text-xs text-slate-500 mb-6">{consumeItem.item}</p>
            <div className="bg-slate-50 p-4 rounded-xl border mb-6">
                <span className="text-[10px] text-slate-400 block mb-1">Available Qty: {consumeItem.qty}</span>
                <input type="number" placeholder="Enter Qty to use" className="w-full p-3 border rounded-lg text-center text-xl outline-none focus:border-orange-500" onChange={e=>setConsumeQty(e.target.value)} />
            </div>
            <div className="flex gap-2">
                <button onClick={()=>setConsumeItem(null)} className="flex-1 py-3 bg-slate-100 rounded-xl text-xs">CANCEL</button>
                <button onClick={handleConsume} className="flex-1 py-3 bg-orange-600 text-white rounded-xl text-xs shadow-md">CONFIRM CONSUME</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUMMARY */}
      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase font-bold">
                <div className="p-6 border-b bg-blue-50 flex justify-between items-center"><h3 className="text-blue-900">Store Summary</h3><button onClick={()=>setShowSummary(false)}><i className="fa-solid fa-xmark"></i></button></div>
                <div className="p-6 space-y-4">
                    {MASTER_DATA.categories.map(c => {
                        const total = myItems.filter(i=>i.cat === c).reduce((acc,curr)=>acc+curr.qty, 0);
                        return (
                            <div key={c} className="flex justify-between border-b pb-2">
                                <span className="text-xs text-slate-600">{c}</span>
                                <span className="text-sm text-blue-700">{total} Items</span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
