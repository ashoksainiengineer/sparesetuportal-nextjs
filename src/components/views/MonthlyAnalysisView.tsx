"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
import { Bar } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";

// Register Chart components for production stability on Vercel
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

export default function MonthlyAnalysisView({ profile }: any) {
  const [selectedMonth, setSelectedMonth] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Default month set to current system month
  useEffect(() => {
    const d = new Date();
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }, []);

  const fetchGlobalConsumption = useCallback(async () => {
    if (!selectedMonth) return;
    setLoading(true);
    
    const [year, month] = selectedMonth.split("-");
    const startTs = new Date(parseInt(year), parseInt(month) - 1, 1, 0, 0, 0, 0).getTime();
    const endTs = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999).getTime();

    try {
      // Logic Update: Added filter to exclude manual items at DB level
      const { data, error } = await supabase
        .from("usage_logs")
        .select("*")
        .gte("timestamp", startTs)
        .lte("timestamp", endTs)
        .eq("is_manual", false); // <--- YE LINE ADD KI HAI (DB Level Filter)

      if (error) throw error;
      setLogs(data || []);
    } catch (e: any) { 
        console.error("Fetch error:", e.message); 
    } finally { 
        setLoading(false); 
    }
  }, [selectedMonth]);

  // --- HELPER: Smart Formatting Logic ---
  const formatQuantity = (val: number, unit: string) => {
    if (unit === 'Nos' || unit === 'Sets') return Math.round(val);
    return val % 1 === 0 ? val : Number(val.toFixed(2));
  };

  // --- LOGIC: Strict Category Grouping & Smart Formatting ---
  const chartConfigs = useMemo(() => {
    const report: any = {};
    
    logs.forEach((log) => {
      // Safety Filter: Client side par bhi check rakha hai
      if (log.is_manual || log.cat === 'Manual Entry' || !log.cat) return;
      
      const rawCat = log.cat.trim().toUpperCase();
      const subKey = (log.sub || 'General').trim().toUpperCase();
      const qty = Number(log.qty_consumed || 0);
      const unit = log.unit || 'Nos';

      if (!report[rawCat]) {
        report[rawCat] = {
            displayName: rawCat,
            subs: {},
            primaryUnit: unit 
        };
      }

      if (!report[rawCat].subs[subKey]) {
        report[rawCat].subs[subKey] = {
            displayName: subKey,
            total: 0,
            unit: unit 
        };
      }

      report[rawCat].subs[subKey].total += qty;
    });

    return Object.keys(report).sort().map(catKey => {
      const categoryData = report[catKey];
      const subDataMap = categoryData.subs;
      const subKeys = Object.keys(subDataMap).sort();
      
      const labels = subKeys.map(k => subDataMap[k].displayName);
      const values = subKeys.map(k => subDataMap[k].total);
      const barUnits = subKeys.map(k => subDataMap[k].unit);
      
      const colors = ['#38bdf8', '#4f46e5', '#9333ea', '#ec4899', '#f43f5e'];
      
      return {
        category: categoryData.displayName, 
        totalSum: values.reduce((a, b) => a + b, 0), 
        groupUnit: categoryData.primaryUnit,
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
  }, [logs]);

  useEffect(() => {
    fetchGlobalConsumption();
    const channel = supabase.channel('monthly_sync_final').on('postgres_changes', { event: '*', schema: 'public', table: 'usage_logs' }, () => {
        fetchGlobalConsumption();
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedMonth, fetchGlobalConsumption]);

  return (
    <div className="animate-fade-in space-y-8 pb-20 font-roboto font-bold uppercase tracking-tight">
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center border-t-4 border-orange-500 font-black uppercase">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest leading-none">Monthly Analysis</h2>
          <p className="text-[10px] text-slate-400 mt-2 lowercase font-black tracking-[0.1em]">Catalog Consumption (Standard Spares Only)</p>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={fetchGlobalConsumption} disabled={loading} className="bg-slate-50 text-slate-400 p-2.5 rounded-xl hover:text-indigo-600 transition-all border border-slate-100">
                <i className={`fa-solid fa-sync ${loading ? 'animate-spin' : ''}`}></i>
            </button>
            <input type="month" className="bg-slate-50 text-slate-800 p-2.5 rounded-xl outline-none font-black text-[11px] cursor-pointer border border-slate-200 uppercase" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
        </div>
      </div>

      {loading && chartConfigs.length === 0 ? (
        <div className="p-40 text-center animate-pulse uppercase tracking-[0.4em] text-slate-300 font-black">Syncing analytical data...</div>
      ) : chartConfigs.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 uppercase font-black">
          {chartConfigs.map((cfg, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md uppercase">
              <div className="flex justify-between items-center mb-6 uppercase">
                <div className="flex items-center gap-3 uppercase font-black">
                    <i className="fa-solid fa-layer-group text-orange-500 text-sm"></i>
                    <h3 className="text-[13px] font-black text-slate-700 tracking-tight uppercase">{cfg.category}</h3>
                </div>
                <div className="bg-slate-50 px-3 py-1 rounded-md border border-slate-100 flex items-center gap-2 font-black">
                    <span className="text-[9px] text-slate-400 font-bold uppercase font-black">Total:</span>
                    <span className="text-[13px] font-black text-slate-600 uppercase font-black">
                        {formatQuantity(cfg.totalSum, cfg.groupUnit)} {cfg.groupUnit}
                    </span>
                </div>
              </div>

              <div className="h-[230px] w-full px-2 font-black uppercase">
                <Bar 
                    data={cfg.data} 
                    options={{ 
                        responsive: true, 
                        maintainAspectRatio: false, 
                        layout: { padding: { top: 35, bottom: 5 } },
                        plugins: { 
                            legend: { display: false }, 
                            datalabels: { 
                                anchor: 'end',
                                align: 'top',
                                offset: 5,
                                color: '#1e293b',
                                font: { weight: 'bold', size: 10 },
                                formatter: (val, ctx: any) => {
                                    const units = ctx.dataset.units || [];
                                    const unit = units[ctx.dataIndex] || '';
                                    return `${formatQuantity(val, unit)} ${unit}`;
                                }
                            },
                            tooltip: {
                                backgroundColor: '#0f172a',
                                padding: 12,
                                cornerRadius: 8,
                                displayColors: false,
                                titleFont: { size: 11, weight: 'bold' },
                                bodyFont: { size: 12, weight: 'bold' },
                                callbacks: {
                                    label: (ctx: any) => {
                                        const units = ctx.dataset.units || [];
                                        const unit = units[ctx.dataIndex] || '';
                                        return ` Consumption: ${formatQuantity(ctx.raw as number, unit)} ${unit}`;
                                    }
                                }
                            }
                        },
                        scales: {
                            y: { 
                                beginAtZero: true, 
                                grace: '25%', 
                                grid: { color: '#f1f5f9' }, 
                                ticks: { font: { size: 10, weight: 'bold' }, color: '#94a3b8', padding: 8 } 
                            },
                            x: { 
                                grid: { display: false }, 
                                border: { display: true, color: '#e2e8f0', width: 2 },
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
        <div className="bg-white border border-slate-100 rounded-3xl p-32 text-center text-slate-200 font-black uppercase tracking-widest">
            <i className="fa-solid fa-chart-simple text-6xl mb-6 block opacity-10"></i>
            No consumption records found
        </div>
      )}
    </div>
  );
}
