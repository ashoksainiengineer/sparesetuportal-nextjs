"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function UsageHistoryView({ profile }: any) {
  const [logs, setLogs] = useState<any[]>([]);
  
  // Pagination State (Same as My Local Store)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => { 
    if (profile?.id) fetchLogs(); 
  }, [profile]);

  const fetchLogs = async () => {
    try {
      // Fetching personal usage logs as per user's original code
      const { data, error } = await supabase
        .from("usage_logs")
        .select("*")
        .eq("consumer_uid", profile.id)
        .order("timestamp", { ascending: false });
      
      if (error) throw error;
      if (data) setLogs(data);
    } catch (e) { console.error("Fetch failed"); }
  };

  const deleteLog = async (id: number) => {
    if (confirm("Delete this log entry?")) {
      try {
        await supabase.from("usage_logs").delete().eq("id", id);
        fetchLogs();
      } catch (e) { alert("Error deleting log"); }
    }
  };

  // Pagination Logic
  const totalPages = Math.ceil(logs.length / itemsPerPage) || 1;
  const currentLogs = logs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const exportCSV = () => {
    const headers = "Date,Item,Qty,Unit,Purpose/Note\n";
    const rows = logs.map(l => {
      const date = l.timestamp ? new Date(Number(l.timestamp)).toLocaleDateString('en-GB') : '';
      return `"${date}","${l.item_name}","${l.qty_consumed}","${l.unit || 'Nos'}","${l.purpose || ''}"\n`;
    });
    const blob = new Blob([headers + rows.join("")], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `MyConsumption_Report.csv`;
    a.click();
  };

  return (
    <div className="animate-fade-in space-y-6 pb-20 font-roboto font-bold uppercase">
      {/* Simple Header with Export Button */}
      <div className="bg-white p-6 rounded-xl border shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest leading-none">My Usage History</h2>
          <p className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded mt-2 inline-block uppercase">Personal Logs</p>
        </div>
        <button onClick={exportCSV} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black shadow-md flex items-center gap-2 hover:bg-emerald-700 transition-all uppercase tracking-widest">
          <i className="fa-solid fa-file-csv"></i> Export Sheet
        </button>
      </div>

      {/* Table Section (Matching Image Layout) */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b bg-slate-50/50 flex items-center gap-2">
            <i className="fa-solid fa-history text-slate-400"></i>
            <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">Recent Consumption</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left tracking-tight">
            <thead className="bg-slate-50 text-slate-400 text-[10px] font-black border-b tracking-widest uppercase">
              <tr>
                <th className="p-5 pl-8">DATE</th>
                <th className="p-5">ITEM</th>
                <th className="p-5 text-center">QTY USED</th>
                <th className="p-5">NOTE/JOB</th>
                <th className="p-5 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y text-[11px] font-bold">
              {currentLogs.length > 0 ? currentLogs.map((l: any) => (
                <tr key={l.id} className="hover:bg-slate-50 transition border-b uppercase">
                  <td className="p-5 pl-8 leading-tight">
                    <div className="text-slate-800 font-bold">{l.timestamp ? new Date(Number(l.timestamp)).toLocaleDateString('en-GB') : '--'}</div>
                    <div className="text-[9px] text-slate-400 font-medium mt-0.5">{l.timestamp ? new Date(Number(l.timestamp)).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '--'}</div>
                  </td>
                  <td className="p-5 leading-tight">
                    <div className="text-slate-800 font-bold text-[13px] tracking-tight">{l.item_name}</div>
                    <div className="text-[9px] text-slate-400 mt-1 uppercase font-medium">{l.category || 'General'} (You)</div>
                  </td>
                  <td className="p-5 font-black text-center text-red-600 text-[14px] whitespace-nowrap">
                     -{l.qty_consumed} {l.unit || 'Nos'}
                  </td>
                  <td className="p-5">
                    <div className="text-slate-600 italic lowercase font-medium tracking-tight">
                      {l.purpose ? `"${l.purpose}"` : '--'}
                    </div>
                  </td>
                  <td className="p-5 text-center">
                    <button onClick={() => deleteLog(l.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                      <i className="fa-solid fa-trash-can text-sm"></i>
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="p-20 text-center text-slate-300 font-black tracking-[0.2em]">NO LOGS FOUND</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar (Same as Local Store) */}
        <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
            disabled={currentPage === 1} 
            className="px-5 py-2 bg-white border-2 rounded-lg shadow-sm disabled:opacity-30 hover:bg-red-50 transition-all"
          >
            Prev
          </button>
          <span className="text-slate-400">Page {currentPage} of {totalPages}</span>
          <button 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
            disabled={currentPage === totalPages} 
            className="px-5 py-2 bg-white border-2 rounded-lg shadow-sm disabled:opacity-30 hover:bg-red-50 transition-all"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
