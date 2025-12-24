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
    
    // Pagination state
    const [archivePage, setArchivePage] = useState(1);
    const logsPerPage = 10;

    const fetchAll = useCallback(async () => {
        if (!profile?.unit) return;
        try {
            // Visibility: Requests coming TO our zone
            const { data: p } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).in("status", ["pending", "return_requested"]).order("timestamp", { ascending: false });
            // Active Given: We lent this (Lender side)
            const { data: g } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).eq("status", "approved").order("timestamp", { ascending: false });
            // Active Taken: We borrowed this (Borrower side)
            const { data: t = [] } = await supabase.from("requests").select("*").eq("from_unit", profile.unit).eq("status", "approved").order("timestamp", { ascending: false });
            
            const { data: gh } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).in("status", ["returned", "rejected"]).order("timestamp", { ascending: false });
            const { data: th = [] } = await supabase.from("requests").select("*").eq("from_unit", profile.unit).in("status", ["returned", "rejected"]).order("timestamp", { ascending: false });
            
            setPending(p || []); setGiven(g || []); setTaken(t || []);
            setGivenHistory(gh || []); setTakenHistory(th || []);
        } catch(e: any){}
    }, [profile.unit]);

    useEffect(() => {
        if (!profile) return; fetchAll();
        const channel = supabase.channel(`secure_ledger_v${Date.now()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => { 
            fetchAll(); if(onAction) onAction(); 
        }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [profile, fetchAll, onAction]);

    const formatTS = (ts: any) => ts ? new Date(Number(ts)).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '--';

    const handleProcess = async () => {
        const { type, data } = actionModal;
        const actionQty = Number(parseFloat(form.qty !== "" ? form.qty : data.req_qty).toFixed(3));
        if (!form.comment.trim() || isNaN(actionQty) || actionQty <= 0) return alert("LOG DETAILS & VALID QTY REQUIRED!");

        setSubmitting(true);
        try {
            const now = Date.now();
            const logStamp = ` [${profile.name} (${profile.unit}) | ${formatTS(now)}]`;

            // Race Condition Check
            const { data: live } = await supabase.from("requests").select("status").eq("id", data.id).single();
            if (!live || live.status !== data.status) throw new Error("STALE DATA: This transaction was already processed.");

            if (type === 'approve') {
                const { data: inv } = await supabase.from("inventory").select("*").eq("id", data.item_id).single();
                if (!inv || actionQty > inv.qty) throw new Error("STOCK SHORTAGE!");
                await supabase.from("requests").update({ status: 'approved', approve_comment: `2. APPROVED: ${form.comment}${logStamp}`, txn_id: data.txn_id || `#TXN-${now.toString().slice(-6)}`, to_uid: profile.id, to_name: profile.name, req_qty: actionQty, timestamp: now }).eq("id", data.id);
                await supabase.from("inventory").update({ qty: Number((inv.qty - actionQty).toFixed(3)) }).eq("id", data.item_id);
            } 
            else if (type === 'return') {
                // FIXED VISIBILITY: Targeting Original Lender Zone
                await supabase.from("requests").insert([{ 
                    txn_id: data.txn_id, item_id: data.item_id, item_name: data.item_name, item_spec: data.item_spec, 
                    item_unit: data.item_unit, req_qty: actionQty, status: 'return_requested', return_comment: `INITIATED: ${form.comment}${logStamp}`, from_uid: profile.id, from_name: profile.name, from_unit: profile.unit, 
                    to_uid: data.to_uid, to_name: data.to_name, to_unit: data.to_unit, approve_comment: `VERIFY_LINK_ID:${data.id}`, timestamp: now 
                }]);
            }
            else if (type === 'verify') {
                // SELF-VERIFICATION PROTECTION
                if (profile.id === data.from_uid) throw new Error("UNAUTHORIZED: You cannot verify your own return!");

                const parentId = data.approve_comment?.match(/VERIFY_LINK_ID:(\d+)/)?.[1];
                const { data: pRec } = await supabase.from("requests").select("*").eq("id", parentId).single();
                
                // INTEGRITY CHECKS
                if (!pRec || pRec.status !== 'approved') throw new Error("ERROR: Parent transaction closed.");
                if (pRec.item_id !== data.item_id) throw new Error("SECURITY: Material mismatch detected!");
                if (actionQty > pRec.req_qty) throw new Error("INVALID: Return qty exceeds balance.");

                const bal = Number((pRec.req_qty - actionQty).toFixed(3));
                await supabase.from("requests").update({ 
                    status: bal <= 0 ? 'returned' : 'approved', req_qty: Math.max(0, bal),
                    approve_comment: bal <= 0 ? `ORIGINAL CLOSED` : `PARTIAL RETURN. BAL: ${bal}` 
                }).eq("id", parentId);

                // CUSTODY ASSIGNMENT
                const { data: exist } = await supabase.from("inventory").select("*").eq("holder_uid", profile.id).eq("item", data.item_name).eq("spec", data.item_spec).single();
                if (exist) { await supabase.from("inventory").update({ qty: Number((exist.qty + actionQty).toFixed(3)) }).eq("id", exist.id); }
                else {
                    const { data: o } = await supabase.from("inventory").select("*").eq("id", data.item_id).single();
                    await supabase.from("inventory").insert([{ item: data.item_name, spec: data.item_spec, make: o?.make || '-', model: o?.model || '-', cat: o?.cat || 'General', sub: o?.sub || 'General', qty: actionQty, unit: data.item_unit, holder_name: profile.name, holder_uid: profile.id, holder_unit: profile.unit, timestamp: now }]);
                }
                await supabase.from("requests").update({ status: 'returned', approve_comment: `3. VERIFIED: ${form.comment}${logStamp}`, to_uid: profile.id, to_name: profile.name, timestamp: now }).eq("id", data.id);
            }
            else if (type === 'reject') {
                await supabase.from("requests").update({ status: 'rejected', approve_comment: `REJECTED: ${form.comment}${logStamp}`, timestamp: now }).eq("id", data.id);
            }
            alert("ACTION SUCCESSFUL!");
        } catch(e:any){ alert(e.message); }
        finally { setSubmitting(false); setActionModal(null); setForm({comment:"", qty:""}); fetchAll(); }
    };

    const sortedHistory = [...givenHistory, ...takenHistory].sort((a,b) => Number(b.timestamp) - Number(a.timestamp));
    const paginatedLogs = sortedHistory.slice((archivePage - 1) * logsPerPage, archivePage * logsPerPage);

    return (
        <div className="space-y-10 animate-fade-in pb-20 font-roboto uppercase font-black tracking-tight">
            <h2 className="text-xl font-black text-slate-800 flex items-center justify-center gap-3 py-4 tracking-widest border-b-2 border-slate-100 uppercase font-black"><i className="fa-solid fa-handshake-angle text-orange-500"></i> UDHAARI & RETURN DASHBOARD</h2>
            
            {/* 1. ATTENTION REQUIRED (Scrollable) */}
            <section className="bg-white rounded-xl border-t-4 border-orange-500 shadow-xl overflow-hidden font-black">
                <div className="p-4 bg-orange-50/50 flex justify-between items-center border-b font-black uppercase"><div className="flex items-center gap-2 text-orange-900 text-[11px] tracking-widest uppercase font-black"><i className="fa-solid fa-bolt animate-pulse"></i> ATTENTION REQUIRED</div><span className="bg-orange-600 text-white px-2 py-0.5 rounded-full text-[10px]">{pending.length}</span></div>
                <div className="max-h-[350px] overflow-y-auto"><table className="w-full text-left border-collapse font-black"><thead className="bg-slate-50 border-b sticky top-0 z-10 text-[10px] text-slate-400 tracking-widest uppercase font-black"><tr><th className="p-5">MATERIAL DETAIL</th><th className="p-5">TARGET ENG</th><th className="p-5">REQUESTER</th><th className="p-5 text-center">QTY</th><th className="p-5 text-center">ACTION</th></tr></thead><tbody className="divide-y text-slate-600 font-bold text-[13px]">
                    {pending.map(r => (<tr key={r.id} className="bg-white hover:bg-slate-50 border-b transition-colors"><td className="p-5 leading-tight"><div className="text-slate-800 font-black text-[13px]">{r.item_name}</div><div className="text-[9px] text-slate-400 mt-1 uppercase tracking-tighter">{r.item_spec}</div><div className="text-[8px] text-orange-600 font-black mt-2 tracking-widest">{formatTS(r.timestamp)}</div></td><td className="p-5"><span className="text-indigo-600 font-black text-[11px] bg-indigo-50 px-2 py-1 rounded border border-indigo-100 uppercase">{r.to_name} ({profile.unit})</span></td><td className="p-5 leading-snug"><div className="text-slate-700 font-black text-[12px] uppercase font-black">{r.from_name} ({r.from_unit})</div></td><td className="p-5 text-center font-black text-orange-600 text-[16px]">{r.req_qty}</td><td className="p-5"><div className="flex gap-2 justify-center"><button onClick={()=>setActionModal({type: r.status==='pending' ? 'approve' : 'verify', data:r})} className="flex-1 bg-[#ff6b00] text-white py-2 rounded-lg text-[10px] font-black tracking-widest uppercase shadow-md hover:bg-orange-600 transition-all font-black">{r.status==='pending' ? 'Issue' : 'Verify'}</button><button onClick={()=>setActionModal({type: 'reject', data:r})} className="flex-1 bg-slate-100 text-slate-500 py-2 rounded-lg text-[10px] font-black hover:bg-slate-200 transition-all font-black">Reject</button></div></td></tr>))}
                </tbody></table></div></section>

            {/* 2. TRACKING CARDS (Side by Side with Dates & Zone Brackets) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-black uppercase">
                <section className="bg-white rounded-2xl border-t-4 border-blue-600 shadow-lg overflow-hidden flex flex-col h-[520px]">
                    <div className="p-4 border-b bg-blue-50/30 flex items-center gap-3 text-xs font-black text-blue-900 tracking-widest uppercase font-black font-black"><i className="fa-solid fa-arrow-up-from-bracket text-blue-600"></i> UDHAARI DIYA (ZONE TOTAL)</div>
                    <div className="p-4 space-y-3 overflow-y-auto bg-slate-50/20 flex-1">{given.map(r => (<div key={r.id} className="p-4 border-2 border-slate-100 bg-white rounded-xl shadow-sm hover:border-blue-100 transition-all uppercase"><div className="text-slate-800 font-black text-[13px]">{r.item_name}</div><div className="text-[9px] text-slate-400 mb-2">{r.item_spec}</div><div className="flex justify-between items-center bg-blue-50/50 p-3 rounded-lg mb-2 border border-blue-100/50"><div className="flex-1"><p className="text-[8px] font-black text-orange-600 tracking-widest mb-1">BORROWER</p><p className="text-[12px] font-black text-slate-700 leading-none">{r.from_name} ({r.from_unit})</p></div><div className="text-right pl-3"><p className="text-[15px] font-black text-blue-600">{r.req_qty}</p></div></div><div className="text-[8.5px] font-black text-slate-400 flex justify-between font-mono tracking-tighter uppercase border-t border-dashed border-slate-200 pt-2"><span>TXN ID: {r.txn_id}</span><span>ISSUED: {formatTS(r.timestamp)}</span></div><div className="text-[8.5px] text-blue-500 font-black mt-1">LENDER: {r.to_name} ({r.to_unit})</div></div>))}</div></section>

                <section className="bg-white rounded-2xl border-t-4 border-red-600 shadow-lg overflow-hidden flex flex-col h-[520px]">
                    <div className="p-4 border-b bg-red-50/30 flex items-center gap-3 text-xs font-black text-red-900 tracking-widest uppercase font-black font-black"><i className="fa-solid fa-arrow-down-long text-red-600"></i> UDHAARI LIYA (MY REQUESTS)</div>
                    <div className="p-4 space-y-3 overflow-y-auto bg-slate-50/20 flex-1">{taken.map(r => (<div key={r.id} className="p-4 border-2 border-slate-100 bg-white rounded-xl shadow-sm hover:border-red-100 transition-all uppercase"><div className="text-slate-800 font-black text-[13px]">{r.item_name}</div><div className="text-[9px] text-slate-400 mb-2">{r.item_spec}</div><div className="flex justify-between items-center bg-red-50/50 p-3 rounded-lg mb-2 border border-red-100/50"><div className="flex-1"><p className="text-[8px] font-black text-blue-600 tracking-widest mb-1">SOURCE (LENDER)</p><p className="text-[12px] font-black text-slate-700 leading-none">{r.to_name} ({r.to_unit})</p></div><div className="text-right pl-3"><p className="text-[15px] font-black text-red-600">{r.req_qty}</p></div></div><div className="text-[8.5px] font-black text-slate-400 flex justify-between font-mono tracking-tighter uppercase border-t border-dashed border-slate-200 pt-2"><span>TXN ID: {r.txn_id}</span><span>TAKEN: {formatTS(r.timestamp)}</span></div><div className="text-[8.5px] text-red-500 font-black mt-1 mb-2">BORROWER: {r.from_name} ({r.from_unit})</div><button onClick={()=>setActionModal({type:'return', data:r})} className="w-full py-2.5 bg-slate-900 text-white text-[10px] font-black rounded-lg uppercase tracking-widest hover:bg-black transition-all shadow-lg font-black">Initiate Return</button></div>))}</div></section>
            </div>

            {/* 3. ARCHIVE LOGS (Paginated) */}
            <section className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden font-black uppercase">
                <div className="p-6 bg-slate-900 text-white flex items-center justify-center border-b-4 border-orange-500 font-black uppercase tracking-[0.3em] font-black">ARCHIVE LOGS</div>
                <div className="overflow-x-auto"><table className="w-full text-left border-collapse font-black"><thead className="bg-slate-50 border-b text-[9px] text-slate-400 font-black tracking-widest uppercase"><tr><th className="p-5">TXN ID</th><th className="p-5">MATERIAL DETAIL</th><th className="p-5 text-center">QTY</th><th className="p-5">PARTIES</th><th className="p-5">AUDIT TRAIL</th><th className="p-5 text-center">STATUS</th></tr></thead><tbody className="divide-y text-slate-600 font-bold text-[11px]">
                    {paginatedLogs.map(h => (<tr key={h.id} className="hover:bg-slate-50 transition-colors border-b font-black"><td className="p-5 font-mono text-[10px] font-black">{h.txn_id || '--'}</td><td className="p-5 leading-tight"><p className="text-slate-800 font-black text-[12.5px] font-black">{h.item_name}</p><p className="text-[8.5px] text-slate-400 mt-1 uppercase tracking-tighter">SPEC: {h.item_spec}</p></td><td className="p-5 text-center font-black"><span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-[10px]">UDH: {h.req_qty}</span>{h.status === 'returned' && <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded text-[10px] block mt-1">RET: {h.req_qty}</span>}</td><td className="p-5 leading-snug font-black"><p className="text-blue-600 font-black uppercase font-black">{h.from_name} ({h.from_unit})</p><p className="text-red-500 font-black mt-1.5 uppercase font-black">{h.to_name} ({h.to_unit})</p></td><td className="p-5 leading-none space-y-2 text-[8.5px] tracking-tight uppercase font-black"><p className="text-slate-400 font-black">1. REQ BY: {h.from_name} ({h.from_unit})</p><p className="text-blue-600 font-black leading-tight uppercase font-black">{h.approve_comment}</p>{h.status === 'returned' && <p className="text-green-600 font-black leading-tight uppercase font-black">{h.return_comment}</p>}</td><td className="p-5 text-center font-black"><span className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-sm ${h.status==='returned' ? 'bg-green-600 text-white' : h.status==='rejected' ? 'bg-slate-400 text-white' : 'bg-red-600 text-white'}`}>{h.status}</span></td></tr>))}
                </tbody></table></div>
                <div className="p-4 bg-slate-50 border-t flex justify-between items-center font-black"><span className="text-[9px] text-slate-400 tracking-widest uppercase italic font-black font-black">Showing {paginatedLogs.length} of {sortedHistory.length}</span><div className="flex gap-2 font-black"><button disabled={archivePage === 1} onClick={()=>setArchivePage(p=>p-1)} className="px-3 py-1 bg-white border border-slate-200 rounded text-[9px] hover:bg-slate-50 disabled:opacity-30 font-black font-black">Prev</button><span className="text-[10px] py-1 px-2 bg-orange-500 text-white rounded font-black font-black">{archivePage}</span><button disabled={archivePage * logsPerPage >= sortedHistory.length} onClick={()=>setArchivePage(p=>p+1)} className="px-3 py-1 bg-white border border-slate-200 rounded text-[9px] hover:bg-slate-50 disabled:opacity-30 font-black font-black">Next</button></div></div>
            </section>

            {/* ACTION MODAL (Simple Style - Details Included) */}
            {actionModal && (
              <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 font-black">
                <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-in border-t-8 border-[#ff6b00]">
                  <div className="p-6 border-b bg-slate-50 flex justify-between items-center font-black uppercase"><h3 className="text-slate-800 text-sm tracking-widest font-black uppercase">{actionModal.type === 'approve' ? 'Issue Spare' : actionModal.type === 'verify' ? 'Verify Return' : actionModal.type === 'return' ? 'Initiate Return' : 'Reject Action'}</h3><button onClick={()=>setActionModal(null)} className="text-slate-400 hover:text-red-500 transition-colors font-black text-2xl font-black font-black"><i className="fa-solid fa-xmark"></i></button></div>
                  <div className="p-6 space-y-5 font-black uppercase font-black">
                    <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-100 space-y-3 font-black uppercase font-black">
                        <div><p className="text-[8px] text-orange-600 tracking-widest mb-1 font-black uppercase font-black">Material Details</p><p className="text-[14px] font-black text-slate-800 leading-tight">{actionModal.data.item_name}</p></div>
                        <div className="grid grid-cols-2 gap-4 uppercase font-black">
                            <div><p className="text-[8px] text-slate-400 uppercase font-black font-black">Make</p><p className="text-[11px] font-black text-slate-700 font-black">{actionModal.data.item_make || actionModal.data.make || '-'}</p></div>
                            <div><p className="text-[8px] text-slate-400 uppercase font-black font-black">Model</p><p className="text-[11px] font-black text-slate-700 font-black">{actionModal.data.item_model || actionModal.data.model || '-'}</p></div>
                        </div>
                        <div><p className="text-[8px] text-slate-400 uppercase font-black font-black">Spec / Rating</p><p className="text-[11px] font-black text-slate-700 leading-tight uppercase font-black font-black">{actionModal.data.item_spec}</p></div>
                    </div>
                    {(actionModal.type === 'approve' || actionModal.type === 'return') && (
                      <div className="font-black uppercase font-black"><label className="text-[10px] font-black text-slate-400 tracking-widest block mb-2 uppercase font-black">Confirmed Qty</label><input type="number" step="any" defaultValue={actionModal.data.req_qty} className="w-full p-4 border-2 border-slate-100 rounded-xl outline-none font-black text-slate-800 focus:border-orange-500 transition-all text-lg shadow-sm font-black uppercase font-black" onChange={e=>setForm({...form, qty:e.target.value})} /></div>
                    )}
                    <div className="font-black uppercase font-black"><label className="text-[10px] font-black text-slate-400 tracking-widest block mb-2 uppercase font-black">Transaction Remarks</label><textarea placeholder="ENTER TRANSACTION DETAILS..." className="w-full p-4 border-2 border-slate-100 rounded-xl outline-none font-black text-xs h-28 text-slate-800 focus:border-orange-500 transition-all uppercase shadow-sm font-black font-black" onChange={e=>setForm({...form, comment:e.target.value})}></textarea></div>
                    <button disabled={submitting} onClick={handleProcess} className={`w-full py-4 ${actionModal.type === 'reject' ? 'bg-red-600' : 'bg-[#ff6b00]'} text-white font-black rounded-xl shadow-lg uppercase tracking-widest text-sm hover:opacity-95 transition-all font-black font-black`}>{submitting ? 'SYNCING...' : 'Confirm Action'}</button>
                  </div>
                </div>
              </div>
            )}
        </div>
    ); 
}
