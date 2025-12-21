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

// Registering plugins to make them available for the charts
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

export default function MonthlyAnalysisView({ profile }: any) {
  const [selectedMonth, setSelectedMonth] = useState("");
  const [chartConfigs, setChartConfigs] = useState<any[]>([]);
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

      const report: any = {};
      logs?.forEach((log) => {
        const cat = log.cat || 'Others';
        const sub = log.sub || 'General';
        if (cat === 'Manual Entry') return;

        if (!report[cat]) report[cat] = {};
        report[cat][sub] = (report[cat][sub] || 0) + Number(log.qty_consumed || 0);
      });

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
              backgroundColor: labels.map((_, i) => `hsl(${210 + (i * 20)}, 70%, 55%)`),
              borderRadius: 5,
              barPercentage: 0.6
            }]
          }
        };
      });

      setChartConfigs(charts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-8 pb-20 font-roboto font-bold uppercase tracking-tight">
      <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest leading-none">Monthly Consumption Analysis</h2>
          <p className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded mt-2 inline-block">Global Refinery View</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border">
          <span className="text-[9px] font-black text-slate-400 pl-2">MONTH:</span>
          <input type="month" className="bg-transparent text-slate-800 outline-none font-black text-sm" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="p-40 text-center text-slate-300 font-black animate-pulse tracking-[0.4em]">GENERATING ANALYTICS...</div>
      ) : chartConfigs.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {chartConfigs.map((cfg, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-lg">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="text-md font-black text-slate-800">{cfg.category}</h3>
                <span className="text-[14px] font-black text-indigo-600">{cfg.total} <span className="text-[8px] text-slate-400">TOTAL</span></span>
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
                        formatter: (v) => v
                      }
                    },
                    scales: {
                      y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 9 } } },
                      x: { grid: { display: false }, ticks: { font: { size: 9, weight: 'bold' } } }
                    }
                  }} 
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed rounded-3xl p-32 text-center text-slate-300 font-black text-xs">NO DATA FOUND FOR THIS MONTH</div>
      )}
    </div>
  );
}
