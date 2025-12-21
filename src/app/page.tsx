"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// --- Modular Components Import ---
import AuthView from "@/components/auth/AuthView";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import GlobalSearchView from "@/components/views/GlobalSearchView";
import MyStoreView from "@/components/views/MyStoreView";
import UsageHistoryView from "@/components/views/UsageHistoryView";
import MonthlyAnalysisView from "@/components/views/MonthlyAnalysisView";
import ReturnsLedgerView from "@/components/views/ReturnsLedgerView";

export default function SpareSetuApp() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("search");
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  // 1. Authentication & Session Management
  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user);
          fetchProfile(session.user.id);
        }
        setLoading(false);
      } catch (err) {
        console.error("Session Error:", err);
        setLoading(false);
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    getSession();
    return () => authListener.subscription.unsubscribe();
  }, []);

  // 2. Real-Time Notification Engine (Global Sync)
  useEffect(() => {
    if (!profile?.id || !profile?.unit) return;

    const fetchAllCounts = async () => {
      try {
        const { count: incoming } = await supabase
          .from("requests")
          .select("*", { count: 'exact', head: true })
          .eq("to_unit", profile.unit)
          .in("status", ["pending", "return_requested"]);

        const { count: updates } = await supabase
          .from("requests")
          .select("*", { count: 'exact', head: true })
          .eq("from_uid", profile.id)
          .eq("viewed_by_requester", false)
          .in("status", ["approved", "rejected", "returned"]);

        setPendingCount((incoming || 0) + (updates || 0));
      } catch (err) {
        console.error("Notification Sync Error:", err);
      }
    };

    fetchAllCounts();

    const channel = supabase
      .channel('sparesetu-global-sync-vfinal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        fetchAllCounts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  // 3. Notification Read Trigger
  useEffect(() => {
    if (activeTab === 'returns' && profile?.id) {
      supabase
        .from("requests")
        .update({ viewed_by_requester: true })
        .eq("from_uid", profile.id)
        .eq("viewed_by_requester", false)
        .then(() => {});
    }
  }, [activeTab, profile]);

  // 4. Profile Fetch Helper
  const fetchProfile = async (uid: string) => {
    try {
      const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
      if (data) setProfile(data);
    } catch (err) {
      console.error("Profile Fetch Error:", err);
    }
  };

  // --- Render Logic ---

  // Loading Screen (Preserving your exact branding)
  if (loading) return (
    <div className="fixed inset-0 z-[10000] bg-[#0f172a] flex flex-col items-center justify-center font-roboto">
      <div className="iocl-logo-container mb-4 animate-pulse" style={{ fontSize: '20px' }}>
        <div className="iocl-circle"><div className="iocl-band"><span className="iocl-hindi-text">इंडियनऑयल</span></div></div>
      </div>
      <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.3em]">SpareSetu Loading...</p>
    </div>
  );

  // Auth View (Isolated login logic)
  if (!user) return <AuthView />;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f1f5f9] font-roboto font-bold uppercase">
      
      {/* Sidebar - Componentized */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        profile={profile} 
        pendingCount={pendingCount} 
      />

      <main className="flex-1 flex flex-col overflow-y-auto relative pb-20 md:pb-0 font-bold uppercase font-roboto">
        
        {/* Header - Componentized */}
        <Header />

        <div className="p-4 md:p-10 max-w-7xl mx-auto w-full space-y-8">
          
          {/* Dynamic View Injection */}
          {activeTab === "search" && (
            <GlobalSearchView profile={profile} />
          )}
          
          {activeTab === "mystore" && (
            <MyStoreView 
              profile={profile} 
              fetchProfile={() => fetchProfile(user.id)} 
            />
          )}
          
          {activeTab === "usage" && (
            <UsageHistoryView profile={profile} />
          )}
          
          {activeTab === "analysis" && (
            <MonthlyAnalysisView profile={profile} />
          )}
          
          {activeTab === "returns" && (
            <ReturnsLedgerView profile={profile} onAction={fetchProfile} />
          )}

        </div>
      </main>
    </div>
  );
}
