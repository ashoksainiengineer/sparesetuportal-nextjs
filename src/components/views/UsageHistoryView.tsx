"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function UsageHistoryView({ profile }: any) {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => { if (profile) fetch(); }, [profile]);
  
  const fetch = async () => { 
    try { const { data } = await supabase.from("usage_logs").select("*").eq("consumer_uid", profile.id).order("timestamp", { ascending: false }); if (data) setLogs(data); } catch(e){} 
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm font-roboto font-bold uppercase">
      <div className="p-5 border-b bg-slate-50/50 flex justify-between">
        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wider">Log: Usage Feed</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono font-bold uppercase">
          <thead className="bg-slate-50 border-b text-[10px] font-black uppercase tracking-widest">
            <tr><th className="p-4 pl-8">Date</th><th className="p-4">Details</th><th className="p-4 text-center">Qty</th></tr>
          </thead>
          <tbody className="divide-y text-slate-600">
            {logs.map(l => (
              <tr key={l.id} className="hover:bg-slate-50 transition border-b border-slate-100">
                <td className="p-4 pl-8 uppercase font-mono">{new Date(Number(l.timestamp)).toLocaleDateString()}</td>
                <td className="p-4 font-bold uppercase leading-tight">
                  <div className="text-slate-800 font-bold text-[13px] tracking-tight uppercase">{l.item_name}</div>
                  <div className="text-[9px] text-slate-400 uppercase mt-0.5 tracking-tighter uppercase">{l.category}</div>
                </td>
                <td className="p-4 text-center font-black text-red-600">-{l.qty_consumed} Nos</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
