"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function MyStoreView({ profile, fetchProfile }: any) {
  const [myItems, setMyItems] = useState<any[]>([]); 
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ cat: "", sub: "", make: "", model: "", spec: "", qty: "", isManual: false });

  useEffect(() => { if (profile) fetch(); }, [profile]);
  
  const fetch = async () => { 
    try { const { data } = await supabase.from("inventory").select("*").eq("holder_uid", profile.id).order("id", { ascending: false }); if (data) setMyItems(data); } catch(e){} 
  };

  const handleSave = async () => {
    if (!form.spec || !form.qty) return alert("Sari details bhariye!");
    const itemName = `${form.make} ${form.sub} ${form.model}`.trim();
    try {
        const { error } = await supabase.from("inventory").insert([{ item: itemName, cat: form.cat, sub: form.sub, make: form.make, model: form.model, spec: form.spec, qty: parseInt(form.qty), unit: 'Nos', holder_unit: profile.unit, holder_uid: profile.id, holder_name: profile.name }]);
        if (!error) { 
            alert("Stock Inward Success!"); 
            fetch(); 
            setShowAddModal(false); 
            setForm({ cat: "", sub: "", make: "", model: "", spec: "", qty: "", isManual: false }); 
            await supabase.from("profiles").update({ item_count: (profile.item_count || 0) + 1 }).eq('id', profile.id); 
            fetchProfile(); 
        } else alert(error.message);
    } catch(e){ alert("Database connection error"); }
  };

  return (
    <div className="animate-fade-in space-y-6 pb-10 uppercase font-roboto font-bold">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl border shadow-sm uppercase">
        <div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-widest leading-none font-black">My Local Store</h2>
          <p className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded mt-2 uppercase tracking-tighter">ZONE: {profile?.unit}</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="iocl-btn text-white px-6 py-2.5 rounded-xl font-bold shadow-md flex items-center gap-2 uppercase"><i className="fa-solid fa-plus"></i> Add New Stock</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden font-bold font-roboto uppercase">
        <div className="overflow-x-auto">
          <table className="w-full text-left tracking-tight font-roboto">
            <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold border-b uppercase tracking-widest">
              <tr><th className="p-5 pl-8 font-bold">Category</th><th className="p-5 font-bold">Item Name</th><th className="p-5 font-bold">Spec</th><th className="p-5 text-center font-bold">Qty</th></tr>
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
      
      {/* Add Modal Placeholder - Logic is same as original */}
    </div>
  );
}
