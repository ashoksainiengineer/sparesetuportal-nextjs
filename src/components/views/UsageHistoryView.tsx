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
      await supabase.from("usage_logs").delete().eq("id", log.id);
      alert("Deleted and Stock Restored!"); fetchLogs();
    } catch (e: any) {} finally { setSubmitting(false); }
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
      <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center border-l-4 border-red-600 gap-4">
        <div><h2 className="text-xl font-black text-slate-800 uppercase tracking-widest leading-none">My Consumption History</h2><div className="flex items-center gap-2 mt-2"><span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase">Personal Audit</span><span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase">User: {profile?.name}</span></div></div>
        <div className="flex gap-2 w-full md:w-auto"><button onClick={fetchLogs} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black shadow-md flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all uppercase"><i className={`fa-solid fa-sync ${loading ? 'animate-spin' : ''}`}></i> Refresh</button><button onClick={exportCSV} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black shadow-md flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all uppercase"><i className="fa-solid fa-file-csv"></i> Export</button></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left tracking-tight"><thead className="bg-slate-50 text-slate-400 text-[10px] font-black border-b uppercase tracking-widest uppercase"><tr><th className="p-5 pl-8">Time Audit</th><th className="p-5">Material Details</th><th className="p-5 text-center">Qty</th><th className="p-5">Job Purpose</th><th className="p-5 text-center">Action</th></tr></thead><tbody className="divide-y text-[11px] font-bold">
            {loading ? <tr><td colSpan={5} className="p-20 text-center animate-pulse text-slate-300 font-black uppercase">Updating...</td></tr> : logs.length > 0 ? logs.map((l: any) => (
                <tr key={l.id} className="hover:bg-slate-50 transition border-b uppercase font-bold"><td className="p-5 pl-8 leading-tight"><div className="text-slate-800 font-black text-[12px]">{l.timestamp ? new Date(Number(l.timestamp)).toLocaleDateString('en-IN') : '--'}</div><div className="text-[9px] text-slate-400 mt-1 uppercase font-bold">{l.timestamp ? new Date(Number(l.timestamp)).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--'}</div></td><td className="p-5 leading-tight"><div className="text-slate-800 font-black text-[13px] mb-1">{l.item_name}</div><span className="bg-white border px-2 py-0.5 rounded-[4px] text-[9.5px] text-indigo-500 font-black shadow-sm inline-block uppercase tracking-tighter">{l.make} | {l.model} | {l.spec}</span></td><td className="p-5 text-center"><div className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-100 font-black inline-block text-[14px]">-{l.qty_consumed} Nos</div></td><td className="p-5"><div className="text-slate-600 italic lowercase font-medium bg-slate-50 p-2 rounded-lg border border-dashed border-slate-200 max-w-[200px] truncate uppercase">{l.purpose || '-- no note --'}</div></td><td className="p-5 text-center"><button onClick={() => deleteLog(l)} disabled={submitting} className="text-slate-300 hover:text-red-500 transition-all flex items-center justify-center mx-auto"><i className="fa-solid fa-trash-can text-sm"></i></button></td></tr>)) : <tr><td colSpan={5} className="p-20 text-center text-slate-300 font-black uppercase">No Records</td></tr>}
        </tbody></table></div>
        <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-[10px] font-black uppercase tracking-widest"><button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1 || loading} className="px-5 py-2 bg-white border-2 rounded-lg shadow-sm disabled:opacity-30 hover:bg-slate-50 transition-all">Prev</button><span className="text-slate-400 font-black">Page {currentPage} of {Math.ceil(totalCount/itemsPerPage)||1}</span><button onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalCount/itemsPerPage)))} disabled={currentPage >= Math.ceil(totalCount/itemsPerPage) || loading} className="px-5 py-2 bg-white border-2 rounded-lg shadow-sm disabled:opacity-30 hover:bg-slate-50 transition-all">Next</button></div>
      </div>
    </div>
  );
}
