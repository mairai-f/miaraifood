import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Clock3, FileText, IdCard, Loader2, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getPublicErrorMessage, getRedactedLogValue } from '../../shared/security/redaction';

type HrTimeClockEntryType = 'entry' | 'break_start' | 'break_end' | 'exit' | 'manual_adjustment';
type HrTimeClockStatus = 'valid' | 'pending_approval' | 'adjusted' | 'canceled';
type HrLeaveType = 'vacation' | 'sick_leave' | 'absence' | 'maternity' | 'paternity' | 'bereavement' | 'other';
type HrLeaveStatus = 'requested' | 'approved' | 'rejected' | 'canceled';
type HrPayrollEventType = 'earning' | 'discount' | 'base' | 'info';

interface PortalEmployee {
  id: string;
  owner_user_id: string;
  employee_code: string | null;
  full_name: string;
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  department: string | null;
  position: string | null;
  address_zip_code: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  emergency_contact_phone: string | null;
}

interface TimeEntry {
  id: string;
  entry_type: HrTimeClockEntryType;
  occurred_at: string;
  source: string;
  status: HrTimeClockStatus;
  notes: string | null;
}

interface LeaveRequest {
  id: string;
  leave_type: HrLeaveType;
  start_date: string;
  end_date: string;
  status: HrLeaveStatus;
  reason: string | null;
  created_at: string;
}

interface EmployeeDocument {
  id: string;
  document_type: string;
  title: string;
  file_url: string | null;
  expires_at: string | null;
  sensitive: boolean;
  created_at: string;
}

interface PayrollItem {
  id: string;
  payroll_run_id: string;
  event_code: string;
  description: string;
  event_type: HrPayrollEventType;
  amount: number;
  quantity: number | null;
  created_at: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  published_at: string;
  expires_at: string | null;
}

const db = supabase;

const entryLabels: Record<HrTimeClockEntryType, string> = {
  entry: 'Entrada',
  break_start: 'Inicio intervalo',
  break_end: 'Fim intervalo',
  exit: 'Saida',
  manual_adjustment: 'Ajuste',
};

const timeStatusLabels: Record<HrTimeClockStatus, string> = {
  valid: 'Valido',
  pending_approval: 'Pendente',
  adjusted: 'Ajustado',
  canceled: 'Cancelado',
};

const leaveLabels: Record<HrLeaveType, string> = {
  vacation: 'Ferias',
  sick_leave: 'Atestado medico',
  absence: 'Falta',
  maternity: 'Licenca maternidade',
  paternity: 'Licenca paternidade',
  bereavement: 'Licenca luto',
  other: 'Outra ausencia',
};

const leaveStatusLabels: Record<HrLeaveStatus, string> = {
  requested: 'Solicitada',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  canceled: 'Cancelada',
};

const payrollEventLabels: Record<HrPayrollEventType, string> = {
  earning: 'Provento',
  discount: 'Desconto',
  base: 'Base',
  info: 'Informativo',
};

const normalizeName = (value: string | null | undefined) => value?.trim().replace(/\s+/g, ' ') ?? '';
const formatMoney = (value: number) => `R$ ${Number(value || 0).toFixed(2)}`;
const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};
const formatDateTime = (value: string) => new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
}).format(new Date(value));
const initials = (name: string) => {
  const parts = normalizeName(name).split(' ').filter(Boolean);
  return `${parts[0]?.[0] ?? 'H'}${parts[1]?.[0] ?? parts[0]?.[1] ?? 'C'}`.toUpperCase();
};

export default function EmployeePortal() {
  const { user, ownerUserId } = useAuth();
  const { hasPermission } = usePermissions();
  const [employee, setEmployee] = useState<PortalEmployee | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [payrollItems, setPayrollItems] = useState<PayrollItem[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    preferredName: '',
    email: '',
    phone: '',
    photoUrl: '',
    zipCode: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    emergencyPhone: '',
  });

  const canUseTimeClock = hasPermission('employee_portal.time_clock');
  const canUseLeave = hasPermission('employee_portal.leave');
  const canUseDocuments = hasPermission('employee_portal.documents');
  const canViewPayroll = hasPermission('employee_portal.payroll');
  const canViewAnnouncements = hasPermission('employee_portal.announcements');

  const loadPortal = useCallback(async () => {
    if (!user?.id || !ownerUserId) return;
    setLoading(true);

    try {
      const { data: employeeRow, error: employeeError } = await db
        .from('hr_employees')
        .select('id, owner_user_id, employee_code, full_name, preferred_name, email, phone, photo_url, department, position, address_zip_code, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, emergency_contact_phone')
        .eq('profile_user_id', user.id)
        .maybeSingle();

      if (employeeError) throw new Error(employeeError.message);

      const nextEmployee = employeeRow as PortalEmployee | null;
      setEmployee(nextEmployee);
      if (!nextEmployee) {
        setTimeEntries([]);
        setLeaveRequests([]);
        setDocuments([]);
        setPayrollItems([]);
        setAnnouncements([]);
        return;
      }

      setProfileForm({
        preferredName: nextEmployee.preferred_name ?? '',
        email: nextEmployee.email ?? '',
        phone: nextEmployee.phone ?? '',
        photoUrl: nextEmployee.photo_url ?? '',
        zipCode: nextEmployee.address_zip_code ?? '',
        street: nextEmployee.address_street ?? '',
        number: nextEmployee.address_number ?? '',
        complement: nextEmployee.address_complement ?? '',
        neighborhood: nextEmployee.address_neighborhood ?? '',
        city: nextEmployee.address_city ?? '',
        state: nextEmployee.address_state ?? '',
        emergencyPhone: nextEmployee.emergency_contact_phone ?? '',
      });

      const [timeResponse, leaveResponse, documentResponse, payrollResponse, announcementResponse] = await Promise.all([
        canUseTimeClock
          ? db.from('hr_time_clock_entries').select('id, entry_type, occurred_at, source, status, notes').eq('employee_id', nextEmployee.id).order('occurred_at', { ascending: false }).limit(30)
          : Promise.resolve({ data: [], error: null }),
        canUseLeave
          ? db.from('hr_leave_requests').select('id, leave_type, start_date, end_date, status, reason, created_at').eq('employee_id', nextEmployee.id).order('created_at', { ascending: false }).limit(30)
          : Promise.resolve({ data: [], error: null }),
        canUseDocuments
          ? db.from('hr_employee_documents').select('id, document_type, title, file_url, expires_at, sensitive, created_at').eq('employee_id', nextEmployee.id).order('created_at', { ascending: false }).limit(50)
          : Promise.resolve({ data: [], error: null }),
        canViewPayroll
          ? db.from('hr_payroll_items').select('id, payroll_run_id, event_code, description, event_type, amount, quantity, created_at').eq('employee_id', nextEmployee.id).order('created_at', { ascending: false }).limit(80)
          : Promise.resolve({ data: [], error: null }),
        canViewAnnouncements
          ? db.from('hr_announcements').select('id, title, body, published_at, expires_at').order('published_at', { ascending: false }).limit(20)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const error = timeResponse.error || leaveResponse.error || documentResponse.error || payrollResponse.error || announcementResponse.error;
      if (error) throw new Error(error.message);

      setTimeEntries((timeResponse.data ?? []) as TimeEntry[]);
      setLeaveRequests((leaveResponse.data ?? []) as LeaveRequest[]);
      setDocuments((documentResponse.data ?? []) as EmployeeDocument[]);
      setPayrollItems((payrollResponse.data ?? []) as PayrollItem[]);
      setAnnouncements((announcementResponse.data ?? []) as Announcement[]);
    } catch (error) {
      console.error('Nao foi possivel carregar o portal do funcionario:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel carregar o portal.'));
    } finally {
      setLoading(false);
    }
  }, [canUseDocuments, canUseLeave, canUseTimeClock, canViewAnnouncements, canViewPayroll, ownerUserId, user?.id]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  const payrollTotals = useMemo(() => {
    return payrollItems.reduce((totals, item) => {
      const amount = Number(item.amount || 0);
      if (item.event_type === 'earning') totals.earnings += amount;
      if (item.event_type === 'discount') totals.discounts += amount;
      return totals;
    }, { earnings: 0, discounts: 0 });
  }, [payrollItems]);

  const pendingLeaves = leaveRequests.filter((leave) => leave.status === 'requested').length;
  const pendingTimeEntries = timeEntries.filter((entry) => entry.status === 'pending_approval').length;

  const handleOpenDocument = async (document: EmployeeDocument) => {
    if (!document.file_url) {
      toast.info('Documento sem arquivo anexado.');
      return;
    }

    setSavingKey(`document-${document.id}`);
    try {
      const { data, error } = await supabase.storage.from('hr-documents').createSignedUrl(document.file_url, 300);
      if (error) throw new Error(error.message);
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Nao foi possivel abrir documento:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel abrir o documento.'));
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando portal...
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <Card>
        <CardContent className="flex items-start gap-3 py-8 text-sm text-muted-foreground">
          <AlertTriangle className="h-5 w-5 text-primary" />
          Seu usuario ainda nao esta vinculado a um cadastro de funcionario no RH.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-14 w-14 border border-border">
              <AvatarImage src={employee.photo_url ?? undefined} alt={employee.full_name} />
              <AvatarFallback>{initials(employee.full_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="page-title flex items-center gap-2">
                <IdCard className="h-6 w-6 text-primary" />
                Portal do Funcionário
              </h1>
              <p className="page-subtitle truncate">{employee.full_name} · {[employee.department, employee.position].filter(Boolean).join(' · ') || 'Cadastro funcional'}</p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={() => void loadPortal()}>
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PortalMetric title="Pontos pendentes" value={pendingTimeEntries} icon={<Clock3 className="h-5 w-5 text-primary" />} />
        <PortalMetric title="Solicitacoes abertas" value={pendingLeaves} icon={<CalendarDays className="h-5 w-5 text-primary" />} />
        <PortalMetric title="Documentos" value={documents.length} icon={<FileText className="h-5 w-5 text-primary" />} />
        <PortalMetric title="Eventos de folha" value={payrollItems.length} icon={<WalletCards className="h-5 w-5 text-primary" />} />
      </div>

      <Tabs defaultValue="dados" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          {canUseTimeClock ? <TabsTrigger value="ponto">Ponto</TabsTrigger> : null}
          {canUseLeave ? <TabsTrigger value="ferias">Ferias</TabsTrigger> : null}
          {canUseDocuments ? <TabsTrigger value="documentos">Documentos</TabsTrigger> : null}
          {canViewPayroll ? <TabsTrigger value="holerites">Holerites</TabsTrigger> : null}
          {canViewAnnouncements ? <TabsTrigger value="comunicados">Comunicados</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="dados">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados pessoais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Nome">
                  <Input value={employee.full_name} readOnly />
                </Field>
                <Field label="Nome social">
                  <Input value={profileForm.preferredName} readOnly />
                </Field>
                <Field label="Email">
                  <Input type="email" value={profileForm.email} readOnly />
                </Field>
                <Field label="Telefone">
                  <Input value={profileForm.phone} readOnly />
                </Field>
                <Field label="Foto">
                  <Input value={profileForm.photoUrl} readOnly />
                </Field>
                <Field label="CEP">
                  <Input value={profileForm.zipCode} readOnly />
                </Field>
                <Field label="Rua">
                  <Input value={profileForm.street} readOnly />
                </Field>
                <Field label="Numero">
                  <Input value={profileForm.number} readOnly />
                </Field>
                <Field label="Complemento">
                  <Input value={profileForm.complement} readOnly />
                </Field>
                <Field label="Bairro">
                  <Input value={profileForm.neighborhood} readOnly />
                </Field>
                <Field label="Cidade">
                  <Input value={profileForm.city} readOnly />
                </Field>
                <Field label="UF">
                  <Input value={profileForm.state} readOnly />
                </Field>
                <Field label="Telefone emergencia">
                  <Input value={profileForm.emergencyPhone} readOnly />
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {canUseTimeClock ? (
          <TabsContent value="ponto" className="space-y-4">
            <SimpleList empty="Nenhum ponto registrado.">
              {timeEntries.map((entry) => (
                <ListRow key={entry.id} title={entryLabels[entry.entry_type]} detail={`${formatDateTime(entry.occurred_at)} · ${entry.source}`}>
                  <Badge variant={entry.status === 'valid' ? 'secondary' : entry.status === 'canceled' ? 'destructive' : 'outline'}>{timeStatusLabels[entry.status]}</Badge>
                </ListRow>
              ))}
            </SimpleList>
          </TabsContent>
        ) : null}

        {canUseLeave ? (
          <TabsContent value="ferias" className="space-y-4">
            <SimpleList empty="Nenhuma solicitacao registrada.">
              {leaveRequests.map((leave) => (
                <ListRow key={leave.id} title={leaveLabels[leave.leave_type]} detail={`${formatDate(leave.start_date)} a ${formatDate(leave.end_date)} · ${leave.reason || '-'}`}>
                  <Badge variant={leave.status === 'approved' ? 'secondary' : leave.status === 'rejected' || leave.status === 'canceled' ? 'destructive' : 'outline'}>{leaveStatusLabels[leave.status]}</Badge>
                </ListRow>
              ))}
            </SimpleList>
          </TabsContent>
        ) : null}

        {canUseDocuments ? (
          <TabsContent value="documentos" className="space-y-4">
            <SimpleList empty="Nenhum documento encontrado.">
              {documents.map((document) => (
                <ListRow key={document.id} title={document.title} detail={`${document.document_type} · ${formatDate(document.created_at)}`}>
                  <Button type="button" variant="outline" size="sm" disabled={!document.file_url || savingKey === `document-${document.id}`} onClick={() => void handleOpenDocument(document)}>
                    Abrir
                  </Button>
                </ListRow>
              ))}
            </SimpleList>
          </TabsContent>
        ) : null}

        {canViewPayroll ? (
          <TabsContent value="holerites" className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <PortalMetric title="Proventos" value={formatMoney(payrollTotals.earnings)} icon={<WalletCards className="h-5 w-5 text-primary" />} />
              <PortalMetric title="Descontos" value={formatMoney(payrollTotals.discounts)} icon={<WalletCards className="h-5 w-5 text-primary" />} />
              <PortalMetric title="Liquido estimado" value={formatMoney(payrollTotals.earnings - payrollTotals.discounts)} icon={<WalletCards className="h-5 w-5 text-primary" />} />
            </div>
            <SimpleList empty="Nenhum evento de folha disponivel.">
              {payrollItems.map((item) => (
                <ListRow key={item.id} title={`${item.event_code} · ${item.description}`} detail={`${payrollEventLabels[item.event_type]} · ${formatDateTime(item.created_at)}`}>
                  <span className={item.event_type === 'discount' ? 'font-semibold text-destructive' : 'font-semibold'}>
                    {item.event_type === 'discount' ? '-' : ''}{formatMoney(item.amount)}
                  </span>
                </ListRow>
              ))}
            </SimpleList>
          </TabsContent>
        ) : null}

        {canViewAnnouncements ? (
          <TabsContent value="comunicados">
            <SimpleList empty="Nenhum comunicado ativo.">
              {announcements.map((announcement) => (
                <ListRow key={announcement.id} title={announcement.title} detail={announcement.body}>
                  <span className="text-sm text-muted-foreground">{formatDate(announcement.published_at)}</span>
                </ListRow>
              ))}
            </SimpleList>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function PortalMetric({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card className="cursor-default">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}

function SimpleList({ empty, children }: { empty: string; children: React.ReactNode }) {
  const count = Array.isArray(children) ? children.filter(Boolean).length : children ? 1 : 0;
  return (
    <Card>
      <CardContent className="p-0">
        {count === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="divide-y">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

function ListRow({ title, detail, children }: { title: string; detail: string; children?: React.ReactNode }) {
  return (
    <div className="grid gap-2 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
      {children ? <div className="flex flex-wrap gap-2 md:justify-end">{children}</div> : null}
    </div>
  );
}
