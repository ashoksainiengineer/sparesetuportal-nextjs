"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

export default function MonthlyAnalysisView() {
  const [selectedMonth, setSelectedMonth] = useState("");
  const [chartConfigs, setChartConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Set current month on component mount
  useEffect(() => {
    const d = new Date();
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }, []);

  // Fetch whenever month is changed
  useEffect(() => {
    if (selectedMonth) fetchRawGlobalData(selectedMonth);
  }, [selectedMonth]);

  const fetchRawGlobalData = async (monthStr: string) => {
    setLoading(true);
    const [year, month] = monthStr.split("-");
    const startTs = new Date(parseInt(year), parseInt(month) - 1, 1).getTime();
    const endTs = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59).getTime();

    try {
      // Global Fetch: No unit filter to cover all zones
      const { data: logs, error } = await supabase
        .from("usage_logs")
        .select("*")
        .gte("timestamp", startTs)
        .lte("timestamp", endTs);

      if (error) throw error;

      // AGGREGATION LOGIC (Category > Raw Sub-Category)
      const report: any = {};
      logs?.forEach((log) => {
        const cat = log.cat || 'Others';
        const sub = log.sub || 'General'; // Using raw sub-category name
        
        // Basic filter to ignore completely empty/manual entries if desired
        if (cat === 'Manual Entry') return;

        if (!report[cat]) report[cat] = {};
        report[cat][sub] = (report[cat][sub] || 0) + Number(log.qty_consumed || 0);
      });

      // Transform report into Chart.js configurations
      const charts = Object.keys(report).sort().map(catName => {
        const subData = report[catName];
        const labels = Object.keys(subData).sort();
        const values = labels.map(l => subData[l]);

        return {
          category: catName,
          total: values.reduce((a, b) => a + b, 0),
          data: {
            labels,
            datasets: [{
              label: 'Consumption',
              data: values,
              backgroundColor: labels.map((_, i) => `hsl(${210 + (i * 25)}, 70%, 50%)`), // Professional blue-scale colors
              borderRadius: 4,
              barPercentage: 0.6
            }]
          }
        };
      });

      setChartConfigs(charts);
    } catch (e) {
      console.error("Data processing failed", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-8 pb-20 font-roboto font-bold uppercase">
      {/* Header & Date Picker */}
      <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest leading-none">Monthly Consumption Analysis</h2>
          <p className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded mt-2 inline-block uppercase tracking-widest">Global Refinery View (All Zones)</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border">
          <span className="text-[9px] font-black text-slate-400 pl-2">MONTH:</span>
          <input 
            type="month" 
            className="bg-transparent text-slate-800 outline-none font-black text-sm cursor-pointer" 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(e.target.value)} 
          />
        </div>
      </div>

      {/* Analytics Grid */}
      {loading ? (
        <div className="p-40 text-center">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-[10px] text-slate-400 font-black tracking-[0.4em]">Aggregating Logs...</p>
        </div>
      ) : chartConfigs.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {chartConfigs.map((cfg, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <div>
                    <h3 className="text-md font-black text-slate-800 tracking-tight leading-none uppercase">{cfg.category}</h3>
                    <p className="text-[8px] text-slate-400 mt-1 font-bold tracking-widest">Sub-Category Distribution</p>
                </div>
                <div className="text-right">
                    <p className="text-[14px] font-black text-indigo-600 leading-none">{cfg.total} <span className="text-[9px] text-slate-400">Total</span></p>
                </div>
              </div>
              <div className="h-[280px]">
                <Bar 
                  data={cfg.data} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      datalabels: {
                        color: '#475569',
                        font: { weight: 'bold', size: 10 },
                        anchor: 'end',
                        align: 'top',
                        offset: 2,
                        formatter: (v) => v
                      }
                    },
                    scales: {
                      y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 9 } } },
                      x: { grid: { display: false }, ticks: { font: { size: 9, weight: 'bold' }, color: '#64748b' } }
                    }
                  }} 
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed rounded-3xl p-32 text-center">
            <p className="text-slate-300 font-black tracking-widest text-xs uppercase">No usage data found for this month</p>
        </div>
      )}
    </div>
  );
}
