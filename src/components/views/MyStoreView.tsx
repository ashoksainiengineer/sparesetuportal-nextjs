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

  const [form, setForm] = useState({
    cat: "", sub: "", make: "", model: "", spec: "", qty: "", unit: "Nos", note: "", isManual: false
  });
  const [consumeForm, setConsumeForm] = useState({ qty: "", note: "" });

  const fetchStore = useCallback(async () => {
    if (!profile?.unit) return;
    setLoading(true); // Effect starts
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
    } catch (e) { console.error("Fetch failed", e); }
    finally { setLoading(false); /* Effect ends */ }
  }, [profile?.unit, search, selCat, selSub, selEngineer, currentPage]);

  useEffect(() => { fetchStore(); }, [fetchStore]);

  useEffect(() => {
    if (form.isManual) return;
    const cats = [...new Set(masterCatalog.map(i => i.cat))].sort();
    if (cats.length === 1 && !form.cat) setForm(p => ({ ...p, cat: cats[0] }));
    if (form.cat) {
      const subs = [...new Set(masterCatalog.filter(i => i.cat === form.cat).map(i => i.sub))].sort();
      if (subs.length === 1 && !form.sub) setForm(p => ({ ...p, sub: subs[0] }));
      if (form.sub) {
        const makes = [...new Set(masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub).map(i => i.make))].sort();
        if (makes.length === 1 && !form.make) setForm(p => ({ ...p, make: makes[0] }));
        if (form.make) {
          const models = [...new Set(masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub && i.make === form.make).map(i => i.model))].sort();
          if (models.length === 1 && !form.model) setForm(p => ({ ...p, model: models[0] }));
          if (form.model) {
            const specs = [...new Set(masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub && i.make === form.make && i.model === form.model).map(i => i.spec))].sort();
            if (specs.length === 1 && !form.spec) setForm(p => ({ ...p, spec: specs[0] }));
          }
        }
      }
    }
  }, [form.cat, form.sub, form.make, form.model, form.isManual]);

  const uniqueCats = [...new Set(masterCatalog.map(i => i.cat))].sort();
  const availableSubs = [...new Set(masterCatalog.filter(i => i.cat === form.cat).map(i => i.sub))].sort();
  const availableMakes = [...new Set(masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub).map(i => i.make))].sort();
  const availableModels = [...new Set(masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub && i.make === form.make).map(i => i.model))].sort();
  const availableSpecs = [...new Set(masterCatalog.filter(i => i.cat === form.cat && i.sub === form.sub && i.make === form.make && i.model === form.model).map(i => i.spec))].sort();

  const handleConsume = async () => {
    const q = parseInt(consumeForm.qty);
    if (isNaN(q) || q <= 0) return alert("Invalid Quantity!");
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
    } catch (e) { alert("Save Error"); } finally { setSubmitting(false); }
  };

  const handleDeleteItem = async (id: number) => {
    const { data: loans } = await supabase.from("requests").select("id").eq("item_id", id).eq("status", "approved");
    if (loans && loans.length > 0) return alert("CANNOT DELETE: Active Udhaari records exist!");
    if (confirm("Permanently delete?")) { 
      setSubmitting(true);
      await supabase.from("inventory").delete().eq("id", id); 
      setBifurcationItem(null); await fetchStore(); if(fetchProfile) fetchProfile(); 
      setSubmitting(false);
    }
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
    // ADDED: Smooth transition and blur effect based on 'loading' state
    <div className={`animate-fade-in space-y-6 pb-20 font-roboto font-bold uppercase tracking-tight transition-all duration-500 ${loading ? 'opacity-60 blur-[1px] pointer-events-none' : 'opacity-100 blur-0'}`}>
      <div className="bg-white p-6 rounded-xl border shadow-sm flex justify-between items-center border-t-4 border-orange-500">
        <div><h2 className="text-xl font-black text-slate-800 uppercase tracking-widest leading-none">My Local Store</h2><p className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded mt-2 inline-block uppercase">ZONE: {profile?.unit}</p></div>
      </div>

      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b bg-slate-50/80 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-grow md:w-80"><i className="fa-solid fa-search absolute left-3 top-3 text-slate-400"></i><input type="text" placeholder="Search Material..." className="w-full pl-9 pr-4 py-2 border rounded-md text-sm outline-none font-black uppercase" value={search} onChange={e=>setSearch(e.target.value)} /></div>
            <div className="flex gap-2">
              <button onClick={() => setShowSummary(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase shadow-md flex items-center gap-2 hover:bg-indigo-700 transition-all uppercase tracking-widest"><i className="fa-solid fa-chart-pie"></i> Summary</button>
              <button onClick={() => { resetForm(); setShowAddModal(true); }} className="bg-[#ff6b00] text-white px-4 py-2 rounded-lg text-[10px] font-black shadow-md uppercase tracking-widest hover:opacity-90 transition-all"><i className="fa-solid fa-plus"></i> Add Stock</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select className="border rounded-md text-[10px] font-bold p-2 uppercase bg-white cursor-pointer" value={selCat} onChange={e => { setSelCat(e.target.value); setSelSub("all"); }}><option value="all">Category: All</option><option value="OUT_OF_STOCK" className="text-red-600 font-black uppercase">OUT OF STOCK</option>{uniqueCats.map(c => <option key={c} value={c}>{c}</option>)}</select>
            <select disabled={selCat === "all" || selCat === "OUT_OF_STOCK"} className="border rounded-md text-[10px] font-bold p-2 uppercase bg-white cursor-pointer disabled:opacity-50" value={selSub} onChange={e => setSelSub(e.target.value)}><option value="all">Sub-Cat: All</option>{[...new Set(masterCatalog.filter(i => i.cat === selCat).map(i => i.sub))].sort().map((s: any) => <option key={s} value={s}>{s}</option>)}</select>
            <select className="border rounded-md text-[10px] font-bold p-2 uppercase bg-white cursor-pointer" value={selEngineer} onChange={e => setSelEngineer(e.target.value)}><option value="all">Engineer: Team View</option>{[...new Set(myItems.map(i => i.holder_name))].sort().map((name: any) => <option key={name} value={name}>{name === profile?.name ? "By: You" : name}</option>)}</select>
          </div>
        </div>

        <div className="overflow-x-auto"><table className="w-full text-left tracking-tight"><thead className="bg-slate-50 text-slate-500 text-[10px] font-black border-b tracking-widest uppercase"><tr><th className="p-5 pl-8">Material Detail</th><th className="p-5">Spec Details</th><th className="p-5 text-center">Total Qty</th><th className="p-5 text-center">Action</th></tr></thead><tbody className="divide-y text-sm">
            {myItems.length > 0 ? myItems.map((i: any) => (
              <tr key={i.id} className="hover:bg-blue-50/50 transition border-b group cursor-pointer" onClick={() => setBifurcationItem({item: i.item, records: [i]})}>
                <td className="p-5 pl-8 leading-tight"><div className="text-slate-800 font-bold text-[14px] leading-tight uppercase">{i.item}{i.is_manual && <span className=\"bg-orange-100 text-orange-600 text-[8px] px-1.5 py-0.5 rounded font-black border border-orange-200 ml-2\">M</span>}</div><div className="text-[9px] text-slate-400 mt-1 uppercase font-bold">{i.cat} &gt; {i.sub}</div><p className="text-[8px] text-indigo-500 mt-1 uppercase font-black opacity-0 group-hover:opacity-100 transition-opacity tracking-widest uppercase">View split details →</p></td>
                <td className="p-5 font-mono"><span className="bg-white border px-2 py-0.5 rounded-[4px] text-[10.5px] text-slate-600 font-bold shadow-sm inline-block uppercase">{i.make || '-'} | {i.model || '-'} | {i.spec}</span></td>
                <td className={`p-5 text-center font-black text-[16px] whitespace-nowrap ${i.qty === 0 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>{i.qty === 0 ? 'ZERO STOCK' : `${i.qty} ${i.unit}`}</td>
                <td className="p-5 text-center"><button onClick={(e)=>{ e.stopPropagation(); setConsumeItem(i); }} className="bg-orange-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase uppercase tracking-widest uppercase">Consume</button></td>
              </tr>
            )) : <tr><td colSpan={4} className="p-20 text-center text-slate-300 font-black uppercase tracking-widest uppercase">No spares in your zone inventory</td></tr>}
        </tbody></table></div>
        
        <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-[10px] font-black uppercase uppercase tracking-widest">
          <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1 || loading} className="px-5 py-2 bg-white border-2 rounded-lg shadow-sm disabled:opacity-30">Prev</button>
          <span>Page {currentPage} of {Math.ceil(totalCount / itemsPerPage) || 1}</span>
          <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalCount/itemsPerPage)))} disabled={currentPage >= Math.ceil(totalCount/itemsPerPage) || loading} className="px-5 py-2 bg-white border-2 rounded-lg shadow-sm disabled:opacity-30">Next</button>
        </div>
      </section>

      {/* Modals are outside the blurred container */}
      {bifurcationItem && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase font-bold">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center font-black uppercase"><div><h3 className="text-slate-800 text-lg uppercase tracking-tight">Material Split-up</h3><p className="text-[10px] text-slate-400">Ref: {bifurcationItem.item}</p></div><button onClick={() => setBifurcationItem(null)} className="text-slate-400 hover:text-red-500 transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button></div>
            <div className="p-0 max-h-[60vh] overflow-y-auto"><table className="w-full text-left text-xs uppercase"><thead className="bg-slate-50 border-b text-[10px] text-slate-400 tracking-widest font-black uppercase"><tr><th className="p-4 pl-6">Added By</th><th className="p-4 text-center uppercase tracking-widest">Audit Date</th><th className="p-4 text-center uppercase tracking-widest">Qty</th><th className="p-4 text-center uppercase tracking-widest">Action</th></tr></thead><tbody className="divide-y">{bifurcationItem.records.filter((r:any) => r.qty > 0).map((r: any) => (<tr key={r.id} className="hover:bg-slate-50 transition-colors"><td className="p-4 pl-6 leading-tight"><span className={`px-2 py-1 rounded text-[10px] font-black block w-fit uppercase ${r.holder_uid === profile?.id ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-slate-100 text-slate-600'}`}>{r.holder_uid === profile?.id ? "YOU" : r.holder_name}</span>{r.note && <p className=\"text-[8px] text-slate-400 lowercase italic truncate max-w-[150px] mt-1\">note: {r.note}</p>}</td><td className="p-4 text-center text-[10px] text-slate-500 font-bold uppercase">{formatTS(r.timestamp)}</td><td className="p-4 text-center font-black text-slate-800 text-[14px] uppercase">{r.qty} {r.unit}</td><td className="p-4 text-center flex justify-center gap-2"><button onClick={(e)=>{ e.stopPropagation(); setConsumeItem(r); }} className="bg-orange-600 text-white px-3 py-1.5 rounded text-[9px] font-black uppercase shadow-sm uppercase tracking-widest">Consume</button><button onClick={(e) => { e.stopPropagation(); setEditItem(r); setForm({ cat: r.cat, sub: r.sub, make: r.make, model: r.model, spec: r.spec, qty: r.qty.toString(), unit: r.unit, note: r.note || "", isManual: r.is_manual }); setShowAddModal(true); }} className="bg-slate-800 text-white px-3 py-1.5 rounded text-[9px] font-black uppercase shadow-sm uppercase tracking-widest">Edit</button></td></tr>))}</tbody></table></div>
            <div className="p-4 bg-slate-50 text-center uppercase"><button onClick={() => setBifurcationItem(null)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-all uppercase">Close Details</button></div>
          </div>
        </div>)}

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase font-bold">
            <div className="p-6 border-b bg-slate-50 flex justify-between items-center font-black uppercase"><h3 className="text-slate-800 text-lg uppercase tracking-tight">{editItem ? 'Edit Entry' : 'Add Stock'}</h3><button onClick={resetForm} className="text-slate-400 hover:text-red-500 transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button></div>
            <div className="p-6 space-y-4 font-bold uppercase">
              {!editItem && (<div className="flex justify-between items-center bg-orange-50 p-4 rounded-xl border-2 border-dashed border-orange-200 mb-2 shadow-inner"><div className="flex flex-col"><span className="text-[10px] text-orange-800 font-black uppercase tracking-tight">ITEM NOT IN LIST? (Manual)</span><span className=\"text-[8.5px] text-orange-600 font-medium lowercase mt-1\">toggle manual mode to enter details</span></div><button onClick={() => setForm({ ...form, isManual: !form.isManual, cat: "", sub: "", make: "", model: "", spec: "" })} className={`w-12 h-6 rounded-full relative transition-colors ${form.isManual ? 'bg-orange-500' : 'bg-slate-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.isManual ? 'left-7' : 'left-1'}`}></div></button></div>)}
              <div className="space-y-3 uppercase font-bold">
                <div><label className="text-[9px] text-slate-400 block mb-1 uppercase font-black tracking-widest uppercase">Category</label>{form.isManual ? <input type="text" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold uppercase" placeholder=\"e.g. Electrical\" value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value })} /> : <select disabled={!!editItem} className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold uppercase cursor-pointer uppercase" value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value, sub: "", make: "", model: "", spec: "" })}><option value="">-- Choose Category --</option>{uniqueCats.map((c:any) => <option key={c} value={c}>{c}</option>)}</select>}</div>
                <div className="grid grid-cols-2 gap-3 uppercase font-bold">
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase font-black tracking-widest uppercase">Sub-Cat</label>{form.isManual ? <input type="text" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold uppercase" placeholder=\"e.g. Pumps\" value={form.sub} onChange={e => setForm({ ...form, sub: e.target.value })} /> : <select disabled={!!editItem} className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold uppercase cursor-pointer uppercase" value={form.sub} onChange={e => setForm({ ...form, sub: e.target.value, make: "", model: "", spec: "" })}><option value="">-- Select --</option>{availableSubs.map((s:any) => <option key={s} value={s}>{s}</option>)}</select>}</div>
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase font-black tracking-widest uppercase">Make</label>{form.isManual ? <input type="text" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold uppercase" placeholder=\"e.g. SKF\" value={form.make} onChange={e => setForm({ ...form, make: e.target.value, model: "", spec: "" })} /> : <select disabled={!!editItem} className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold uppercase cursor-pointer uppercase" value={form.make} onChange={e => setForm({ ...form, make: e.target.value, model: "", spec: "" })}><option value="">-- Select --</option>{availableMakes.map((m:any) => <option key={m} value={m}>{m}</option>)}</select>}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 uppercase font-bold">
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase font-black tracking-widest uppercase">Model</label>{form.isManual ? <input type="text" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold uppercase" placeholder=\"e.g. ML-2\" value={form.model} onChange={e => setForm({ ...form, model: e.target.value, spec: "" })} /> : <select disabled={!!editItem} className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold uppercase cursor-pointer uppercase" value={form.model} onChange={e => setForm({ ...form, model: e.target.value, spec: "" })}><option value="">-- Select --</option>{availableModels.map((m:any) => <option key={m} value={m}>{m}</option>)}</select>}</div>
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase font-black tracking-widest uppercase">Spec</label>{form.isManual ? <input type="text" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold uppercase" placeholder=\"e.g. 240V\" value={form.spec} onChange={e => setForm({ ...form, spec: e.target.value })} /> : <select disabled={!!editItem} className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold uppercase cursor-pointer uppercase" value={form.spec} onChange={e => setForm({ ...form, spec: e.target.value })}><option value="">-- Select --</option>{availableSpecs.map((s:any) => <option key={s} value={s}>{s}</option>)}</select>}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 uppercase font-bold">
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase font-black tracking-widest uppercase">Quantity</label><input type="number" className="w-full p-3 border-2 border-slate-100 rounded-xl text-lg font-black text-indigo-600 outline-none shadow-sm uppercase" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} /></div>
                  <div><label className="text-[9px] text-slate-400 block mb-1 uppercase font-black tracking-widest uppercase">Unit</label><select className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-black uppercase cursor-pointer uppercase" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}><option value="Nos">Nos</option><option value="Sets">Sets</option><option value="Mtrs">Mtrs</option></select></div>
                </div>
                <div><label className=\"text-[9px] text-slate-400 block mb-1 uppercase font-black tracking-widest uppercase\">Note (Optional)</label><textarea placeholder=\"Reason/Ref No...\" className=\"w-full p-3 border-2 border-slate-100 rounded-xl text-[10px] h-16 font-bold uppercase focus:border-orange-300 outline-none uppercase\" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}></textarea></div>
              </div>
              <div className=\"flex gap-2 pt-2 uppercase font-bold\">{editItem && <button onClick={()=>handleDeleteItem(editItem.id)} className=\"flex-1 py-4 bg-red-50 text-red-600 rounded-2xl shadow-sm hover:bg-red-100 uppercase tracking-widest font-black text-[10px] border border-red-100 transition-all uppercase\"><i className=\"fa-solid fa-trash mr-2\"></i>Delete</button>}<button disabled={submitting} onClick={handleSaveItem} className="flex-[3] py-4 bg-slate-900 text-white rounded-2xl shadow-lg font-black uppercase tracking-[0.2em] text-sm hover:opacity-90 transition-all shadow-md uppercase">{submitting ? "Processing..." : "Confirm Stock"}</button></div>
            </div>
          </div>
        </div>)}

      {consumeItem && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[10001] flex items-center justify-center p-4 uppercase font-bold">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative animate-scale-in uppercase font-bold">
            <button onClick={() => setConsumeItem(null)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors uppercase"><i className="fa-solid fa-xmark text-xl"></i></button>
            <h3 className="text-xl font-black text-slate-800 uppercase mb-6 tracking-tight tracking-widest uppercase">Consume Material</h3>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 shadow-inner leading-tight uppercase leading-tight uppercase"><p className=\"text-[10px] text-slate-400 mb-1 uppercase tracking-widest uppercase\">Detail</p><p className="text-sm font-black text-slate-700 uppercase">{consumeItem.item}</p><p className=\"text-[9px] text-green-600 mt-2 font-black tracking-widest uppercase uppercase\">Sub-Balance: {consumeItem.qty} {consumeItem.unit}</p></div>
            <div className="space-y-4 uppercase font-bold"><div><label className="text-[10px] text-slate-500 uppercase mb-1 block uppercase">Qty used</label><input type="number" className="w-full p-4 border-2 border-slate-100 rounded-2xl font-black text-xl text-center outline-none shadow-sm uppercase" value={consumeForm.qty} onChange={e => setConsumeForm({ ...consumeForm, qty: e.target.value })} /></div><div><label className="text-[10px] text-slate-500 uppercase mb-1 block uppercase">Purpose / Note</label><textarea placeholder="..." className="w-full p-4 border-2 border-slate-100 rounded-2xl font-bold h-24 text-xs outline-none focus:border-orange-500 shadow-sm uppercase" value={consumeForm.note} onChange={e => setConsumeForm({ ...consumeForm, note: e.target.value })}></textarea></div><button disabled={submitting} onClick={handleConsume} className="w-full py-4 bg-slate-900 text-white rounded-2xl shadow-xl font-black tracking-widest uppercase hover:bg-black transition-all shadow-md uppercase">{submitting ? "Verifying..." : "Confirm Consumption"}</button></div>
          </div>
        </div>)}

      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 uppercase font-bold">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase font-bold">
            <div className="p-6 border-b bg-indigo-50 flex justify-between items-center font-black uppercase"><h3 className="font-black text-indigo-900 text-lg uppercase tracking-tight tracking-widest uppercase"><i className="fa-solid fa-boxes-stacked mr-2"></i> Zone Balance Summary</h3><button onClick={() => setShowSummary(false)} className="text-slate-400 hover:text-red-500 transition-colors uppercase"><i className="fa-solid fa-xmark text-xl"></i></button></div>
            <div className="p-6 max-h-[60vh] overflow-y-auto font-black uppercase"><table className="w-full text-left text-xs font-bold uppercase"><thead className="border-b text-slate-400 uppercase tracking-widest text-[10px] uppercase"><tr><th className="pb-3 uppercase">Category &gt; Sub-Category</th><th className="pb-3 text-right uppercase">Total Balance</th></tr></thead><tbody className="divide-y uppercase">{getSummaryData().map((s: any, idx: number) => (<tr key={idx} className="hover:bg-slate-50 transition border-b uppercase"><td className="py-4 text-slate-700 text-[11px] uppercase">{s.cat} <i className="fa-solid fa-chevron-right text-[8px] mx-1 opacity-40 uppercase"></i> {s.sub}</td><td className="py-4 text-right font-black text-indigo-600 text-sm uppercase">{s.total} {s.unit}</td></tr>))}</tbody></table></div>
            <div className="p-4 bg-slate-50 text-center uppercase font-black uppercase"><button onClick={() => setShowSummary(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-all uppercase">Close Summary</button></div>
          </div>
        </div>)}
    </div>
  );
}
