"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function ReturnsLedgerView({ profile, onAction }: any) { 
    const [pending, setPending] = useState<any[]>([]);
    const [given, setGiven] = useState<any[]>([]);
    const [taken, setTaken] = useState<any[]>([]);
    const [givenHistory, setGivenHistory] = useState<any[]>([]);
    const [takenHistory, setTakenHistory] = useState<any[]>([]);
    const [actionModal, setActionModal] = useState<any>(null); 
    const [form, setForm] = useState({ comment: "", qty: "" });

    const [archivePage, setArchivePage] = useState(1);
    const logsPerPage = 20;

    const fetchAll = async () => {
        try {
            const { data: p } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).in("status", ["pending", "return_requested"]).order("id", { ascending: false });
            const { data: g } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).eq("status", "approved").order("id", { ascending: false });
            const { data: t = [] } = await supabase.from("requests").select("*").eq("from_unit", profile.unit).eq("status", "approved").order("id", { ascending: false });
            const { data: gh } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).in("status", ["returned", "rejected"]).order("id", { ascending: false });
            const { data: th = [] } = await supabase.from("requests").select("*").eq("from_unit", profile.unit).in("status", ["returned", "rejected"]).order("id", { ascending: false });
            
            if (p) setPending(p); 
            if (g) setGiven(g); 
            if (t) setTaken(t);
            if (gh) setGivenHistory(gh); 
            if (th) setTakenHistory(th);
        } catch(e){}
    };

    useEffect(() => {
        if (!profile) return; fetchAll();
        const channel = supabase.channel('sparesetu-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => { fetchAll(); if(onAction) onAction(); }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [profile]);

    const formatTS = (ts: any) => new Date(Number(ts)).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

    const handleProcess = async () => {
        const { type, data } = actionModal;
        const actionQty = Number(form.qty || data.req_qty);
        if (!form.comment.trim()) { alert("Provide a transaction log/reason!"); return; }

        try {
            if (type === 'approve') {
                const newTxnId = `#TXN-${Date.now().toString().slice(-6)}`;
                await supabase.from("requests").update({ status: 'approved', approve_comment: form.comment, txn_id: newTxnId, to_uid: profile.id, to_name: profile.name, req_qty: actionQty, viewed_by_requester: false }).eq("id", data.id);
            } 
            else if (type === 'reject') {
                await supabase.from("requests").update({ status: 'rejected', approve_comment: form.comment, to_uid: profile.id, to_name: profile.name, viewed_by_requester: false }).eq("id", data.id);
            }
            else if (type === 'return') {
                await supabase.from("requests").insert([{ 
                    item_id: data.item_id, item_name: data.item_name, item_spec: data.item_spec, item_unit: data.item_unit, req_qty: actionQty, status: 'return_requested', return_comment: form.comment, from_uid: profile.id, from_name: profile.name, from_unit: profile.unit, to_uid: data.to_uid, to_name: data.to_name, to_unit: data.to_unit, viewed_by_requester: false, txn_id: data.txn_id 
                }]);
            }
        } catch(e){ alert("Action failed."); }
        setActionModal(null); setForm({comment:"", qty:""});
    };

    const sortedHistory = [...givenHistory, ...takenHistory].sort((a,b) => Number(b.timestamp) - Number(a.timestamp));
    const currentArchiveLogs = sortedHistory.slice((archivePage - 1) * logsPerPage, archivePage * logsPerPage);

    return (
        <div className="space-y-10 animate-fade-in pb-20 font-roboto uppercase font-bold tracking-tight">
            <h2 className="text-2xl font-black text-slate-800 uppercase flex items-center justify-center gap-3 py-4">
                <i className="fa-solid fa-handshake-angle text-orange-500"></i> UDHAARI & RETURN DASHBOARD
            </h2>

            <section className="bg-white rounded-xl border-t-4 border-orange-500 shadow-xl overflow-hidden">
                <div className="p-4 bg-orange-50/50 flex justify-between border-b">
                    <div className="flex items-center gap-2 text-orange-900 font-black uppercase text-[10px] tracking-widest"><i className="fa-solid fa-bolt animate-pulse"></i> Attention Required</div>
                    <span className="bg-orange-600 text-white px-2.5 py-0.5 rounded-full font-black text-[10px]">{pending.length}</span>
                </div>
                <div className="overflow-x-auto min-h-[200px]">
                    <table className="w-full text-left text-sm divide-y font-mono font-bold uppercase">
                        <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <tr><th className="p-4 pl-6">Material Detail</th><th className="p-4">Counterparty</th><th className="p-4 text-center">Qty</th><th className="p-4 text-center">Action</th></tr>
                        </thead>
                        <tbody className="divide-y text-slate-600 uppercase">
                            {pending.map(r => (
                                <tr key={r.id} className="bg-white transition border-b hover:bg-slate-50">
                                    <td className="p-4 pl-6 leading-tight">
                                      <div className="text-slate-800 font-bold text-[14px]">{r.item_name}</div>
                                      <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter">{r.item_spec}</div>
                                    </td>
                                    <td className="p-4 font-bold text-slate-700 leading-tight">{r.from_name}<div className="text-[10px] text-slate-400 font-normal uppercase">{r.from_unit}</div></td>
                                    <td className="p-4 text-center font-black text-orange-600">{r.req_qty} {r.item_unit}</td>
                                    <td className="p-4 flex gap-2 justify-center">
                                        <button onClick={()=>setActionModal({type: r.status==='pending' ? 'approve' : 'verify', data:r})} className="bg-[#ff6b00] text-white px-4 py-2 rounded-lg text-[10px] font-black shadow-md hover:bg-orange-600"> {r.status==='pending' ? 'Issue' : 'Verify'} </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section className="bg-white rounded-2xl border-t-4 border-blue-600 shadow-lg overflow-hidden">
                    <div className="p-5 border-b bg-blue-50/30 text-xs font-black text-blue-900 tracking-widest uppercase">UDHAARI DIYA (ITEMS GIVEN)</div>
                    <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                        {given.map(r => (
                            <div key={r.id} className="p-4 border-2 border-slate-100 bg-white rounded-2xl relative shadow-sm hover:border-blue-100 transition-colors">
                                <div className="text-slate-800 font-bold text-[14px] mb-1">{r.item_name}</div>
                                <div className="text-right font-black text-blue-600 font-mono text-[14px]">{r.req_qty} {r.item_unit}</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="bg-white rounded-2xl border-t-4 border-red-600 shadow-lg overflow-hidden">
                    <div className="p-5 border-b bg-red-50/30 text-xs font-black text-red-900 tracking-widest uppercase">UDHAARI LIYA (ITEMS TAKEN)</div>
                    <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                        {taken.map(r => (
                            <div key={r.id} className="p-4 border-2 border-slate-100 bg-white rounded-2xl relative shadow-sm hover:border-red-100 transition-colors">
                                <div className="text-slate-800 font-bold text-[14px] mb-1">{r.item_name}</div>
                                <div className="text-right font-black text-red-600 font-mono text-[14px]">{r.req_qty} {r.item_unit}</div>
                                <button onClick={()=>setActionModal({type:'return', data:r})} className="w-full py-2 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest mt-2 shadow-md">Initiate Return</button>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {actionModal && (
              <div className="fixed top-0 left-0 w-full h-full bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                  <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                    <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Confirm Transaction</h3>
                    <button onClick={()=>setActionModal(null)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
                  </div>
                  <div className="p-6 space-y-4 font-bold uppercase">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Log / Comment</label>
                        <textarea placeholder="Reason/Log Details..." className="w-full mt-1 p-3 border-2 rounded-lg outline-none font-bold text-xs h-24 text-slate-800 focus:border-orange-500 transition-all uppercase" onChange={e=>setForm({...form, comment:e.target.value})}></textarea>
                    </div>
                    <button onClick={handleProcess} className="w-full py-3 bg-[#ff6b00] text-white font-black rounded-xl shadow-lg uppercase tracking-widest text-sm hover:opacity-90 transition-opacity">Confirm Transaction</button>
                  </div>
                </div>
              </div>
            )}
        </div>
    ); 
}
