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
        if (!profile?.unit) return;
        try {
            // 1. Pending Tasks (Issues + Return Requests)
            const { data: p } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).in("status", ["pending", "return_requested"]).order("id", { ascending: false });
            
            // 2. Active Udhaari (Only 'approved' status)
            const { data: g } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).eq("status", "approved").order("id", { ascending: false });
            const { data: t } = await supabase.from("requests").select("*").eq("from_unit", profile.unit).eq("status", "approved").order("id", { ascending: false });
            
            // 3. History (Returned or Rejected)
            const { data: gh } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).in("status", ["returned", "rejected"]).order("id", { ascending: false });
            const { data: th } = await supabase.from("requests").select("*").eq("from_unit", profile.unit).in("status", ["returned", "rejected"]).order("id", { ascending: false });
            
            if (p) setPending(p); 
            if (g) setGiven(g); 
            if (t) setTaken(t || []);
            if (gh) setGivenHistory(gh); 
            if (th) setTakenHistory(th || []);
        } catch (e) {
            console.error("Fetch Error:", e);
        }
    };

    useEffect(() => {
        if (!profile) return;
        fetchAll();
        const channel = supabase.channel('ledger-sync-main').on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => { 
            fetchAll(); 
            if(onAction) onAction(); 
        }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [profile]);

    const formatTS = (ts: any) => new Date(Number(ts)).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

    const handleProcess = async () => {
        const { type, data } = actionModal;
        const actionQty = Number(form.qty || data.req_qty);
        if (!form.comment.trim()) return alert("Log comment required!");
        if (actionQty <= 0) return alert("Invalid Qty!");

        try {
            if (type === 'approve') {
                const { data: inv } = await supabase.from("inventory").select("qty").eq("id", data.item_id).single();
                if (!inv || actionQty > inv.qty) return alert("INSUFFICIENT STOCK!");
                
                const txnId = data.txn_id || `#TXN-${Date.now().toString().slice(-6)}`;
                
                await supabase.from("requests").update({ 
                    status: 'approved', approve_comment: form.comment, txn_id: txnId, 
                    to_uid: profile.id, to_name: profile.name, req_qty: actionQty, viewed_by_requester: false 
                }).eq("id", data.id);

                await supabase.from("inventory").update({ qty: inv.qty - actionQty }).eq("id", data.item_id);
                alert("Material Issued!");
            } 
            else if (type === 'return') {
                // Udhaari return karne ki request daalna
                await supabase.from("requests").insert([{ 
                    item_id: data.item_id, item_name: data.item_name, item_spec: data.item_spec, item_unit: data.item_unit, 
                    req_qty: actionQty, status: 'return_requested', return_comment: form.comment, 
                    from_uid: profile.id, from_name: profile.name, from_unit: profile.unit, 
                    to_uid: data.to_uid, to_name: data.to_name, to_unit: data.to_unit, 
                    viewed_by_requester: false, 
                    approve_comment: `VERIFY_LINK_ID:${data.id}`, // Parent ID store karna
                    txn_id: data.txn_id,
                    timestamp: Date.now()
                }]);
                alert("Return Initiated!");
            }
            else if (type === 'verify') {
                // 1. Parent entry check karna (jahan status 'approved' hai)
                const parentIdMatch = data.approve_comment?.match(/VERIFY_LINK_ID:(\d+)/);
                const parentId = parentIdMatch ? parentIdMatch[1] : null;

                if (parentId) {
                    const { data: parent } = await supabase.from("requests").select("req_qty").eq("id", parentId).single();
                    if (parent) {
                        const newBal = parent.req_qty - data.req_qty;
                        if (newBal <= 0) {
                            await supabase.from("requests").delete().eq("id", parentId); // Full return: Active ledger se delete
                        } else {
                            await supabase.from("requests").update({ req_qty: newBal }).eq("id", parentId); // Partial return: Qty update
                        }
                    }
                }
                
                // 2. Return request ko confirm karna
                await supabase.from("requests").update({ 
                    status: 'returned', 
                    approve_comment: `Verified: ${form.comment}`, 
                    to_uid: profile.id, to_name: profile.name, 
                    viewed_by_requester: false 
                }).eq("id", data.id);
                
                // 3. Inventory mein stock wapas jodna
                const { data: inv } = await supabase.from("inventory").select("qty").eq("id", data.item_id).single();
                if (inv) await supabase.from("inventory").update({ qty: inv.qty + data.req_qty }).eq("id", data.item_id);
                alert("Return Verified & Stock Updated!");
            }
            else if (type === 'reject') {
                await supabase.from("requests").update({ 
                    status: 'rejected', 
                    approve_comment: form.comment, 
                    to_uid: profile.id, to_name: profile.name, 
                    viewed_by_requester: false 
                }).eq("id", data.id);
            }

            // UI manual refresh
            await fetchAll();
            if(onAction) onAction();
        } catch (e) {
            console.error(e);
            alert("Operation failed.");
        }
        setActionModal(null); 
        setForm({comment:"", qty:""});
    };

    const sortedHistory = [...givenHistory, ...takenHistory].sort((a,b) => Number(b.timestamp) - Number(a.timestamp));
    const currentArchiveLogs = sortedHistory.slice((archivePage - 1) * logsPerPage, archivePage * logsPerPage);

    return (
        <div className="space-y-10 pb-20 font-roboto uppercase font-bold tracking-tight">
            <h2 className="text-2xl font-black text-slate-800 flex items-center justify-center gap-3 py-4 border-b-2 border-slate-100">
                <i className="fa-solid fa-handshake-angle text-orange-500"></i> UDHAARI & RETURN DASHBOARD
            </h2>
            
            {/* --- SECTION: PENDING ACTION --- */}
            <section className="bg-white rounded-2xl border-t-4 border-orange-500 shadow-xl overflow-hidden">
                <div className="p-4 bg-orange-50/50 flex justify-between items-center border-b">
                    <div className="flex items-center gap-2 text-orange-900 text-[10px] tracking-widest font-black">
                        <i className="fa-solid fa-bolt animate-pulse"></i> ATTENTION REQUIRED
                    </div>
                    <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-[10px]">{pending.length}</span>
                </div>
                <div className="overflow-x-auto min-h-[150px]">
                    <table className="w-full text-left text-sm divide-y uppercase">
                        <thead className="bg-slate-50 text-[10px] text-slate-400 tracking-widest font-black">
                            <tr><th className="p-4 pl-6">Material Details</th><th className="p-4">Counterparty</th><th className="p-4 text-center">Qty</th><th className="p-4 text-center">Action</th></tr>
                        </thead>
                        <tbody className="divide-y text-slate-600">
                            {pending.map(r => (
                                <tr key={r.id} className={`${r.status==='return_requested' ? 'bg-orange-50 animate-pulse' : 'bg-white'} border-b hover:bg-slate-50 transition-colors`}>
                                    <td className="p-4 pl-6 leading-tight">
                                        <div className="text-slate-800 font-black text-[14px]">{r.item_name}</div>
                                        <div className="text-[10px] text-slate-400 mt-1">{r.item_spec}</div>
                                        <div className="text-[8px] text-orange-600 mt-1 font-black">{formatTS(r.timestamp)}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-black text-slate-700">{r.from_name}</div>
                                        <div className="text-[10px] text-slate-400 font-bold">{r.from_unit}</div>
                                    </td>
                                    <td className="p-4 text-center font-black text-orange-600 text-[14px]">{r.req_qty} {r.item_unit}</td>
                                    <td className="p-4 flex gap-2 justify-center">
                                        <button onClick={()=>setActionModal({type: r.status==='pending' ? 'approve' : 'verify', data:r})} className="bg-orange-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-md uppercase tracking-widest">{r.status==='pending' ? 'Issue' : 'Verify'}</button>
                                        <button onClick={()=>setActionModal({type: 'reject', data:r})} className="bg-slate-100 text-slate-400 px-4 py-2 rounded-xl text-[10px] font-black hover:bg-slate-200 uppercase">Reject</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* --- SECTION: ACTIVE LEDGER GRID --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* DIYA (GIVEN) */}
                <section className="bg-white rounded-3xl border-t-4 border-blue-600 shadow-lg flex flex-col h-[500px]">
                    <div className="p-5 border-b bg-blue-50/30 text-blue-900 text-xs font-black tracking-widest flex items-center gap-3">
                        <i className="fa-solid fa-arrow-up-from-bracket"></i> UDHAARI DIYA (GIVEN)
                    </div>
                    <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
                        {given.map(r => (
                            <div key={r.id} className="p-5 border-2 border-slate-100 bg-white rounded-2xl shadow-sm hover:border-blue-200 transition-all">
                                <div className="text-slate-800 font-black text-[14px] mb-1">{r.item_name}</div>
                                <div className="text-[10px] text-slate-400 mb-3">{r.item_spec}</div>
                                <div className="flex justify-between items-center bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
                                    <div>
                                        <p className="text-[8px] text-slate-400 font-black mb-0.5">RECEIVER</p>
                                        <p className="text-[12px] font-black text-slate-700">{r.from_name} ({r.from_unit})</p>
                                    </div>
                                    <div className="text-right text-blue-600 font-black text-sm">{r.req_qty} {r.item_unit}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* LIYA (TAKEN) */}
                <section className="bg-white rounded-3xl border-t-4 border-red-600 shadow-lg flex flex-col h-[500px]">
                    <div className="p-5 border-b bg-red-50/30 text-red-900 text-xs font-black tracking-widest flex items-center gap-3">
                        <i className="fa-solid fa-arrow-down-long"></i> UDHAARI LIYA (TAKEN)
                    </div>
                    <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
                        {taken.map(r => (
                            <div key={r.id} className="p-5 border-2 border-slate-100 bg-white rounded-2xl shadow-sm hover:border-red-200 transition-all">
                                <div className="text-slate-800 font-black text-[14px] mb-1">{r.item_name}</div>
                                <div className="text-[10px] text-slate-400 mb-3">{r.item_spec}</div>
                                <div className="flex justify-between items-center bg-red-50/50 p-3 rounded-xl border border-red-100/50 mb-3">
                                    <div>
                                        <p className="text-[8px] text-slate-400 font-black mb-0.5">SOURCE</p>
                                        <p className="text-[12px] font-black text-slate-700">{r.to_unit} ({r.to_name})</p>
                                    </div>
                                    <div className="text-right text-red-600 font-black text-sm">{r.req_qty} {r.item_unit}</div>
                                </div>
                                <button onClick={()=>setActionModal({type:'return', data:r})} className="w-full py-2.5 bg-slate-900 text-white text-[10px] font-black rounded-xl shadow-lg hover:bg-black transition-all uppercase tracking-widest">
                                    Initiate Return
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* --- SECTION: LOGS --- */}
            <section className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="p-6 bg-slate-800 text-white text-center">
                    <h3 className="text-lg font-black tracking-widest">RETURN & UDHAARI HISTORY</h3>
                    <p className="text-[9px] text-slate-400 mt-1 uppercase">TRANSACTION AUDIT LOGS</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[9px] divide-y font-bold uppercase tracking-tighter">
                        <thead className="bg-slate-50 text-slate-400 tracking-widest">
                            <tr><th className="p-4">TXN ID</th><th className="p-4">Material</th><th className="p-4 text-center">Qty</th><th className="p-4">Counterparty</th><th className="p-4 text-center">Status</th></tr>
                        </thead>
                        <tbody className="divide-y text-slate-600">
                            {currentArchiveLogs.map(h => (
                                <tr key={h.id} className="hover:bg-slate-50">
                                    <td className="p-4 font-black text-blue-600">{h.txn_id || '--'}</td>
                                    <td className="p-4">
                                        <div className="text-slate-800 font-black">{h.item_name}</div>
                                        <div className="text-[8px] text-slate-400">{h.item_spec}</div>
                                    </td>
                                    <td className="p-4 text-center font-black">{h.req_qty} {h.item_unit}</td>
                                    <td className="p-4">
                                        <p className="text-blue-600">B: {h.from_name}</p>
                                        <p className="text-red-500">L: {h.to_name}</p>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[8px] font-black tracking-widest ${h.status==='returned' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {h.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-[10px] font-black">
                    <button onClick={() => setArchivePage(prev => Math.max(prev - 1, 1))} disabled={archivePage === 1} className="px-5 py-2 bg-white border-2 rounded-lg disabled:opacity-30">PREV</button>
                    <span className="text-slate-400 tracking-widest uppercase">Page {archivePage} of {Math.ceil(sortedHistory.length/logsPerPage)||1}</span>
                    <button onClick={() => setArchivePage(prev => Math.min(prev + 1, Math.ceil(sortedHistory.length/logsPerPage)||1))} disabled={archivePage === (Math.ceil(sortedHistory.length/logsPerPage)||1)} className="px-5 py-2 bg-white border-2 rounded-lg disabled:opacity-30">NEXT</button>
                </div>
            </section>

            {/* --- MODAL --- */}
            {actionModal && (
              <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-in">
                  <div className="p-6 border-b bg-slate-50 flex justify-between items-center font-black">
                    <h3 className="text-slate-800 text-lg uppercase">{actionModal.type === 'approve' ? 'Issue Spare' : actionModal.type === 'return' ? 'Initiate Return' : actionModal.type === 'verify' ? 'Verify Return' : 'Reject Action'}</h3>
                    <button onClick={()=>setActionModal(null)} className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-circle-xmark text-xl"></i></button>
                  </div>
                  <div className="p-8 space-y-5 uppercase">
                    <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                      <p className="text-[9px] text-slate-400 font-black mb-1">Item Details</p>
                      <p className="text-[13px] font-black text-slate-800">{actionModal.data.item_name}</p>
                    </div>
                    {(actionModal.type === 'approve' || actionModal.type === 'return') && (
                      <div>
                        <label className="text-[10px] font-black text-slate-400 tracking-widest block mb-2">Quantity</label>
                        <input type="number" defaultValue={actionModal.data.req_qty} className="w-full p-4 border-2 rounded-2xl outline-none focus:border-orange-500 font-black text-slate-800" onChange={e=>setForm({...form, qty:e.target.value})} />
                      </div>
                    )}
                    <div>
                        <label className="text-[10px] font-black text-slate-400 tracking-widest block mb-2">Audit Log / Comment</label>
                        <textarea placeholder="Write reason..." className="w-full p-4 border-2 rounded-2xl outline-none focus:border-orange-500 h-24 font-bold text-xs uppercase" onChange={e=>setForm({...form, comment:e.target.value})}></textarea>
                    </div>
                    <button onClick={handleProcess} className={`w-full py-4 ${actionModal.type === 'reject' ? 'bg-red-600' : 'bg-orange-600'} text-white font-black rounded-2xl shadow-xl uppercase tracking-widest`}>
                        {actionModal.type === 'return' ? 'Send Return Request' : 'Confirm Action'}
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>
    ); 
}
