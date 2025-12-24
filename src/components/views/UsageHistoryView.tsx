"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

export default function UsageHistoryView({ profile }: any) {
  const [logs, setLogs] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0); 
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const isProcessing = useRef(false);
  const userUnit = profile?.unit || "";

  const formatFullTS = (ts: any) => {
    if (!ts) return "--";
    return new Date(Number(ts)).toLocaleString('en-IN', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
  };

  const fetchLogs = useCallback(async (isMounted: boolean = true) => {
    if (!userUnit) return;
    setLoading(true);
    try {
      const from = (currentPage - 1) * itemsPerPage;
      const { data, count, error } = await supabase
        .from("usage_logs")
        .select("*", { count: "exact" })
        .eq("consumer_unit", userUnit) 
        .order("timestamp", { ascending: false })
        .range(from, from + itemsPerPage - 1);

      if (error) throw error;
      if (isMounted) {
        setLogs(data || []);
        setTotalCount(count || 0);
      }
    } catch (e: any) { 
      console.error("History Error:", e.message); 
    } finally { 
      if (isMounted) setLoading(false); 
    }
  }, [userUnit, currentPage]); 

  useEffect(() => { 
    let active = true;
    if (userUnit) {
      fetchLogs(active); 
      const channel = supabase.channel(`usage_sync_${userUnit}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'usage_logs' }, () => { fetchLogs(active); })
        .subscribe();
      
      return () => { 
        active = false;
        supabase.removeChannel(channel); 
      };
    }
  }, [userUnit, fetchLogs]);

  const handleDeleteLog = async (log: any) => {
    if (isProcessing.current || submitting) return;
    if (!confirm("CONFIRM RESTORE: Yeh action stock ko wapas inventory mein add kar dega aur log delete kar dega. Continue?")) return;

    setSubmitting(true);
    isProcessing.current = true;

    try {
      const { data: invItem, error: fetchErr } = await supabase
        .from("inventory")
        .select("qty")
        .eq("id", log.item_id)
        .single();

      if (fetchErr) throw new Error("Inventory item not found or already changed.");

      const restoreQty = Number(log.qty_consumed);
      const newInvQty = Number((invItem.qty + restoreQty).toFixed(3));

      const { error: invUpdateErr } = await supabase
        .from("inventory")
        .update({ qty: newInvQty })
        .eq("id", log.item_id);
      
      if (invUpdateErr) throw invUpdateErr;

      const logDate = new Date(Number(log.timestamp));
      const monthYear = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}`;
      
      const { data: analysis } = await supabase.from("monthly_analysis")
        .select("id, qty_used")
        .eq("unit", userUnit)
        .eq("month_year", monthYear)
        .eq("cat", log.cat)
        .eq("sub", log.sub)
        .maybeSingle();

      if (analysis) {
        const newAnalysisQty = Math.max(0, Number((analysis.qty_used - restoreQty).toFixed(3)));
        await supabase.from("monthly_analysis").update({ qty_used: newAnalysisQty }).eq("id", analysis.id);
      }

      const { error: delErr } = await supabase.from("usage_logs").delete().eq("id", log.id);
      if (delErr) throw delErr;

      alert("Restored & Log Deleted Successfully!");
      await fetchLogs(true);
    } catch (e: any) {
      alert("Critical Error: " + e.message);
    } finally {
      setSubmitting(false);
      isProcessing.current = false;
    }
  };

  const exportToSheet = async () => {
    const { data } = await supabase.from("usage_logs").select("*").eq("consumer_unit", userUnit).order("timestamp", { ascending: false });
    if (!data || data.length === 0) return alert("No data available!");
    
    const headers = "Date,Item,Make,Model,Spec,Qty,Unit,Purpose,Consumed By,Source\n";
    const rows = data.map((l: any) => {
      const date = l.timestamp ? new Date(Number(l.timestamp)).toLocaleDateString() : '';
      return `"${date}","${l.item_name}","${l.make || '-'}","${l.model || '-'}","${l.spec || '-'}","${l.qty_consumed}","${l.unit}","${l.purpose || '-'}","${l.consumer_name}","${l.holder_name}"`;
    }).join("\n");

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Usage_Report_${userUnit}.csv`;
    a.click();
  };

  return (
    <div className="animate-fade-in space-y-6 pb-20 font-roboto font-bold uppercase tracking-tight font-black">
      <div className="bg-white p-6 rounded-xl border-l-4 border-red-600 flex justify-between items-center font-black uppercase shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest leading-none">Consumption History</h2>
          <p className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded mt-2 inline-block uppercase">ZONE: {userUnit}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToSheet} className="bg-emerald-600 text-white px-5 py-3 rounded-xl text-[11px] font-black shadow-md flex items-center gap-2 hover:bg-emerald-700 transition-all font-black uppercase tracking-widest">
            <i className="fa-solid fa-file-excel"></i> Export to sheet
          </button>
          <button onClick={() => fetchLogs(true)} className="bg-indigo-600 text-white px-5 py-3 rounded-xl text-[11px] font-black shadow-md flex items-center gap-2 hover:bg-indigo-700 transition-all font-black uppercase tracking-widest">
            <i className="fa-solid fa-rotate"></i>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden font-black uppercase">
        <div className="overflow-x-auto font-black">
          <table className="w-full text-left tracking-tight font-black uppercase font-black"><thead className="bg-slate-50 text-slate-500 text-[10px] font-black border-b tracking-widest uppercase font-black font-black"><tr><th className="p-5 pl-8 uppercase font-black">Time Audit</th><th className="p-5 uppercase font-black">Material Details</th><th className="p-5 text-center uppercase font-black">Qty Used</th><th className="p-5 uppercase font-black">Used By / Source</th><th className="p-5 text-center uppercase font-black">Action</th></tr></thead><tbody className="divide-y text-[11px] font-black font-black">
              {loading && logs.length === 0 ? (
                <tr><td colSpan={5} className="p-20 text-center animate-pulse font-black uppercase">Syncing Audit Trail...</td></tr>
              ) : logs.length > 0 ? logs.map((l: any) => (
                <tr key={l.id} className="hover:bg-slate-50 transition border-b uppercase font-black font-black">
                  <td className="p-5 pl-8 uppercase font-black leading-tight font-black">
                    <div className="text-slate-800 font-black">{formatFullTS(l.timestamp)}</div>
                  </td>
                  <td className="p-5 font-black uppercase leading-tight font-black">
                    <div className="text-slate-700 font-bold text-[13px]">{l.item_name}</div>
                    <div className="text-[9px] text-indigo-500 font-black mt-1">
                      {l.make || '-'} | {l.model || '-'} | {l.spec || '-'}
                    </div>
                  </td>
                  <td className="p-5 text-center font-black">
                    <div className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-100 font-black inline-block text-[13px]">
                      -{l.qty_consumed} {l.unit}
                    </div>
                  </td>
                  <td className="p-5 leading-tight uppercase font-black">
                    <div className="text-slate-800 font-black mb-1">By: {l.consumer_name}</div>
                    <div className="text-[9px] text-slate-400">Source: {l.holder_name}</div>
                  </td>
                  <td className="p-5 text-center font-black">
                    <button 
                      disabled={submitting}
                      onClick={() => handleDeleteLog(l)}
                      className="text-slate-200 hover:text-red-600 transition-colors p-2 disabled:opacity-20 font-black"
                    >
                      <i className="fa-solid fa-trash-can text-sm"></i>
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="p-20 text-center text-slate-300 font-black uppercase font-black">No records available</td></tr>
              )}
            </tbody></table>
        </div>

        <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-[10px] font-black uppercase tracking-widest font-black">
          <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-5 py-2 bg-white border-2 rounded-lg shadow-sm font-black uppercase font-black">Prev</button>
          <div className="font-black text-slate-500 font-black uppercase">Page {currentPage} of {Math.ceil(totalCount / itemsPerPage) || 1}</div>
          <button onClick={() => setCurrentPage(p => Math.min(p + 1, Math.ceil(totalCount / itemsPerPage)))} disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)} className="px-5 py-2 bg-white border-2 rounded-lg shadow-sm font-black uppercase font-black">Next</button>
        </div>
      </div>
    </div>
  );
}
