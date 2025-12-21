import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Frontend se bheja gaya data read karna
    const { name, email, otp } = await request.json();

    // Aapke environment variables fetch karna
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    // Keys check karna
    if (!serviceId || !templateId || !publicKey || !privateKey) {
      return NextResponse.json(
        { error: 'Server misconfiguration: Missing EmailJS keys' }, 
        { status: 500 }
      );
    }

    // EmailJS ke liye data bundle taiyar karna
    const emailData = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: {
        to_name: name,
        to_email: email, 
        otp_code: otp
      }
    };

    // EmailJS API ko fetch request bhejna
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailData)
    });

    if (response.ok) {
      return NextResponse.json({ success: true }, { status: 200 });
    } else {
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'EmailJS Error', details: errorText }, 
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message }, 
      { status: 500 }
    );
  }
}
