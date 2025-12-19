
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { masterCatalog } from "@/lib/masterdata";

export default function SpareSetuApp() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("search");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
      setLoading(false);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session) {
          setUser(session.user);
          fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    getSession();
    return () => authListener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();
    if (data) setProfile(data);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="text-3xl font-bold font-hindi">इंडियनऑयल</div>
          <div className="text-sm opacity-80 mt-2">SpareSetu Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) return <AuthView />;

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* SIDEBAR */}
      <aside className="w-72 bg-white border-r border-slate-200 p-4 hidden md:flex flex-col">
        <div className="mb-4">
          <div className="text-lg font-black font-industrial text-slate-800">
            SpareSetu
          </div>
          <div className="text-xs text-slate-500">IOCL Spare Setu Portal</div>
        </div>

        <div className="space-y-1">
          {[
            { id: "search", label: "Global Search", icon: "fa-globe" },
            { id: "mystore", label: "My Local Store", icon: "fa-warehouse" },
            { id: "analysis", label: "Monthly Analysis", icon: "fa-chart-pie" },
            { id: "usage", label: "My Usage History", icon: "fa-clock-rotate-left" },
            { id: "returns", label: "Returns & Udhaari", icon: "fa-hand-holding-hand" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`nav-item w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${
                activeTab === tab.id
                  ? "active-nav"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <i className={`fa-solid ${tab.icon}`} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-auto pt-4 border-t border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-black">
              {profile?.name?.charAt(0) || "U"}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800">
                {profile?.name || "User"}
              </div>
              <div className="text-xs text-slate-500">
                {profile?.unit || "Unit"}
              </div>
            </div>
          </div>

          <button
            onClick={() =>
              supabase.auth.signOut().then(() => window.location.reload())
            }
            className="w-full mt-3 py-2 text-xs text-red-500 hover:bg-red-50 font-bold rounded-lg transition border border-red-100"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1">
        {/* HEADER */}
        <div className="header-bg text-white px-6 py-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="iocl-logo-container">
                <div className="iocl-circle">
                  <div className="iocl-band">
                    <span className="iocl-hindi-text">इंडियनऑयल</span>
                  </div>
                </div>
                <div className="iocl-english-text">IndianOil</div>
              </div>
              <div className="text-xs opacity-80 -mt-1">
                The Energy of India • Gujarat Refinery
              </div>
              <div className="text-lg font-black mt-2">SPARE SETU PORTAL</div>
              <div className="text-xs opacity-80 font-hindi">
                जहाँ प्रगति ही जीवन सार है
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs opacity-80">Logged in as</div>
              <div className="font-bold">{profile?.name || "User"}</div>
              <div className="text-xs opacity-80">{profile?.unit || ""}</div>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="p-6">
          {activeTab === "search" && <GlobalSearchView profile={profile} />}
          {activeTab === "mystore" && (
            <MyStoreView
              profile={profile}
              fetchProfile={() => fetchProfile(user.id)}
            />
          )}
          {activeTab === "usage" && <UsageHistoryView profile={profile} />}
          {activeTab === "analysis" && <MonthlyAnalysisView profile={profile} />}
          {activeTab === "returns" && <ReturnsLedgerView profile={profile} />}
        </div>
      </main>
    </div>
  );
}

/* ---------------- AUTH VIEW ---------------- */
function AuthView() {
  const [view, setView] = useState<"login" | "register" | "otp" | "forgot">(
    "login"
  );
  const [form, setForm] = useState({
    email: "",
    pass: "",
    name: "",
    unit: "",
    enteredOtp: "",
    generatedOtp: "",
  });
  const [authLoading, setAuthLoading] = useState(false);

  const handleAuth = async () => {
    setAuthLoading(true);

    try {
      if (view === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.pass,
        });
        if (error) alert(error.message);
      }

      if (view === "register") {
        if (!form.name || !form.unit || !form.email || !form.pass) {
          alert("Details bhariye!");
          setAuthLoading(false);
          return;
        }

        const { data: allowed } = await supabase
          .from("allowed_users")
          .select("*")
          .eq("email", form.email)
          .eq("unit", form.unit)
          .single();

        if (!allowed) {
          alert("Email access not allowed for this zone!");
          setAuthLoading(false);
          return;
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        setForm((f) => ({ ...f, generatedOtp: otp }));

        const res = await fetch("/api/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.name, email: form.email, otp }),
        });

        if (res.ok) {
          alert("OTP sent!");
          setView("otp");
        } else {
          alert("OTP Send Failed");
        }
      }

      if (view === "otp") {
        if (form.enteredOtp === form.generatedOtp) {
          const { error } = await supabase.auth.signUp({
            email: form.email,
            password: form.pass,
            options: { data: { name: form.name, unit: form.unit } },
          });
          if (error) alert(error.message);
          else setView("login");
        } else {
          alert("Wrong OTP");
        }
      }

      if (view === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(form.email);
        if (error) alert(error.message);
        else alert("Reset link sent to your email!");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const zones = [
    "RUP - South Block",
    "RUP - North Block",
    "LAB",
    "MSQU",
    "AU-5",
    "BS-VI",
    "GR-II & NBA",
    "GR-I",
    "OM&S",
    "OLD SRU & CETP",
    "Electrical Planning",
    "Electrical Testing",
    "Electrical Workshop",
    "FCC",
    "GRE",
    "CGP-I",
    "CGP-II & TPS",
    "Water Block & Bitumen",
    "Township - Estate Office",
    "AC Section",
    "GHC",
    "DHUMAD",
  ];

  return (
    <div className="min-h-screen login-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md login-card rounded-3xl p-8 text-white animate-scale-in">
        <div className="text-center mb-6">
          <div className="font-hindi text-3xl font-black">इंडियनऑयल</div>
          <div className="text-2xl font-black">IndianOil</div>
          <div className="text-xs opacity-80">The Energy of India</div>
          <div className="text-sm font-bold mt-2">Gujarat Refinery</div>
          <div className="text-xs opacity-80 font-hindi mt-1">
            जहाँ प्रगति ही जीवन सार है
          </div>
          <div className="mt-4 text-lg font-black">Spare Setu Portal</div>
        </div>

        {view === "register" && (
          <>
            <label className="text-xs font-bold opacity-80">Name</label>
            <input
              className="login-input w-full px-4 py-3 rounded-xl mt-1 mb-3"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your Name"
            />

            <label className="text-xs font-bold opacity-80">Unit / Zone</label>
            <select
              className="login-input w-full px-4 py-3 rounded-xl mt-1 mb-3"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            >
              <option value="">Select Your Zone</option>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </>
        )}

        <label className="text-xs font-bold opacity-80">Email</label>
        {view === "otp" ? (
          <input
            className="login-input w-full px-4 py-3 rounded-xl mt-1 mb-3"
            value={form.enteredOtp}
            onChange={(e) => setForm({ ...form, enteredOtp: e.target.value })}
            placeholder="Enter OTP"
          />
        ) : (
          <input
            className="login-input w-full px-4 py-3 rounded-xl mt-1 mb-3"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="name@company.com"
          />
        )}

        {(view === "login" || view === "register") && (
          <>
            <label className="text-xs font-bold opacity-80">Password</label>
            <input
              type="password"
              className="login-input w-full px-4 py-3 rounded-xl mt-1 mb-2"
              value={form.pass}
              onChange={(e) => setForm({ ...form, pass: e.target.value })}
              placeholder="••••••••"
            />
          </>
        )}

        {view === "login" && (
          <button
            onClick={() => setView("forgot")}
            className="text-xs text-orange-400 hover:text-orange-300 font-bold transition"
          >
            Forgot Password?
          </button>
        )}

        <button
          onClick={handleAuth}
          disabled={authLoading}
          className="iocl-btn w-full mt-4 py-3 rounded-2xl font-black shadow-lg disabled:opacity-60"
        >
          {authLoading
            ? "Processing..."
            : view === "login"
            ? "Secure Login →"
            : view === "register"
            ? "Create Account"
            : view === "otp"
            ? "Verify & Register"
            : "Send Reset Link"}
        </button>

        <div className="text-center mt-5 text-sm">
          {view === "login" ? "New User? " : "Already have an account? "}
          <button
            onClick={() => setView(view === "login" ? "register" : "login")}
            className="text-white hover:text-orange-400 font-bold underline ml-1"
          >
            {view === "login" ? "Create Account" : "Back to Login"}
          </button>
        </div>

        <div className="text-center mt-6 text-xs opacity-80">
          Developed By Engineers <br />
          अशोक सैनी • दीपक चौहान • दिव्यांक सिंह राजपूत
        </div>
      </div>
    </div>
  );
}

/* ---------------- GLOBAL SEARCH (Cat + SubCat Filter Added) ---------------- */
function GlobalSearchView({ profile }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [contributors, setContributors] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selCat, setSelCat] = useState("all");
  const [selSub, setSelSub] = useState("all");
  const [breakdown, setBreakdown] = useState<any>(null);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      const { data } = await supabase.from("inventory").select("*");
      if (data) setItems(data);
    };
    const lead = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("name, unit, item_count")
        .order("item_count", { ascending: false })
        .limit(3);
      if (data) setContributors(data);
    };

    fetchAll();
    lead();
  }, []);

  // group by item+spec for total stock
  const grouped = useMemo(() => {
    const g: any = {};
    items.forEach((i) => {
      const key = `${i.item}-${i.spec}`.toLowerCase();
      if (!g[key]) g[key] = { ...i, totalQty: 0, holders: [] };
      g[key].totalQty += Number(i.qty);
      g[key].holders.push(i);
    });
    return g;
  }, [items]);

  const categories = useMemo(() => {
    return [...new Set(items.map((i) => i.cat).filter(Boolean))].sort();
  }, [items]);

  const subs = useMemo(() => {
    const base =
      selCat === "all" || selCat === "zero"
        ? items
        : items.filter((i) => i.cat === selCat);
    return [...new Set(base.map((i) => i.sub).filter(Boolean))].sort();
  }, [items, selCat]);

  useEffect(() => {
    setSelSub("all");
  }, [selCat]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return Object.values(grouped).filter((i: any) => {
      const matchesSearch =
        !q ||
        [i.item, i.spec, i.cat, i.sub]
          .filter(Boolean)
          .some((x: string) => x.toLowerCase().includes(q));

      const matchesCat =
        selCat === "all"
          ? true
          : selCat === "zero"
          ? i.totalQty === 0
          : i.cat === selCat;

      const matchesSub = selSub === "all" ? true : i.sub === selSub;

      return matchesSearch && matchesCat && matchesSub;
    });
  }, [grouped, search, selCat, selSub]);

  return (
    <div className="fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
        <div>
          <div className="text-lg font-black text-slate-800">Global Search</div>
          <div className="text-xs text-slate-500">
            Combined stock across all units/zones
          </div>
        </div>

        <div className="ml-auto flex flex-wrap gap-2 items-center w-full lg:w-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Item / Spec / Category / Sub..."
            className="w-full lg:w-96 px-4 py-2 rounded-lg border border-slate-200 bg-white shadow-sm text-sm"
          />

          <select
            value={selCat}
            onChange={(e) => setSelCat(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white shadow-sm text-sm"
          >
            <option value="all">Category: All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="zero">⚠️ Out of Stock</option>
          </select>

          <select
            value={selSub}
            onChange={(e) => setSelSub(e.target.value)}
            disabled={subs.length === 0}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white shadow-sm text-sm disabled:opacity-50"
          >
            <option value="all">Sub-Category: All</option>
            {subs.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowSummary(true)}
            className="bg-indigo-600 text-white px-3 py-2 rounded-md text-xs font-bold ml-auto flex items-center gap-2 shadow-sm"
          >
            <i className="fa-solid fa-chart-simple" />
            Stock Summary
          </button>

          <button
            onClick={() => {
              setSearch("");
              setSelCat("all");
              setSelSub("all");
            }}
            className="px-3 py-2 rounded-md text-xs font-bold bg-slate-100 hover:bg-slate-200 border border-slate-200"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Top Contributors */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
        <div className="text-sm font-black text-slate-800 mb-3">
          Top Contributors
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {contributors.map((c, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 p-3 bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-black">
                  {c.name?.charAt(0) || "U"}
                </div>
                <div>
                  <div className="text-sm font-black">{c.name}</div>
                  <div className="text-xs text-slate-500">{c.unit}</div>
                </div>
              </div>
              <div className="mt-2 text-xs font-bold text-slate-700">
                {c.item_count ?? 0} Items
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-black text-slate-800">
            Results ({filtered.length})
          </div>
          <div className="text-xs text-slate-500">
            Filter: {selCat}/{selSub}
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="text-left px-4 py-3">Item Details</th>
                <th className="text-left px-4 py-3">Spec</th>
                <th className="text-center px-4 py-3">Total Stock</th>
                <th className="text-center px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i: any, idx: number) => (
                <tr key={idx} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-800">{i.item}</div>
                    <div className="text-xs text-slate-500">
                      {i.cat} • {i.sub}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{i.spec}</td>
                  <td className="px-4 py-3 text-center">
                    {i.totalQty === 0 ? (
                      <span className="text-red-600 font-black">
                        Out of Stock
                      </span>
                    ) : (
                      <button
                        onClick={() => setBreakdown(i)}
                        className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-lg border border-blue-200 font-bold hover:bg-blue-100 transition shadow-sm"
                      >
                        {i.totalQty} Nos
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setBreakdown(i)}
                      className="text-indigo-600 font-bold hover:underline"
                    >
                      Breakdown
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td
                    className="px-4 py-10 text-center text-slate-500"
                    colSpan={4}
                  >
                    No matching results.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SUMMARY MODAL */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 relative overflow-hidden">
            <button
              onClick={() => setShowSummary(false)}
              className="absolute top-4 right-4 text-slate-400 font-bold text-xl hover:text-red-500 transition"
            >
              ✕
            </button>

            <div className="px-6 py-5 border-b border-slate-200">
              <div className="text-lg font-black text-slate-800">
                Stock Summary
              </div>
              <div className="text-xs text-slate-500">
                Category → Sub Category totals
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-auto">
              {[...new Set(items.map((i) => i.cat))]
                .filter(Boolean)
                .sort()
                .map((cat) => (
                  <div key={cat}>
                    <div className="font-black text-slate-800 mb-2">{cat}</div>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="min-w-full text-sm">
                        <tbody>
                          {[
                            ...new Set(
                              items
                                .filter((i) => i.cat === cat)
                                .map((i) => i.sub)
                            ),
                          ]
                            .filter(Boolean)
                            .sort()
                            .map((sub) => (
                              <tr
                                key={sub}
                                className="border-t border-slate-100"
                              >
                                <td className="px-4 py-2">{sub}</td>
                                <td className="px-4 py-2 text-right font-bold">
                                  {items
                                    .filter(
                                      (i) => i.cat === cat && i.sub === sub
                                    )
                                    .reduce(
                                      (sum, item) => sum + Number(item.qty),
                                      0
                                    )}{" "}
                                  Nos
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* BREAKDOWN MODAL */}
      {breakdown && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 relative overflow-hidden">
            <button
              onClick={() => setBreakdown(null)}
              className="absolute top-4 right-4 text-slate-400 font-bold text-xl hover:text-red-500 transition"
            >
              ✕
            </button>

            <div className="px-6 py-5 border-b border-slate-200">
              <div className="text-lg font-black text-slate-800">
                {breakdown.item}
              </div>
              <div className="text-xs text-slate-500">{breakdown.spec}</div>
            </div>

            <div className="p-6 overflow-auto max-h-[75vh]">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="text-left px-4 py-3">Unit / Zone</th>
                    <th className="text-left px-4 py-3">Engineer</th>
                    <th className="text-center px-4 py-3">Qty</th>
                    <th className="text-center px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.holders?.map((h: any, idx: number) => (
                    <tr key={idx} className="border-t border-slate-100">
                      <td className="px-4 py-3">{h.holder_unit}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-black text-xs">
                            {h.holder_name?.charAt(0) || "U"}
                          </div>
                          <div className="font-bold text-slate-800">
                            {h.holder_name}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-bold">
                        {h.qty} Nos
                      </td>
                      <td className="px-4 py-3 text-center">
                        {h.holder_uid === profile?.id ? (
                          <span className="text-slate-400 font-bold">
                            Your Stock
                          </span>
                        ) : (
                          <button
                            onClick={() => alert("Request logic coming soon")}
                            className="text-indigo-600 font-bold hover:underline"
                          >
                            Request
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
