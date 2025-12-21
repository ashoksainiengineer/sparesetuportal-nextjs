"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function MyStoreView({ profile, fetchProfile }: any) {
  const [myItems, setMyItems] = useState<any[]>([]); 
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ cat: "", sub: "", make: "", model: "", spec: "", qty: "" });

  useEffect(() => { if (profile) fetch(); }, [profile]);
  
  const fetch = async () => { 
    try { const { data } = await supabase.from("inventory").select("*").eq("holder_uid", profile.id).order("id", { ascending: false }); if (data) setMyItems(data); } catch(e){} 
  };

  const handleSave = async () => {
    if (!form.spec || !form.qty) return alert("Details bhariye!");
    const itemName = `${form.make} ${form.sub} ${form.model}`.trim();
    try {
        const { error } = await supabase.from("inventory").insert([{ 
            item: itemName, cat: form.cat, sub: form.sub, make: form.make, model: form.model, spec: form.spec, qty: parseInt(form.qty), 
            unit: 'Nos', holder_unit: profile.unit, holder_uid: profile.id, holder_name: profile.name 
        }]);
        if (!error) { 
            alert("Stock Inward Success!"); 
            fetch(); 
            setShowAddModal(false); 
            setForm({ cat: "", sub: "", make: "", model: "", spec: "", qty: "" }); 
            await supabase.from("profiles").update({ item_count: (profile.item_count || 0) + 1 }).eq('id', profile.id); 
            fetchProfile(); 
        } else alert(error.message);
    } catch(e){ alert("Database connection error"); }
  };

  return (
    <div className="animate-fade-in space-y-6 pb-10 uppercase font-roboto font-bold">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-widest leading-none font-black">My Local Store</h2>
          <p className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded mt-2 uppercase tracking-tighter">ZONE: {profile?.unit}</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="iocl-btn text-white px-6 py-2.5 rounded-xl font-bold shadow-md flex items-center gap-2 uppercase"><i className="fa-solid fa-plus"></i> Add New Stock</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden font-bold font-roboto uppercase">
        <div className="overflow-x-auto">
          <table className="w-full text-left tracking-tight">
            <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold border-b uppercase tracking-widest">
              <tr><th className="p-5 pl-8">Category</th><th className="p-5">Item Name</th><th className="p-5">Spec</th><th className="p-5 text-center">Qty</th></tr>
            </thead>
            <tbody className="divide-y text-sm">
                {myItems.map(i => (
                  <tr key={i.id} className="hover:bg-slate-50 transition border-b border-slate-50 font-bold uppercase">
                    <td className="p-5 pl-8 text-[9.5px] font-bold text-slate-400 leading-none">{i.cat}</td>
                    <td className="p-5 leading-tight uppercase"><div className="text-slate-800 font-bold text-[14px] tracking-tight">{i.item}</div></td>
                    <td className="p-5 font-mono uppercase font-bold"><span className="bg-white border border-slate-200 px-2.5 py-1 rounded-[4px] text-[10.5px] font-bold text-slate-500 shadow-sm uppercase">{i.spec}</span></td>
                    <td className="p-5 font-bold text-center font-mono uppercase whitespace-nowrap text-slate-800 text-[14px]">{i.qty} {i.unit}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed top-0 left-0 w-full h-full bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
             <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Inward New Material</h3>
                <button onClick={()=>setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
             </div>
             <div className="p-6 space-y-3 font-bold uppercase">
                <input type="text" placeholder="Category (e.g. Pump Spares)" className="w-full p-3 border rounded-lg text-xs" onChange={e=>setForm({...form, cat:e.target.value})} />
                <input type="text" placeholder="Make (e.g. Sulzer)" className="w-full p-3 border rounded-lg text-xs" onChange={e=>setForm({...form, make:e.target.value})} />
                <input type="text" placeholder="Model" className="w-full p-3 border rounded-lg text-xs" onChange={e=>setForm({...form, model:e.target.value})} />
                <input type="text" placeholder="Specifications" className="w-full p-3 border rounded-lg text-xs" onChange={e=>setForm({...form, spec:e.target.value})} />
                <input type="number" placeholder="Quantity" className="w-full p-3 border rounded-lg text-xs" onChange={e=>setForm({...form, qty:e.target.value})} />
                <button onClick={handleSave} className="w-full py-3 iocl-btn text-white font-black rounded-xl shadow-lg uppercase tracking-widest mt-4">Save Stock</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
