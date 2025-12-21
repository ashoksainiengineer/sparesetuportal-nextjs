"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function MonthlyAnalysisView({ profile }: any) {
  const [analysis, setAnalysis] = useState<any[]>([]);
  
  useEffect(() => { 
    const f = async () => { 
      try { 
        const { data } = await supabase.from("usage_logs").select("*").eq("consumer_uid", profile.id); 
        if (data) { 
          const stats: any = {}; 
          data.forEach((l: any) => { 
            const month = new Date(Number(l.timestamp)).toLocaleString('default', { month: 'long', year: 'numeric' }); 
            if (!stats[month]) stats[month] = { month, total: 0, count: 0 }; 
            stats[month].total += Number(l.qty_consumed); 
            stats[month].count += 1; 
          }); 
          setAnalysis(Object.values(stats)); 
        } 
      } catch(e){} 
    }; 
    if (profile) f(); 
  }, [profile]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-roboto uppercase tracking-tight font-bold">
      <div className="col-span-3 pb-4 text-xs font-black text-slate-400 tracking-widest text-center border-b uppercase">Analytical Summary</div>
      {analysis.map((a, idx) => (
        <div key={idx} className="bg-white p-6 rounded-2xl border shadow-sm text-center transition hover:shadow-md uppercase font-bold">
          <div className="text-xs font-black text-slate-400 uppercase mb-4 tracking-[0.2em] font-bold">{a.month}</div>
          <div className="w-16 h-16 bg-blue-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner font-bold"><i className="fa-solid fa-chart-line"></i></div>
          <div className="text-3xl font-black text-slate-800 font-bold">{a.total} <small className="text-[10px] text-slate-400 font-bold uppercase tracking-widest uppercase">Nos</small></div>
          <div className="text-[10px] font-bold text-emerald-500 mt-2 uppercase tracking-tighter uppercase">{a.count} Logged Records</div>
        </div>
      ))}
    </div>
  );
}
