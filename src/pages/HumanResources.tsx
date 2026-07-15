import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { BriefcaseBusiness, CalendarDays, Clock3, FileCheck2, Loader2, ShieldCheck, UsersRound, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { getPublicErrorMessage, getRedactedLogValue } from '../../shared/security/redaction';

type HrEmployeeStatus = 'active' | 'inactive' | 'terminated' | 'on_leave';

interface HrEmployee {
  id: string;
  full_name: string;
  preferred_name: string | null;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  status: HrEmployeeStatus;
  employment_type: string;
  admission_date: string | null;
  termination_date: string | null;
  department: string | null;
  position: string | null;
  notes: string | null;
}

interface HrTimeClockEntry {
  id: string;
  employee_id: string;
  entry_type: string;
  occurred_at: string;
  status: string;
  notes: string | null;
}

interface HrLeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  reason: string | null;
}

interface HrPayrollRun {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  gross_total: number;
  net_total: number;
}

const db = supabase as unknown as {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (column: string, options?: { ascending?: boolean }) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
        limit: (count: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      };
    };
    insert: (rows: Record<string, unknown>[]) => {
      select: (columns: string) => {
        single: () => Promise<{ data: unknown | null; error: { message: string } | null }>;
      };
    };
  };
};

const statusLabels: Record<HrEmployeeStatus, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  terminated: 'Desligado',
  on_leave: 'Afastado',
};

const payrollStatusLabels: Record<string, string> = {
  draft: 'Rascunho',
  closed: 'Fechada',
  exported: 'Exportada',
  canceled: 'Cancelada',
};

const employeeInitialForm = {
  fullName: '',
  preferredName: '',
  cpf: '',
  email: '',
  phone: '',
  department: '',
  position: '',
  admissionDate: '',
  notes: '',
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const formatDateTime = (value: string) => new Date(value).toLocaleString('pt-BR');
const formatMoney = (value: number) => `R$ ${Number(value || 0).toFixed(2)}`;

export default function HumanResources() {
  const { ownerUserId, user, role } = useAuth();
  const { hasPermission } = usePermissions();
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [timeEntries, setTimeEntries] = useState<HrTimeClockEntry[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<HrLeaveRequest[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<HrPayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [employeeForm, setEmployeeForm] = useState(employeeInitialForm);

  const canManageEmployees = hasPermission('hr.employees.manage');
  const canManageTimeClock = hasPermission('hr.time_clock.manage');
  const canManageSchedules = hasPermission('hr.schedules.manage');
  const canManageDocuments = hasPermission('hr.documents.manage');
  const canManagePayroll = hasPermission('hr.payroll.manage');

  const employeeById = useMemo(() => {
    return new Map(employees.map((employee) => [employee.id, employee]));
  }, [employees]);

  const activeEmployees = employees.filter((employee) => employee.status === 'active').length;
  const pendingTimeEntries = timeEntries.filter((entry) => entry.status === 'pending_approval').length;
  const pendingLeaves = leaveRequests.filter((request) => request.status === 'requested').length;
  const openPayroll = payrollRuns.filter((run) => run.status === 'draft').length;

  const loadHrData = useCallback(async () => {
    if (!ownerUserId) {
      setEmployees([]);
      setTimeEntries([]);
      setLeaveRequests([]);
      setPayrollRuns([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [employeesResponse, timeResponse, leavesResponse, payrollResponse] = await Promise.all([
        db.from('hr_employees')
          .select('id, full_name, preferred_name, cpf, email, phone, status, employment_type, admission_date, termination_date, department, position, notes')
          .eq('owner_user_id', ownerUserId)
          .order('full_name', { ascending: true }),
        db.from('hr_time_clock_entries')
          .select('id, employee_id, entry_type, occurred_at, status, notes')
          .eq('owner_user_id', ownerUserId)
          .order('occurred_at', { ascending: false }),
        db.from('hr_leave_requests')
          .select('id, employee_id, leave_type, start_date, end_date, status, reason')
          .eq('owner_user_id', ownerUserId)
          .order('start_date', { ascending: false }),
        db.from('hr_payroll_runs')
          .select('id, period_start, period_end, status, gross_total, net_total')
          .eq('owner_user_id', ownerUserId)
          .order('period_start', { ascending: false }),
      ]);

      const error = employeesResponse.error || timeResponse.error || leavesResponse.error || payrollResponse.error;
      if (error) throw new Error(error.message);

      setEmployees((employeesResponse.data ?? []) as HrEmployee[]);
      setTimeEntries((timeResponse.data ?? []) as HrTimeClockEntry[]);
      setLeaveRequests((leavesResponse.data ?? []) as HrLeaveRequest[]);
      setPayrollRuns((payrollResponse.data ?? []) as HrPayrollRun[]);
    } catch (error) {
      console.error('Nao foi possivel carregar o RH:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel carregar o RH.'));
    } finally {
      setLoading(false);
    }
  }, [ownerUserId]);

  useEffect(() => {
    void loadHrData();
  }, [loadHrData]);

  const handleCreateEmployee = async (event: FormEvent) => {
    event.preventDefault();
    if (!ownerUserId || !user?.id) return;

    const fullName = employeeForm.fullName.trim().replace(/\s+/g, ' ');
    if (fullName.length < 3) {
      toast.error('Informe o nome completo do colaborador.');
      return;
    }

    setSavingEmployee(true);

    try {
      const { error } = await db.from('hr_employees').insert([{
        owner_user_id: ownerUserId,
        full_name: fullName,
        preferred_name: employeeForm.preferredName.trim() || null,
        cpf: employeeForm.cpf.trim() || null,
        email: employeeForm.email.trim().toLowerCase() || null,
        phone: employeeForm.phone.trim() || null,
        department: employeeForm.department.trim() || null,
        position: employeeForm.position.trim() || null,
        admission_date: employeeForm.admissionDate || null,
        notes: employeeForm.notes.trim() || null,
        status: 'active',
        employment_type: 'clt',
        created_by: user.id,
        updated_by: user.id,
      }]).select('id').single();

      if (error) throw new Error(error.message);

      toast.success('Colaborador cadastrado no RH.');
      setEmployeeForm(employeeInitialForm);
      await loadHrData();
    } catch (error) {
      console.error('Nao foi possivel cadastrar colaborador no RH:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel cadastrar o colaborador.'));
    } finally {
      setSavingEmployee(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando RH...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-3">
          <BriefcaseBusiness className="h-6 w-6 text-primary" />
          HappyCash RH
        </h1>
        <p className="page-subtitle">
          {role === 'hr' ? 'Area exclusiva da equipe de RH.' : 'Gestao de pessoas, ponto, escalas e folha.'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-xs text-muted-foreground">Colaboradores ativos</p>
              <p className="text-2xl font-bold">{activeEmployees}</p>
            </div>
            <UsersRound className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-xs text-muted-foreground">Ponto pendente</p>
              <p className="text-2xl font-bold">{pendingTimeEntries}</p>
            </div>
            <Clock3 className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-xs text-muted-foreground">Solicitacoes</p>
              <p className="text-2xl font-bold">{pendingLeaves}</p>
            </div>
            <CalendarDays className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-xs text-muted-foreground">Folhas abertas</p>
              <p className="text-2xl font-bold">{openPayroll}</p>
            </div>
            <WalletCards className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="colaboradores" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
          <TabsTrigger value="ponto">Ponto</TabsTrigger>
          <TabsTrigger value="escalas">Escalas</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="folha">Folha</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="colaboradores" className="space-y-4">
          {canManageEmployees && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cadastrar colaborador</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleCreateEmployee}>
                  <div className="space-y-1.5 xl:col-span-2">
                    <Label>Nome completo</Label>
                    <Input value={employeeForm.fullName} onChange={(event) => setEmployeeForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Nome do colaborador" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nome social</Label>
                    <Input value={employeeForm.preferredName} onChange={(event) => setEmployeeForm((current) => ({ ...current, preferredName: event.target.value }))} placeholder="Opcional" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CPF</Label>
                    <Input value={employeeForm.cpf} onChange={(event) => setEmployeeForm((current) => ({ ...current, cpf: event.target.value }))} placeholder="000.000.000-00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={employeeForm.email} onChange={(event) => setEmployeeForm((current) => ({ ...current, email: event.target.value }))} placeholder="email@empresa.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input value={employeeForm.phone} onChange={(event) => setEmployeeForm((current) => ({ ...current, phone: event.target.value }))} placeholder="(00) 00000-0000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Departamento</Label>
                    <Input value={employeeForm.department} onChange={(event) => setEmployeeForm((current) => ({ ...current, department: event.target.value }))} placeholder="Ex: Operacao" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cargo</Label>
                    <Input value={employeeForm.position} onChange={(event) => setEmployeeForm((current) => ({ ...current, position: event.target.value }))} placeholder="Ex: Caixa" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Admissao</Label>
                    <Input type="date" value={employeeForm.admissionDate} onChange={(event) => setEmployeeForm((current) => ({ ...current, admissionDate: event.target.value }))} />
                  </div>
                  <div className="space-y-1.5 md:col-span-2 xl:col-span-4">
                    <Label>Observacoes</Label>
                    <Textarea value={employeeForm.notes} onChange={(event) => setEmployeeForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Contrato, jornada, exames, beneficios ou observacoes internas." />
                  </div>
                  <div className="md:col-span-2 xl:col-span-4">
                    <Button type="submit" disabled={savingEmployee}>
                      {savingEmployee ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Cadastrar no RH
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Equipe RH</CardTitle>
            </CardHeader>
            <CardContent>
              {employees.length === 0 ? (
                <p className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">Nenhum colaborador cadastrado no RH.</p>
              ) : (
                <div className="divide-y rounded-lg border border-border/70">
                  {employees.map((employee) => (
                    <div key={employee.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold">{employee.full_name}</p>
                          <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>{statusLabels[employee.status]}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {[employee.position, employee.department, employee.email].filter(Boolean).join(' · ') || 'Sem cargo definido'}
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground md:text-right">
                        <p>Admissao: {formatDate(employee.admission_date)}</p>
                        <p>{employee.phone || employee.cpf || '-'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ponto" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock3 className="h-4 w-4 text-primary" />
                Marcacoes e ajustes
              </CardTitle>
              <Badge variant="outline">{canManageTimeClock ? 'Gerencia ponto' : 'Somente leitura'}</Badge>
            </CardHeader>
            <CardContent>
              {timeEntries.length === 0 ? (
                <p className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">Nenhuma marcacao registrada.</p>
              ) : (
                <div className="divide-y rounded-lg border border-border/70">
                  {timeEntries.slice(0, 12).map((entry) => {
                    const employee = employeeById.get(entry.employee_id);
                    return (
                      <div key={entry.id} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <div>
                          <p className="font-medium">{employee?.full_name || 'Colaborador'}</p>
                          <p className="text-sm text-muted-foreground">{entry.entry_type} · {entry.notes || 'Sem observacao'}</p>
                        </div>
                        <div className="text-sm text-muted-foreground sm:text-right">
                          <p>{formatDateTime(entry.occurred_at)}</p>
                          <Badge variant={entry.status === 'valid' ? 'secondary' : 'outline'}>{entry.status}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="escalas">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-primary" />
                Escalas e jornadas
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border/70 p-4">
                <p className="font-semibold">Jornada semanal</p>
                <p className="mt-1 text-sm text-muted-foreground">Turnos por dia, intervalo, tolerancia e folgas.</p>
              </div>
              <div className="rounded-lg border border-border/70 p-4">
                <p className="font-semibold">Banco de horas</p>
                <p className="mt-1 text-sm text-muted-foreground">Saldo por periodo, ajustes e aprovacao.</p>
              </div>
              <div className="rounded-lg border border-border/70 p-4">
                <p className="font-semibold">Permissao</p>
                <p className="mt-1 text-sm text-muted-foreground">{canManageSchedules ? 'Usuario pode gerenciar escalas.' : 'Usuario sem edicao de escalas.'}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileCheck2 className="h-4 w-4 text-primary" />
                Documentos trabalhistas
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {['Contrato', 'ASO / exames', 'Ferias e recibos'].map((item) => (
                <div key={item} className="rounded-lg border border-border/70 p-4">
                  <p className="font-semibold">{item}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{canManageDocuments ? 'Disponivel para controle e vencimento.' : 'Sem permissao para gerenciar documentos.'}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="folha" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <WalletCards className="h-4 w-4 text-primary" />
                Fechamentos de folha
              </CardTitle>
              <Badge variant="outline">{canManagePayroll ? 'Gerencia folha' : 'Somente leitura'}</Badge>
            </CardHeader>
            <CardContent>
              {payrollRuns.length === 0 ? (
                <p className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">Nenhum fechamento de folha criado.</p>
              ) : (
                <div className="divide-y rounded-lg border border-border/70">
                  {payrollRuns.map((run) => (
                    <div key={run.id} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div>
                        <p className="font-medium">{formatDate(run.period_start)} a {formatDate(run.period_end)}</p>
                        <p className="text-sm text-muted-foreground">Bruto {formatMoney(run.gross_total)} · Liquido {formatMoney(run.net_total)}</p>
                      </div>
                      <Badge variant={run.status === 'draft' ? 'outline' : 'secondary'}>{payrollStatusLabels[run.status] ?? run.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Auditoria de RH
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                Alteracoes sensiveis de colaborador, folha, ponto e documentos ficam preparadas para trilha auditavel.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
