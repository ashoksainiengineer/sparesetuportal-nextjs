import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // Admin power
    );

    // 1. User fetch karein email se
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    const targetUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (listError || !targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // 2. Password update (No session required)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUser.id,
      { password: password }
    );

    if (updateError) throw updateError;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
