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
        const channel = supabase.channel('sparesetu-sync-v-final-fixed').on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => { fetchAll(); if(onAction) onAction(); }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [profile]);

    const formatTS = (ts: any) => new Date(Number(ts)).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

    const handleProcess = async () => {
        const { type, data } = actionModal;
        const actionQty = Number(form.qty || data.req_qty);
        if (!form.comment.trim()) { alert("Provide a transaction log/reason!"); return; }
        if (actionQty <= 0 || actionQty > data.req_qty) { alert(`Invalid Quantity! Range: 1 to ${data.req_qty}`); return; }

        try {
            if (type === 'approve') {
                const newTxnId = `#TXN-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 99)}`;
                const { error } = await supabase.from("requests").update({ status: 'approved', approve_comment: form.comment, txn_id: newTxnId, to_uid: profile.id, to_name: profile.name, req_qty: actionQty, viewed_by_requester: false }).eq("id", data.id);
                if (!error) {
                    const { data: inv } = await supabase.from("inventory").select("qty").eq("id", data.item_id).single();
                    if (inv) await supabase.from("inventory").update({ qty: inv.qty - actionQty }).eq("id", data.item_id);
                }
            } 
            else if (type === 'reject') {
                await supabase.from("requests").update({ status: 'rejected', approve_comment: form.comment, to_uid: profile.id, to_name: profile.name, viewed_by_requester: false }).eq("id", data.id);
            }
            else if (type === 'return') {
                const { error } = await supabase.from("requests").insert([{ 
                    item_id: data.item_id, item_name: data.item_name, item_spec: data.item_spec, item_unit: data.item_unit, req_qty: actionQty, status: 'return_requested', return_comment: form.comment, from_uid: profile.id, from_name: profile.name, from_unit: profile.unit, to_uid: data.to_uid, to_name: data.to_name, to_unit: data.to_unit, viewed_by_requester: false, 
                    approve_comment: `VERIFY_LINK_ID:${data.id}`,
                    txn_id: data.txn_id 
                }]);
                if (!error) alert("Return Request Sent!");
            }
            else if (type === 'verify') {
                const parentId = data.approve_comment?.match(/VERIFY_LINK_ID:(\d+)/)?.[1];
                if (parentId) {
                    const { data: parent } = await supabase.from("requests").select("req_qty").eq("id", parentId).single();
                    if (parent) {
                        const newBal = parent.req_qty - data.req_qty;
                        if (newBal <= 0) await supabase.from("requests").delete().eq("id", parentId);
                        else await supabase.from("requests").update({ req_qty: newBal }).eq("id", parentId);
                    }
                }
                await supabase.from("requests").update({ status: 'returned', approve_comment: `Verified: ${form.comment}`, to_uid: profile.id, to_name: profile.name, viewed_by_requester: false }).eq("id", data.id);
                const { data: inv } = await supabase.from("inventory").select("qty").eq("id", data.item_id).single();
                if (inv) await supabase.from("inventory").update({ qty: inv.qty + data.req_qty }).eq("id", data.item_id);
            }
        } catch(e){ alert("Action failed."); }
        setActionModal(null); setForm({comment:"", qty:""});
    };

    const sortedHistory = [...givenHistory, ...takenHistory].sort((a,b) => Number(b.timestamp) - Number(a.timestamp));
    const totalArchivePages = Math.ceil(sortedHistory.length / logsPerPage) || 1;
    const currentArchiveLogs = sortedHistory.slice((archivePage - 1) * logsPerPage, archivePage * logsPerPage);

    return (
        <div className="space-y-10 animate-fade-in pb-20 font-roboto uppercase font-bold tracking-tight">
            <h2 className="text-2xl font-black text-slate-800 uppercase flex items-center justify-center gap-3 py-4">
                <i className="fa-solid fa-handshake-angle text-orange-500"></i> UDHAARI & RETURN DASHBOARD
            </h2>

            {/* SECTION 1: ATTENTION REQUIRED (Height Adjusted to ~180px-200px) */}
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
                                <tr key={r.id} className={`${r.status==='return_requested' ? 'bg-orange-50 animate-pulse' : 'bg-white'} transition border-b hover:bg-slate-50`}>
                                    <td className="p-4 pl-6 leading-tight">
                                      <div className="text-slate-800 font-bold text-[14px] tracking-tight">{r.item_name}</div>
                                      <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">{r.item_spec}</div>
                                      <div className="text-[8.5px] text-orange-600 font-black mt-1 tracking-widest">{formatTS(r.timestamp)}</div>
                                    </td>
                                    <td className="p-4 font-bold text-slate-700 leading-tight">{r.from_name}<div className="text-[10px] text-slate-400 font-normal uppercase">{r.from_unit}</div></td>
                                    <td className="p-4 text-center font-black text-orange-600 text-[14px] whitespace-nowrap">{r.req_qty} {r.item_unit}</td>
                                    <td className="p-4 flex gap-2 justify-center">
                                        <button onClick={()=>setActionModal({type: r.status==='pending' ? 'approve' : 'verify', data:r})} className="bg-[#ff6b00] text-white px-4 py-2 rounded-lg text-[10px] font-black shadow-md hover:bg-orange-600 tracking-widest"> {r.status==='pending' ? 'Issue' : 'Verify'} </button>
                                        <button onClick={()=>setActionModal({type: 'reject', data:r})} className="bg-slate-100 text-slate-500 px-4 py-2 rounded-lg text-[9px] font-black transition tracking-widest hover:bg-slate-200">Reject</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* SECTION 2: ACTIVE LEDGERS (Height Adjusted to ~250px-300px) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section className="bg-white rounded-2xl border-t-4 border-blue-600 shadow-lg overflow-hidden flex flex-col">
                    <div className="p-5 border-b bg-blue-50/30 flex items-center gap-3 uppercase text-xs font-black text-blue-900 tracking-widest">
                        <i className="fa-solid fa-arrow-up-from-bracket text-blue-600"></i> UDHAARI DIYA (ITEMS GIVEN)
                    </div>
                    <div className="p-4 space-y-4 min-h-[250px] max-h-[500px] overflow-y-auto bg-slate-50/20">
                        {given.map(r => (
                            <div key={r.id} className="p-4 border-2 border-slate-100 bg-white rounded-2xl relative shadow-sm hover:border-blue-100 transition-colors">
                                <div className="text-slate-800 font-bold text-[14px] tracking-tight mb-1">{r.item_name}</div>
                                <div className="text-[10px] text-slate-400 mb-3 uppercase tracking-tighter">{r.item_spec}</div>
                                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg mb-3"><div><p className="text-[9px] font-bold text-slate-400 uppercase">Receiver</p><p className="text-[12.5px] font-black text-slate-700 uppercase tracking-tighter">{r.from_name} ({r.from_unit})</p></div><div className="text-right font-black text-blue-600 font-mono text-[14px]">{r.req_qty} {r.item_unit}</div></div>
                                <div className="text-[9px] font-mono text-slate-400 space-y-1 bg-slate-50/50 p-2 rounded border border-dashed tracking-tighter">
                                    <p><span className="font-black text-blue-600/70">TXN:</span> {r.txn_id || '--'}</p>
                                    <p><span className="font-black text-blue-600/70">ISSUED BY:</span> {r.to_name}</p>
                                    <p><span className="font-black text-blue-600/70">ISSUED ON:</span> {formatTS(r.timestamp)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="bg-white rounded-2xl border-t-4 border-red-600 shadow-lg overflow-hidden flex flex-col">
                    <div className="p-5 border-b bg-red-50/30 flex items-center gap-3 uppercase text-xs font-black text-red-900 tracking-widest">
                        <i className="fa-solid fa-arrow-down-long text-red-600"></i> UDHAARI LIYA (ITEMS TAKEN)
                    </div>
                    <div className="p-4 space-y-4 min-h-[250px] max-h-[500px] overflow-y-auto bg-slate-50/20">
                        {taken.map(r => (
                            <div key={r.id} className="p-4 border-2 border-slate-100 bg-white rounded-2xl relative shadow-sm hover:border-red-100 transition-colors">
                                <div className="text-slate-800 font-bold text-[14px] tracking-tight mb-1">{r.item_name}</div>
                                <div className="text-[10px] text-slate-400 mb-3 uppercase tracking-tighter">{r.item_spec}</div>
                                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg mb-3"><div><p className="text-[9px] font-bold text-slate-400 uppercase">Source</p><p className="text-[12.5px] font-black text-slate-700 uppercase tracking-tighter">{r.to_unit} ({r.to_name})</p></div><div className="text-right font-black text-red-600 font-mono text-[14px]">{r.req_qty} {r.item_unit}</div></div>
                                <div className="text-[9px] font-mono text-slate-400 mb-3 space-y-1 bg-slate-50/50 p-2 rounded border border-dashed tracking-tighter">
                                    <p><span className="font-black text-red-600/70">TXN:</span> {r.txn_id || '--'}</p>
                                    <p><span className="font-black text-red-600/70">TAKEN BY:</span> {r.from_name}</p>
                                    <p><span className="font-black text-red-600/70">TAKEN ON:</span> {formatTS(r.timestamp)}</p>
                                </div>
                                <button onClick={()=>setActionModal({type:'return', data:r})} className="w-full py-2 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-md hover:bg-slate-800 transition">Initiate Return</button>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* SECTION 3: DIGITAL ARCHIVE LOGS */}
            <div className="pt-10 space-y-6">
                <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
                    <div className="p-6 bg-slate-800 text-white flex flex-col items-center justify-center">
                      <span className="text-[20px] font-bold tracking-widest">Digital Archive Logs</span>
                      <span className="text-[10px] opacity-80 font-black tracking-[0.2em] mt-1">(UDH: UDHAARI • RET: RETURNED)</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[9px] divide-y divide-slate-100 font-mono">
                            <thead className="bg-slate-50 text-[8.5px] font-black text-slate-400 tracking-widest uppercase"><tr><th className="p-4">Txn ID</th><th className="p-4">Material Details</th><th className="p-4 text-center">Qty</th><th className="p-4">Info</th><th className="p-4">Audit Log</th><th className="p-4 text-center">Status</th></tr></thead>
                            <tbody className="divide-y text-slate-600">
                                {currentArchiveLogs.map(h => (
                                    <tr key={h.id} className="hover:bg-slate-50 transition border-b">
                                        <td className="p-4 whitespace-nowrap tracking-tighter"><span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{h.txn_id || '--'}</span></td>
                                        <td className="p-4 leading-tight">
                                          <p className="text-slate-800 font-bold text-[12.5px] tracking-tight">{h.item_name}</p>
                                          <p className="text-[8.5px] text-slate-400 mt-1.5 uppercase font-bold">SPEC: {h.item_spec}</p>
                                        </td>
                                        <td className="p-4 text-center font-black whitespace-nowrap">
                                          <div className="flex flex-col items-center gap-1 leading-none">
                                            <span className="text-[9.5px] text-blue-600/80 font-bold tracking-tighter uppercase">UDH: {h.req_qty} {h.item_unit}</span>
                                            <span className={`text-[9.5px] font-black tracking-tighter uppercase ${h.status === 'returned' ? 'text-green-600' : 'text-slate-300'}`}>RET: {h.status === 'returned' ? h.req_qty : 0} {h.item_unit}</span>
                                          </div>
                                        </td>
                                        <td className="p-4 leading-tight"><p className="text-blue-500 font-bold">BORR: {h.from_name}</p><p className="text-red-500 font-bold mt-1">LEND: {h.to_name}</p></td>
                                        <td className="p-4 leading-none space-y-1.5 font-bold tracking-tighter text-[8px] uppercase">
                                            <p><span className="opacity-50">1. REQUEST BY:</span> {h.from_name} ({h.from_unit}) on {formatTS(h.timestamp)}</p>
                                            <p><span className="opacity-50">2. APPROVED BY:</span> {h.to_name} on {formatTS(h.timestamp)}</p>
                                            <p><span className="opacity-50">3. RETURN BY:</span> {h.from_name} on {formatTS(h.timestamp)}</p>
                                            <p><span className="opacity-50 font-black text-green-600">4. FINAL VERIFY:</span> {h.to_name} on {formatTS(h.timestamp)}</p>
                                        </td>
                                        <td className="p-4 text-center"><span className={`px-2.5 py-1 rounded-full text-[8.5px] font-black uppercase tracking-widest ${h.status==='returned' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{h.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                        <button onClick={() => setArchivePage(prev => Math.max(prev - 1, 1))} disabled={archivePage === 1} className="px-5 py-2 bg-white border-2 rounded-lg shadow-sm disabled:opacity-30 hover:bg-slate-50 transition-all">Prev</button>
                        <span className="text-slate-400">Page {archivePage} of {totalArchivePages}</span>
                        <button onClick={() => setArchivePage(prev => Math.min(prev + 1, totalArchivePages))} disabled={archivePage === totalArchivePages} className="px-5 py-2 bg-white border-2 rounded-lg shadow-sm disabled:opacity-30 hover:bg-slate-50 transition-all">Next</button>
                    </div>
                </div>
            </div>

            {actionModal && (
              <div className="fixed top-0 left-0 w-full h-full bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                  <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                    <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">
                      {actionModal.type === 'approve' ? 'Issue Spare' : actionModal.type === 'return' ? 'Initiate Return' : actionModal.type === 'verify' ? 'Verify Return' : 'Reject Action'}
                    </h3>
                    <button onClick={()=>setActionModal(null)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
                  </div>
                  <div className="p-6 space-y-4 font-bold uppercase">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-[9px] text-slate-400 font-black uppercase mb-1 tracking-widest">Transaction Details</p>
                      <p className="text-[13px] font-bold text-slate-800">{actionModal.data.item_name}</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter">{actionModal.data.item_spec}</p>
                    </div>
                    {(actionModal.type === 'approve' || actionModal.type === 'return') && (
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity {actionModal.type === 'return' ? '(Borrowed:' : '(Requested:'} {actionModal.data.req_qty})</label>
                        <input type="number" defaultValue={actionModal.data.req_qty} className="w-full mt-1 p-3 border-2 rounded-lg outline-none font-black text-slate-800 focus:border-orange-500 transition-all" onChange={e=>setForm({...form, qty:e.target.value})} />
                      </div>
                    )}
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Log / Comment</label>
                        <textarea placeholder="Reason/Log Details..." className="w-full mt-1 p-3 border-2 rounded-lg outline-none font-bold text-xs h-24 text-slate-800 focus:border-orange-500 transition-all uppercase" onChange={e=>setForm({...form, comment:e.target.value})}></textarea>
                    </div>
                    <button onClick={handleProcess} className={`w-full py-3 ${actionModal.type === 'reject' ? 'bg-red-600' : 'bg-[#ff6b00]'} text-white font-black rounded-xl shadow-lg uppercase tracking-widest text-sm hover:opacity-90 transition-opacity`}>
                        {actionModal.type === 'return' ? 'Send Return Request' : 'Confirm Transaction'}
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>
    ); 
}
