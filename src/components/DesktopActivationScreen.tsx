import { useMemo, useState, type FormEvent } from 'react';
import { Building2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import happyCashLogo from '@/assets/login/happycash.svg';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  activateDesktopWithLicenseKey,
  type DesktopActivationRecord,
} from '@/lib/desktopActivation';
import { LanguageSwitcher } from '../../shared/locale/LanguageSwitcher';
import { useLocale } from '../../shared/locale/useLocale';
import {
  LEGAL_ACCEPTANCE_SOURCES,
  LEGAL_UPDATED_AT_LABEL,
} from '../../shared/legal/legalAcceptance';
import { LEGAL_MODAL_DOCUMENTS } from '../../shared/legal/legalModalDocuments';
import { getPublicErrorMessage, maskDocument } from '../../shared/security/redaction';

interface DesktopActivationScreenProps {
  onActivated: (activation: DesktopActivationRecord) => void | Promise<void>;
}

type ActivationLegalDocumentKey = 'terms' | 'privacy';

export function DesktopActivationScreen({ onActivated }: DesktopActivationScreenProps) {
  const { locale } = useLocale();
  const [licenseKey, setLicenseKey] = useState('');
  const [showLicenseKey, setShowLicenseKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recognizedCompany, setRecognizedCompany] = useState<DesktopActivationRecord | null>(null);
  const [legalDecision, setLegalDecision] = useState<'accepted' | 'declined' | null>(null);
  const [legalModal, setLegalModal] = useState<ActivationLegalDocumentKey | null>(null);
  const requiresInAppLegalAcceptance = useMemo(() => {
    try {
      return window.electronAPI?.app?.getRuntimeInfoSync?.().platform === 'linux';
    } catch {
      return false;
    }
  }, []);

  const copy = locale === 'pt-BR'
      ? {
        tagline: 'Tecnologia simples para sua empresa.',
        pill: 'Ativação do desktop',
        title: 'Chave da licença',
        description: '',
        companyKeyLabel: 'Chave da empresa',
        companyKeyPlaceholder: 'Informe a chave recebida',
        showKey: 'Mostrar chave',
        hideKey: 'Ocultar chave',
        legalTitle: 'Termos e política de privacidade',
        legalDescription: 'Leia os documentos antes de continuar.',
        terms: 'Termos de Uso',
        privacy: 'Política de Privacidade',
        accept: 'Concordo',
        decline: 'Não concordo',
        declinedMessage: 'Sem o aceite legal não é possível concluir a ativação desta máquina.',
        submit: 'Validar e continuar',
        submitLoading: 'Validando chave...',
        companyRecognized: 'Empresa reconhecida.',
        companyRecognizedMessage: 'Agora o administrador entra com email e senha para configurar usuário, PIN e os dados locais desta máquina.',
        emptyKeyError: 'Digite a chave da licença para ativar esta máquina.',
        legalRequiredError: 'Concorde com os Termos de Uso e com a Política de Privacidade para continuar.',
        activationError: 'Não foi possível validar a chave desta empresa.',
        activationSuccess: 'Empresa reconhecida com sucesso.',
        close: 'Fechar',
        lastUpdated: 'Última atualização',
      }
    : {
        tagline: 'Simple technology for your business.',
        pill: 'Desktop activation',
        title: 'License key',
        description: '',
        companyKeyLabel: 'Company key',
        companyKeyPlaceholder: 'Enter the license key',
        showKey: 'Show key',
        hideKey: 'Hide key',
        legalTitle: 'Terms and privacy policy',
        legalDescription: 'Read the documents before continuing.',
        terms: 'Terms of Use',
        privacy: 'Privacy Policy',
        accept: 'I agree',
        decline: 'I do not agree',
        declinedMessage: 'Without legal acceptance, this machine cannot be activated.',
        submit: 'Validate and continue',
        submitLoading: 'Validating key...',
        companyRecognized: 'Company recognized.',
        companyRecognizedMessage: 'The administrator can now sign in with email and password to configure user, PIN, and local machine data.',
        emptyKeyError: 'Enter the license key to activate this machine.',
        legalRequiredError: 'Accept the Terms of Use and the Privacy Policy to continue.',
        activationError: 'Could not validate this company key.',
        activationSuccess: 'Company recognized successfully.',
        close: 'Close',
        lastUpdated: 'Last update',
      };

  const legalDocuments = locale === 'pt-BR'
    ? {
        terms: LEGAL_MODAL_DOCUMENTS.terms,
        privacy: LEGAL_MODAL_DOCUMENTS.privacy,
      }
    : {
        terms: {
          title: 'Terms of Use',
          description: 'Main conditions for using HappyCash, including plans, trial period, account, support, desktop, offline use, reports, and user responsibilities.',
          sections: [
            {
              title: 'Account use',
              text: 'When creating an account, subscribing to a plan, using the free trial, or accessing HappyCash products, the user agrees to keep accurate data and protect passwords, PINs, operators, and devices.',
            },
            {
              title: 'Data and operation',
              text: 'Using HappyCash may involve owner and company data such as name, email, phone number, CPF or CNPJ, and establishment address, as well as operational data entered by the store, including customer and third-party records, CPF or CNPJ when informed, sales, tabs, payments, products, stock, expenses, reports, appointments, and notes.',
            },
            {
              title: 'Responsibilities',
              text: 'The user must use the system according to the law, obtain authorization before registering third-party data, and must not use HappyCash for fraud, abuse, illegal activity, or rights violations.',
            },
          ],
        },
        privacy: {
          title: 'Privacy Policy',
          description: 'How HappyCash handles personal data across the site, registration, client area, POS, tabs, inventory, schedule, and related features.',
          sections: [
            {
              title: 'Processed data',
              text: 'We may process owner and company data such as full name, email, phone number, CPF or CNPJ, establishment name, business type, ZIP code, street, number, complement, neighborhood, city, and state. We also process data entered by the store in the system, including name, CPF, CNPJ, phone number, address, tabs, sales, payments, products, inventory, expenses, appointments, notes, and other operational or financial records.',
            },
            {
              title: 'Purposes',
              text: 'We use this data to create and protect accounts, unlock subscribed features, operate the system, process subscriptions, provide support, prevent fraud, improve the product, and comply with legal obligations.',
            },
            {
              title: 'Rights and contact',
              text: 'Data subjects may request access, correction, deletion, processing confirmation, and other information under LGPD by emailing happycashsupport@gmail.com.',
            },
          ],
        },
      };
  const activeLegalDocument = legalModal ? legalDocuments[legalModal] : null;

  const normalizedKey = useMemo(
    () => licenseKey.toUpperCase().replace(/[^A-Z0-9-]/g, ''),
    [licenseKey],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    if (!normalizedKey.trim()) {
      toast.error(copy.emptyKeyError);
      return;
    }

    if (requiresInAppLegalAcceptance && legalDecision !== 'accepted') {
      toast.error(copy.legalRequiredError);
      return;
    }

    setSubmitting(true);

    try {
      const result = await activateDesktopWithLicenseKey(normalizedKey, {
        accepted: !requiresInAppLegalAcceptance || legalDecision === 'accepted',
        source: LEGAL_ACCEPTANCE_SOURCES.desktopActivation,
      });
      if (!result.success) {
        toast.error(getPublicErrorMessage(result.error, copy.activationError));
        return;
      }

      setRecognizedCompany(result.activation);
      toast.success(copy.activationSuccess);
      await onActivated(result.activation);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[linear-gradient(180deg,#5e79ff_0%,#5571f4_48%,#4d69e8_100%)]">
      <LanguageSwitcher className="left-1/2 top-[calc(env(safe-area-inset-top,0px)+0.55rem)] right-auto bottom-auto z-30 -translate-x-1/2 sm:hidden" />
      <LanguageSwitcher className="hidden sm:flex top-[calc(env(safe-area-inset-top,0px)+1rem)] right-4 bottom-auto left-auto z-30 translate-x-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.2),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(21,41,113,0.2),_transparent_42%)]" />
      <div className="absolute left-[12%] top-[14%] h-72 w-72 rounded-full bg-white/14 blur-3xl" />
      <div className="absolute bottom-[10%] right-[8%] h-80 w-80 rounded-full bg-[#183b8c]/22 blur-3xl" />

      <main className="relative flex h-full items-center justify-center px-4 pb-4 pt-[calc(env(safe-area-inset-top,0px)+4.7rem)] sm:px-6 sm:pt-[calc(env(safe-area-inset-top,0px)+5.2rem)]">
        <div className="w-full max-w-[28rem] [@media(max-height:780px)]:scale-[0.95] [@media(max-height:700px)]:scale-[0.9] [@media(max-height:640px)]:scale-[0.84]">
          <div className="space-y-3 pb-4 text-center">
            <img
              src={happyCashLogo}
              alt="HappyCash"
              className="mx-auto h-auto w-full max-w-[16rem] object-contain sm:max-w-[18.5rem]"
              loading="eager"
              decoding="async"
            />
            <p className="mx-auto max-w-[20rem] text-[13px] font-semibold leading-snug tracking-[-0.01em] text-[#f4f8ff] sm:max-w-[22rem] sm:text-[14px]">
              {copy.tagline}
            </p>
          </div>

          <div className="rounded-[28px] border border-[#d6e0f0] bg-white/96 px-4 py-4 shadow-[0_24px_60px_rgba(21,41,113,0.2)] backdrop-blur-xl sm:px-5 sm:py-4.5">
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#111827]">
                {copy.pill}
              </p>
              <h1 className="mt-1.5 text-[1.58rem] font-bold leading-none tracking-[-0.03em] text-[#173d7a] sm:text-[1.8rem]">
                {copy.title}
              </h1>
              {copy.description ? (
                <p className="mt-2 text-[13px] leading-5 text-[#425978] sm:text-[13.5px] sm:leading-6">
                  {copy.description}
                </p>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3" autoComplete="off">
              <div className="space-y-2">
                <Label htmlFor="desktop-license-key" className="text-[14px] font-semibold text-[#203550]">
                  {copy.companyKeyLabel}
                </Label>
                <div className="relative">
                  <Input
                    id="desktop-license-key"
                    type={showLicenseKey ? 'text' : 'password'}
                    value={normalizedKey}
                    onChange={(event) => setLicenseKey(event.target.value)}
                    placeholder={copy.companyKeyPlaceholder}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    className="h-10 rounded-2xl border-[#ced9ea] bg-white px-4 pr-12 text-[14px] uppercase tracking-[0.16em] text-[#111827] placeholder:text-[#111827] focus-visible:ring-[#1f56a5]/25 focus-visible:ring-offset-0"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLicenseKey((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#667a98] transition-colors hover:text-[#24324a]"
                    aria-label={showLicenseKey ? copy.hideKey : copy.showKey}
                  >
                    {showLicenseKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {requiresInAppLegalAcceptance && (
                <div className="space-y-3.5 rounded-[22px] border border-[#d4deef] bg-[#eef4ff] p-4">
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-[#203550]">{copy.legalTitle}</p>
                    <p className="text-xs leading-5 text-[#4f6480]">
                      {copy.legalDescription}
                    </p>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-[#ced9ea] bg-white text-[#111827] hover:bg-[#edf3fb] hover:text-[#111827]"
                      onClick={() => setLegalModal('terms')}
                    >
                      {copy.terms}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-[#ced9ea] bg-white text-[#111827] hover:bg-[#edf3fb] hover:text-[#111827]"
                      onClick={() => setLegalModal('privacy')}
                    >
                      {copy.privacy}
                    </Button>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className={legalDecision === 'accepted'
                        ? 'h-10 rounded-2xl border border-[#1f56a5] bg-[#1f56a5] text-[#111827] hover:bg-[#194788] hover:text-[#111827]'
                        : 'h-10 rounded-2xl border border-[#ced9ea] bg-white text-[#111827] hover:bg-[#edf3fb] hover:text-[#111827]'}
                      onClick={() => setLegalDecision('accepted')}
                    >
                      {copy.accept}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className={legalDecision === 'declined'
                        ? 'h-10 rounded-2xl border border-[#b91c1c] bg-[#dc2626] text-white hover:bg-[#b91c1c] hover:text-white'
                        : 'h-10 rounded-2xl border border-[#b91c1c] bg-[#dc2626] text-white hover:bg-[#b91c1c] hover:text-white'}
                      onClick={() => setLegalDecision('declined')}
                    >
                      {copy.decline}
                    </Button>
                  </div>
                  {legalDecision === 'declined' && (
                    <p className="text-xs text-red-600">
                      {copy.declinedMessage}
                    </p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="h-10 w-full rounded-2xl bg-[#1f56a5] text-[14px] font-semibold text-[#111827] hover:bg-[#194788] hover:text-[#111827]"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {copy.submitLoading}
                  </>
                ) : (
                  copy.submit
                )}
              </Button>
            </form>

            {recognizedCompany && (
              <div className="mt-3.5 rounded-[22px] border border-[#d4deef] bg-[#eef4ff] p-3.5 text-sm text-[#4f6480]">
                <div className="flex items-center gap-2 text-[#203550]">
                  <Building2 className="h-4 w-4 text-[#1f56a5]" />
                  <p className="font-medium">{recognizedCompany.companyName}</p>
                </div>
                {recognizedCompany.cnpj && (
                  <p className="mt-2">CNPJ: {maskDocument(recognizedCompany.cnpj)}</p>
                )}
                <p className="mt-1.5">
                  {copy.companyRecognized} {copy.companyRecognizedMessage}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <Dialog open={Boolean(activeLegalDocument)} onOpenChange={(open) => !open && setLegalModal(null)}>
        <DialogContent
          className="grid max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border border-[#d6e0f0] bg-white p-0 text-[#203550] shadow-[0_24px_60px_rgba(21,41,113,0.24)] sm:max-h-[calc(100dvh-3rem)] sm:max-w-3xl"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {activeLegalDocument ? (
            <>
              <DialogHeader className="border-b border-[#dbe5f2] px-5 pb-4 pt-5 text-left">
                <DialogTitle className="text-[1.4rem] font-bold tracking-[-0.03em] text-[#173d7a]">
                  {activeLegalDocument.title}
                </DialogTitle>
                <DialogDescription className="leading-6 text-[#4f6480]">
                  {activeLegalDocument.description}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="min-h-0 px-5 py-4">
                <div className="space-y-5 pr-3">
                  {activeLegalDocument.sections.map((section) => (
                    <section key={section.title} className="space-y-2">
                      <h3 className="text-[15px] font-semibold text-[#203550]">{section.title}</h3>
                      <p className="text-sm leading-6 text-[#4f6480]">{section.text}</p>
                    </section>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex flex-col gap-3 border-t border-[#dbe5f2] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-[#5d6f89]">
                  {copy.lastUpdated}: {LEGAL_UPDATED_AT_LABEL}
                </span>
                <Button
                  type="button"
                  className="h-10 rounded-2xl bg-[#1f56a5] px-5 text-[14px] font-semibold text-[#111827] hover:bg-[#194788] hover:text-[#111827]"
                  onClick={() => setLegalModal(null)}
                >
                  {copy.close}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
