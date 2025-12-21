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

// Register Chart.js components
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
    if (selectedMonth) fetchGlobalConsumption();
  }, [selectedMonth]);

  const fetchGlobalConsumption = async () => {
    setLoading(true);
    const [year, month] = selectedMonth.split("-");
    const startTs = new Date(parseInt(year), parseInt(month) - 1, 1).getTime();
    const endTs = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59).getTime();

    try {
      // 1. Fetch Global Logs (All Zones Combined)
      const { data: logs, error } = await supabase
        .from("usage_logs")
        .select("*")
        .gte("timestamp", startTs)
        .lte("timestamp", endTs);

      if (error) throw error;

      // 2. Data Processing: Category -> SubCat -> Items
      const report: any = {};

      logs?.forEach((log) => {
        const cat = log.cat || 'Others';
        const sub = log.sub || 'General';
        const item = log.item_name || 'Unknown Item';
        const qty = Number(log.qty_consumed || 0);

        if (cat === 'Manual Entry') return;

        if (!report[cat]) report[cat] = {};
        if (!report[cat][sub]) {
          report[cat][sub] = { total: 0, items: {} };
        }

        report[cat][sub].total += qty;
        report[cat][sub].items[item] = (report[cat][sub].items[item] || 0) + qty;
      });

      // 3. Prepare Bar Chart Data
      const charts = Object.keys(report).sort().map(catName => {
        const subDataMap = report[catName];
        const labels = Object.keys(subDataMap).sort();
        const values = labels.map(l => subDataMap[l].total);

        // Tooltip Breakdown (Top 5 items per sub-cat)
        const breakdownInfo = labels.map(l => {
            const items = subDataMap[l].items;
            return Object.entries(items)
                .sort((a: any, b: any) => b[1] - a[1])
                .slice(0, 5);
        });

        return {
          category: catName,
          total: values.reduce((a, b) => a + b, 0),
          data: {
            labels,
            datasets: [{
              label: 'Used Qty',
              data: values,
              backgroundColor: labels.map((_, i) => `hsl(${210 + (i * 20)}, 75%, 50%)`),
              borderRadius: 6,
              barPercentage: 0.6,
              itemBreakdown: breakdownInfo // Custom data for tooltips
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
      {/* Analytics Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 border-b-4 border-orange-500">
        <div>
          <h2 className="text-xl font-black uppercase tracking-widest leading-none">Global Consumption Analysis</h2>
          <p className="text-[10px] text-slate-400 mt-2 tracking-[0.2em]">Refinery-Wide Audit Logs</p>
        </div>
        <div className="flex items-center gap-4 bg-slate-800 p-3 rounded-xl border border-slate-700">
          <span className="text-[9px] font-black text-orange-400">ANALYSIS MONTH:</span>
          <input type="month" className="bg-transparent text-white outline-none font-black text-sm cursor-pointer" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
        </div>
      </div>

      {/* Grid for Bar Charts */}
      {loading ? (
        <div className="p-40 text-center animate-pulse">
            <p className="text-[10px] text-slate-400 font-black tracking-[0.4em]">Aggregating Refinery Logs...</p>
        </div>
      ) : chartConfigs.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {chartConfigs.map((cfg, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <div>
                    <h3 className="text-md font-black text-slate-800 leading-none">{cfg.category}</h3>
                    <p className="text-[8px] text-slate-400 mt-1 font-bold tracking-widest uppercase">Usage Breakdown</p>
                </div>
                <div className="text-right">
                    <p className="text-[14px] font-black text-indigo-600 leading-none">{cfg.total} <span className="text-[9px] text-slate-400">Total</span></p>
                </div>
              </div>
              <div className="h-[300px]">
                <Bar 
                  data={cfg.data} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      // Values attached to bars
                      datalabels: {
                        color: '#1e293b',
                        font: { weight: 'bold', size: 10 },
                        anchor: 'end',
                        align: 'top',
                        offset: 2,
                        formatter: (v) => v
                      },
                      // Item Breakdown on Hover
                      tooltip: {
                        backgroundColor: '#0f172a',
                        padding: 12,
                        titleFont: { size: 12, weight: 'bold' },
                        bodyFont: { size: 11 },
                        callbacks: {
                          label: (context: any) => ` Total Used: ${context.raw}`,
                          afterBody: (context: any) => {
                            const dataIndex = context[0].dataIndex;
                            const breakdown = context[0].dataset.itemBreakdown[dataIndex];
                            let lines = ['\nTOP ITEMS USED:'];
                            breakdown.forEach((item: any) => {
                                lines.push(` • ${item[0]}: ${item[1]} Nos`);
                            });
                            return lines;
                          }
                        }
                      }
                    },
                    scales: {
                      // FIXED TYPE ERRORS HERE: Changed weight strings to 'bold'
                      y: { beginAtZero: true, grid: { color: '#f8fafc' }, ticks: { font: { size: 9, weight: 'bold' } } },
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
            <p className="text-slate-300 font-black tracking-widest text-xs">No records for selected month</p>
        </div>
      )}
    </div>
  );
}
