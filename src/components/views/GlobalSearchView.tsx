"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function GlobalSearchView({ profile }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [contributors, setContributors] = useState<any[]>([]);
  const [search, setSearch] = useState(""); 
  const [selCat, setSelCat] = useState("all");
  const [requestItem, setRequestItem] = useState<any>(null);
  const [reqForm, setReqForm] = useState({ qty: "", comment: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchAll(); lead(); }, []);
  
  const fetchAll = async () => { 
    try { const { data } = await supabase.from("inventory").select("*"); if (data) setItems(data); } catch(e){} 
  };
  
  const lead = async () => { 
    try { const { data } = await supabase.from("profiles").select("name, unit, item_count").order("item_count", { ascending: false }).limit(3); if (data) setContributors(data); } catch(e){} 
  };

  const handleSendRequest = async () => {
    if (!reqForm.qty || Number(reqForm.qty) <= 0 || Number(reqForm.qty) > requestItem.qty) { alert("Invalid quantity!"); return; }
    setSubmitting(true);
    try {
        const { error } = await supabase.from("requests").insert([{
            item_id: requestItem.id, item_name: requestItem.item, item_spec: requestItem.spec, item_unit: requestItem.unit, req_qty: Number(reqForm.qty), req_comment: reqForm.comment, from_name: profile.name, from_uid: profile.id, from_unit: profile.unit, to_name: requestItem.holder_name, to_uid: requestItem.holder_uid, to_unit: requestItem.holder_unit, status: 'pending', viewed_by_requester: false
        }]);
        if (!error) { alert("Request Sent!"); setRequestItem(null); setReqForm({ qty: "", comment: "" }); } else alert(error.message);
    } catch (err) { alert("Check your internet connection!"); }
    setSubmitting(false);
  };

  const filtered = items.filter((i: any) => (i.item.toLowerCase().includes(search.toLowerCase()) || i.spec.toLowerCase().includes(search.toLowerCase())) && (selCat === "all" ? true : i.cat === selCat));

  return (
    <div className="space-y-6 animate-fade-in font-roboto font-bold uppercase">
      <section className="bg-white p-4 rounded-xl border flex flex-wrap items-center gap-4 shadow-sm">
         <h2 className="text-sm font-bold uppercase text-slate-700 tracking-tight font-roboto"><i className="fa-solid fa-trophy text-yellow-500 mr-2"></i> Top Contributors</h2>
         <div className="flex gap-3 overflow-x-auto flex-1 pb-1">
           {contributors.map((c, idx) => (
             <div key={idx} className="bg-slate-50 p-2 rounded-lg border flex items-center gap-3 min-w-[180px] shadow-sm">
               <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs border-2 border-orange-400">{c.name.charAt(0)}</div>
               <div><p className="text-xs font-bold text-slate-800 truncate">{c.name}</p><p className="text-[9px] text-slate-400 uppercase tracking-tighter">{c.unit}</p><p className="text-[9px] font-bold text-green-600">{c.item_count || 0} Items</p></div>
             </div>
           ))}
         </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b bg-slate-50/80 flex flex-wrap items-center gap-2">
             <div className="relative flex-grow md:w-80 font-bold"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Global Inventory Search..." className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none focus:ring-1 font-bold uppercase font-roboto" onChange={e=>setSearch(e.target.value)} /></div>
             <select className="border rounded-md text-xs font-bold p-2 bg-white uppercase font-roboto" onChange={e=>setSelCat(e.target.value)}>
               <option value="all">Category: All</option>
               {[...new Set(items.map(i => i.cat))].sort().map(c => <option key={c} value={c}>{c}</option>)}
             </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left tracking-tight font-roboto font-bold uppercase">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b tracking-widest">
              <tr><th className="p-4 pl-6 font-bold">Item Detail</th><th className="p-4 font-bold">Spec</th><th className="p-4 text-center font-bold">Qty</th><th className="p-4 text-center font-bold">Action</th></tr>
            </thead>
            <tbody className="divide-y text-sm">
              {filtered.map((i: any, idx: number) => (
                <tr key={idx} className={`hover:bg-slate-50 transition border-b border-slate-50 ${i.qty === 0 ? 'bg-red-50/20' : ''}`}>
                  <td className="p-4 pl-6 leading-tight">
                    <div className="text-slate-800 font-bold text-[14px] tracking-tight uppercase">{i.item}</div>
                    <div className="text-[9.5px] text-slate-400 font-bold uppercase mt-1 tracking-wider">{i.cat}</div>
                  </td>
                  <td className="p-4">
                    <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-[4px] text-[10.5px] font-bold text-slate-500 shadow-sm uppercase inline-block">{i.spec}</span>
                  </td>
                  <td className="p-4 text-center font-bold whitespace-nowrap text-slate-800 text-[14px]">{i.qty} {i.unit}</td>
                  <td className="p-4 text-center uppercase">
                      {i.holder_uid === profile?.id ? <span className="text-[10px] font-black text-green-600 italic tracking-tighter uppercase">MY STORE</span> : <button onClick={()=>setRequestItem(i)} className="bg-[#ff6b00] text-white px-4 py-1.5 rounded-[4px] text-[10.5px] font-black shadow-sm uppercase tracking-widest">Request</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {requestItem && (
        <div className="fixed top-0 left-0 w-full h-full bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Raise Request</h3>
              <button onClick={()=>setRequestItem(null)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6 space-y-4 font-bold uppercase">
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                <p className="text-[10px] text-orange-600 font-black uppercase mb-1 tracking-widest">Requesting Material</p>
                <p className="text-sm font-bold text-slate-800">{requestItem.item}</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase">{requestItem.spec}</p>
              </div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity (Available: {requestItem.qty})</label><input type="number" placeholder="Enter Qty" className="w-full mt-1 p-3 border rounded-lg outline-none font-bold text-slate-800" onChange={e=>setReqForm({...reqForm, qty:e.target.value})} /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purpose / Log Comment</label><textarea placeholder="Why do you need this?" className="w-full mt-1 p-3 border rounded-lg outline-none font-bold text-xs h-24 text-slate-800" onChange={e=>setReqForm({...reqForm, comment:e.target.value})}></textarea></div>
              <button onClick={handleSendRequest} disabled={submitting} className="w-full py-3 bg-[#ff6b00] text-white font-black rounded-xl shadow-lg uppercase tracking-widest disabled:opacity-50">
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
