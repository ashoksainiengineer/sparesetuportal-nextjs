"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
import { Bar } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";

// Chart Components Registration
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

export default function MonthlyAnalysisView({ profile }: any) {
  const [selectedMonth, setSelectedMonth] = useState("");
  const [chartConfigs, setChartConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Set default month to current
  useEffect(() => {
    const d = new Date();
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }, []);

  const fetchGlobalConsumption = useCallback(async () => {
    if (!selectedMonth) return;
    setLoading(true); // Hover/Blur effect starts
    const [year, month] = selectedMonth.split("-");
    
    // Precise timestamps for the month audit
    const startTs = new Date(parseInt(year), parseInt(month) - 1, 1, 0, 0, 0, 0).getTime();
    const endTs = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999).getTime();

    try {
      const { data: logs, error } = await supabase
        .from("usage_logs")
        .select("*")
        .gte("timestamp", startTs)
        .lte("timestamp", endTs);

      if (error) throw error;

      const report: any = {};
      logs?.forEach((log) => {
        // AS-IT-IS: Manual entries filtering logic
        if (log.is_manual === true || log.cat === 'Manual Entry' || !log.cat) return;
        
        const cat = log.cat;
        const sub = log.sub || 'General';
        const qty = Number(log.qty_consumed || 0);
        const unit = log.unit || 'Nos';

        if (!report[cat]) report[cat] = {};
        if (!report[cat][sub]) report[cat][sub] = { total: 0, units: {} };

        report[cat][sub].total += qty;
        report[cat][sub].units[unit] = (report[cat][sub].units[unit] || 0) + qty;
      });

      // Mapping logic for Sub-category bars
      const charts = Object.keys(report).sort().map(catName => {
        const subDataMap = report[catName];
        const labels = Object.keys(subDataMap).sort();
        const values = labels.map(l => subDataMap[l].total);
        
        const barUnits = labels.map(l => {
            const sortedUnits = Object.entries(subDataMap[l].units).sort((a: any, b: any) => (b[1] as number) - (a[1] as number));
            return sortedUnits.length > 0 ? sortedUnits[0][0] : 'Nos';
        });

        const colors = ['#38bdf8', '#4f46e5', '#9333ea', '#ec4899', '#f43f5e'];
        
        return {
          category: catName, 
          total: values.reduce((a, b) => a + b, 0), 
          primaryUnit: barUnits[0],
          data: {
            labels,
            datasets: [{
              data: values, 
              backgroundColor: labels.map((_, i) => colors[i % colors.length]),
              borderRadius: 4, 
              barPercentage: 0.5, 
              categoryPercentage: 0.8,
              units: barUnits
            }]
          }
        };
      });
      setChartConfigs(charts);
    } catch (e) { 
        console.error("Analysis Error:", e); 
    } finally { 
        setLoading(false); // Hover/Blur effect ends
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchGlobalConsumption();
    const channel = supabase.channel('monthly_realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'usage_logs' }, () => {
        fetchGlobalConsumption();
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedMonth, fetchGlobalConsumption]);

  return (
    // SMOOTH EFFECT: Added transition, opacity and blur logic
    <div className={`animate-fade-in space-y-8 pb-20 font-roboto font-bold uppercase tracking-tight transition-all duration-500 ${loading ? 'opacity-40 blur-[1px]' : 'opacity-100 blur-0'}`}>
      
      {/* HEADER: Exactly as original */}
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center border-t-4 border-orange-500">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest leading-none">Monthly Analysis</h2>
          <p className="text-[10px] text-slate-400 mt-2 lowercase font-black tracking-[0.1em]">Monthly material usage across refinery zones</p>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={fetchGlobalConsumption} disabled={loading} className="bg-slate-50 text-slate-400 p-2.5 rounded-xl hover:text-indigo-600 border border-slate-100 transition-all">
                <i className={`fa-solid fa-sync ${loading ? 'animate-spin' : ''}`}></i>
            </button>
            <input type="month" className="bg-slate-50 text-slate-800 p-2.5 rounded-xl outline-none font-black text-[11px] border border-slate-200 cursor-pointer shadow-sm" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
        </div>
      </div>

      {loading && chartConfigs.length === 0 ? (
        <div className="p-40 text-center animate-pulse uppercase tracking-[0.4em] text-slate-300 font-black">Syncing Analytical Feed...</div>
      ) : chartConfigs.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 font-bold">
          {chartConfigs.map((cfg, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <i className="fa-solid fa-layer-group text-orange-500 text-sm"></i>
                    <h3 className="text-[13px] font-black text-slate-700 tracking-tight uppercase">{cfg.category}</h3>
                </div>
                <div className="bg-slate-50 px-3 py-1 rounded-md border border-slate-100 flex items-center gap-2">
                    <span className="text-[9px] text-slate-400 font-bold uppercase">Total:</span>
                    <span className="text-[13px] font-black text-slate-600">{cfg.total}</span>
                </div>
              </div>

              <div className="h-[210px] w-full px-2">
                <Bar 
                    data={cfg.data} 
                    options={{ 
                        responsive: true, 
                        maintainAspectRatio: false, 
                        layout: { padding: { top: 25, bottom: 5 } },
                        plugins: { 
                            legend: { display: false }, 
                            datalabels: { 
                                anchor: 'end', align: 'top', offset: 5, color: '#334155', font: { weight: 'bold', size: 11 },
                                formatter: (val) => val
                            },
                            tooltip: {
                                backgroundColor: '#1e293b',
                                padding: 10,
                                // FIXED: Reverted to cornerRadius for your TS version compatibility
                                cornerRadius: 8,
                                displayColors: false,
                                titleFont: { size: 12, weight: 'bold' },
                                bodyFont: { size: 11, weight: 'bold' }
                            }
                        },
                        scales: {
                            y: { 
                                beginAtZero: true, 
                                grace: '25%', 
                                grid: { color: '#f1f5f9' }, 
                                border: { display: true, color: '#e2e8f0' },
                                ticks: { font: { size: 10, weight: 'bold' }, color: '#94a3b8', padding: 8 } 
                            },
                            x: { 
                                grid: { display: false }, 
                                border: { display: true, color: '#cbd5e1', width: 2 },
                                ticks: { font: { size: 10, weight: 'bold' }, color: '#64748b', padding: 10 } 
                            }
                        }
                    }} 
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-3xl p-32 text-center text-slate-200 font-black uppercase tracking-widest uppercase">
            <i className="fa-solid fa-chart-simple text-6xl mb-6 block opacity-10"></i>
            No consumption records found for this month
        </div>
      )}
    </div>
  );
}
