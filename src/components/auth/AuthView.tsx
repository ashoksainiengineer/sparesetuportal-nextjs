"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthView() {
  const [view, setView] = useState<"login" | "register" | "otp" | "forgot">("login");
  const [form, setForm] = useState({ 
    email: "", 
    pass: "", 
    name: "", 
    unit: "", 
    enteredOtp: "", 
    generatedOtp: "" 
  });
  const [authLoading, setAuthLoading] = useState(false);

  // --- LOGIC: Handle Login, Register (OTP Send), Verify, & Forgot ---
  const handleAuth = async () => {
    setAuthLoading(true);
    const cleanEmail = form.email.trim().toLowerCase();

    try {
      if (view === "login") {
        // Direct Login with Email/Password
        const { error } = await supabase.auth.signInWithPassword({ 
            email: cleanEmail, 
            password: form.pass 
        });
        if (error) alert(error.message);
      } 
      else if (view === "register") {
        // Step 1: Mandatory Fields Check
        if (!form.name || !form.unit || !cleanEmail || !form.pass) { 
          alert("Kripya saari details bhariye!"); 
          setAuthLoading(false); 
          return; 
        }
        
        // Step 2: Validate against Allowed Users Table
        const { data: allowed } = await supabase.from('allowed_users')
          .select('*')
          .eq('email', cleanEmail)
          .eq('unit', form.unit)
          .single();

        if (!allowed) { 
          alert("Aapka Email is Zone ke liye authorized nahi hai!"); 
          setAuthLoading(false); 
          return; 
        }
        
        // Step 3: Generate 6-digit OTP & Send via API (EmailJS/Custom)
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        setForm(prev => ({ ...prev, generatedOtp: otp }));

        const res = await fetch('/api/send-otp', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ name: form.name, email: cleanEmail, otp }) 
        });

        if (res.ok) { 
          alert("Verification code aapke email par bhej diya gaya hai!"); 
          setView("otp"); 
        } else {
          alert("OTP bhenjne mein samasya aayi. Kripya dobara koshish karein.");
        }
      } 
      else if (view === "otp") {
        // Step 4: Verify the OTP locally
        if (form.enteredOtp === form.generatedOtp) {
          // Step 5: Final Sign Up after successful verification
          const { data: authData, error: authErr } = await supabase.auth.signUp({ 
            email: cleanEmail, 
            password: form.pass, 
            options: { data: { name: form.name, unit: form.unit } } 
          });

          if (authErr) { 
            alert(authErr.message); 
          } else if (authData.user) {
            // Bulletproof: Create Profile entry to avoid dashboard crash
            await supabase.from("profiles").insert([{
                id: authData.user.id,
                name: form.name,
                unit: form.unit,
                email: cleanEmail,
                item_count: 0
            }]);
            alert("Registration Safal raha! Ab aap login kar sakte hain.");
            setView("login");
          }
        } else {
          alert("Galat OTP! Kripya sahi code dalein.");
        }
      } 
      else if (view === "forgot") {
        // Send reset link using Supabase default
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
        if (error) alert(error.message); else alert("Reset link aapki email par bhej di gayi hai!");
      }
    } catch (err) { 
      alert("Network Error! Kripya connection check karein."); 
    }
    setAuthLoading(false);
  };

  // --- KEYBOARD SUPPORT: Enter key triggers main action ---
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAuth();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 login-bg font-roboto uppercase font-bold">
      <div className="w-full max-w-md login-card rounded-2xl shadow-2xl p-8 border-t-4 border-orange-500 text-center relative animate-fade-in">
        
        {/* BRANDING: IOCL ORIGINAL LOGO & TEXTS */}
        <div className="mb-8">
            <div className="flex justify-center mb-4 font-bold uppercase">
              <div className="iocl-logo-container" style={{ fontSize: '14px' }}>
                <div className="iocl-circle">
                    <div className="iocl-band"><span className="iocl-hindi-text">इंडियनऑयल</span></div>
                </div>
                <div className="iocl-english-text" style={{ color: 'white' }}>IndianOil</div>
                <div className="font-script text-orange-400 text-[10px] mt-1 whitespace-nowrap">The Energy of India</div>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white uppercase tracking-wider leading-tight">Gujarat Refinery</h1>
            <p className="font-hindi text-blue-400 text-sm font-bold mt-1 tracking-wide">जहाँ प्रगति ही जीवन सार है</p>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-4 opacity-70">Spare Setu Portal</p>
        </div>

        {/* FORMS SECTION */}
        <div className="space-y-4">
          {view === "register" && (
            <>
              <div className="relative">
                <i className="fa-solid fa-user absolute left-4 top-3.5 text-slate-400"></i>
                <input type="text" placeholder="Engineer Full Name" onKeyDown={handleKeyDown} className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm font-bold" onChange={e=>setForm({...form, name:e.target.value})} />
              </div>
              <div className="relative">
                <i className="fa-solid fa-building absolute left-4 top-3.5 text-slate-400"></i>
                <select className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm bg-slate-900 text-slate-300 font-bold cursor-pointer" onChange={e=>setForm({...form, unit:e.target.value})}>
                  <option value="">Select Your Zone</option>
                  {["RUP - South Block", "RUP - North Block", "LAB", "MSQU", "AU-5", "BS-VI", "GR-II & NBA", "GR-I", "OM&S", "OLD SRU & CETP", "Electrical Planning", "Electrical Testing", "Electrical Workshop", "FCC", "GRE", "CGP-I", "CGP-II & TPS", "Water Block & Bitumen", "Township - Estate Office", "AC Section", "GHC", "DHUMAD"].map(z=><option key={z} value={z}>{z}</option>)}
                </select>
              </div>
            </>
          )}

          {view === "otp" ? (
             <div className="relative">
               <i className="fa-solid fa-key absolute left-4 top-3.5 text-slate-400"></i>
               <input type="text" placeholder="######" maxLength={6} onKeyDown={handleKeyDown} className="w-full p-3 rounded-lg login-input text-center text-2xl tracking-[0.5em] font-bold text-white outline-none font-mono" onChange={e=>setForm({...form, enteredOtp:e.target.value})} />
             </div>
          ) : (
             <div className="relative">
               <i className="fa-solid fa-envelope absolute left-4 top-3.5 text-slate-400"></i>
               <input type="email" value={form.email} onKeyDown={handleKeyDown} className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm font-bold" placeholder="Official Email ID" onChange={e=>setForm({...form, email:e.target.value})} />
             </div>
          )}

          {(view === "login" || view === "register") && (
            <div className="relative">
              <i className="fa-solid fa-lock absolute left-4 top-3.5 text-slate-400"></i>
              <input type="password" placeholder="Password" onKeyDown={handleKeyDown} className="w-full pl-10 pr-4 py-3 rounded-lg login-input outline-none text-sm font-bold" onChange={e=>setForm({...form, pass:e.target.value})} />
            </div>
          )}

          {view === "login" && (
            <div className="text-right">
              <button onClick={()=>setView('forgot')} className="text-xs text-orange-500 hover:text-orange-400 font-bold transition">Forgot Password?</button>
            </div>
          )}

          <button onClick={handleAuth} disabled={authLoading} className="w-full h-12 mt-4 iocl-btn text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 uppercase tracking-widest text-sm hover:opacity-90 active:scale-95 transition-all">
            {authLoading ? "Processing..." : view === 'login' ? "Secure Login →" : view === 'register' ? "Send OTP" : view === 'otp' ? "Verify & Register" : "Send Reset Link"}
          </button>

          <div className="mt-6 text-center border-t border-white/10 pt-4 font-bold">
            <p className="text-xs text-slate-400">
              {view==='login' ? "New User? " : "Already have an account? "}
              <button onClick={()=>setView(view==='login'?'register':'login')} className="text-white hover:text-orange-500 font-bold underline ml-1">
                {view==='login' ? "Create Account" : "Back to Login"}
              </button>
            </p>
          </div>
          
          {/* FOOTER: DEVELOPERS NAMES IN LIGHT WHITE Devnagri */}
          <div className="mt-8 pt-6 border-t border-white/10 text-center font-bold">
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">Developed & Maintained By</p>
            <p className="text-[11px] text-slate-200 font-black font-hindi">अशोक सैनी • दीपक चौहान • दिव्यांक सिंह राजपूत</p>
          </div>
        </div>
      </div>
    </div>
  );
}
