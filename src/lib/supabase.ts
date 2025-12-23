import { createClient } from '@supabase/supabase-js';

// Environment variables fetch karna
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// BUG FIX: Manual validation check
// Agar environment variables load nahi hote toh app crash hone se pehle explicit error degi
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase Error: NEXT_PUBLIC_SUPABASE_URL ya NEXT_PUBLIC_SUPABASE_ANON_KEY missing hai! " +
    "Kripya .env.local file check karein."
  );
}

/**
 * Gujarat Refinery database client initialization
 * singleton pattern ensure karta hai ki ek hi instance reuse ho.
 */
export const supabase = createClient(
  supabaseUrl || '', 
  supabaseAnonKey || ''
);
