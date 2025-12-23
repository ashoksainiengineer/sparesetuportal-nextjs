"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function UsageHistoryView({ profile }: any) {
  const [logs, setLogs] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0); 
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const fetchLogs = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const from = (currentPage - 1) * itemsPerPage;
      const { data, count, error } = await supabase.from("usage_logs").select("*", { count: "exact" }).eq("consumer_uid", profile.id).order("timestamp", { ascending: false }).range(from, from + itemsPerPage - 1);
      if (!error) { setLogs(data || []); setTotalCount(count || 0); }
    } catch (e: any) {} finally { setLoading(false); }
  }, [profile?.id, currentPage]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const deleteLog = async (log: any) => {
    if (!confirm("Are you sure? This will restore stock back to your zone inventory.")) return;
    setSubmitting(true);
    try {
      const { data: invItem } = await supabase.from("inventory").select("qty").eq("id", log.item_id).single();
      if (invItem) await supabase.from("inventory").update({ qty: invItem.qty + log.qty_consumed }).eq("id", log.item_id);
      const { error } = await supabase.from("usage_logs").delete().eq("id", log.id);
      if (error) throw error;
      alert("Deleted and Stock Restored!"); fetchLogs();
    } catch (e: any) { alert("Restore failed!"); } finally { setSubmitting(false); }
  };

  const exportCSV = async () => {
    const { data } = await supabase.from("usage_logs").select("*").eq("consumer_uid", profile.id);
    if (!data) return;
    const headers = "Date,Item,Make,Model,Spec,Qty,Unit,Purpose\n";
    const rows = data.map(l => {
      const date = l.timestamp ? new Date(Number(l.timestamp)).toLocaleDateString('en-GB') : '--';
      return `"${date}","${l.item_name}","${l.make || '-'}","${l.model || '-'}","${l.spec || '-'}","${l.qty_consumed}","${l.unit || 'Nos'}","${l.purpose || ''}"\n`;
    });
    const blob = new Blob([headers + rows.join("")], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Consumption_History.csv`; a.click();
  };

  return (
    <div className="animate-fade-in space-y-6 pb-20 font-roboto font-bold uppercase tracking-tight">
      <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center border-l-4 border-red-600 gap-4 uppercase font-black">
        <div><h2 className="text-xl font-black text-slate-800 uppercase tracking-widest leading-none font-black uppercase">My Consumption History</h2><div className="flex items-center gap-2 mt-2 font-black uppercase"><span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase font-black uppercase">Personal Audit</span><span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase font-black uppercase">User: {profile?.name}</span></div></div>
        <div className="flex gap-2 w-full md:w-auto font-black uppercase"><button onClick={fetchLogs} disabled={loading} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black shadow-md flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all uppercase tracking-widest font-black uppercase"><i className={`fa-solid fa-sync ${loading ? 'animate-spin' : ''}`}></i> Refresh</button><button onClick={exportCSV} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black shadow-md flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all uppercase font-black uppercase tracking-widest font-black uppercase"><i className="fa-solid fa-file-csv"></i> Export CSV</button></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden font-black uppercase font-black uppercase">
        <div className="overflow-x-auto font-black uppercase font-black uppercase"><table className="w-full text-left tracking-tight font-black uppercase font-black uppercase"><thead className="bg-slate-50 text-slate-400 text-[10px] font-black border-b uppercase tracking-widest font-black uppercase font-black uppercase"><tr><th className="p-5 pl-8 font-black uppercase">Time Audit</th><th className="p-5 font-black uppercase">Material Details</th><th className="p-5 text-center font-black uppercase">Qty</th><th className="p-5 font-black uppercase">Job Purpose</th><th className="p-5 text-center font-black uppercase">Action</th></tr></thead><tbody className="divide-y text-[11px] font-bold uppercase font-black font-black uppercase">
            {loading && logs.length === 0 ? <tr><td colSpan={5} className="p-20 text-center animate-pulse text-slate-300 font-black uppercase tracking-widest uppercase font-black uppercase">Updating feed...</td></tr> : logs.length > 0 ? logs.map((l: any) => (
                <tr key={l.id} className="hover:bg-slate-50 transition border-b uppercase font-bold font-black font-black uppercase"><td className="p-5 pl-8 leading-tight font-black uppercase font-black uppercase"><div className="text-slate-800 font-black text-[12px] uppercase uppercase font-black">{l.timestamp ? new Date(Number(l.timestamp)).toLocaleDateString('en-IN') : '--'}</div><div className="text-[9px] text-slate-400 mt-1 uppercase font-bold uppercase font-black font-black uppercase">{l.timestamp ? new Date(Number(l.timestamp)).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--'}</div></td><td className="p-5 leading-tight font-black uppercase font-black uppercase"><div className="text-slate-800 font-black text-[13px] mb-1 uppercase font-black tracking-tight uppercase font-black">{l.item_name}</div><span className="bg-white border px-2 py-0.5 rounded-[4px] text-[9.5px] text-indigo-500 font-black shadow-sm inline-block uppercase font-black tracking-tighter uppercase font-black">{l.make} | {l.model} | {l.spec}</span></td><td className="p-5 text-center font-black uppercase font-black uppercase"><div className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-100 font-black inline-block text-[14px] font-black uppercase font-black font-black uppercase">-{l.qty_consumed} {l.unit || 'Nos'}</div></td><td className="p-5 font-black uppercase font-black uppercase"><div className="text-slate-600 italic lowercase font-medium bg-slate-50 p-2 rounded-lg border border-dashed border-slate-200 max-w-[200px] truncate uppercase font-black uppercase font-black font-black uppercase">{l.purpose || '-- no note --'}</div></td><td className="p-5 text-center font-black uppercase font-black uppercase font-black uppercase"><button onClick={() => deleteLog(l)} disabled={submitting} className="text-slate-300 hover:text-red-500 transition-all flex items-center justify-center mx-auto uppercase font-black font-black font-black uppercase"><i className="fa-solid fa-trash-can text-sm uppercase font-black font-black uppercase"></i></button></td></tr>)) : <tr><td colSpan={5} className="p-20 text-center text-slate-300 font-black uppercase font-black uppercase font-black uppercase">No records found</td></tr>}
        </tbody></table></div>
        <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-[10px] font-black uppercase tracking-widest font-black uppercase font-black uppercase font-black uppercase"><button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1 || loading} className="px-5 py-2 bg-white border-2 rounded-lg shadow-sm disabled:opacity-30 hover:bg-slate-50 transition-all uppercase font-black font-black uppercase font-black uppercase">Prev</button><span className="text-slate-400 font-black uppercase font-black font-black uppercase font-black uppercase">Page {currentPage} of {Math.ceil(totalCount/itemsPerPage)||1}</span><button onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalCount/itemsPerPage)))} disabled={currentPage >= Math.ceil(totalCount/itemsPerPage) || loading} className="px-5 py-2 bg-white border-2 rounded-lg shadow-sm disabled:opacity-30 hover:bg-slate-50 transition-all uppercase font-black font-black uppercase font-black uppercase">Next</button></div>
      </div>
    </div>
  );
}
