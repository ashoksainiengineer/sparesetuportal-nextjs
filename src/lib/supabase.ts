import { createClient } from '@supabase/supabase-js';

// Environment variables ke aage '!' lagane se TypeScript error khatam ho jayega
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Gujarat Refinery database client initialize karna
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
