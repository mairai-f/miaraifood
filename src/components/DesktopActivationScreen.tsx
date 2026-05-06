import { useMemo, useState, type FormEvent } from 'react';
import { Building2, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import happyCashLogo from '@/assets/happycash-logo.webp';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  activateDesktopWithLicenseKey,
  type DesktopActivationRecord,
} from '@/lib/desktopActivation';

interface DesktopActivationScreenProps {
  onActivated: (activation: DesktopActivationRecord) => void | Promise<void>;
}

const formatDocument = (value: string | null) => {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14) return value;

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

export function DesktopActivationScreen({ onActivated }: DesktopActivationScreenProps) {
  const [licenseKey, setLicenseKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recognizedCompany, setRecognizedCompany] = useState<DesktopActivationRecord | null>(null);

  const normalizedKey = useMemo(
    () => licenseKey.toUpperCase().replace(/[^A-Z0-9-]/g, ''),
    [licenseKey],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    if (!normalizedKey.trim()) {
      toast.error('Digite a chave da licença para ativar esta máquina.');
      return;
    }

    setSubmitting(true);

    try {
      const result = await activateDesktopWithLicenseKey(normalizedKey);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setRecognizedCompany(result.activation);
      toast.success('Empresa reconhecida com sucesso.');
      await onActivated(result.activation);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-4 py-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.12),_transparent_42%)]" />
      <div className="relative w-full max-w-md">
        <div className="mb-4 text-center">
          <img
            src={happyCashLogo}
            alt="HappyCash"
            className="mx-auto h-auto w-[clamp(7rem,30vw,10rem)] max-w-full object-contain"
            width={768}
            height={512}
            loading="eager"
            decoding="async"
          />
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-200/80">
            Ativação do Desktop
          </p>
        </div>

        <Card className="border-yellow-400/15 bg-black/45 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-md">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-400/10 text-yellow-300">
              <KeyRound className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl text-yellow-300">Chave da licença</CardTitle>
            <CardDescription>
              Em cada maquina nova, informe a chave da empresa para reconhecer o cadastro. Depois disso, o primeiro acesso deve ser do admin com email e senha para cadastrar o usuario admin offline desta maquina.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="desktop-license-key">Chave da empresa</Label>
                <Input
                  id="desktop-license-key"
                  value={normalizedKey}
                  onChange={(event) => setLicenseKey(event.target.value)}
                  placeholder="Ex: HC-AB12-CD34-EF56"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-11 tracking-[0.18em] uppercase"
                />
              </div>

              <Button type="submit" className="h-11 w-full bg-yellow-400 font-semibold text-black hover:bg-yellow-300" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validando chave...
                  </>
                ) : (
                  'Validar e continuar'
                )}
              </Button>
            </form>

            {recognizedCompany && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground">
                  <Building2 className="h-4 w-4 text-primary" />
                  <p className="font-medium">{recognizedCompany.companyName}</p>
                </div>
                {recognizedCompany.cnpj && (
                  <p className="mt-2">CNPJ: {formatDocument(recognizedCompany.cnpj)}</p>
                )}
                <p className="mt-1">
                  Empresa reconhecida. Agora o admin entra com email e senha para concluir o cadastro local desta maquina.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
