import { useState, type FormEvent } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { saveDesktopActivation } from '@/lib/desktopActivation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import logo from '@/assets/happycash-logo.webp';

interface DesktopLicenseResponse {
  licensed?: boolean;
  error?: string;
  planId?: string | null;
  validUntil?: string | null;
  offlineGraceUntil?: string | null;
  offlineGraceDays?: number;
  licenseKey?: string | null;
}

export function DesktopActivation({ onActivated }: { onActivated: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [adminName, setAdminName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const normalizedLicenseKey = licenseKey.trim().toUpperCase();

    if (!/^\d{4,12}$/.test(pin)) {
      toast.error('O PIN local deve ter de 4 a 12 numeros.');
      return;
    }

    if (pin !== confirmPin) {
      toast.error('A confirmacao do PIN nao confere.');
      return;
    }

    setSubmitting(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError || !authData.session?.access_token || !authData.user) {
        toast.error(authError?.message || 'Email ou senha incorretos.');
        return;
      }

      const { data: license, error: licenseError } = await supabase.functions.invoke<DesktopLicenseResponse>('desktop-license', {
        headers: {
          Authorization: `Bearer ${authData.session.access_token}`,
        },
        body: {},
      });

      if (licenseError || !license?.licensed || !license.licenseKey) {
        toast.error(license?.error || 'Nao foi possivel validar a licenca PRO.');
        return;
      }

      if (license.licenseKey.trim().toUpperCase() !== normalizedLicenseKey) {
        toast.error('A chave de licenca nao pertence a esta assinatura PRO.');
        return;
      }

      const result = await saveDesktopActivation({
        ownerUserId: authData.user.id,
        adminEmail: email.trim(),
        adminName: adminName.trim(),
        pin,
        licenseKey: normalizedLicenseKey,
        planId: license.planId || 'pro',
        validUntil: license.validUntil ?? null,
        offlineGraceUntil: license.offlineGraceUntil ?? null,
        offlineGraceDays: license.offlineGraceDays ?? 7,
      });

      if (!result.success) {
        toast.error(result.error || 'Nao foi possivel salvar a ativacao local.');
        return;
      }

      toast.success('Desktop ativado. Seu admin local foi criado.');
      onActivated();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <Card className="grid w-full overflow-hidden rounded-2xl border-border/70 md:grid-cols-[0.9fr_1.1fr]">
          <div className="hidden bg-zinc-950 p-8 text-white md:flex md:flex-col md:justify-between">
            <img src={logo} alt="HappyCash" className="h-auto w-40" />
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-300/30 px-3 py-1 text-sm text-yellow-200">
                <ShieldCheck className="h-4 w-4" />
                PRO Offline
              </div>
              <h1 className="text-3xl font-bold">Ative este computador</h1>
              <p className="mt-3 text-sm text-zinc-300">
                Valide uma vez com internet, crie o administrador local e use o HappyCash Desktop com tolerancia offline.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <KeyRound className="h-5 w-5" />
                <CardTitle>Ativacao inicial</CardTitle>
              </div>
              <CardDescription>
                Informe a conta PRO, a chave de licenca e crie o PIN local deste desktop.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email PRO</Label>
                  <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Senha da conta</Label>
                  <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Chave de licenca</Label>
                <Input
                  value={licenseKey}
                  onChange={(event) => setLicenseKey(event.target.value)}
                  placeholder="HC-PRO-XXXX-XXXX-XXXX-XXXX-XXXX"
                  className="font-mono uppercase"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Nome do administrador local</Label>
                <Input value={adminName} onChange={(event) => setAdminName(event.target.value)} required />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>PIN local</Label>
                  <Input inputMode="numeric" type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} required />
                </div>
                <div className="space-y-2">
                  <Label>Confirmar PIN</Label>
                  <Input inputMode="numeric" type="password" value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, ''))} required />
                </div>
              </div>

              <Button type="submit" className="h-11 w-full font-semibold" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ativar desktop
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  );
}
