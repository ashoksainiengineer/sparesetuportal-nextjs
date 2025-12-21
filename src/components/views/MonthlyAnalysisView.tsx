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
        
        const make = log.make && log.make !== '-' ? log.make : '';
        const model = log.model && log.model !== '-' ? log.model : '';
        const spec = log.spec && log.spec !== '-' ? log.spec : '';
        const fullDesc = `${make} ${model} ${spec}`.trim() || log.item_name;
        
        const qty = Number(log.qty_consumed || 0);
        const unit = log.unit || 'Nos';

        if (cat === 'Manual Entry') return;

        if (!report[cat]) report[cat] = {};
        if (!report[cat][sub]) {
          report[cat][sub] = { total: 0, items: {} };
        }

        report[cat][sub].total += qty;
        
        const itemKey = `${fullDesc}||${unit}`;
        if (!report[cat][sub].items[itemKey]) {
            report[cat][sub].items[itemKey] = 0;
        }
        report[cat][sub].items[itemKey] += qty;
      });

      const charts = Object.keys(report).sort().map(catName => {
        const subDataMap = report[catName];
        const labels = Object.keys(subDataMap).sort();
        const values = labels.map(l => subDataMap[l].total);

        const breakdownInfo = labels.map(l => {
            const itemsObj = subDataMap[l].items;
            return Object.entries(itemsObj)
                .sort((a: any, b: any) => b[1] - a[1])
                .slice(0, 8);
        });

        return {
          category: catName,
          total: values.reduce((a, b) => a + b, 0),
          data: {
            labels,
            datasets: [{
              label: 'Total Used',
              data: values,
              backgroundColor: labels.map((_, i) => `hsl(${210 + (i * 20)}, 75%, 50%)`),
              borderRadius: 6,
              barPercentage: 0.6,
              itemBreakdown: breakdownInfo 
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
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 border-b-4 border-orange-500">
        <div>
          <h2 className="text-xl font-black uppercase tracking-widest leading-none">Refinery Resource Analysis</h2>
          <p className="text-[10px] text-slate-400 mt-2 tracking-[0.2em]">Global Consumption & Itemized Breakdown</p>
        </div>
        <div className="flex items-center gap-4 bg-slate-800 p-3 rounded-xl border border-slate-700">
          <span className="text-[9px] font-black text-orange-400 uppercase">Analysis Month</span>
          <input type="month" className="bg-transparent text-white outline-none font-black text-sm cursor-pointer" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="p-40 text-center animate-pulse">
            <p className="text-[10px] text-slate-400 font-black tracking-[0.4em]">Aggregating Data...</p>
        </div>
      ) : chartConfigs.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {chartConfigs.map((cfg, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <div>
                    <h3 className="text-md font-black text-slate-800 leading-none">{cfg.category}</h3>
                    <p className="text-[8px] text-slate-400 mt-1 font-bold tracking-widest uppercase">Usage Summary</p>
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
                    layout: { padding: { top: 35 } },
                    plugins: {
                      legend: { display: false },
                      datalabels: {
                        color: '#1e293b',
                        font: { weight: 'bold', size: 10 },
                        anchor: 'end',
                        align: 'top',
                        offset: 4,
                        formatter: (v) => v
                      },
                      tooltip: {
                        backgroundColor: '#0f172a',
                        titleColor: '#fb923c',
                        padding: 15,
                        titleFont: { size: 13, weight: 'bold' },
                        // FIXED: Changed '500' string to 'normal' to satisfy TypeScript
                        bodyFont: { size: 11, weight: 'normal' },
                        displayColors: false,
                        callbacks: {
                          title: (context: any) => `SUB-CAT: ${context[0].label}`,
                          label: (context: any) => `Total Consumed: ${context.raw} units`,
                          afterBody: (context: any) => {
                            const dataIndex = context[0].dataIndex;
                            const dataset = context[0].dataset;
                            const breakdown = dataset.itemBreakdown[dataIndex];
                            let lines = ['\nTOP ITEMS (MAKE MODEL SPEC):'];
                            breakdown.forEach((entry: any) => {
                                const [details, unit] = entry[0].split('||');
                                const qty = entry[1];
                                lines.push(`• ${details} : ${qty} ${unit}`);
                            });
                            return lines;
                          }
                        }
                      }
                    },
                    scales: {
                      y: { 
                        beginAtZero: true, 
                        grace: '20%', 
                        grid: { color: '#f8fafc' }, 
                        ticks: { font: { size: 9, weight: 'bold' } } 
                      },
                      x: { 
                        grid: { display: false }, 
                        ticks: { font: { size: 9, weight: 'bold' }, color: '#64748b' } 
                      }
                    }
                  }} 
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed rounded-3xl p-32 text-center text-slate-300 font-black text-xs">DATA UNAVAILABLE</div>
      )}
    </div>
  );
}
