"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function UsageHistoryView({ profile }: any) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const fetchLogs = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("usage_logs")
        .select("*")
        .eq("consumer_uid", profile.id) 
        .order("timestamp", { ascending: false });
      
      if (error) throw error;
      setLogs(data || []);
    } catch (e: any) { 
      console.error("Fetch error:", e.message);
    } finally { 
      setLoading(false); 
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const deleteLog = async (id: number) => {
    if (!confirm("Are you sure you want to remove this record?")) return;
    try {
      const { error } = await supabase.from("usage_logs").delete().eq("id", id);
      if (error) throw error;
      setLogs(prev => prev.filter(log => log.id !== id));
      alert("Record Deleted Successfully");
    } catch (e: any) { 
      alert("Delete action failed."); 
    }
  };

  const currentLogs = logs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(logs.length / itemsPerPage) || 1;

  const exportCSV = () => {
    const headers = "Date,Item,Make,Model,Spec,Qty,Unit,Purpose\n";
    const rows = logs.map(l => {
      const date = l.timestamp ? new Date(Number(l.timestamp)).toLocaleDateString('en-GB') : '--';
      return `"${date}","${l.item_name}","${l.make || '-'}","${l.model || '-'}","${l.spec || '-'}","${l.qty_consumed}","${l.unit || 'Nos'}","${l.purpose || ''}"\n`;
    });
    const blob = new Blob([headers + rows.join("")], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Consumption_Report.csv`; a.click();
  };

  return (
    <div className="animate-fade-in space-y-6 pb-20 font-roboto font-bold uppercase tracking-tight">
      <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center border-l-4 border-red-600 gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest leading-none">My Consumption History</h2>
          <div className="flex items-center gap-2 mt-2">
             <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase">Personal Audit</span>
             <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase tracking-tighter">Login: {profile?.name}</span>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={fetchLogs} className="flex-1 md:flex-none bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black shadow-md flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all uppercase">
            <i className={`fa-solid fa-sync ${loading ? 'animate-spin' : ''}`}></i> {loading ? 'Syncing...' : 'Refresh Logs'}
          </button>
          <button onClick={exportCSV} className="flex-1 md:flex-none bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black shadow-md flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all uppercase">
            <i className="fa-solid fa-file-csv"></i> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left tracking-tight">
            <thead className="bg-slate-50 text-slate-400 text-[10px] font-black border-b uppercase tracking-widest">
              <tr>
                <th className="p-5 pl-8">Time Audit</th>
                <th className="p-5">Material Details</th>
                <th className="p-5 text-center">Qty Consumed</th>
                <th className="p-5">Job Purpose</th>
                <th className="p-5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y text-[11px] font-bold">
              {loading ? (
                <tr><td colSpan={5} className="p-20 text-center animate-pulse text-slate-300 font-black uppercase tracking-[0.2em]">Updating Feed...</td></tr>
              ) : currentLogs.length > 0 ? currentLogs.map((l: any) => (
                <tr key={l.id} className="hover:bg-slate-50 transition border-b uppercase">
                  <td className="p-5 pl-8 leading-tight">
                    <div className="text-slate-800 font-black text-[12px]">{l.timestamp ? new Date(Number(l.timestamp)).toLocaleDateString('en-IN') : '--'}</div>
                    <div className="text-[9px] text-slate-400 mt-1 font-bold">{l.timestamp ? new Date(Number(l.timestamp)).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--'}</div>
                  </td>
                  <td className="p-5 leading-tight">
                    <div className="text-slate-800 font-black text-[14px] mb-1">
                      {l.item_name}
                      {l.is_manual && <span className="ml-2 bg-orange-100 text-orange-600 text-[7px] px-1 py-0.5 rounded border border-orange-200">M</span>}
                    </div>
                    <span className="bg-white border px-2 py-0.5 rounded-[4px] text-[9.5px] text-indigo-500 font-black shadow-sm inline-block">
                       {l.make || '-'} | {l.model || '-'} | {l.spec || '-'}
                    </span>
                  </td>
                  <td className="p-5 text-center">
                    <div className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-100 font-black inline-block text-[14px]">
                        -{l.qty_consumed} <span className="text-[10px] opacity-70">{l.unit || 'Nos'}</span>
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="text-slate-600 italic lowercase font-medium bg-slate-50 p-2 rounded-lg border border-dashed border-slate-200 max-w-[200px] truncate">
                      {l.purpose || '-- no note provided --'}
                    </div>
                  </td>
                  <td className="p-5 text-center">
                    <button onClick={() => deleteLog(l.id)} className="w-8 h-8 rounded-full hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all flex items-center justify-center mx-auto">
                      <i className="fa-solid fa-trash-can text-sm"></i>
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="p-20 text-center text-slate-300 font-black uppercase">No Records Found in Audit Log</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
