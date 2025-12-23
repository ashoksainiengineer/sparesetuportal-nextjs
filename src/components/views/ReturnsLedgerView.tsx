"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function ReturnsLedgerView({ profile, onAction }: any) { 
    const [pending, setPending] = useState<any[]>([]);
    const [given, setGiven] = useState<any[]>([]);
    const [taken, setTaken] = useState<any[]>([]);
    const [givenHistory, setGivenHistory] = useState<any[]>([]);
    const [takenHistory, setTakenHistory] = useState<any[]>([]);
    const [actionModal, setActionModal] = useState<any>(null); 
    const [form, setForm] = useState({ comment: "", qty: "" });
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(true); 
    const [archivePage, setArchivePage] = useState(1);
    const logsPerPage = 20;

    // --- SPEED OPTIMIZATION: PARALLEL DATA FETCHING ---
    const fetchAll = useCallback(async () => {
        if (!profile?.unit) return;
        setLoading(true);
        try {
            const [pRes, gRes, tRes, ghRes, thRes] = await Promise.all([
                supabase.from("requests").select("*").eq("to_unit", profile.unit).in("status", ["pending", "return_requested"]).order("timestamp", { ascending: false }),
                supabase.from("requests").select("*").eq("to_unit", profile.unit).eq("status", "approved").order("timestamp", { ascending: false }),
                supabase.from("requests").select("*").eq("from_unit", profile.unit).eq("status", "approved").order("timestamp", { ascending: false }),
                supabase.from("requests").select("*").eq("to_unit", profile.unit).in("status", ["returned", "rejected"]).order("timestamp", { ascending: false }),
                supabase.from("requests").select("*").eq("from_unit", profile.unit).in("status", ["returned", "rejected"]).order("timestamp", { ascending: false })
            ]);

            setPending(pRes.data || []);
            setGiven(gRes.data || []);
            setTaken(tRes.data || []);
            setGivenHistory(ghRes.data || []);
            setTakenHistory(thRes.data || []);
        } catch(e) {
            console.error("Fetch Error");
        } finally {
            setLoading(false);
        }
    }, [profile?.unit]);

    useEffect(() => {
        if (!profile) return;
        fetchAll();
        const channel = supabase.channel('ledger-sync-final').on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => { 
            fetchAll(); if(onAction) onAction(); 
        }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [profile, fetchAll, onAction]);

    const formatTS = (ts: any) => ts ? new Date(Number(ts)).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '--';

    const handleProcess = async () => {
        const { type, data } = actionModal;
        const actionQty = form.qty !== "" ? Number(form.qty) : Number(data.req_qty);
        
        if (!form.comment.trim()) return alert("Log comment required!");
        if (isNaN(actionQty) || actionQty <= 0) return alert("Invalid Qty!");

        setSubmitting(true);
        try {
            const now = Date.now();
            if (type === 'approve') {
                const { data: inv } = await supabase.from("inventory").select("qty").eq("id", data.item_id).single();
                if (!inv || actionQty > inv.qty) {
                    setSubmitting(false);
                    return alert(`STOCK SHORTAGE! Available: ${inv?.qty || 0}`);
                }
                
                await supabase.from("requests").update({ 
                    status: 'approved', approve_comment: form.comment, txn_id: data.txn_id || `#TXN-${now.toString().slice(-6)}`, 
                    to_uid: profile.id, to_name: profile.name, req_qty: actionQty, timestamp: now 
                }).eq("id", data.id);

                await supabase.from("inventory").update({ qty: inv.qty - actionQty }).eq("id", data.item_id);
                alert("Material Issued Successfully!");
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
                await supabase.from("requests").update({ status: 'returned', approve_comment: `Verified: ${form.comment}`, to_uid: profile.id, to_name: profile.name, timestamp: now }).eq("id", data.id);
                const { data: inv } = await supabase.from("inventory").select("qty").eq("id", data.item_id).single();
                if (inv) await supabase.from("inventory").update({ qty: inv.qty + data.req_qty }).eq("id", data.item_id);
                alert("Return Verified!");
            }
            else if (type === 'reject') {
                await supabase.from("requests").update({ status: 'rejected', approve_comment: form.comment, timestamp: now }).eq("id", data.id);
                alert("Rejected!");
            }
            else if (type === 'return') {
                await supabase.from("requests").insert([{ 
                    item_id: data.item_id, item_name: data.item_name, item_spec: data.item_spec, item_unit: data.item_unit, req_qty: actionQty, status: 'return_requested', return_comment: form.comment, from_uid: profile.id, from_name: profile.name, from_unit: profile.unit, to_uid: data.to_uid, to_name: data.to_name, to_unit: data.to_unit, approve_comment: `VERIFY_LINK_ID:${data.id}`, txn_id: data.txn_id, timestamp: now 
                }]);
                alert("Return Request Sent!");
            }
        } catch(e){ alert("Operation failed."); }
        finally { setSubmitting(false); setActionModal(null); setForm({comment:"", qty:""}); fetchAll(); }
    };

    const sortedHistory = [...givenHistory, ...takenHistory].sort((a,b) => Number(b.timestamp) - Number(a.timestamp));
    const currentArchiveLogs = sortedHistory.slice((archivePage - 1) * logsPerPage, archivePage * logsPerPage);

    return (
        <div className={`space-y-10 pb-20 font-roboto uppercase font-bold tracking-tight transition-all duration-500 ${loading ? 'opacity-40 blur-[1px]' : 'opacity-100 blur-0'}`}>
            {/* --- 1. HEADER SECTION --- */}
            <h2 className="text-2xl font-black text-slate-800 flex items-center justify-center gap-3 py-4 tracking-widest uppercase">
                <i className="fa-solid fa-handshake-angle text-orange-500"></i> UDHAARI & RETURN DASHBOARD
            </h2>
            
            {/* --- 2. PENDING REQUESTS TABLE --- */}
            <section className="bg-white rounded-xl border-t-4 border-orange-500 shadow-xl overflow-hidden uppercase font-black">
                <div className="p-4 bg-orange-50/50 flex justify-between border-b tracking-widest text-[10px] font-black">
                    <div className="flex items-center gap-2 text-orange-900"><i className="fa-solid fa-bolt animate-pulse"></i> Attention Required</div>
                    <span className="bg-orange-600 text-white px-2.5 py-0.5 rounded-full">{pending.length}</span>
                </div>
                <div className="overflow-x-auto min-h-[150px]">
                    <table className="w-full text-left text-sm font-bold uppercase">
                        <thead className="bg-slate-50 text-[10px] text-slate-400 tracking-widest uppercase">
                            <tr><th className="p-4 pl-6">Material Detail</th><th className="p-4">Counterparty</th><th className="p-4 text-center">Qty</th><th className="p-4 text-center">Action</th></tr>
                        </thead>
                        <tbody className="divide-y text-slate-600 uppercase">
                            {pending.length > 0 ? pending.map(r => (
                                <tr key={r.id} className={`${r.status==='return_requested' ? 'bg-orange-50 animate-pulse' : 'bg-white'} transition border-b hover:bg-slate-50 font-black`}>
                                    <td className="p-4 pl-6 leading-tight">
                                        <div className="text-slate-800 font-bold uppercase">{r.item_name}</div>
                                        <div className="text-[10px] text-slate-400 mt-1 font-black uppercase tracking-tighter">{r.item_spec}</div>
                                        <div className="text-[8px] text-orange-600 font-black mt-1 uppercase tracking-widest">{formatTS(r.timestamp)}</div>
                                    </td>
                                    <td className="p-4 font-bold text-slate-700 uppercase">
                                        {r.from_name}<div className="text-[10px] text-slate-400 font-normal uppercase">{r.from_unit}</div>
                                    </td>
                                    <td className="p-4 text-center font-black text-orange-600 whitespace-nowrap">{r.req_qty} {r.item_unit}</td>
                                    <td className="p-4 flex gap-2 justify-center">
                                        <button onClick={()=>setActionModal({type: r.status==='pending' ? 'approve' : 'verify', data:r})} className="bg-[#ff6b00] text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md">
                                            {r.status==='pending' ? 'Issue' : 'Verify'}
                                        </button>
                                        <button onClick={()=>setActionModal({type: 'reject', data:r})} className="bg-slate-100 text-slate-500 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md">Reject</button>
                                    </td>
                                </tr>
                            )) : <tr><td colSpan={4} className="p-10 text-center text-slate-300 tracking-widest">NO PENDING ACTIONS</td></tr>}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* --- 3. UDHAARI TRACKING CARDS --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 uppercase font-bold tracking-tight">
                {/* ITEMS GIVEN SECTION */}
                <section className="bg-white rounded-2xl border-t-4 border-blue-600 shadow-lg h-[500px] flex flex-col overflow-hidden">
                    <div className="p-5 border-b bg-blue-50/30 flex items-center gap-3 text-xs font-black text-blue-900 tracking-widest uppercase">
                        <i className="fa-solid fa-arrow-up-from-bracket text-blue-600"></i> UDHAARI DIYA (ITEMS GIVEN)
                    </div>
                    <div className="p-4 space-y-4 overflow-y-auto bg-slate-50/20">
                        {given.length > 0 ? given.map(r => (
                            <div key={r.id} className="p-4 border-2 border-slate-100 bg-white rounded-2xl relative shadow-sm uppercase font-bold">
                                <div className="text-slate-800 font-bold text-[14px] leading-tight mb-2 uppercase">{r.item_name}</div>
                                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg uppercase">
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Receiver</p>
                                        <p className="text-[12px] font-black text-slate-700 tracking-tighter uppercase">{r.from_name} ({r.from_unit})</p>
                                    </div>
                                    <div className="text-right font-black text-blue-600 text-[14px] uppercase">{r.req_qty} {r.item_unit}</div>
                                </div>
                                <div className="text-[9px] font-mono text-slate-400 mt-2 p-2 bg-slate-50/50 rounded border-dashed border uppercase">
                                    TXN: {r.txn_id || '--'} | ISSUED: {formatTS(r.timestamp)}
                                </div>
                            </div>
                        )) : <div className="h-full flex items-center justify-center text-slate-300 tracking-widest">NO ITEMS GIVEN</div>}
                    </div>
                </section>

                {/* ITEMS TAKEN SECTION */}
                <section className="bg-white rounded-2xl border-t-4 border-red-600 shadow-lg h-[500px] flex flex-col overflow-hidden">
                    <div className="p-5 border-b bg-red-50/30 flex items-center gap-3 text-xs font-black text-red-900 tracking-widest uppercase">
                        <i className="fa-solid fa-arrow-down-long text-red-600"></i> UDHAARI LIYA (ITEMS TAKEN)
                    </div>
                    <div className="p-4 space-y-4 overflow-y-auto bg-slate-50/20">
                        {taken.length > 0 ? taken.map(r => (
                            <div key={r.id} className="p-4 border-2 border-slate-100 bg-white rounded-2xl relative shadow-sm uppercase font-bold">
                                <div className="text-slate-800 font-bold text-[14px] leading-tight mb-2 uppercase">{r.item_name}</div>
                                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg uppercase">
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Source</p>
                                        <p className="text-[12px] font-black text-slate-700 tracking-tighter uppercase">{r.to_unit} ({r.to_name})</p>
                                    </div>
                                    <div className="text-right font-black text-red-600 text-[14px] uppercase">{r.req_qty} {r.item_unit}</div>
                                </div>
                                <button onClick={()=>setActionModal({type:'return', data:r})} className="w-full mt-3 py-2 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-md hover:bg-black transition-all uppercase">
                                    Initiate Return
                                </button>
                            </div>
                        )) : <div className="h-full flex items-center justify-center text-slate-300 tracking-widest">NO ITEMS TAKEN</div>}
                    </div>
                </section>
            </div>

            {/* --- 4. AUDIT LOGS TABLE --- */}
            <div className="pt-10 space-y-6">
                <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden uppercase font-bold">
                    <div className="p-6 bg-slate-800 text-white flex flex-col items-center justify-center font-bold tracking-widest uppercase">
                        <span className="text-[20px]">RETURN & UDHAARI LOGS</span>
                        <span className="text-[10px] opacity-80 mt-1 uppercase">(UDH: UDHAARI • RET: RETURNED)</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[9px] divide-y font-mono uppercase font-bold">
                            <thead className="bg-slate-50 text-slate-400 tracking-widest uppercase text-[8.5px]">
                                <tr><th className="p-4">Txn ID</th><th className="p-4">Material Details</th><th className="p-4 text-center">Qty Status</th><th className="p-4">Audit Log</th><th className="p-4 text-center">Status</th></tr>
                            </thead>
                            <tbody className="divide-y text-slate-600 uppercase">
                                {currentArchiveLogs.map(h => (
                                    <tr key={h.id} className="hover:bg-slate-50 transition border-b uppercase font-black">
                                        <td className="p-4 tracking-tighter font-black"><span className="bg-slate-100 px-1.5 py-0.5 rounded border uppercase">{h.txn_id || '--'}</span></td>
                                        <td className="p-4 leading-tight"><p className="text-slate-800 font-bold text-[12px] tracking-tight uppercase">{h.item_name}</p><p className="text-[8.5px] text-slate-400 mt-1 uppercase tracking-tighter uppercase">SPEC: {h.item_spec}</p></td>
                                        <td className="p-4 text-center font-black whitespace-nowrap"><div className="flex flex-col items-center gap-1 leading-none uppercase"><span className="text-[9px] text-blue-600/80">UDH: {h.req_qty}</span>{h.status === 'returned' && <span className="text-[9px] text-green-600">RET: {h.req_qty}</span>}</div></td>
                                        <td className="p-4 leading-none space-y-1.5 font-bold tracking-tighter text-[8px] uppercase">
                                            <p className="text-slate-400 font-black uppercase"><span className="opacity-50">1. REQUEST BY:</span> {h.from_name} ({h.from_unit})</p>
                                            {h.status !== 'pending' && (<p className={h.status === 'rejected' ? 'text-red-500 font-black uppercase' : 'text-blue-600 font-black uppercase'}><span className="opacity-50 uppercase">{h.status === 'rejected' ? '2. REJECTED BY:' : '2. APPROVED BY:'}</span> {h.to_name} ON {formatTS(h.timestamp)}</p>)}
                                            {h.status === 'returned' && (<p className="text-green-600 font-black uppercase"><span className="opacity-50 uppercase">3. FINAL VERIFY:</span> {h.to_name} ON {formatTS(h.timestamp)}</p>)}
                                        </td>
                                        <td className="p-4 text-center uppercase"><span className={`px-2.5 py-1 rounded-full text-[8.5px] font-black tracking-widest uppercase ${h.status==='returned' ? 'bg-green-100 text-green-700' : h.status==='rejected' ? 'bg-slate-100 text-slate-500' : 'bg-red-100 text-red-700'}`}>{h.status}</span></td>
                                    </tr>))}
                            </tbody>
                        </table>
                    </div>
                    {/* PAGINATION PANEL */}
                    <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-[10px] font-black uppercase tracking-widest uppercase">
                        <button onClick={() => setArchivePage(prev => Math.max(prev - 1, 1))} disabled={archivePage === 1} className="px-5 py-2 bg-white border-2 rounded-lg shadow-sm disabled:opacity-30 hover:bg-slate-50 transition-all uppercase">Prev</button>
                        <span className="text-slate-400 uppercase font-black uppercase">Page {archivePage} of {Math.ceil(sortedHistory.length/logsPerPage)||1}</span>
                        <button onClick={() => setArchivePage(prev => Math.min(prev + 1, Math.ceil(sortedHistory.length/logsPerPage)||1))} disabled={archivePage >= (Math.ceil(sortedHistory.length/logsPerPage)||1)} className="px-5 py-2 bg-white border-2 rounded-lg shadow-sm disabled:opacity-30 hover:bg-slate-50 transition-all uppercase">Next</button>
                    </div>
                </div>
            </div>

            {/* --- 5. ACTION MODAL --- */}
            {actionModal && (
              <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 uppercase font-black">
                <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in uppercase font-bold uppercase font-black">
                  <div className="p-6 border-b bg-slate-50 flex justify-between items-center font-black uppercase uppercase">
                      <h3 className="text-slate-800 text-lg uppercase tracking-tight uppercase font-black">{actionModal.type === 'approve' ? 'Issue Spare' : actionModal.type === 'return' ? 'Initiate Return' : actionModal.type === 'verify' ? 'Verify Return' : 'Reject Action'}</h3>
                      <button onClick={()=>setActionModal(null)} className="text-slate-400 hover:text-red-500 transition-colors uppercase font-black"><i className="fa-solid fa-xmark text-xl uppercase"></i></button>
                  </div>
                  <div className="p-6 space-y-4 uppercase font-bold uppercase font-black">
                    <div className="bg-slate-50 p-4 rounded-xl border leading-tight uppercase font-black">
                        <p className="text-[13px] font-black text-slate-800 tracking-tighter uppercase uppercase font-black">{actionModal.data.item_name}</p>
                        <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase">SPEC: {actionModal.data.item_spec}</p>
                    </div>
                    {(actionModal.type === 'approve' || actionModal.type === 'return') && (
                        <div>
                            <label className="text-[10px] font-black text-slate-400 tracking-widest block mb-1 uppercase font-black">Quantity (Base Requested: {actionModal.data.req_qty})</label>
                            <input type="number" defaultValue={actionModal.data.req_qty} className="w-full mt-1 p-3 border-2 rounded-lg outline-none font-black text-slate-800 focus:border-orange-500 uppercase transition-all shadow-sm font-black uppercase" onChange={e=>setForm({...form, qty:e.target.value})} />
                        </div>
                    )}
                    <div>
                        <label className="text-[10px] font-black text-slate-400 tracking-widest block mb-1 uppercase font-black">Log / Audit Comment</label>
                        <textarea placeholder="Write reason or log details..." className="w-full mt-1 p-3 border-2 rounded-lg outline-none font-bold text-xs h-24 text-slate-800 uppercase focus:border-orange-500 shadow-sm font-black uppercase" onChange={e=>setForm({...form, comment:e.target.value})}></textarea>
                    </div>
                    <button disabled={submitting} onClick={handleProcess} className={`w-full py-4 ${actionModal.type === 'reject' ? 'bg-red-600' : 'bg-[#ff6b00]'} text-white font-black rounded-xl shadow-lg uppercase tracking-[0.2em] text-sm hover:opacity-90 transition-all font-black uppercase`}>
                        {submitting ? 'Processing Transaction...' : actionModal.type === 'return' ? 'Send Return Request' : 'Confirm Transaction'}
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>
    ); 
}
