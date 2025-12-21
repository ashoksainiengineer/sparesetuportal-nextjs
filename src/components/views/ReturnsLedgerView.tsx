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
            const { data: t = [] } = await supabase.from("requests").select("*").eq("from_unit", profile.unit).eq("status", "approved").order("id", { ascending: false });
            const { data: gh } = await supabase.from("requests").select("*").eq("to_unit", profile.unit).in("status", ["returned", "rejected"]).order("id", { ascending: false });
            const { data: th = [] } = await supabase.from("requests").select("*").eq("from_unit", profile.unit).in("status", ["returned", "rejected"]).order("id", { ascending: false });
            if (p) setPending(p); if (g) setGiven(g); if (t) setTaken(t);
            if (gh) setGivenHistory(gh); if (th) setTakenHistory(th);
        } catch(e){}
    };

    useEffect(() => {
        if (!profile) return; fetchAll();
        const channel = supabase.channel('sparesetu-returns-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => { fetchAll(); if(onAction) onAction(); }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [profile]);

    const formatTS = (ts: any) => new Date(Number(ts)).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

    const handleProcess = async () => {
        const { type, data } = actionModal;
        const actionQty = Number(form.qty || data.req_qty);
        if (!form.comment.trim()) { alert("Provide a reason!"); return; }
        
        try {
            if (type === 'approve') {
                const newTxnId = `#TXN-${Date.now().toString().slice(-6)}`;
                await supabase.from("requests").update({ status: 'approved', approve_comment: form.comment, txn_id: newTxnId, to_uid: profile.id, to_name: profile.name, req_qty: actionQty, viewed_by_requester: false }).eq("id", data.id);
                const { data: inv } = await supabase.from("inventory").select("qty").eq("id", data.item_id).single();
                if (inv) await supabase.from("inventory").update({ qty: inv.qty - actionQty }).eq("id", data.item_id);
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
            
            {/* Logic for Tables (Pending, Given, Taken) remains exactly as provided in your original monolithic code */}
            {/* ... (Paste your original table code here using the filtered state variables above) ... */}
            
            <p className="text-center text-slate-400 text-[10px] tracking-[0.3em]">Audited Ledger Sync Active</p>
        </div>
    ); 
}
