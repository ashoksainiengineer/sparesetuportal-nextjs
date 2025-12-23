"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { masterCatalog } from "@/lib/masterdata";

export default function MyStoreView({ profile, fetchProfile }: any) {
  const [myItems, setMyItems] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0); 
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false); 
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [bifurcationItem, setBifurcationItem] = useState<any>(null); 
  const [editItem, setEditItem] = useState<any>(null);
  const [consumeItem, setConsumeItem] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [selCat, setSelCat] = useState("all");
  const [selSub, setSelSub] = useState("all");
  const [selEngineer, setSelEngineer] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [form, setForm] = useState({ cat: "", sub: "", make: "", model: "", spec: "", qty: "", unit: "Nos", note: "", isManual: false });
  const [consumeForm, setConsumeForm] = useState({ qty: "", note: "" });

  const fetchStore = useCallback(async () => {
    if (!profile?.unit) return;
    setLoading(true);
    try {
      let query = supabase.from("inventory").select("*", { count: "exact" }).eq("holder_unit", profile.unit);
      if (search) query = query.or(`item.ilike.%${search}%,spec.ilike.%${search}%`);
      if (selCat !== "all" && selCat !== "OUT_OF_STOCK") query = query.eq("cat", selCat);
      if (selCat === "OUT_OF_STOCK") query = query.eq("qty", 0);
      if (selSub !== "all") query = query.eq("sub", selSub);
      if (selEngineer !== "all") query = query.eq("holder_name", selEngineer);
      const from = (currentPage - 1) * itemsPerPage;
      const { data, count, error } = await query.range(from, from + itemsPerPage - 1).order("id", { ascending: false });
      if (!error) { setMyItems(data || []); setTotalCount(count || 0); }
    } catch (e) {} finally { setLoading(false); }
  }, [profile?.unit, search, selCat, selSub, selEngineer, currentPage]);

  useEffect(() => { fetchStore(); }, [fetchStore]);

  const uniqueCats = [...new Set(masterCatalog.map(i => i.cat))].sort();
  const availableSubs = [...new Set(masterCatalog.filter(i => i.cat === form.cat).map(i => i.sub))].sort();
  const availableMakes = [...new Set(masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub).map(i => i.make))].sort();
  const availableModels = [...new Set(masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub && i.make === form.make).map(i => i.model))].sort();
  const availableSpecs = [...new Set(masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub && i.make === form.make && i.model === form.model).map(i => i.spec))].sort();

  const handleConsume = async () => {
    const q = parseInt(consumeForm.qty);
    if (isNaN(q) || q <= 0) return alert("Invalid Qty!");
    setSubmitting(true);
    try {
      const { data: live } = await supabase.from("inventory").select("qty").eq("id", consumeItem.id).single();
      if (!live || q > live.qty) { alert(`Stock shortage! Only ${live?.qty || 0} left.`); setSubmitting(false); return; }
      await supabase.from("inventory").update({ qty: live.qty - q }).eq("id", consumeItem.id);
      await supabase.from("usage_logs").insert([{ item_id: consumeItem.id, item_name: consumeItem.item, cat: consumeItem.cat, sub: consumeItem.sub, spec: consumeItem.spec, qty_consumed: q, unit: consumeItem.unit, purpose: consumeForm.note, consumer_uid: profile.id, consumer_name: profile.name, consumer_unit: profile.unit, timestamp: Date.now(), make: consumeItem.make || '-', model: consumeItem.model || '-' }]);
      setConsumeItem(null); setBifurcationItem(null); await fetchStore(); alert("Usage Logged!");
    } catch (e) {} finally { setSubmitting(false); }
  };

  const handleSaveItem = async () => {
    const quantity = parseInt(form.qty);
    if (!form.cat || isNaN(quantity) || !form.spec) return alert("Fill mandatory fields!");
    setSubmitting(true);
    const itemName = form.isManual ? `${form.make} ${form.model} ${form.spec}`.trim() : `${form.make} ${form.sub} ${form.model}`.trim();
    const payload = { item: itemName, cat: form.cat, sub: form.sub, make: form.make, model: form.model, spec: form.spec, qty: quantity, unit: form.unit, note: form.note, is_manual: form.isManual, holder_unit: profile.unit, holder_uid: profile.id, holder_name: profile.name, timestamp: editItem ? editItem.timestamp : Date.now() };
    try {
      if (editItem) { await supabase.from("inventory").update(payload).eq("id", editItem.id); } 
      else { await supabase.from("inventory").insert([payload]); await supabase.from("profiles").update({ item_count: (profile.item_count || 0) + 1 }).eq('id', profile.id); }
      setShowAddModal(false); setEditItem(null); await fetchStore(); if(fetchProfile) fetchProfile();
    } catch (e) {} finally { setSubmitting(false); }
  };

  const formatTS = (ts: any) => new Date(Number(ts)).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  const resetForm = () => { setShowAddModal(false); setEditItem(null); setForm({ cat: "", sub: "", make: "", model: "", spec: "", qty: "", unit: "Nos", note: "", isManual: false }); };

  const getSummaryData = () => {
    const summary: any = {};
    myItems.forEach((i: any) => {
      if (Number(i.qty) > 0) {
        const key = `${i.cat} > ${i.sub}`;
        if (!summary[key]) summary[key] = { cat: i.cat, sub: i.sub, total: 0, unit: i.unit || 'Nos' };
        summary[key].total += Number(i.qty);
      }
    });
    return Object.values(summary).sort((a: any, b: any) => a.cat.localeCompare(b.cat));
  };

  return (
    <div className="animate-fade-in space-y-6 pb-20 font-roboto font-bold uppercase tracking-tight">
      <div className="bg-white p-6 rounded-xl border shadow-sm flex justify-between items-center border-t-4 border-orange-500">
        <div><h2 className="text-xl font-black text-slate-800 uppercase tracking-widest leading-none">My Local Store</h2><p className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded mt-2 inline-block uppercase">ZONE: {profile?.unit}</p></div>
      </div>

      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b bg-slate-50/80 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-grow md:w-80"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Search Material..." className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none font-black uppercase" value={search} onChange={e=>setSearch(e.target.value)} /></div>
            <div className="flex gap-2">
              <button onClick={() => setShowSummary(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-[10px] font-black shadow-md uppercase tracking-widest"><i className="fa-solid fa-chart-pie"></i> Summary</button>
              <button onClick={() => { resetForm(); setShowAddModal(true); }} className="bg-[#ff6b00] text-white px-4 py-2 rounded-lg text-[10px] font-black shadow-md uppercase tracking-widest hover:opacity-90 transition-all"><i className="fa-solid fa-plus"></i> Add Stock</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select className="border rounded-md text-[10px] font-bold p-2 uppercase bg-white cursor-pointer" value={selCat} onChange={e => { setSelCat(e.target.value); setSelSub("all"); }}><option value="all">Category: All</option><option value="OUT_OF_STOCK" className="text-red-600 font-black">OUT OF STOCK</option>{uniqueCats.map(c => <option key={c} value={c}>{c}</option>)}</select>
            <select disabled={selCat === "all" || selCat === "OUT_OF_STOCK"} className="border rounded-md text-[10px] font-bold p-2 uppercase bg-white cursor-pointer disabled:opacity-50" value={selSub} onChange={e => setSelSub(e.target.value)}><option value="all">Sub-Cat: All</option>{[...new Set(masterCatalog.filter(i => i.cat === selCat).map(i => i.sub))].sort().map((s: any) => <option key={s} value={s}>{s}</option>)}</select>
            <select className="border rounded-md text-[10px] font-bold p-2 uppercase bg-white cursor-pointer" value={selEngineer} onChange={e => setSelEngineer(e.target.value)}><option value="all">Engineer: Team View</option>{[...new Set(myItems.map(i => i.holder_name))].sort().map((name: any) => <option key={name} value={name}>{name === profile?.name ? "By: You" : name}</option>)}</select>
          </div>
        </div>

        <div className="overflow-x-auto"><table className="w-full text-left tracking-tight"><thead className="bg-slate-50 text-slate-500 text-[10px] font-black border-b tracking-widest uppercase"><tr><th className="p-5 pl-8">Material Detail</th><th className="p-5 text-center">Total Qty</th><th className="p-5 text-center">Action</th></tr></thead><tbody className="divide-y text-sm">
            {myItems.length > 0 ? myItems.map((i: any) => (
              <tr key={i.id} className="hover:bg-blue-50/50 transition border-b group cursor-pointer" onClick={() => setBifurcationItem({item: i.item, spec: i.spec, records: [i]})}>
                <td className="p-5 pl-8 leading-tight"><div className="text-slate-800 font-bold text-[14px]">{i.item}</div><div className="text-[9px] text-slate-400 mt-1 uppercase font-bold">{i.cat} &gt; {i.sub}</div><p className="text-[8px] text-indigo-500 mt-1 uppercase font-black opacity-0 group-hover:opacity-100 transition-opacity">Split details →</p></td>
                <td className="p-5 text-center font-black text-slate-800 text-[16px] whitespace-nowrap">{i.qty} {i.unit}</td>
                <td className="p-5 text-center"><button onClick={(e)=>{ e.stopPropagation(); setConsumeItem(i); }} className="bg-orange-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase">Consume</button></td>
              </tr>
            )) : <tr><td colSpan={3} className="p-20 text-center text-slate-300 font-black uppercase tracking-widest">No Items in your zone</td></tr>}
        </tbody></table></div>
        
        <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-[10px] font-black uppercase">
          <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-5 py-2 bg-white border-2 rounded-lg shadow-sm disabled:opacity-30">Prev</button>
          <span>Page {currentPage} of {Math.ceil(totalCount / itemsPerPage) || 1}</span>
          <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalCount/itemsPerPage)))} disabled={currentPage >= Math.ceil(totalCount/itemsPerPage)} className="px-5 py-2 bg-white border-2 rounded-lg shadow-sm disabled:opacity-30">Next</button>
        </div>
      </section>

      {/* Split-up Modal */}
      {bifurcationItem && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase font-bold">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center"><div><h3 className="font-black text-slate-800 text-lg">Material Split-up</h3><p className="text-[10px] text-slate-400">REF: {bifurcationItem.item}</p></div><button onClick={() => setBifurcationItem(null)} className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-xmark text-xl"></i></button></div>
            <div className="p-0 max-h-[60vh] overflow-y-auto"><table className="w-full text-left text-xs uppercase"><thead className="bg-slate-50 border-b text-[10px] text-slate-400 tracking-widest font-black uppercase"><tr><th className="p-4 pl-6">Added By</th><th className="p-4 text-center">Date</th><th className="p-4 text-center">Qty</th><th className="p-4 text-center">Action</th></tr></thead><tbody className="divide-y">{bifurcationItem.records.filter((r:any) => r.qty > 0).map((r: any) => (<tr key={r.id} className="hover:bg-slate-50 transition-colors"><td className="p-4 pl-6"><span className={`px-2 py-1 rounded text-[10px] font-black block w-fit ${r.holder_uid === profile?.id ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-slate-100 text-slate-600'}`}>{r.holder_uid === profile?.id ? "YOU" : r.holder_name}</span></td><td className="p-4 text-center text-[10px] text-slate-500">{formatTS(r.timestamp)}</td><td className="p-4 text-center font-black text-slate-800 text-[14px]">{r.qty} {r.unit}</td><td className="p-4 text-center flex justify-center gap-2"><button onClick={(e) => { e.stopPropagation(); setConsumeItem(r); }} className="bg-orange-600 text-white px-3 py-1.5 rounded text-[9px] font-black uppercase shadow-sm">Consume</button><button onClick={(e) => { e.stopPropagation(); setEditItem(r); setForm({ cat: r.cat, sub: r.sub, make: r.make, model: r.model, spec: r.spec, qty: r.qty.toString(), unit: r.unit, note: r.note || "", isManual: r.is_manual }); setShowAddModal(true); }} className="bg-slate-800 text-white px-3 py-1.5 rounded text-[9px] font-black uppercase shadow-sm">Edit</button></td></tr>))}</tbody></table></div>
            <div className="p-4 bg-slate-50 text-center"><button onClick={() => setBifurcationItem(null)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-all uppercase">Close</button></div>
          </div>
        </div>)}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase font-bold">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center font-black"><h3 className="text-slate-800 text-lg uppercase tracking-tight">{editItem ? 'Edit Entry' : 'Add Stock'}</h3><button onClick={resetForm} className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-xmark text-xl"></i></button></div>
            <div className="p-6 space-y-4 font-bold">
              {!editItem && (<div className="flex justify-between items-center bg-orange-50 p-4 rounded-xl border-2 border-dashed border-orange-200 mb-2 shadow-inner"><div className="flex flex-col"><span className="text-[10px] text-orange-800 font-black uppercase tracking-tight">ITEM NOT IN LIST? (Manual)</span></div><button onClick={() => setForm({ ...form, isManual: !form.isManual, cat: "", sub: "", make: "", model: "", spec: "" })} className={`w-12 h-6 rounded-full relative transition-colors ${form.isManual ? 'bg-orange-500' : 'bg-slate-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.isManual ? 'left-7' : 'left-1'}`}></div></button></div>)}
              <div className="space-y-3">
                <div><label className="text-[9px] text-slate-400 block mb-1 uppercase font-black">Category</label>{form.isManual ? <input type="text" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold" value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value })} /> : <select disabled={!!editItem} className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold uppercase cursor-pointer" value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value, sub: "", make: "", model: "", spec: "" })}><option value="">-- Choose Category --</option>{uniqueCats.map((c:any) => <option key={c} value={c}>{c}</option>)}</select>}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase font-black">Sub-Cat</label>{form.isManual ? <input type="text" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold" value={form.sub} onChange={e => setForm({ ...form, sub: e.target.value })} /> : <select disabled={!!editItem} className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold uppercase cursor-pointer" value={form.sub} onChange={e => setForm({ ...form, sub: e.target.value, make: "", model: "", spec: "" })}><option value="">-- Select --</option>{availableSubs.map((s:any) => <option key={s} value={s}>{s}</option>)}</select>}</div>
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase font-black">Make</label>{form.isManual ? <input type="text" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold" value={form.make} onChange={e => setForm({ ...form, make: e.target.value, model: "", spec: "" })} /> : <select disabled={!!editItem} className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold uppercase cursor-pointer" value={form.make} onChange={e => setForm({ ...form, make: e.target.value, model: "", spec: "" })}><option value="">-- Select --</option>{availableMakes.map((m:any) => <option key={m} value={m}>{m}</option>)}</select>}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase font-black tracking-widest">Quantity</label><input type="number" className="w-full p-3 border-2 border-slate-100 rounded-xl text-lg font-black text-indigo-600 outline-none shadow-sm" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} /></div>
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase font-black tracking-widest">Unit</label><select className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-black uppercase cursor-pointer" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}><option value="Nos">Nos</option><option value="Sets">Sets</option><option value="Mtrs">Mtrs</option></select></div>
                </div>
              </div>
              <button disabled={submitting} onClick={handleSaveItem} className="w-full py-4 bg-slate-900 text-white rounded-2xl shadow-lg font-black uppercase tracking-[0.2em] text-sm hover:opacity-90 transition-all shadow-md">{submitting ? "Processing..." : "Confirm Stock"}</button>
            </div>
          </div>
        </div>)}

      {/* Consume Modal */}
      {consumeItem && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[10001] flex items-center justify-center p-4 uppercase font-bold">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative animate-scale-in">
            <button onClick={() => setConsumeItem(null)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h3 className="text-xl font-black text-slate-800 uppercase mb-6 tracking-tight tracking-widest">Consume Material</h3>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 shadow-inner leading-tight"><p className="text-sm font-black text-slate-700 uppercase tracking-tighter">{consumeItem.item}</p><p className="text-[9px] text-green-600 mt-2 font-black tracking-widest uppercase">Sub-Balance: {consumeItem.qty} {consumeItem.unit}</p></div>
            <div className="space-y-4"><div><label className="text-[10px] text-slate-500 uppercase mb-1 block">Qty used</label><input type="number" className="w-full p-4 border-2 border-slate-100 rounded-2xl font-black text-xl text-center outline-none shadow-sm" value={consumeForm.qty} onChange={e => setConsumeForm({ ...consumeForm, qty: e.target.value })} /></div><div><label className="text-[10px] text-slate-500 uppercase mb-1 block">Purpose / Note</label><textarea placeholder="..." className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold h-24 text-xs outline-none focus:border-orange-500 shadow-sm uppercase" value={consumeForm.note} onChange={e => setConsumeForm({ ...consumeForm, note: e.target.value })}></textarea></div><button disabled={submitting} onClick={handleConsume} className="w-full py-4 bg-slate-900 text-white rounded-2xl shadow-xl font-black tracking-widest uppercase hover:bg-black transition-all shadow-md">{submitting ? "Verifying..." : "Confirm Consumption"}</button></div>
          </div>
        </div>)}

      {/* Summary Modal */}
      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase font-bold">
            <div className="p-6 border-b bg-indigo-50 flex justify-between items-center"><h3 className="font-black text-indigo-900 text-lg uppercase tracking-tight tracking-widest uppercase"><i className="fa-solid fa-boxes-stacked mr-2"></i> Zone Balance Summary</h3><button onClick={() => setShowSummary(false)} className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-xmark text-xl"></i></button></div>
            <div className="p-6 max-h-[60vh] overflow-y-auto"><table className="w-full text-left text-xs font-bold uppercase"><thead className="border-b text-slate-400 uppercase tracking-widest text-[10px]"><tr><th className="pb-3">Category &gt; Sub-Category</th><th className="pb-3 text-right">Total Balance</th></tr></thead><tbody className="divide-y">{getSummaryData().map((s: any, idx: number) => (<tr key={idx} className="hover:bg-slate-50 transition border-b"><td className="py-4 text-slate-700 text-[11px]">{s.cat} <i className="fa-solid fa-chevron-right text-[8px] mx-1 opacity-40"></i> {s.sub}</td><td className="py-4 text-right font-black text-indigo-600 text-sm">{s.total} {s.unit}</td></tr>))}</tbody></table></div>
            <div className="p-4 bg-slate-50 text-center"><button onClick={() => setShowSummary(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-all uppercase">Close Summary</button></div>
          </div>
        </div>)}
    </div>
  );
}
