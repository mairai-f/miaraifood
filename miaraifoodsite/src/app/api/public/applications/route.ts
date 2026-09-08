import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const clean = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max);
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const disposableDomains = new Set(['mailinator.com','10minutemail.com','guerrillamail.com','temp-mail.org','tempmail.com','yopmail.com','sharklasers.com','trashmail.com','getnada.com','dispostable.com']);
const repeated = (v: string) => /^(\d)\1+$/.test(v);

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    const form = contentType.includes('multipart/form-data') ? await req.formData() : null;
    const body = form ? Object.fromEntries(form.entries()) : await req.json();
    const kind = body.kind === 'driver' ? 'driver' : body.kind === 'representative' ? 'representative' : null;
    if (!kind) return NextResponse.json({ error: 'Tipo de cadastro inválido.' }, { status: 400 });
    const full_name = clean(body.full_name, 160), email = clean(body.email, 254).toLowerCase();
    const phone = clean(body.phone, 32), cpf = clean(body.cpf, 32), city = clean(body.city, 120), state = clean(body.state, 2).toUpperCase();
    const cpfDigits = cpf.replace(/\D/g, ''), emailDomain = email.split('@')[1] || '';
    const phoneDigits = phone.replace(/\D/g, '');
    if (full_name.length < 3 || !validEmail(email) || disposableDomains.has(emailDomain) || phoneDigits.length < 10 || repeated(phoneDigits) || cpfDigits.length !== 11 || repeated(cpfDigits) || !city || state.length !== 2 || !body.terms) {
      return NextResponse.json({ error: 'Preencha os campos obrigatórios e aceite os termos.' }, { status: 400 });
    }
    const db = await createClient();
    const payload = kind === 'representative' ? {
      full_name, email, phone, cpf, city, state,
      applicant_type: body.applicant_type === 'company' ? 'company' : 'individual',
      sales_experience: Boolean(body.sales_experience),
      segments: Array.isArray(body.segments) ? body.segments.map((x: unknown) => clean(x, 40)).slice(0, 12) : [],
      experience: clean(body.experience, 2000) || null,
      represented_company: body.represented_company === 'true' || body.represented_company === 'on',
      prospecting_channels: Array.isArray(body.prospecting_channels) ? body.prospecting_channels.map((x: unknown) => clean(x, 40)).slice(0, 12) : [],
      representation_type: ['independent','agency','referral_partner'].includes(String(body.representation_type)) ? body.representation_type : 'independent',
      company_name: clean(body.company_name, 160) || null, company_cnpj: clean(body.company_cnpj, 32) || null,
      has_client_portfolio: body.has_client_portfolio === 'true' || body.has_client_portfolio === 'on', terms_version: '2026-09-07',
    } : {
      full_name, email, phone, cpf, city, state,
      vehicle_type: ['motorcycle', 'car', 'bicycle', 'other'].includes(body.vehicle_type) ? body.vehicle_type : 'motorcycle',
      vehicle_plate: clean(body.vehicle_plate, 12) || null, vehicle_model: clean(body.vehicle_model, 120) || null,
      cnh_number: clean(body.cnh_number, 32) || null, establishment_invite_code: clean(body.establishment_invite_code, 80) || null, establishment_id: null, terms_version: '2026-09-07',
    };
    const table = kind === 'representative' ? 'representative_applications' : 'delivery_driver_applications';
    const { data: application, error } = await db.from(table).insert(payload as any).select('id').single();
    if (error) { console.error(error); if (error.code === '23505') return NextResponse.json({ error: 'Já existe um pré-cadastro com este e-mail ou documento.' }, { status: 409 }); return NextResponse.json({ error: 'Não foi possível registrar o cadastro.' }, { status: 500 }); }
    if (kind === 'driver' && form && application) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) return NextResponse.json({ error: 'Upload temporariamente indisponível.' }, { status: 503 });
      const admin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } });
      for (const type of ['cnh_front', 'cnh_back', 'vehicle_document']) {
        const file = form.get(type);
        if (!(file instanceof File) || file.size === 0) continue;
        if (file.size > 8 * 1024 * 1024 || !file.type.startsWith('image/') && file.type !== 'application/pdf') return NextResponse.json({ error: 'Documento inválido ou maior que 8MB.' }, { status: 400 });
        const path = `${application.id}/${type}-${crypto.randomUUID()}`;
        const upload = await admin.storage.from('driver-application-documents').upload(path, file, { contentType: file.type, upsert: false });
        if (upload.error) return NextResponse.json({ error: 'Não foi possível salvar os documentos.' }, { status: 500 });
        const doc = await admin.from('delivery_driver_documents').insert({ application_id: application.id, document_type: type, storage_path: path });
        if (doc.error) return NextResponse.json({ error: 'Não foi possível registrar os documentos.' }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 }); }
}
