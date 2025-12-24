"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function MyStoreView({ profile, fetchProfile }: any) {
  const [store, setStore] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<any>(null);
  const [consumeItem, setConsumeItem] = useState<any>(null);
  const [bifurcationItem, setBifurcationItem] = useState<any>(null);
  const [form, setForm] = useState({ 
    item: "", cat: "", sub: "", spec: "", qty: "", unit: "", make: "", model: "" 
  });
  const [consumeForm, setConsumeForm] = useState({ qty: "", note: "" });

  const fetchStore = async () => {
    if (!profile?.unit) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("inventory")
        .select("*")
        .eq("unit", profile.unit)
        .order("id", { ascending: false });
      if (data) setStore(data);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (profile) fetchStore(); 
  }, [profile]);

  const resetForm = () => {
    setForm({ item: "", cat: "", sub: "", spec: "", qty: "", unit: "", make: "", model: "" });
    setEditItem(null);
  };

  const handleSave = async () => {
    if (!form.item || !form.qty) return alert("Fill required fields!");
    try {
      const payload = { 
        ...form, 
        qty: Number(form.qty), 
        unit: profile.unit, 
        owner_id: profile.id 
      };
      
      if (editItem?.id) { 
        await supabase.from("inventory").update(payload).eq("id", editItem.id); 
      } 
      else { 
        await supabase.from("inventory").insert([payload]); 
        // Update profile item count
        await supabase.from("profiles")
          .update({ item_count: (profile.item_count || 0) + 1 })
          .eq('id', profile.id); 
      }
      
      resetForm(); 
      await fetchStore(); 
      if (fetchProfile) fetchProfile();
      alert("Inventory Updated Successfully!");
    } catch (e) { 
      console.error(e);
      alert("Save Error Occurred"); 
    }
  };

  const handleConsume = async () => {
    const q = Number(consumeForm.qty);
    if (!q || q <= 0) return alert("Invalid Qty");
    if (!consumeItem) return;

    try {
      const { data: live } = await supabase
        .from("inventory")
        .select("qty")
        .eq("id", consumeItem.id)
        .single();
        
      if (!live || live.qty < q) return alert("Insufficient Stock!");

      // Update Stock
      await supabase.from("inventory").update({ qty: live.qty - q }).eq("id", consumeItem.id);
      
      // Log usage
      await supabase.from("usage_logs").insert([{ 
        item_id: consumeItem.id, 
        item_name: consumeItem.item, 
        cat: consumeItem.cat, 
        sub: consumeItem.sub, 
        spec: consumeItem.spec, 
        qty_consumed: q, 
        unit: consumeItem.unit, 
        purpose: consumeForm.note, 
        consumer_uid: profile.id, 
        consumer_name: profile.name, 
        consumer_unit: profile.unit, 
        timestamp: Date.now(), 
        make: consumeItem.make || '-', 
        model: consumeItem.model || '-' 
      }]);

      setConsumeItem(null); 
      setBifurcationItem(null); 
      await fetchStore(); 
      alert("Usage Logged!");
    } catch (e) { 
      console.error(e);
      alert("Error logging usage"); 
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm("Are you sure?")) return;
    try {
      await supabase.from("inventory").delete().eq("id", id);
      await fetchStore();
      if (fetchProfile) fetchProfile();
    } catch (e) {
      alert("Delete Error");
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20 font-roboto uppercase font-bold tracking-tight">
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-3xl shadow-xl border-t-8 border-blue-600 gap-6">
            <div>
                <h2 className="text-3xl font-black text-slate-800 flex items-center justify-center md:justify-start gap-4">
                    <i className="fa-solid fa-boxes-stacked text-blue-600"></i> MY STORE INVENTORY
                </h2>
                <p className="text-[11px] text-slate-400 font-black tracking-[0.3em] mt-2 italic uppercase">Unit: {profile?.unit}</p>
            </div>
            <button onClick={() => { resetForm(); setEditItem({}); }} className="w-full md:w-auto bg-blue-600 text-white px-10 py-4 rounded-2xl text-[12px] font-black shadow-lg hover:bg-blue-700 transition-all uppercase tracking-widest">
                + Add New Spare
            </button>
        </div>

        {/* --- MAIN TABLE --- */}
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm divide-y-2 divide-slate-100 font-bold uppercase">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <tr>
                            <th className="p-6 pl-8">Material Detail</th>
                            <th className="p-6">Category & Sub</th>
                            <th className="p-6">Make & Model</th>
                            <th className="p-6 text-center">In-Stock</th>
                            <th className="p-6 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600 uppercase">
                        {loading ? (
                            <tr><td colSpan={5} className="p-20 text-center text-slate-400 animate-pulse font-black tracking-[0.2em]">SYNCING STORE...</td></tr>
                        ) : store.length === 0 ? (
                            <tr><td colSpan={5} className="p-20 text-center text-slate-300 font-black tracking-widest uppercase">No Spares in this unit store</td></tr>
                        ) : store.map(item => (
                            <tr key={item.id} className="hover:bg-blue-50/50 transition border-b group">
                                <td className="p-6 pl-8 leading-tight">
                                    <div className="text-slate-800 font-black text-[15px] group-hover:text-blue-600">{item.item}</div>
                                    <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter line-clamp-1">{item.spec}</div>
                                </td>
                                <td className="p-6">
                                    <div className="text-[11px] text-slate-700 font-black">{item.cat}</div>
                                    <div className="text-[9px] text-slate-400 font-bold">{item.sub || '-'}</div>
                                </td>
                                <td className="p-6 font-mono text-[10px]">
                                    <div className="text-slate-500 font-black tracking-tighter">M: {item.make || '-'}</div>
                                    <div className="text-slate-400 font-black tracking-tighter"># {item.model || '-'}</div>
                                </td>
                                <td className="p-6 text-center">
                                    <div className={`text-xl font-black ${item.qty <= 5 ? 'text-red-600 animate-pulse' : 'text-blue-700'}`}>{item.qty}</div>
                                    <div className="text-[9px] text-slate-400 font-black tracking-widest uppercase">{item.unit}</div>
                                </td>
                                <td className="p-6">
                                    <div className="flex gap-2 justify-center">
                                        <button onClick={() => setConsumeItem(item)} className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-md hover:bg-emerald-600 transition-all uppercase">Consume</button>
                                        <button onClick={() => { setEditItem(item); setForm(item); }} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-md hover:bg-slate-700 transition-all uppercase">Edit</button>
                                        <button onClick={() => handleDeleteItem(item.id)} className="text-red-300 hover:text-red-600 px-2 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* --- ADD/EDIT MODAL --- */}
        {editItem && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in border-t-8 border-blue-600">
                <div className="p-8 border-b bg-slate-50 flex justify-between items-center font-black">
                    <h3 className="text-slate-800 text-xl uppercase tracking-tighter">{editItem.id ? 'Modify Inventory Record' : 'Add New Inventory'}</h3>
                    <button onClick={resetForm} className="text-slate-400 hover:text-red-500 transition-colors"><i className="fa-solid fa-circle-xmark text-2xl"></i></button>
                </div>
                <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-6 font-black uppercase">
                    <div className="md:col-span-3">
                        <label className="text-[10px] text-slate-400 tracking-widest block mb-1">Item Name / Description *</label>
                        <input value={form.item} onChange={e => setForm({...form, item: e.target.value.toUpperCase()})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 transition-all text-sm font-black" placeholder="E.G. BALL BEARING 6205 ZZ" />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-400 tracking-widest block mb-1">Category</label>
                        <input value={form.cat} onChange={e => setForm({...form, cat: e.target.value.toUpperCase()})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 transition-all text-xs font-black" placeholder="E.G. MECHANICAL" />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-400 tracking-widest block mb-1">Sub-Category</label>
                        <input value={form.sub} onChange={e => setForm({...form, sub: e.target.value.toUpperCase()})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 transition-all text-xs font-black" placeholder="E.G. BEARINGS" />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-400 tracking-widest block mb-1">Stock Quantity *</label>
                        <input type="number" value={form.qty} onChange={e => setForm({...form, qty: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 transition-all text-sm font-black" />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-400 tracking-widest block mb-1">Unit (Nos/Mtr/etc)</label>
                        <input value={form.unit} onChange={e => setForm({...form, unit: e.target.value.toUpperCase()})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 transition-all text-sm font-black" placeholder="NOS" />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-400 tracking-widest block mb-1">Make / Brand</label>
                        <input value={form.make} onChange={e => setForm({...form, make: e.target.value.toUpperCase()})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 transition-all text-sm font-black" placeholder="E.G. SKF / NBC" />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-400 tracking-widest block mb-1">Model / Part No</label>
                        <input value={form.model} onChange={e => setForm({...form, model: e.target.value.toUpperCase()})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 transition-all text-sm font-black" placeholder="E.G. 123-ABC" />
                    </div>
                    <div className="md:col-span-3">
                        <label className="text-[10px] text-slate-400 tracking-widest block mb-1">Technical Specification</label>
                        <textarea value={form.spec} onChange={e => setForm({...form, spec: e.target.value.toUpperCase()})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 h-24 transition-all font-bold text-xs uppercase" placeholder="ADD SPECIFICATIONS..."></textarea>
                    </div>
                    <button onClick={handleSave} className="md:col-span-3 bg-blue-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-blue-700 transition-all uppercase tracking-widest">
                        {editItem.id ? 'Confirm Changes' : 'Confirm & Save Stock'}
                    </button>
                </div>
            </div>
          </div>
        )}

        {/* --- CONSUME MODAL --- */}
        {consumeItem && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in border-t-8 border-emerald-500 font-black uppercase">
                <div className="p-8 border-b bg-emerald-50 flex justify-between items-center">
                    <h3 className="text-emerald-900 text-xl tracking-tighter">Consumption Log</h3>
                    <button onClick={() => setConsumeItem(null)} className="text-emerald-300 hover:text-red-500 transition-colors"><i className="fa-solid fa-circle-xmark text-2xl"></i></button>
                </div>
                <div className="p-10 space-y-6">
                    <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200">
                        <p className="text-[10px] text-slate-400 font-black tracking-widest mb-1">Active Item</p>
                        <p className="text-[16px] font-black text-slate-800">{consumeItem.item}</p>
                        <p className="text-[11px] text-blue-600 font-black mt-2 tracking-tighter italic">Currently Available: {consumeItem.qty} {consumeItem.unit}</p>
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-400 tracking-widest block mb-2">Quantity Used</label>
                        <input type="number" onChange={e => setConsumeForm({...consumeForm, qty: e.target.value})} className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 transition-all text-2xl font-black text-slate-800 text-center" placeholder="0" />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-400 tracking-widest block mb-2">Usage Purpose / Note</label>
                        <textarea onChange={e => setConsumeForm({...consumeForm, note: e.target.value.toUpperCase()})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 h-24 font-bold text-xs uppercase" placeholder="E.G. PUMP OVERHAULING AREA-1..."></textarea>
                    </div>
                    <button onClick={handleConsume} className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-emerald-700 transition-all uppercase tracking-widest">
                        Confirm & Log Consumption
                    </button>
                </div>
            </div>
          </div>
        )}
    </div>
  );
}
