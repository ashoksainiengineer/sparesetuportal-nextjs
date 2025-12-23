import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { name, email } = await request.json();

    // Security Fix: Generate OTP on server side, not frontend
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    if (!serviceId || !templateId || !publicKey || !privateKey) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const emailData = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: {
        to_name: name,
        to_email: email, 
        otp_code: otp // Using server-generated OTP
      }
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailData)
    });

    if (response.ok) {
      // Return the OTP to frontend so it can be verified in state
      return NextResponse.json({ success: true, otp }, { status: 200 });
    } else {
      const errorText = await response.text();
      return NextResponse.json({ error: 'EmailJS Error', details: errorText }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
