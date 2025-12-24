"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function MyStoreView({ profile, fetchProfile }: any) {
  const [store, setStore] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<any>(null);
  const [consumeItem, setConsumeItem] = useState<any>(null);
  const [bifurcationItem, setBifurcationItem] = useState<any>(null);
  const [form, setForm] = useState({ item: "", cat: "", sub: "", spec: "", qty: "", unit: "", make: "", model: "" });
  const [consumeForm, setConsumeForm] = useState({ qty: "", note: "" });

  const fetchStore = async () => {
    if (!profile?.unit) return;
    setLoading(true);
    const { data } = await supabase.from("inventory").select("*").eq("unit", profile.unit).order("id", { ascending: false });
    if (data) setStore(data);
    setLoading(false);
  };

  useEffect(() => { if (profile) fetchStore(); }, [profile]);

  const resetForm = () => {
    setForm({ item: "", cat: "", sub: "", spec: "", qty: "", unit: "", make: "", model: "" });
    setEditItem(null);
  };

  const handleSave = async () => {
    if (!form.item || !form.qty) return alert("Fill required fields!");
    try {
      const payload = { ...form, qty: Number(form.qty), unit: profile.unit, owner_id: profile.id };
      if (editItem) { 
        await supabase.from("inventory").update(payload).eq("id", editItem.id); 
      } 
      else { 
        await supabase.from("inventory").insert([payload]); 
        await supabase.from("profiles").update({ item_count: (profile.item_count || 0) + 1 }).eq('id', profile.id); 
      }
      resetForm(); 
      await fetchStore(); 
      if (fetchProfile) fetchProfile();
      alert("Inventory Updated!");
    } catch (e) { 
      console.error(e);
      alert("Save Error"); 
    }
  };

  const handleConsume = async () => {
    const q = Number(consumeForm.qty);
    if (!q || q <= 0) return alert("Invalid Qty");
    try {
      const { data: live } = await supabase.from("inventory").select("qty").eq("id", consumeItem.id).single();
      if (!live || live.qty < q) return alert("Insufficient Stock!");

      await supabase.from("inventory").update({ qty: live.qty - q }).eq("id", consumeItem.id);
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
    } catch(e) { alert("Delete failed"); }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20 font-roboto uppercase font-bold tracking-tight">
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase flex items-center gap-3">
                    <i className="fa-solid fa-warehouse text-blue-600"></i> My Store Inventory
                </h2>
                <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] mt-1">MANAGE STOCK & CONSUMPTION</p>
            </div>
            <button onClick={() => setEditItem({})} className="bg-blue-600 text-white px-6 py-3 rounded-xl text-[12px] font-black shadow-lg hover:bg-blue-700 transition-all uppercase tracking-widest">
                + Add New Spare
            </button>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm divide-y font-bold uppercase">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <tr>
                            <th className="p-4 pl-6">Material Details</th>
                            <th className="p-4">Category</th>
                            <th className="p-4 text-center">Current Qty</th>
                            <th className="p-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-slate-600 uppercase">
                        {loading ? (
                            <tr><td colSpan={4} className="p-10 text-center text-slate-400 animate-pulse">Loading Inventory...</td></tr>
                        ) : store.length === 0 ? (
                            <tr><td colSpan={4} className="p-10 text-center text-slate-400">No items in your store</td></tr>
                        ) : store.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50 transition border-b">
                                <td className="p-4 pl-6 leading-tight">
                                    <div className="text-slate-800 font-bold text-[14px]">{item.item}</div>
                                    <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter">{item.spec}</div>
                                </td>
                                <td className="p-4">
                                    <div className="text-[11px] text-slate-700">{item.cat}</div>
                                    <div className="text-[9px] text-slate-400">{item.sub}</div>
                                </td>
                                <td className="p-4 text-center">
                                    <span className={`text-lg font-black ${item.qty <= 5 ? 'text-red-600' : 'text-blue-600'}`}>{item.qty}</span>
                                    <span className="text-[10px] ml-1 text-slate-400">{item.unit}</span>
                                </td>
                                <td className="p-4">
                                    <div className="flex gap-2 justify-center">
                                        <button onClick={() => setConsumeItem(item)} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-[10px] hover:bg-green-700 transition">Consume</button>
                                        <button onClick={() => { setEditItem(item); setForm(item); }} className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] hover:bg-slate-200 transition">Edit</button>
                                        <button onClick={() => handleDeleteItem(item.id)} className="text-red-400 hover:text-red-600 transition p-2"><i className="fa-solid fa-trash-can"></i></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* MODAL: ADD / EDIT */}
        {editItem && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
                    <div className="p-6 border-b bg-slate-50 flex justify-between items-center font-bold">
                        <h3 className="text-slate-800 text-lg uppercase tracking-tight">{editItem.id ? 'Edit Spare' : 'Add New Spare'}</h3>
                        <button onClick={resetForm} className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-xmark text-xl"></i></button>
                    </div>
                    <div className="p-8 grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="text-[10px] font-black text-slate-400 tracking-widest block mb-1">Item Name *</label>
                            <input value={form.item} onChange={e => setForm({...form, item: e.target.value})} className="w-full p-3 border-2 rounded-xl outline-none focus:border-blue-500" placeholder="E.G. BEARING 6205" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 tracking-widest block mb-1">Category</label>
                            <input value={form.cat} onChange={e => setForm({...form, cat: e.target.value})} className="w-full p-3 border-2 rounded-xl outline-none focus:border-blue-500" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 tracking-widest block mb-1">Quantity *</label>
                            <input type="number" value={form.qty} onChange={e => setForm({...form, qty: e.target.value})} className="w-full p-3 border-2 rounded-xl outline-none focus:border-blue-500" />
                        </div>
                        <div className="col-span-2">
                            <label className="text-[10px] font-black text-slate-400 tracking-widest block mb-1">Specification</label>
                            <textarea value={form.spec} onChange={e => setForm({...form, spec: e.target.value})} className="w-full p-3 border-2 rounded-xl h-20 outline-none focus:border-blue-500" />
                        </div>
                        <button onClick={handleSave} className="col-span-2 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:opacity-90 transition-opacity">
                            {editItem.id ? 'Update Record' : 'Save to Inventory'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL: CONSUME */}
        {consumeItem && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
                    <div className="p-6 border-b bg-green-50 flex justify-between items-center font-bold">
                        <h3 className="text-green-800 text-lg uppercase tracking-tight">Consume Spare</h3>
                        <button onClick={() => setConsumeItem(null)} className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-xmark text-xl"></i></button>
                    </div>
                    <div className="p-8 space-y-4">
                        <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200">
                            <p className="text-[10px] text-slate-400 uppercase">Item</p>
                            <p className="font-black text-slate-800">{consumeItem.item}</p>
                            <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-tighter">Available: {consumeItem.qty} {consumeItem.unit}</p>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 tracking-widest block mb-1">Consumption Qty</label>
                            <input type="number" onChange={e => setConsumeForm({...consumeForm, qty: e.target.value})} className="w-full p-3 border-2 rounded-xl outline-none focus:border-green-500 text-lg font-black" placeholder="0.00" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 tracking-widest block mb-1">Purpose / Note</label>
                            <textarea onChange={e => setConsumeForm({...consumeForm, note: e.target.value})} className="w-full p-3 border-2 rounded-xl outline-none focus:border-green-500 h-24" placeholder="E.G. REPLACED IN PUMP P-101" />
                        </div>
                        <button onClick={handleProcess} className="w-full bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-green-700 transition-all">
                            Confirm Consumption
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
