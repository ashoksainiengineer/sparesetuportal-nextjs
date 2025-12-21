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

    const fetchAll = async () => {
        try {
            const { data: p } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).in("status", ["pending", "return_requested"]).order("id", { ascending: false });
            const { data: g } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).eq("status", "approved").order("id", { ascending: false });
            const { data: t } = await supabase.from("requests").select("*").eq("from_unit", profile.unit).eq("status", "approved").order("id", { ascending: false });
            const { data: gh } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).in("status", ["returned", "rejected"]).order("id", { ascending: false });
            const { data: th } = await supabase.from("requests").select("*").eq("from_unit", profile.unit).in("status", ["returned", "rejected"]).order("id", { ascending: false });
            
            if (p) setPending(p); 
            if (g) setGiven(g); 
            if (t) setTaken(t);
            if (gh) setGivenHistory(gh); 
            if (th) setTakenHistory(th);
        } catch(e){}
    };

    useEffect(() => {
        if (!profile) return;
        fetchAll();
        const channel = supabase.channel('sparesetu-returns-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => { fetchAll(); if(onAction) onAction(); }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [profile]);

    const formatTS = (ts: any) => new Date(Number(ts)).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

    const handleProcess = async () => {
        const { type, data } = actionModal;
        const actionQty = Number(form.qty || data.req_qty);

        if (!form.comment.trim()) { alert("Provide a transaction log/reason!"); return; }
        if (actionQty <= 0 || actionQty > data.req_qty) { alert(`Invalid Quantity!`); return; }

        try {
            if (type === 'approve') {
                const newTxnId = `#TXN-${Date.now().toString().slice(-6)}`;
                const { error } = await supabase.from("requests").update({ 
                    status: 'approved', 
                    approve_comment: form.comment, 
                    txn_id: newTxnId, 
                    to_uid: profile.id, 
                    to_name: profile.name, 
                    req_qty: actionQty, 
                    viewed_by_requester: false 
                }).eq("id", data.id);
                
                if (!error) {
                    const { data: inv } = await supabase.from("inventory").select("qty").eq("id", data.item_id).single();
                    if (inv) await supabase.from("inventory").update({ qty: inv.qty - actionQty }).eq("id", data.item_id);
                }
            } 
            else if (type === 'reject') {
                await supabase.from("requests").update({ status: 'rejected', approve_comment: form.comment, to_uid: profile.id, to_name: profile.name, viewed_by_requester: false }).eq("id", data.id);
            }
            else if (type === 'verify') {
                await supabase.from("requests").update({ status: 'returned', approve_comment: `Verified: ${form.comment}`, to_uid: profile.id, to_name: profile.name, viewed_by_requester: false }).eq("id", data.id);
                const { data: inv } = await supabase.from("inventory").select("qty").eq("id", data.item_id).single();
                if (inv) await supabase.from("inventory").update({ qty: inv.qty + data.req_qty }).eq("id", data.item_id);
            }
        } catch(e){ alert("Action failed."); }
        setActionModal(null); setForm({comment:"", qty:""});
    };

    return (
        <div className="space-y-10 animate-fade-in pb-20 font-roboto uppercase font-bold tracking-tight">
            <h2 className="text-2xl font-bold text-slate-800 uppercase flex items-center gap-2"><i className="fa-solid fa-handshake-angle text-orange-500"></i> Udhaari Dashboard</h2>

            {/* Attention Required Section */}
            <section className="bg-white rounded-xl border-t-4 border-orange-500 shadow-xl overflow-hidden">
                <div className="p-4 bg-orange-50/50 flex justify-between border-b">
                    <div className="flex items-center gap-2 text-orange-900 font-black text-[10px] tracking-widest"><i className="fa-solid fa-bolt animate-pulse"></i> Attention Required</div>
                    <span className="bg-orange-600 text-white px-2.5 py-0.5 rounded-full font-black text-[10px]">{pending.length}</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm divide-y font-bold uppercase">
                        <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase tracking-widest">
                            <tr><th className="p-4 pl-6">Material Detail</th><th className="p-4">Counterparty</th><th className="p-4 text-center">Qty</th><th className="p-4 text-center">Action</th></tr>
                        </thead>
                        <tbody className="divide-y text-slate-600 uppercase">
                            {pending.map(r => (
                                <tr key={r.id} className={`${r.status==='return_requested' ? 'bg-orange-50 animate-pulse' : 'bg-white'} border-b`}>
                                    <td className="p-4 pl-6 leading-tight">
                                      <div className="text-slate-800 font-bold text-[14px] uppercase">{r.item_name}</div>
                                      <div className="text-[10px] text-slate-400 mt-1 font-mono">{r.item_spec}</div>
                                    </td>
                                    <td className="p-4 text-slate-700 leading-tight">{r.from_name}<div className="text-[10px] text-slate-400 font-mono">{r.from_unit}</div></td>
                                    <td className="p-4 text-center font-black text-orange-600 text-[14px]">{r.req_qty} {r.item_unit}</td>
                                    <td className="p-4 flex gap-2 justify-center">
                                        <button onClick={()=>setActionModal({type: r.status==='pending' ? 'approve' : 'verify', data:r})} className="bg-[#ff6b00] text-white px-4 py-2 rounded-lg text-[10px] font-black shadow-md tracking-widest"> {r.status==='pending' ? 'Issue' : 'Verify'} </button>
                                        <button onClick={()=>setActionModal({type: 'reject', data:r})} className="bg-slate-100 text-slate-500 px-4 py-2 rounded-lg text-[9px] font-black tracking-widest">Reject</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Archive Logs */}
            <div className="pt-10 space-y-10">
                <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden font-bold uppercase">
                    <div className="p-6 bg-slate-800 text-white flex flex-col items-center justify-center">
                      <span className="text-[20px] font-bold tracking-widest">Digital Archive Logs</span>
                      <span className="text-[10px] opacity-80 font-black tracking-[0.2em] mt-1">(UDH: Udhaari • RET: Returned)</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[9px] divide-y divide-slate-100 font-mono">
                            <thead className="bg-slate-50 text-[8.5px] text-slate-400 tracking-widest uppercase">
                                <tr><th className="p-4">Txn ID</th><th className="p-4">Material Details</th><th className="p-4 text-center">Qty</th><th className="p-4">Info</th><th className="p-4 text-center">Status</th></tr>
                            </thead>
                            <tbody className="divide-y text-slate-600">
                                {[...givenHistory, ...takenHistory].sort((a,b)=>Number(b.timestamp)-Number(a.timestamp)).map(h => (
                                    <tr key={h.id} className="hover:bg-slate-50 border-b">
                                        <td className="p-4"><span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{h.txn_id || '--'}</span></td>
                                        <td className="p-4">
                                          <p className="text-slate-800 font-bold text-[12.5px]">{h.item_name}</p>
                                          <p className="text-[8.5px] text-slate-400 mt-1">SPEC: {h.item_spec}</p>
                                        </td>
                                        <td className="p-4 text-center font-black">
                                          <div className="flex flex-col items-center gap-1 leading-none">
                                            <span className="text-[9.5px] text-blue-600/80">UDH: {h.req_qty} {h.item_unit}</span>
                                            <span className={`text-[9.5px] font-black ${h.status === 'returned' ? 'text-green-600' : 'text-slate-300'}`}>RET: {h.status === 'returned' ? h.req_qty : 0} {h.item_unit}</span>
                                          </div>
                                        </td>
                                        <td className="p-4 leading-tight"><p className="text-blue-500">BORR: {h.from_name}</p><p className="text-red-500 font-bold mt-1">LEND: {h.to_name}</p></td>
                                        <td className="p-4 text-center"><span className={`px-2.5 py-1 rounded-full text-[8.5px] font-black tracking-widest ${h.status==='returned' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{h.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Action Modal - z-[9999] for full coverage */}
            {actionModal && (
              <div className="fixed top-0 left-0 w-full h-full bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in font-bold uppercase">
                  <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                    <h3 className="font-black text-slate-800 text-lg tracking-tight">
                      {actionModal.type === 'approve' ? 'Issue Spare' : actionModal.type === 'verify' ? 'Verify Return' : 'Reject Action'}
                    </h3>
                    <button onClick={()=>setActionModal(null)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
                  </div>
                  <div className="p-6 space-y-4 font-bold uppercase">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-[9px] text-slate-400 font-black mb-1 tracking-widest">Transaction Details</p>
                      <p className="text-[13px] font-bold text-slate-800">{actionModal.data.item_name}</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase">{actionModal.data.item_spec}</p>
                    </div>
                    {(actionModal.type === 'approve') && (
                      <div>
                        <label className="text-[10px] font-black text-slate-400 tracking-widest">Quantity (Requested: {actionModal.data.req_qty})</label>
                        <input type="number" defaultValue={actionModal.data.req_qty} className="w-full mt-1 p-3 border-2 rounded-lg outline-none font-black text-slate-800 focus:border-orange-500" onChange={e=>setForm({...form, qty:e.target.value})} />
                      </div>
                    )}
                    <div>
                        <label className="text-[10px] font-black text-slate-400 tracking-widest">Log / Comment</label>
                        <textarea placeholder="Reason/Log Details..." className="w-full mt-1 p-3 border-2 rounded-lg outline-none text-xs h-24 text-slate-800 focus:border-orange-500" onChange={e=>setForm({...form, comment:e.target.value})}></textarea>
                    </div>
                    <button onClick={handleProcess} className={`w-full py-3 ${actionModal.type === 'reject' ? 'bg-red-600' : 'bg-[#ff6b00]'} text-white font-black rounded-xl shadow-lg uppercase tracking-widest text-sm`}>
                        Confirm Transaction
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>
    ); 
}
