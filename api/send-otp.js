// File: api/send-otp.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, email, otp } = req.body;

    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    if (!serviceId || !templateId || !publicKey || !privateKey) {
        return res.status(500).json({ error: 'Server misconfiguration: Missing EmailJS keys' });
    }

    const emailData = {
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: {
            to_name: name,
            to_email: email, // Fix for {{to_email}} in your template
            otp_code: otp
        }
    };

    try {
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailData)
        });

        if (response.ok) {
            return res.status(200).json({ success: true });
        } else {
            const errorText = await response.text();
            return res.status(500).json({ error: 'EmailJS Error', details: errorText });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}