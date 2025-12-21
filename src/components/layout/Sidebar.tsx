"use client";
import { supabase } from "@/lib/supabase";

export default function Sidebar({ activeTab, setActiveTab, profile, pendingCount }: any) {
  const tabs = [
    { id: 'search', label: 'Global Search', icon: 'fa-globe', badge: 0 },
    { id: 'mystore', label: 'My Local Store', icon: 'fa-warehouse', badge: 0 },
    { id: 'analysis', label: 'Monthly Analysis', icon: 'fa-chart-pie', badge: 0 },
    { id: 'usage', label: 'My Usage History', icon: 'fa-clock-rotate-left', badge: 0 },
    { id: 'returns', label: 'Returns & Udhaari', icon: 'fa-hand-holding-hand', badge: pendingCount }
  ];

  return (
    <aside className="w-64 bg-white hidden md:flex flex-col flex-shrink-0 z-20 shadow-xl border-r border-slate-200 font-bold uppercase">
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-orange-600"><i className="fa-solid fa-layer-group"></i></div>
        <span className="text-lg font-bold text-slate-800 uppercase tracking-wide">Menu</span>
      </div>
      <nav className="flex-1 px-3 space-y-1 mt-4 overflow-y-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-bold relative ${activeTab === tab.id ? 'active-nav' : 'text-slate-600 hover:bg-slate-50'}`}>
            <i className={`fa-solid ${tab.icon} w-5`}></i> 
            <span>{tab.label}</span>
            {(tab.badge || 0) > 0 && <span className="absolute right-3 top-3.5 bg-orange-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black animate-bounce">{tab.badge}</span>}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-100 bg-slate-50 font-bold uppercase">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white border mb-2 shadow-sm">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-xs">{profile?.name?.charAt(0)}</div>
          <div className="overflow-hidden"><p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Logged in</p><div className="text-xs font-bold text-slate-700 truncate">{profile?.name}</div></div>
        </div>
        <button onClick={() => supabase.auth.signOut().then(()=>window.location.reload())} className="w-full py-2 text-xs text-red-500 hover:bg-red-50 font-bold rounded-lg transition border border-red-100 text-center block uppercase">Logout</button>
      </div>
    </aside>
  );
}
