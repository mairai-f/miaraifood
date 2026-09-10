import { NextResponse } from 'next/server';

function escapeHtml(str: string) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export async function POST(req: Request) {
    try {
        const { name, email, subject, message } = await req.json();

        if (
            typeof name !== 'string' ||
            typeof email !== 'string' ||
            typeof message !== 'string' ||
            !name.trim() ||
            !message.trim() ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
            name.length > 160 || email.length > 254 || message.length > 10_000
        ) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const resendApiKey = process.env.RESEND_API_KEY?.trim();
        const from = process.env.MIAR_FROM_EMAIL?.trim() || 'MIAR AI/FOOD <no-reply@miaraifood.com.br>';
        const to = process.env.MIAR_CONTACT_TO?.trim() || 'suporte@miaraifood.com.br';
        if (!resendApiKey) {
            console.error('RESEND_API_KEY is not configured');
            return NextResponse.json({ error: 'Email service is not configured' }, { status: 503 });
        }

        const safeName = escapeHtml(name);
        const safeEmail = escapeHtml(email);
        const safeSubject = escapeHtml(subject || 'No Subject');
        const safeMessage = escapeHtml(message).replace(/\n/g, '<br />');

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from,
                to: [to],
                reply_to: email.trim(),
                subject: `Contato pelo site: ${safeSubject}`,
                text: `Nome: ${name.trim()}\nE-mail: ${email.trim()}\n\n${message.trim()}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                        <h3 style="color: #333;">Nova mensagem pelo site MIAR AI/FOOD</h3>
                        <p><strong>Nome: </strong> ${safeName}</p>
                        <p><strong>E-mail: </strong> ${safeEmail}</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                        <p><strong>Mensagem:</strong></p>
                        <p style="white-space: pre-wrap; color: #555;">${safeMessage}</p>
                    </div>
                `,
            }),
        });

        if (!response.ok) {
            console.error('Resend rejected contact email:', await response.text());
            return NextResponse.json({ error: 'Failed to send email' }, { status: 502 });
        }

        return NextResponse.json({ message: 'Email sent successfully!' }, { status: 200 });
    } catch (error) {
        console.error('Error sending email:', error);
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
}
