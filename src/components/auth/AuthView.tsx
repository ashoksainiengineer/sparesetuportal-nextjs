"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthView() {
  const [view, setView] = useState<"login" | "register" | "otp" | "forgot">("login");
  const [form, setForm] = useState({ email: "", pass: "", name: "", unit: "", enteredOtp: "", generatedOtp: "" });
  const [authLoading, setAuthLoading] = useState(false);

  const handleAuth = async () => {
    setAuthLoading(true);
    try {
      if (view === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.pass });
        if (error) alert(error.message);
      } else if (view === "register") {
        if (!form.name || !form.unit || !form.email || !form.pass) { alert("Details bhariye!"); setAuthLoading(false); return; }
        const { data: allowed } = await supabase.from('allowed_users').select('*').eq('email', form.email).eq('unit', form.unit).single();
        if (!allowed) { alert("Email access not allowed for this zone!"); setAuthLoading(false); return; }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        setForm({ ...form, generatedOtp: otp });
        const res = await fetch('/api/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, email: form.email, otp }) });
        if (res.ok) { alert("OTP sent!"); setView("otp"); } else alert("OTP Send Failed");
      } else if (view === "otp") {
        if (form.enteredOtp === form.generatedOtp) {
          const { error } = await supabase.auth.signUp({ email: form.email, password: form.pass, options: { data: { name: form.name, unit: form.unit } } });
          if (error) alert(error.message); else setView("login");
        } else alert("Wrong OTP");
      } else if (view === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(form.email);
        if (error) alert(error.message); else alert("Reset link sent to your email!");
      }
    } catch (err) { alert("Network Connection Error"); }
    setAuthLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 login-bg">
      <div className="w-full max-w-md login-card rounded-2xl shadow-2xl p-8 border-t-4 border-orange-500 text-center relative animate-fade-in font-roboto font-bold uppercase">
        <div className="mb-8">
          <div className="flex justify-center mb-4 font-bold uppercase">
            <div className="iocl-logo-container" style={{ fontSize: '14px' }}>
              <div className="iocl-circle"><div className="iocl-band"><span className="iocl-hindi-text">इंडियनऑयल</span></div></div>
              <div className="iocl-english-text" style={{ color: 'white' }}>IndianOil</div>
              <div className="font-script text-orange-400 text-[10px] mt-1 whitespace-nowrap">The Energy of India</div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-wider leading-tight">Gujarat Refinery</h1>
          <p className="font-hindi text-blue-400 text-sm font-bold mt-1 tracking-wide">जहाँ प्रगति ही जीवन सार है</p>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-4">Spare Setu Portal</p>
        </div>
        <div className="space-y-4">
          {(view === "register") && (
            <>
              <div className="relative font-bold uppercase"><i className="fa-solid fa-user absolute left-4 top-3.5 text-slate-400"></i><input type="text" placeholder="Engineer Full Name" className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm font-bold" onChange={e=>setForm({...form, name:e.target.value})} /></div>
              <div className="relative font-bold uppercase"><i className="fa-solid fa-building absolute left-4 top-3.5 text-slate-400"></i><select className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm bg-slate-900 text-slate-300 font-bold" onChange={e=>setForm({...form, unit:e.target.value})}><option value="">Select Your Zone</option>{["RUP - South Block", "RUP - North Block", "LAB", "MSQU", "AU-5", "BS-VI", "GR-II & NBA", "GR-I", "OM&S", "OLD SRU & CETP", "Electrical Planning", "Electrical Testing", "Electrical Workshop", "FCC", "GRE", "CGP-I", "CGP-II & TPS", "Water Block & Bitumen", "Township - Estate Office", "AC Section", "GHC", "DHUMAD"].map(z=><option key={z} value={z}>{z}</option>)}</select></div>
            </>
          )}
          {view === "otp" ? (
             <div className="relative font-bold uppercase"><i className="fa-solid fa-key absolute left-4 top-3.5 text-slate-400"></i><input type="text" placeholder="######" maxLength={6} className="w-full p-3 rounded-lg login-input text-center text-2xl tracking-[0.5em] font-bold text-white outline-none font-mono" onChange={e=>setForm({...form, enteredOtp:e.target.value})} /></div>
          ) : (
             <div className="relative font-bold uppercase"><i className="fa-solid fa-envelope absolute left-4 top-3.5 text-slate-400"></i><input type="email" value={form.email} className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm font-bold" placeholder="Official Email ID" onChange={e=>setForm({...form, email:e.target.value})} /></div>
          )}
          {(view === "login" || view === "register") && <div className="relative font-bold uppercase"><i className="fa-solid fa-lock absolute left-4 top-3.5 text-slate-400"></i><input type="password" placeholder="Password" className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm font-bold" onChange={e=>setForm({...form, pass:e.target.value})} /></div>}
          {view === "login" && <div className="text-right"><button onClick={()=>setView('forgot')} className="text-xs text-orange-500 hover:text-orange-400 font-bold transition">Forgot Password?</button></div>}
          <button onClick={handleAuth} disabled={authLoading} className="w-full h-12 mt-4 iocl-btn text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 uppercase tracking-widest text-sm">
            {authLoading ? "Processing..." : view === 'login' ? "Secure Login →" : view === 'register' ? "Create Account" : view === 'otp' ? "Verify & Register" : "Send Reset Link"}
          </button>
          <div className="mt-6 text-center border-t border-white/10 pt-4">
            <p className="text-xs text-slate-400">{view==='login' ? "New User? " : "Already have an account? "}<button onClick={()=>setView(view==='login'?'register':'login')} className="text-white hover:text-orange-500 font-bold underline ml-1">{view==='login' ? "Create Account" : "Back to Login"}</button></p>
          </div>
          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Developed By Engineers</p>
            <p className="text-[11px] text-slate-300 font-bold font-hindi">अशोक सैनी • दीपक चौहान • दिव्यांक सिंह राजपूत</p>
          </div>
        </div>
      </div>
    </div>
  );
}
