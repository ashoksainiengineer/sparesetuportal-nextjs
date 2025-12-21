"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Point: Accepting 'profile' prop to fix TypeScript Build Error
export default function MonthlyAnalysisView({ profile }: any) {
  const [selectedMonth, setSelectedMonth] = useState("");
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const d = new Date();
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }, []);

  useEffect(() => {
    if (selectedMonth) fetchGlobalData();
  }, [selectedMonth]);

  const fetchGlobalData = async () => {
    setLoading(true);
    const [year, month] = selectedMonth.split("-");
    const startTs = new Date(parseInt(year), parseInt(month) - 1, 1).getTime();
    const endTs = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59).getTime();

    try {
      const { data: logs, error } = await supabase
        .from("usage_logs")
        .select("*")
        .gte("timestamp", startTs)
        .lte("timestamp", endTs);

      if (error) throw error;

      // --- LOGIC: AGGREGATION (Category > Raw Sub-category) ---
      const report: any = {};
      logs?.forEach((log) => {
        const cat = log.cat || 'Others';
        const sub = log.sub || 'General';
        if (cat === 'Manual Entry') return;

        if (!report[cat]) report[cat] = {};
        report[cat][sub] = (report[cat][sub] || 0) + Number(log.qty_consumed || 0);
      });

      const finalArray = Object.keys(report).sort().map(cat => {
        const subItems = Object.keys(report[cat]).map(sub => ({
          name: sub,
          qty: report[cat][sub]
        })).sort((a, b) => b.qty - a.qty);

        const maxQty = Math.max(...subItems.map(i => i.qty));
        const total = subItems.reduce((acc, curr) => acc + curr.qty, 0);

        return { category: cat, total, maxQty, items: subItems };
      });

      setReportData(finalArray);
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-8 pb-20 font-roboto font-bold uppercase tracking-tight">
      {/* Header Panel */}
      <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest leading-none">Monthly Consumption Analytics</h2>
          <p className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded mt-2 inline-block">Refinery Global View</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
          <span className="text-[9px] font-black text-slate-400 pl-2">MONTH:</span>
          <input 
            type="month" 
            className="bg-transparent text-slate-800 outline-none font-black text-sm cursor-pointer" 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(e.target.value)} 
          />
        </div>
      </div>

      {/* Analysis Grid */}
      {loading ? (
        <div className="p-40 text-center animate-pulse">
            <p className="text-[10px] text-slate-300 font-black tracking-[0.5em]">Aggregating Global Logs...</p>
        </div>
      ) : reportData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {reportData.map((data, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-lg">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <div>
                  <h3 className="text-md font-black text-slate-800 leading-none">{data.category}</h3>
                  <p className="text-[8px] text-slate-400 mt-1 font-bold tracking-widest">Sub-Category Breakdown</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-indigo-600 leading-none">{data.total}</p>
                  <p className="text-[9px] text-slate-400 font-black">TOTAL QTY</p>
                </div>
              </div>

              {/* CUSTOM BARS (Zero Dependencies) */}
              <div className="space-y-5">
                {data.items.map((item: any, i: number) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-black tracking-tight">
                      <span className="text-slate-600 truncate max-w-[70%]">{item.name}</span>
                      <span className="text-slate-800 font-mono">{item.qty} Nos</span>
                    </div>
                    <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100 shadow-inner">
                      <div 
                        className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                        style={{ 
                          width: `${(item.qty / data.maxQty) * 100}%`,
                          backgroundColor: `hsl(${210 + (i * 20)}, 70%, 50%)` 
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-slate-100 rounded-3xl p-32 text-center">
            <p className="text-slate-300 font-black tracking-widest text-xs">No global logs found for this period</p>
        </div>
      )}
    </div>
  );
}
