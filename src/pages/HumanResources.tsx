import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  UsersRound,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { getPublicErrorMessage, getRedactedLogValue } from '../../shared/security/redaction';

type HrEmployeeStatus = 'active' | 'inactive' | 'terminated' | 'on_leave';
type HrEmploymentType = 'clt' | 'pj' | 'intern' | 'temporary' | 'third_party' | 'other';
type HrTimeClockEntryType = 'entry' | 'break_start' | 'break_end' | 'exit' | 'manual_adjustment';
type HrTimeClockStatus = 'valid' | 'pending_approval' | 'adjusted' | 'canceled';
type HrLeaveType = 'vacation' | 'sick_leave' | 'absence' | 'maternity' | 'paternity' | 'bereavement' | 'other';
type HrLeaveStatus = 'requested' | 'approved' | 'rejected' | 'canceled';
type HrPayrollStatus = 'draft' | 'closed' | 'exported' | 'canceled';
type HrPayrollEventType = 'earning' | 'discount' | 'base' | 'info';

interface HrEmployee {
  id: string;
  employee_code: string | null;
  full_name: string;
  preferred_name: string | null;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  status: HrEmployeeStatus;
  employment_type: HrEmploymentType;
  admission_date: string | null;
  termination_date: string | null;
  department: string | null;
  position: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface HrEmployeeDocument {
  id: string;
  employee_id: string;
  document_type: string;
  title: string;
  file_url: string | null;
  expires_at: string | null;
  sensitive: boolean;
  created_at: string;
}

interface HrWorkSchedule {
  id: string;
  name: string;
  description: string | null;
  timezone: string;
  weekly_rules: {
    days?: number[];
    start_time?: string;
    end_time?: string;
    break_minutes?: number;
  } | null;
  tolerance_minutes: number;
  active: boolean;
  created_at: string;
}

interface HrScheduleAssignment {
  id: string;
  employee_id: string;
  schedule_id: string;
  starts_on: string;
  ends_on: string | null;
  created_at: string;
}

interface HrTimeClockEntry {
  id: string;
  employee_id: string;
  entry_type: HrTimeClockEntryType;
  occurred_at: string;
  source: string;
  status: HrTimeClockStatus;
  schedule_id: string | null;
  notes: string | null;
  created_at: string;
}

interface HrLeaveRequest {
  id: string;
  employee_id: string;
  leave_type: HrLeaveType;
  start_date: string;
  end_date: string;
  status: HrLeaveStatus;
  reason: string | null;
  approved_by: string | null;
  created_at: string;
}

interface HrPayrollRun {
  id: string;
  period_start: string;
  period_end: string;
  status: HrPayrollStatus;
  gross_total: number;
  net_total: number;
  closed_at: string | null;
  created_at: string;
}

interface HrPayrollItem {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  event_code: string;
  description: string;
  event_type: HrPayrollEventType;
  amount: number;
  quantity: number | null;
  created_at: string;
}

interface HrAuditEvent {
  id: string;
  employee_id: string | null;
  event_type: string;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface HrComplianceRule {
  id: string;
  code: string;
  category: string;
  title: string;
  requirement_summary: string;
  source_name: string;
  source_url: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  active: boolean;
}

type EmployeeFormState = {
  employeeCode: string;
  fullName: string;
  preferredName: string;
  cpf: string;
  email: string;
  phone: string;
  status: HrEmployeeStatus;
  employmentType: HrEmploymentType;
  department: string;
  position: string;
  admissionDate: string;
  terminationDate: string;
  notes: string;
};

type ScheduleFormState = {
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  toleranceMinutes: string;
  weekdays: number[];
};

type DbRow = {
  id?: string;
  [key: string]: unknown;
};

type DbResponse<T = DbRow[]> = {
  data: T | null;
  error: { message: string } | null;
};

type DbQuery<T = DbRow[]> = PromiseLike<DbResponse<T>> & {
  select: (columns?: string) => DbQuery<T>;
  eq: (column: string, value: unknown) => DbQuery<T>;
  order: (column: string, options?: { ascending?: boolean }) => DbQuery<T>;
  limit: (count: number) => DbQuery<T>;
  insert: (values: unknown) => DbQuery<T>;
  update: (values: unknown) => DbQuery<T>;
  delete: () => DbQuery<T>;
  single: () => Promise<DbResponse<DbRow>>;
};

type LooseSupabaseClient = {
  from: (table: string) => DbQuery;
};

const db = supabase as unknown as LooseSupabaseClient;

const employeeInitialForm: EmployeeFormState = {
  employeeCode: '',
  fullName: '',
  preferredName: '',
  cpf: '',
  email: '',
  phone: '',
  status: 'active',
  employmentType: 'clt',
  department: '',
  position: '',
  admissionDate: '',
  terminationDate: '',
  notes: '',
};

const scheduleInitialForm: ScheduleFormState = {
  name: '',
  description: '',
  startTime: '08:00',
  endTime: '17:00',
  breakMinutes: '60',
  toleranceMinutes: '10',
  weekdays: [1, 2, 3, 4, 5],
};

const statusLabels: Record<HrEmployeeStatus, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  terminated: 'Desligado',
  on_leave: 'Afastado',
};

const employmentTypeLabels: Record<HrEmploymentType, string> = {
  clt: 'CLT',
  pj: 'PJ',
  intern: 'Estagio',
  temporary: 'Temporario',
  third_party: 'Terceiro',
  other: 'Outro',
};

const timeClockEntryLabels: Record<HrTimeClockEntryType, string> = {
  entry: 'Entrada',
  break_start: 'Inicio intervalo',
  break_end: 'Fim intervalo',
  exit: 'Saida',
  manual_adjustment: 'Ajuste manual',
};

const timeClockStatusLabels: Record<HrTimeClockStatus, string> = {
  valid: 'Valido',
  pending_approval: 'Pendente',
  adjusted: 'Ajustado',
  canceled: 'Cancelado',
};

const leaveTypeLabels: Record<HrLeaveType, string> = {
  vacation: 'Ferias',
  sick_leave: 'Atestado',
  absence: 'Ausencia',
  maternity: 'Maternidade',
  paternity: 'Paternidade',
  bereavement: 'Luto',
  other: 'Outro',
};

const leaveStatusLabels: Record<HrLeaveStatus, string> = {
  requested: 'Solicitado',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  canceled: 'Cancelado',
};

const payrollStatusLabels: Record<HrPayrollStatus, string> = {
  draft: 'Rascunho',
  closed: 'Fechada',
  exported: 'Exportada',
  canceled: 'Cancelada',
};

const payrollEventTypeLabels: Record<HrPayrollEventType, string> = {
  earning: 'Provento',
  discount: 'Desconto',
  base: 'Base',
  info: 'Informativo',
};

const weekdayOptions = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sab' },
];

const complianceSeverityLabels: Record<HrComplianceRule['severity'], string> = {
  low: 'Baixo',
  medium: 'Medio',
  high: 'Alto',
  critical: 'Critico',
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
};

const formatMoney = (value: number | null | undefined) => `R$ ${Number(value || 0).toFixed(2)}`;

const emptyToNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ');

const toLocalDateTimeInputValue = (date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const safeFileName = (value: string) => {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return normalized.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 100) || 'documento';
};

const asNumber = (value: string, fallback = 0) => {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const csvEscape = (value: unknown) => {
  const text = String(value ?? '');
  if (!/[",\n;]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
};

const downloadCsv = (filename: string, headers: string[], rows: unknown[][]) => {
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(';')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export default function HumanResources() {
  const { ownerUserId, user, role } = useAuth();
  const { hasPermission } = usePermissions();

  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [documents, setDocuments] = useState<HrEmployeeDocument[]>([]);
  const [workSchedules, setWorkSchedules] = useState<HrWorkSchedule[]>([]);
  const [scheduleAssignments, setScheduleAssignments] = useState<HrScheduleAssignment[]>([]);
  const [timeEntries, setTimeEntries] = useState<HrTimeClockEntry[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<HrLeaveRequest[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<HrPayrollRun[]>([]);
  const [payrollItems, setPayrollItems] = useState<HrPayrollItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<HrAuditEvent[]>([]);
  const [complianceRules, setComplianceRules] = useState<HrComplianceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormState>(employeeInitialForm);
  const [timeClockForm, setTimeClockForm] = useState({
    employeeId: '',
    entryType: 'entry' as HrTimeClockEntryType,
    occurredAt: toLocalDateTimeInputValue(),
    status: 'valid' as HrTimeClockStatus,
    notes: '',
  });
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(scheduleInitialForm);
  const [assignmentForm, setAssignmentForm] = useState({
    employeeId: '',
    scheduleId: '',
    startsOn: new Date().toISOString().slice(0, 10),
    endsOn: '',
  });
  const [documentForm, setDocumentForm] = useState({
    employeeId: '',
    documentType: 'contrato',
    title: '',
    expiresAt: '',
    sensitive: 'true',
  });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [leaveForm, setLeaveForm] = useState({
    employeeId: '',
    leaveType: 'vacation' as HrLeaveType,
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [payrollRunForm, setPayrollRunForm] = useState({
    periodStart: '',
    periodEnd: '',
  });
  const [payrollItemForm, setPayrollItemForm] = useState({
    payrollRunId: '',
    employeeId: '',
    eventCode: '',
    description: '',
    eventType: 'earning' as HrPayrollEventType,
    amount: '',
    quantity: '',
  });
  const [documentToDelete, setDocumentToDelete] = useState<HrEmployeeDocument | null>(null);

  const canManageEmployees = hasPermission('hr.employees.manage');
  const canManageTimeClock = hasPermission('hr.time_clock.manage');
  const canManageSchedules = hasPermission('hr.schedules.manage');
  const canManageDocuments = hasPermission('hr.documents.manage');
  const canManageLeave = hasPermission('hr.leave.manage');
  const canManagePayroll = hasPermission('hr.payroll.manage');
  const canExportHr = hasPermission('hr.exports.manage');
  const canViewAudit = hasPermission('hr.audit.view');

  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const scheduleById = useMemo(() => new Map(workSchedules.map((schedule) => [schedule.id, schedule])), [workSchedules]);

  const activeEmployees = employees.filter((employee) => employee.status === 'active').length;
  const pendingTimeEntries = timeEntries.filter((entry) => entry.status === 'pending_approval').length;
  const pendingLeaves = leaveRequests.filter((request) => request.status === 'requested').length;
  const openPayroll = payrollRuns.filter((run) => run.status === 'draft').length;
  const expiringDocuments = documents.filter((document) => {
    if (!document.expires_at) return false;
    const expiresAt = new Date(`${document.expires_at}T00:00:00`);
    const diffDays = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diffDays <= 30;
  }).length;

  const payrollItemsByRun = useMemo(() => {
    const grouped = new Map<string, HrPayrollItem[]>();
    payrollItems.forEach((item) => {
      const current = grouped.get(item.payroll_run_id) ?? [];
      current.push(item);
      grouped.set(item.payroll_run_id, current);
    });
    return grouped;
  }, [payrollItems]);

  const findScheduleForEmployee = useCallback((employeeId: string, dateValue: string) => {
    const day = dateValue.slice(0, 10);
    const assignment = scheduleAssignments
      .filter((item) => item.employee_id === employeeId && item.starts_on <= day && (!item.ends_on || item.ends_on >= day))
      .sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0];
    return assignment?.schedule_id ?? null;
  }, [scheduleAssignments]);

  const writeAuditEvent = useCallback(async (
    eventType: string,
    description: string,
    employeeId?: string | null,
    metadata: Record<string, unknown> = {},
  ) => {
    if (!ownerUserId || !user?.id) return;

    const { error } = await db.from('hr_audit_events').insert([{
      owner_user_id: ownerUserId,
      actor_user_id: user.id,
      employee_id: employeeId || null,
      event_type: eventType,
      description,
      metadata,
    }]);

    if (error) {
      console.warn('Nao foi possivel gravar auditoria de RH:', getRedactedLogValue(error));
    }
  }, [ownerUserId, user?.id]);

  const loadHrData = useCallback(async () => {
    if (!ownerUserId) {
      setEmployees([]);
      setDocuments([]);
      setWorkSchedules([]);
      setScheduleAssignments([]);
      setTimeEntries([]);
      setLeaveRequests([]);
      setPayrollRuns([]);
      setPayrollItems([]);
      setAuditEvents([]);
      setComplianceRules([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [
        employeesResponse,
        documentsResponse,
        schedulesResponse,
        assignmentsResponse,
        timeResponse,
        leavesResponse,
        payrollRunsResponse,
        payrollItemsResponse,
        auditResponse,
        complianceResponse,
      ] = await Promise.all([
        db.from('hr_employees')
          .select('id, employee_code, full_name, preferred_name, cpf, email, phone, status, employment_type, admission_date, termination_date, department, position, notes, created_at, updated_at')
          .eq('owner_user_id', ownerUserId)
          .order('full_name', { ascending: true }),
        db.from('hr_employee_documents')
          .select('id, employee_id, document_type, title, file_url, expires_at, sensitive, created_at')
          .eq('owner_user_id', ownerUserId)
          .order('created_at', { ascending: false }),
        db.from('hr_work_schedules')
          .select('id, name, description, timezone, weekly_rules, tolerance_minutes, active, created_at')
          .eq('owner_user_id', ownerUserId)
          .order('name', { ascending: true }),
        db.from('hr_employee_schedule_assignments')
          .select('id, employee_id, schedule_id, starts_on, ends_on, created_at')
          .eq('owner_user_id', ownerUserId)
          .order('starts_on', { ascending: false }),
        db.from('hr_time_clock_entries')
          .select('id, employee_id, entry_type, occurred_at, source, status, schedule_id, notes, created_at')
          .eq('owner_user_id', ownerUserId)
          .order('occurred_at', { ascending: false })
          .limit(120),
        db.from('hr_leave_requests')
          .select('id, employee_id, leave_type, start_date, end_date, status, reason, approved_by, created_at')
          .eq('owner_user_id', ownerUserId)
          .order('start_date', { ascending: false }),
        db.from('hr_payroll_runs')
          .select('id, period_start, period_end, status, gross_total, net_total, closed_at, created_at')
          .eq('owner_user_id', ownerUserId)
          .order('period_start', { ascending: false }),
        db.from('hr_payroll_items')
          .select('id, payroll_run_id, employee_id, event_code, description, event_type, amount, quantity, created_at')
          .eq('owner_user_id', ownerUserId)
          .order('created_at', { ascending: false })
          .limit(300),
        db.from('hr_audit_events')
          .select('id, employee_id, event_type, description, metadata, created_at')
          .eq('owner_user_id', ownerUserId)
          .order('created_at', { ascending: false })
          .limit(100),
        db.from('hr_compliance_rules')
          .select('id, code, category, title, requirement_summary, source_name, source_url, severity, active')
          .eq('active', true)
          .order('severity', { ascending: true }),
      ]);

      const error = employeesResponse.error
        || documentsResponse.error
        || schedulesResponse.error
        || assignmentsResponse.error
        || timeResponse.error
        || leavesResponse.error
        || payrollRunsResponse.error
        || payrollItemsResponse.error
        || auditResponse.error
        || complianceResponse.error;

      if (error) throw new Error(error.message);

      setEmployees((employeesResponse.data ?? []) as HrEmployee[]);
      setDocuments((documentsResponse.data ?? []) as HrEmployeeDocument[]);
      setWorkSchedules((schedulesResponse.data ?? []) as HrWorkSchedule[]);
      setScheduleAssignments((assignmentsResponse.data ?? []) as HrScheduleAssignment[]);
      setTimeEntries((timeResponse.data ?? []) as HrTimeClockEntry[]);
      setLeaveRequests((leavesResponse.data ?? []) as HrLeaveRequest[]);
      setPayrollRuns((payrollRunsResponse.data ?? []) as HrPayrollRun[]);
      setPayrollItems((payrollItemsResponse.data ?? []) as HrPayrollItem[]);
      setAuditEvents((auditResponse.data ?? []) as HrAuditEvent[]);
      setComplianceRules((complianceResponse.data ?? []) as HrComplianceRule[]);
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

  useEffect(() => {
    if (!timeClockForm.employeeId && employees[0]) {
      setTimeClockForm((current) => ({ ...current, employeeId: employees[0].id }));
    }
    if (!assignmentForm.employeeId && employees[0]) {
      setAssignmentForm((current) => ({ ...current, employeeId: employees[0].id }));
    }
    if (!documentForm.employeeId && employees[0]) {
      setDocumentForm((current) => ({ ...current, employeeId: employees[0].id }));
    }
    if (!leaveForm.employeeId && employees[0]) {
      setLeaveForm((current) => ({ ...current, employeeId: employees[0].id }));
    }
    if (!payrollItemForm.employeeId && employees[0]) {
      setPayrollItemForm((current) => ({ ...current, employeeId: employees[0].id }));
    }
  }, [assignmentForm.employeeId, documentForm.employeeId, employees, leaveForm.employeeId, payrollItemForm.employeeId, timeClockForm.employeeId]);

  useEffect(() => {
    if (!assignmentForm.scheduleId && workSchedules[0]) {
      setAssignmentForm((current) => ({ ...current, scheduleId: workSchedules[0].id }));
    }
    if (!payrollItemForm.payrollRunId && payrollRuns[0]) {
      setPayrollItemForm((current) => ({ ...current, payrollRunId: payrollRuns[0].id }));
    }
  }, [assignmentForm.scheduleId, payrollItemForm.payrollRunId, payrollRuns, workSchedules]);

  const resetEmployeeForm = () => {
    setEditingEmployeeId(null);
    setEmployeeForm(employeeInitialForm);
  };

  const handleEditEmployee = (employee: HrEmployee) => {
    setEditingEmployeeId(employee.id);
    setEmployeeForm({
      employeeCode: employee.employee_code ?? '',
      fullName: employee.full_name,
      preferredName: employee.preferred_name ?? '',
      cpf: employee.cpf ?? '',
      email: employee.email ?? '',
      phone: employee.phone ?? '',
      status: employee.status,
      employmentType: employee.employment_type,
      department: employee.department ?? '',
      position: employee.position ?? '',
      admissionDate: employee.admission_date ?? '',
      terminationDate: employee.termination_date ?? '',
      notes: employee.notes ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveEmployee = async (event: FormEvent) => {
    event.preventDefault();
    if (!ownerUserId || !user?.id) return;

    const fullName = normalizeName(employeeForm.fullName);
    if (fullName.length < 3) {
      toast.error('Informe o nome completo do colaborador.');
      return;
    }

    setSavingKey('employee');

    try {
      const payload = {
        owner_user_id: ownerUserId,
        employee_code: emptyToNull(employeeForm.employeeCode),
        full_name: fullName,
        preferred_name: emptyToNull(employeeForm.preferredName),
        cpf: emptyToNull(employeeForm.cpf),
        email: emptyToNull(employeeForm.email.toLowerCase()),
        phone: emptyToNull(employeeForm.phone),
        status: employeeForm.status,
        employment_type: employeeForm.employmentType,
        department: emptyToNull(employeeForm.department),
        position: emptyToNull(employeeForm.position),
        admission_date: employeeForm.admissionDate || null,
        termination_date: employeeForm.status === 'terminated' ? employeeForm.terminationDate || new Date().toISOString().slice(0, 10) : employeeForm.terminationDate || null,
        notes: emptyToNull(employeeForm.notes),
        updated_by: user.id,
      };

      if (editingEmployeeId) {
        const { error } = await db.from('hr_employees')
          .update(payload)
          .eq('id', editingEmployeeId)
          .select('id')
          .single();
        if (error) throw new Error(error.message);
        await writeAuditEvent('employee.updated', `Colaborador atualizado: ${fullName}`, editingEmployeeId, { status: employeeForm.status });
        toast.success('Colaborador atualizado.');
      } else {
        const { data, error } = await db.from('hr_employees').insert([{
          ...payload,
          created_by: user.id,
        }]).select('id').single();
        if (error) throw new Error(error.message);
        await writeAuditEvent('employee.created', `Colaborador cadastrado: ${fullName}`, data?.id, { employment_type: employeeForm.employmentType });
        toast.success('Colaborador cadastrado no RH.');
      }

      resetEmployeeForm();
      await loadHrData();
    } catch (error) {
      console.error('Nao foi possivel salvar colaborador no RH:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel salvar o colaborador.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleRegisterTimeEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!ownerUserId || !user?.id) return;
    if (!timeClockForm.employeeId) {
      toast.error('Selecione o colaborador do ponto.');
      return;
    }

    setSavingKey('time');

    try {
      const isoDate = new Date(timeClockForm.occurredAt).toISOString();
      const scheduleId = findScheduleForEmployee(timeClockForm.employeeId, isoDate);
      const { error } = await db.from('hr_time_clock_entries').insert([{
        owner_user_id: ownerUserId,
        employee_id: timeClockForm.employeeId,
        entry_type: timeClockForm.entryType,
        occurred_at: isoDate,
        source: 'manual',
        status: timeClockForm.status,
        schedule_id: scheduleId,
        notes: emptyToNull(timeClockForm.notes),
        created_by: user.id,
      }]).select('id').single();

      if (error) throw new Error(error.message);

      await writeAuditEvent('time_clock.created', `Marcacao de ponto registrada: ${timeClockEntryLabels[timeClockForm.entryType]}`, timeClockForm.employeeId, {
        occurred_at: isoDate,
        status: timeClockForm.status,
      });
      setTimeClockForm((current) => ({ ...current, occurredAt: toLocalDateTimeInputValue(), notes: '' }));
      toast.success('Marcacao registrada.');
      await loadHrData();
    } catch (error) {
      console.error('Nao foi possivel registrar ponto:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel registrar o ponto.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleUpdateTimeEntryStatus = async (entry: HrTimeClockEntry, status: HrTimeClockStatus) => {
    setSavingKey(`time-${entry.id}`);

    try {
      const { error } = await db.from('hr_time_clock_entries')
        .update({ status })
        .eq('id', entry.id)
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      await writeAuditEvent('time_clock.status_changed', `Ponto alterado para ${timeClockStatusLabels[status]}`, entry.employee_id, { entry_id: entry.id, status });
      toast.success('Status do ponto atualizado.');
      await loadHrData();
    } catch (error) {
      console.error('Nao foi possivel atualizar ponto:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel atualizar o ponto.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreateSchedule = async (event: FormEvent) => {
    event.preventDefault();
    if (!ownerUserId || !user?.id) return;

    const name = normalizeName(scheduleForm.name);
    if (name.length < 2) {
      toast.error('Informe o nome da escala.');
      return;
    }

    setSavingKey('schedule');

    try {
      const { data, error } = await db.from('hr_work_schedules').insert([{
        owner_user_id: ownerUserId,
        name,
        description: emptyToNull(scheduleForm.description),
        timezone: 'America/Sao_Paulo',
        weekly_rules: {
          days: scheduleForm.weekdays,
          start_time: scheduleForm.startTime,
          end_time: scheduleForm.endTime,
          break_minutes: asNumber(scheduleForm.breakMinutes),
        },
        tolerance_minutes: asNumber(scheduleForm.toleranceMinutes, 0),
        active: true,
        created_by: user.id,
      }]).select('id').single();

      if (error) throw new Error(error.message);
      await writeAuditEvent('schedule.created', `Escala criada: ${name}`, null, { schedule_id: data?.id });
      setScheduleForm(scheduleInitialForm);
      toast.success('Escala criada.');
      await loadHrData();
    } catch (error) {
      console.error('Nao foi possivel criar escala:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel criar a escala.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggleScheduleWeekday = (weekday: number) => {
    setScheduleForm((current) => {
      const exists = current.weekdays.includes(weekday);
      const weekdays = exists ? current.weekdays.filter((item) => item !== weekday) : [...current.weekdays, weekday].sort();
      return { ...current, weekdays };
    });
  };

  const handleUpdateScheduleStatus = async (schedule: HrWorkSchedule, active: boolean) => {
    setSavingKey(`schedule-${schedule.id}`);

    try {
      const { error } = await db.from('hr_work_schedules')
        .update({ active })
        .eq('id', schedule.id)
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      await writeAuditEvent('schedule.status_changed', `Escala ${active ? 'reativada' : 'inativada'}: ${schedule.name}`, null, { schedule_id: schedule.id });
      toast.success('Escala atualizada.');
      await loadHrData();
    } catch (error) {
      console.error('Nao foi possivel atualizar escala:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel atualizar a escala.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleAssignSchedule = async (event: FormEvent) => {
    event.preventDefault();
    if (!ownerUserId || !user?.id) return;
    if (!assignmentForm.employeeId || !assignmentForm.scheduleId || !assignmentForm.startsOn) {
      toast.error('Selecione colaborador, escala e data inicial.');
      return;
    }

    setSavingKey('assignment');

    try {
      const { data, error } = await db.from('hr_employee_schedule_assignments').insert([{
        owner_user_id: ownerUserId,
        employee_id: assignmentForm.employeeId,
        schedule_id: assignmentForm.scheduleId,
        starts_on: assignmentForm.startsOn,
        ends_on: assignmentForm.endsOn || null,
        created_by: user.id,
      }]).select('id').single();

      if (error) throw new Error(error.message);
      await writeAuditEvent('schedule.assigned', 'Escala atribuida a colaborador', assignmentForm.employeeId, {
        schedule_id: assignmentForm.scheduleId,
        assignment_id: data?.id,
      });
      toast.success('Escala atribuida.');
      await loadHrData();
    } catch (error) {
      console.error('Nao foi possivel atribuir escala:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel atribuir a escala.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleDeleteAssignment = async (assignment: HrScheduleAssignment) => {
    setSavingKey(`assignment-${assignment.id}`);

    try {
      const { error } = await db.from('hr_employee_schedule_assignments').delete().eq('id', assignment.id);
      if (error) throw new Error(error.message);
      await writeAuditEvent('schedule.assignment_removed', 'Atribuicao de escala removida', assignment.employee_id, { schedule_id: assignment.schedule_id });
      toast.success('Atribuicao removida.');
      await loadHrData();
    } catch (error) {
      console.error('Nao foi possivel remover atribuicao:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel remover a atribuicao.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleDocumentFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDocumentFile(event.target.files?.[0] ?? null);
  };

  const handleCreateDocument = async (event: FormEvent) => {
    event.preventDefault();
    if (!ownerUserId || !user?.id) return;
    if (!documentForm.employeeId || !documentForm.title.trim()) {
      toast.error('Selecione colaborador e titulo do documento.');
      return;
    }

    setSavingKey('document');

    try {
      let fileUrl: string | null = null;

      if (documentFile) {
        const path = `${ownerUserId}/${documentForm.employeeId}/${Date.now()}-${safeFileName(documentFile.name)}`;
        const { error: uploadError } = await supabase.storage.from('hr-documents').upload(path, documentFile, {
          cacheControl: '3600',
          upsert: false,
        });
        if (uploadError) throw new Error(uploadError.message);
        fileUrl = path;
      }

      const { data, error } = await db.from('hr_employee_documents').insert([{
        owner_user_id: ownerUserId,
        employee_id: documentForm.employeeId,
        document_type: documentForm.documentType,
        title: normalizeName(documentForm.title),
        file_url: fileUrl,
        expires_at: documentForm.expiresAt || null,
        sensitive: documentForm.sensitive === 'true',
        created_by: user.id,
      }]).select('id').single();

      if (error) throw new Error(error.message);
      await writeAuditEvent('document.created', `Documento registrado: ${documentForm.title}`, documentForm.employeeId, {
        document_id: data?.id,
        document_type: documentForm.documentType,
        has_file: Boolean(fileUrl),
      });
      setDocumentForm((current) => ({ ...current, title: '', expiresAt: '' }));
      setDocumentFile(null);
      toast.success('Documento registrado.');
      await loadHrData();
    } catch (error) {
      console.error('Nao foi possivel registrar documento:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel registrar o documento.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleOpenDocument = async (document: HrEmployeeDocument) => {
    if (!document.file_url) {
      toast.info('Documento sem arquivo anexado.');
      return;
    }

    setSavingKey(`document-open-${document.id}`);

    try {
      const { data, error } = await supabase.storage.from('hr-documents').createSignedUrl(document.file_url, 300);
      if (error) throw new Error(error.message);
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      await writeAuditEvent('document.opened', `Documento aberto: ${document.title}`, document.employee_id, { document_id: document.id });
    } catch (error) {
      console.error('Nao foi possivel abrir documento:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel abrir o documento.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleDeleteDocument = async () => {
    if (!documentToDelete) return;
    setSavingKey(`document-delete-${documentToDelete.id}`);

    try {
      if (documentToDelete.file_url) {
        const { error: storageError } = await supabase.storage.from('hr-documents').remove([documentToDelete.file_url]);
        if (storageError) throw new Error(storageError.message);
      }

      const { error } = await db.from('hr_employee_documents').delete().eq('id', documentToDelete.id);
      if (error) throw new Error(error.message);
      await writeAuditEvent('document.deleted', `Documento removido: ${documentToDelete.title}`, documentToDelete.employee_id, { document_id: documentToDelete.id });
      setDocumentToDelete(null);
      toast.success('Documento removido.');
      await loadHrData();
    } catch (error) {
      console.error('Nao foi possivel remover documento:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel remover o documento.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreateLeave = async (event: FormEvent) => {
    event.preventDefault();
    if (!ownerUserId || !user?.id) return;
    if (!leaveForm.employeeId || !leaveForm.startDate || !leaveForm.endDate) {
      toast.error('Informe colaborador, inicio e fim.');
      return;
    }

    setSavingKey('leave');

    try {
      const { data, error } = await db.from('hr_leave_requests').insert([{
        owner_user_id: ownerUserId,
        employee_id: leaveForm.employeeId,
        leave_type: leaveForm.leaveType,
        start_date: leaveForm.startDate,
        end_date: leaveForm.endDate,
        status: 'requested',
        reason: emptyToNull(leaveForm.reason),
        created_by: user.id,
      }]).select('id').single();

      if (error) throw new Error(error.message);
      await writeAuditEvent('leave.created', `Solicitacao criada: ${leaveTypeLabels[leaveForm.leaveType]}`, leaveForm.employeeId, { leave_id: data?.id });
      setLeaveForm((current) => ({ ...current, startDate: '', endDate: '', reason: '' }));
      toast.success('Solicitacao registrada.');
      await loadHrData();
    } catch (error) {
      console.error('Nao foi possivel registrar solicitacao:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel registrar a solicitacao.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleUpdateLeaveStatus = async (leave: HrLeaveRequest, status: HrLeaveStatus) => {
    setSavingKey(`leave-${leave.id}`);

    try {
      const { error } = await db.from('hr_leave_requests')
        .update({
          status,
          approved_by: status === 'approved' ? user?.id ?? null : leave.approved_by,
        })
        .eq('id', leave.id)
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      await writeAuditEvent('leave.status_changed', `Solicitacao alterada para ${leaveStatusLabels[status]}`, leave.employee_id, { leave_id: leave.id, status });
      toast.success('Solicitacao atualizada.');
      await loadHrData();
    } catch (error) {
      console.error('Nao foi possivel atualizar solicitacao:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel atualizar a solicitacao.'));
    } finally {
      setSavingKey(null);
    }
  };

  const recalculatePayrollRun = useCallback(async (payrollRunId: string) => {
    const { data, error } = await db.from('hr_payroll_items')
      .select('event_type, amount')
      .eq('owner_user_id', ownerUserId)
      .eq('payroll_run_id', payrollRunId);

    if (error) throw new Error(error.message);

    const totals = (data ?? []).reduce((accumulator: { gross: number; discounts: number }, item: HrPayrollItem) => {
      const amount = Number(item.amount || 0);
      if (item.event_type === 'earning') accumulator.gross += amount;
      if (item.event_type === 'discount') accumulator.discounts += amount;
      return accumulator;
    }, { gross: 0, discounts: 0 });

    const { error: updateError } = await db.from('hr_payroll_runs')
      .update({ gross_total: totals.gross, net_total: totals.gross - totals.discounts })
      .eq('id', payrollRunId);

    if (updateError) throw new Error(updateError.message);
  }, [ownerUserId]);

  const handleCreatePayrollRun = async (event: FormEvent) => {
    event.preventDefault();
    if (!ownerUserId) return;
    if (!payrollRunForm.periodStart || !payrollRunForm.periodEnd) {
      toast.error('Informe o periodo da folha.');
      return;
    }

    setSavingKey('payroll-run');

    try {
      const { data, error } = await db.from('hr_payroll_runs').insert([{
        owner_user_id: ownerUserId,
        period_start: payrollRunForm.periodStart,
        period_end: payrollRunForm.periodEnd,
        status: 'draft',
      }]).select('id').single();
      if (error) throw new Error(error.message);
      await writeAuditEvent('payroll.created', `Folha criada: ${formatDate(payrollRunForm.periodStart)} a ${formatDate(payrollRunForm.periodEnd)}`, null, { payroll_run_id: data?.id });
      setPayrollRunForm({ periodStart: '', periodEnd: '' });
      setPayrollItemForm((current) => ({ ...current, payrollRunId: data?.id ?? current.payrollRunId }));
      toast.success('Folha criada.');
      await loadHrData();
    } catch (error) {
      console.error('Nao foi possivel criar folha:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel criar a folha.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreatePayrollItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!ownerUserId) return;
    if (!payrollItemForm.payrollRunId || !payrollItemForm.employeeId || !payrollItemForm.description.trim()) {
      toast.error('Selecione folha, colaborador e descricao.');
      return;
    }

    setSavingKey('payroll-item');

    try {
      const { data, error } = await db.from('hr_payroll_items').insert([{
        owner_user_id: ownerUserId,
        payroll_run_id: payrollItemForm.payrollRunId,
        employee_id: payrollItemForm.employeeId,
        event_code: payrollItemForm.eventCode.trim().toUpperCase() || payrollItemForm.eventType.toUpperCase(),
        description: normalizeName(payrollItemForm.description),
        event_type: payrollItemForm.eventType,
        amount: asNumber(payrollItemForm.amount),
        quantity: payrollItemForm.quantity.trim() ? asNumber(payrollItemForm.quantity) : null,
        metadata: {},
      }]).select('id').single();
      if (error) throw new Error(error.message);

      await recalculatePayrollRun(payrollItemForm.payrollRunId);
      await writeAuditEvent('payroll.item_created', `Evento de folha lancado: ${payrollItemForm.description}`, payrollItemForm.employeeId, {
        payroll_run_id: payrollItemForm.payrollRunId,
        payroll_item_id: data?.id,
        event_type: payrollItemForm.eventType,
      });
      setPayrollItemForm((current) => ({ ...current, eventCode: '', description: '', amount: '', quantity: '' }));
      toast.success('Evento de folha lancado.');
      await loadHrData();
    } catch (error) {
      console.error('Nao foi possivel lancar evento de folha:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel lancar o evento.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleUpdatePayrollStatus = async (run: HrPayrollRun, status: HrPayrollStatus) => {
    setSavingKey(`payroll-${run.id}`);

    try {
      const payload: Record<string, unknown> = { status };
      if (status === 'closed' || status === 'exported') {
        payload.closed_at = run.closed_at ?? new Date().toISOString();
        payload.closed_by = user?.id ?? null;
      }

      const { error } = await db.from('hr_payroll_runs')
        .update(payload)
        .eq('id', run.id)
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      await writeAuditEvent('payroll.status_changed', `Folha alterada para ${payrollStatusLabels[status]}`, null, { payroll_run_id: run.id, status });
      toast.success('Folha atualizada.');
      await loadHrData();
    } catch (error) {
      console.error('Nao foi possivel atualizar folha:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel atualizar a folha.'));
    } finally {
      setSavingKey(null);
    }
  };

  const exportEmployees = () => {
    downloadCsv('happycash-rh-colaboradores.csv', [
      'codigo',
      'nome',
      'status',
      'tipo',
      'departamento',
      'cargo',
      'admissao',
      'desligamento',
      'email',
      'telefone',
    ], employees.map((employee) => [
      employee.employee_code,
      employee.full_name,
      statusLabels[employee.status],
      employmentTypeLabels[employee.employment_type],
      employee.department,
      employee.position,
      employee.admission_date,
      employee.termination_date,
      employee.email,
      employee.phone,
    ]));
  };

  const exportTimeEntries = () => {
    downloadCsv('happycash-rh-ponto.csv', [
      'colaborador',
      'tipo',
      'data_hora',
      'origem',
      'status',
      'escala',
      'observacao',
    ], timeEntries.map((entry) => [
      employeeById.get(entry.employee_id)?.full_name ?? 'Colaborador',
      timeClockEntryLabels[entry.entry_type],
      formatDateTime(entry.occurred_at),
      entry.source,
      timeClockStatusLabels[entry.status],
      entry.schedule_id ? scheduleById.get(entry.schedule_id)?.name : '',
      entry.notes,
    ]));
  };

  const exportPayroll = () => {
    downloadCsv('happycash-rh-folha.csv', [
      'periodo',
      'status',
      'bruto',
      'liquido',
      'eventos',
    ], payrollRuns.map((run) => [
      `${formatDate(run.period_start)} a ${formatDate(run.period_end)}`,
      payrollStatusLabels[run.status],
      run.gross_total,
      run.net_total,
      (payrollItemsByRun.get(run.id) ?? []).length,
    ]));
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title flex items-center gap-3">
              <BriefcaseBusiness className="h-6 w-6 text-primary" />
              HappyCash RH
            </h1>
            <p className="page-subtitle">
              {role === 'hr' ? 'Area exclusiva da equipe de RH.' : 'Gestao completa de pessoas, ponto, escalas, documentos e folha.'}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => void loadHrData()} disabled={savingKey === 'reload'}>
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Colaboradores ativos" value={activeEmployees} icon={<UsersRound className="h-5 w-5 text-primary" />} />
        <MetricCard title="Ponto pendente" value={pendingTimeEntries} icon={<Clock3 className="h-5 w-5 text-primary" />} />
        <MetricCard title="Solicitacoes" value={pendingLeaves} icon={<CalendarDays className="h-5 w-5 text-primary" />} />
        <MetricCard title="Folhas abertas" value={openPayroll} icon={<WalletCards className="h-5 w-5 text-primary" />} />
        <MetricCard title="Docs vencendo" value={expiringDocuments} icon={<AlertTriangle className="h-5 w-5 text-primary" />} />
      </div>

      <Tabs defaultValue="colaboradores" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
          <TabsTrigger value="ponto">Ponto</TabsTrigger>
          <TabsTrigger value="escalas">Escalas</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="afastamentos">Afastamentos</TabsTrigger>
          <TabsTrigger value="folha">Folha</TabsTrigger>
          <TabsTrigger value="relatorios">Relatorios</TabsTrigger>
          <TabsTrigger value="conformidade">Conformidade</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="colaboradores" className="space-y-4">
          {canManageEmployees && (
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle className="text-base">{editingEmployeeId ? 'Editar colaborador' : 'Cadastrar colaborador'}</CardTitle>
                {editingEmployeeId ? (
                  <Button type="button" variant="outline" size="sm" onClick={resetEmployeeForm}>
                    Novo cadastro
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent>
                <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleSaveEmployee}>
                  <Field label="Codigo">
                    <Input value={employeeForm.employeeCode} onChange={(event) => setEmployeeForm((current) => ({ ...current, employeeCode: event.target.value }))} placeholder="Ex: 0001" />
                  </Field>
                  <Field label="Nome completo" className="xl:col-span-2">
                    <Input value={employeeForm.fullName} onChange={(event) => setEmployeeForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Nome do colaborador" />
                  </Field>
                  <Field label="Nome social">
                    <Input value={employeeForm.preferredName} onChange={(event) => setEmployeeForm((current) => ({ ...current, preferredName: event.target.value }))} placeholder="Opcional" />
                  </Field>
                  <Field label="CPF">
                    <Input value={employeeForm.cpf} onChange={(event) => setEmployeeForm((current) => ({ ...current, cpf: event.target.value }))} placeholder="000.000.000-00" />
                  </Field>
                  <Field label="Email">
                    <Input type="email" value={employeeForm.email} onChange={(event) => setEmployeeForm((current) => ({ ...current, email: event.target.value }))} placeholder="email@empresa.com" />
                  </Field>
                  <Field label="Telefone">
                    <Input value={employeeForm.phone} onChange={(event) => setEmployeeForm((current) => ({ ...current, phone: event.target.value }))} placeholder="(00) 00000-0000" />
                  </Field>
                  <Field label="Vinculo">
                    <Select value={employeeForm.employmentType} onValueChange={(value) => setEmployeeForm((current) => ({ ...current, employmentType: value as HrEmploymentType }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(employmentTypeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Status">
                    <Select value={employeeForm.status} onValueChange={(value) => setEmployeeForm((current) => ({ ...current, status: value as HrEmployeeStatus }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Departamento">
                    <Input value={employeeForm.department} onChange={(event) => setEmployeeForm((current) => ({ ...current, department: event.target.value }))} placeholder="Ex: Operacao" />
                  </Field>
                  <Field label="Cargo">
                    <Input value={employeeForm.position} onChange={(event) => setEmployeeForm((current) => ({ ...current, position: event.target.value }))} placeholder="Ex: Caixa" />
                  </Field>
                  <Field label="Admissao">
                    <Input type="date" value={employeeForm.admissionDate} onChange={(event) => setEmployeeForm((current) => ({ ...current, admissionDate: event.target.value }))} />
                  </Field>
                  <Field label="Desligamento">
                    <Input type="date" value={employeeForm.terminationDate} onChange={(event) => setEmployeeForm((current) => ({ ...current, terminationDate: event.target.value }))} />
                  </Field>
                  <Field label="Observacoes" className="md:col-span-2 xl:col-span-4">
                    <Textarea value={employeeForm.notes} onChange={(event) => setEmployeeForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Contrato, jornada, exames, beneficios ou observacoes internas." />
                  </Field>
                  <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-4">
                    <Button type="submit" disabled={savingKey === 'employee'}>
                      {savingKey === 'employee' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      {editingEmployeeId ? 'Salvar alteracoes' : 'Cadastrar no RH'}
                    </Button>
                    {editingEmployeeId ? (
                      <Button type="button" variant="outline" onClick={resetEmployeeForm}>
                        Cancelar edicao
                      </Button>
                    ) : null}
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
                <EmptyState message="Nenhum colaborador cadastrado no RH." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Admissao</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <div className="min-w-[220px]">
                            <p className="font-medium">{employee.full_name}</p>
                            <p className="text-xs text-muted-foreground">{[employee.employee_code, employee.email, employee.phone].filter(Boolean).join(' · ') || employee.cpf || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p>{employee.department || '-'}</p>
                          <p className="text-xs text-muted-foreground">{employee.position || '-'}</p>
                        </TableCell>
                        <TableCell>{formatDate(employee.admission_date)}</TableCell>
                        <TableCell>
                          <Badge variant={employee.status === 'active' ? 'default' : employee.status === 'terminated' ? 'destructive' : 'secondary'}>
                            {statusLabels[employee.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canManageEmployees ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => handleEditEmployee(employee)}>
                              <Pencil className="h-4 w-4" />
                              Editar
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Leitura</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ponto" className="space-y-4">
          {canManageTimeClock && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock3 className="h-4 w-4 text-primary" />
                  Registrar ponto ou ajuste
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" onSubmit={handleRegisterTimeEntry}>
                  <Field label="Colaborador" className="xl:col-span-2">
                    <EmployeeSelect value={timeClockForm.employeeId} employees={employees} onChange={(value) => setTimeClockForm((current) => ({ ...current, employeeId: value }))} />
                  </Field>
                  <Field label="Marcacao">
                    <Select value={timeClockForm.entryType} onValueChange={(value) => setTimeClockForm((current) => ({ ...current, entryType: value as HrTimeClockEntryType }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(timeClockEntryLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Data e hora">
                    <Input type="datetime-local" value={timeClockForm.occurredAt} onChange={(event) => setTimeClockForm((current) => ({ ...current, occurredAt: event.target.value }))} />
                  </Field>
                  <Field label="Status">
                    <Select value={timeClockForm.status} onValueChange={(value) => setTimeClockForm((current) => ({ ...current, status: value as HrTimeClockStatus }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="valid">Valido</SelectItem>
                        <SelectItem value="pending_approval">Pendente</SelectItem>
                        <SelectItem value="adjusted">Ajustado</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Observacao" className="md:col-span-2 xl:col-span-5">
                    <Textarea value={timeClockForm.notes} onChange={(event) => setTimeClockForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Motivo do ajuste, local ou observacao do ponto." />
                  </Field>
                  <div className="md:col-span-2 xl:col-span-5">
                    <Button type="submit" disabled={savingKey === 'time'}>
                      {savingKey === 'time' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
                      Registrar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-base">Marcacoes e ajustes</CardTitle>
              <Badge variant="outline">{canManageTimeClock ? 'Gerencia ponto' : 'Somente leitura'}</Badge>
            </CardHeader>
            <CardContent>
              {timeEntries.length === 0 ? (
                <EmptyState message="Nenhuma marcacao registrada." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Marcacao</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="min-w-[180px]">{employeeById.get(entry.employee_id)?.full_name || 'Colaborador'}</TableCell>
                        <TableCell>
                          <p>{timeClockEntryLabels[entry.entry_type]}</p>
                          <p className="text-xs text-muted-foreground">{entry.source} · {entry.schedule_id ? scheduleById.get(entry.schedule_id)?.name || 'Escala' : 'Sem escala'}</p>
                        </TableCell>
                        <TableCell>{formatDateTime(entry.occurred_at)}</TableCell>
                        <TableCell>
                          <Badge variant={entry.status === 'valid' ? 'secondary' : entry.status === 'canceled' ? 'destructive' : 'outline'}>
                            {timeClockStatusLabels[entry.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canManageTimeClock ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              {entry.status === 'pending_approval' ? (
                                <Button type="button" variant="outline" size="sm" disabled={savingKey === `time-${entry.id}`} onClick={() => void handleUpdateTimeEntryStatus(entry, 'valid')}>
                                  <CheckCircle2 className="h-4 w-4" />
                                  Aprovar
                                </Button>
                              ) : null}
                              {entry.status !== 'canceled' ? (
                                <Button type="button" variant="outline" size="sm" disabled={savingKey === `time-${entry.id}`} onClick={() => void handleUpdateTimeEntryStatus(entry, 'canceled')}>
                                  <XCircle className="h-4 w-4" />
                                  Cancelar
                                </Button>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Leitura</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="escalas" className="space-y-4">
          {canManageSchedules && (
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Criar escala
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateSchedule}>
                    <Field label="Nome">
                      <Input value={scheduleForm.name} onChange={(event) => setScheduleForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex: Comercial segunda a sexta" />
                    </Field>
                    <Field label="Tolerancia em minutos">
                      <Input inputMode="numeric" value={scheduleForm.toleranceMinutes} onChange={(event) => setScheduleForm((current) => ({ ...current, toleranceMinutes: event.target.value }))} />
                    </Field>
                    <Field label="Entrada">
                      <Input type="time" value={scheduleForm.startTime} onChange={(event) => setScheduleForm((current) => ({ ...current, startTime: event.target.value }))} />
                    </Field>
                    <Field label="Saida">
                      <Input type="time" value={scheduleForm.endTime} onChange={(event) => setScheduleForm((current) => ({ ...current, endTime: event.target.value }))} />
                    </Field>
                    <Field label="Intervalo em minutos">
                      <Input inputMode="numeric" value={scheduleForm.breakMinutes} onChange={(event) => setScheduleForm((current) => ({ ...current, breakMinutes: event.target.value }))} />
                    </Field>
                    <div className="space-y-1.5">
                      <Label>Dias</Label>
                      <div className="flex flex-wrap gap-2">
                        {weekdayOptions.map((day) => (
                          <Button key={day.value} type="button" size="sm" variant={scheduleForm.weekdays.includes(day.value) ? 'default' : 'outline'} onClick={() => handleToggleScheduleWeekday(day.value)}>
                            {day.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Field label="Descricao" className="md:col-span-2">
                      <Textarea value={scheduleForm.description} onChange={(event) => setScheduleForm((current) => ({ ...current, description: event.target.value }))} placeholder="Regras internas, folgas, observacoes de jornada." />
                    </Field>
                    <div className="md:col-span-2">
                      <Button type="submit" disabled={savingKey === 'schedule'}>
                        {savingKey === 'schedule' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Criar escala
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Atribuir escala</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-3" onSubmit={handleAssignSchedule}>
                    <Field label="Colaborador">
                      <EmployeeSelect value={assignmentForm.employeeId} employees={employees} onChange={(value) => setAssignmentForm((current) => ({ ...current, employeeId: value }))} />
                    </Field>
                    <Field label="Escala">
                      <ScheduleSelect value={assignmentForm.scheduleId} schedules={workSchedules.filter((schedule) => schedule.active)} onChange={(value) => setAssignmentForm((current) => ({ ...current, scheduleId: value }))} />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Inicio">
                        <Input type="date" value={assignmentForm.startsOn} onChange={(event) => setAssignmentForm((current) => ({ ...current, startsOn: event.target.value }))} />
                      </Field>
                      <Field label="Fim">
                        <Input type="date" value={assignmentForm.endsOn} onChange={(event) => setAssignmentForm((current) => ({ ...current, endsOn: event.target.value }))} />
                      </Field>
                    </div>
                    <Button type="submit" disabled={savingKey === 'assignment'}>
                      {savingKey === 'assignment' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Atribuir
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Escalas cadastradas</CardTitle>
              </CardHeader>
              <CardContent>
                {workSchedules.length === 0 ? (
                  <EmptyState message="Nenhuma escala cadastrada." />
                ) : (
                  <div className="divide-y rounded-lg border border-border/70">
                    {workSchedules.map((schedule) => (
                      <div key={schedule.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{schedule.name}</p>
                            <Badge variant={schedule.active ? 'secondary' : 'outline'}>{schedule.active ? 'Ativa' : 'Inativa'}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatWeekdays(schedule.weekly_rules?.days)} · {schedule.weekly_rules?.start_time || '--:--'} a {schedule.weekly_rules?.end_time || '--:--'} · intervalo {schedule.weekly_rules?.break_minutes ?? 0} min · tolerancia {schedule.tolerance_minutes} min
                          </p>
                          {schedule.description ? <p className="mt-1 text-sm text-muted-foreground">{schedule.description}</p> : null}
                        </div>
                        {canManageSchedules ? (
                          <Button type="button" variant="outline" size="sm" disabled={savingKey === `schedule-${schedule.id}`} onClick={() => void handleUpdateScheduleStatus(schedule, !schedule.active)}>
                            {schedule.active ? 'Inativar' : 'Ativar'}
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Atribuicoes</CardTitle>
              </CardHeader>
              <CardContent>
                {scheduleAssignments.length === 0 ? (
                  <EmptyState message="Nenhuma escala atribuida." />
                ) : (
                  <div className="divide-y rounded-lg border border-border/70">
                    {scheduleAssignments.map((assignment) => (
                      <div key={assignment.id} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <div>
                          <p className="font-medium">{employeeById.get(assignment.employee_id)?.full_name || 'Colaborador'}</p>
                          <p className="text-sm text-muted-foreground">{scheduleById.get(assignment.schedule_id)?.name || 'Escala'} · {formatDate(assignment.starts_on)} a {formatDate(assignment.ends_on)}</p>
                        </div>
                        {canManageSchedules ? (
                          <Button type="button" variant="outline" size="sm" disabled={savingKey === `assignment-${assignment.id}`} onClick={() => void handleDeleteAssignment(assignment)}>
                            <Trash2 className="h-4 w-4" />
                            Remover
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="documentos" className="space-y-4">
          {canManageDocuments && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileCheck2 className="h-4 w-4 text-primary" />
                  Registrar documento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" onSubmit={handleCreateDocument}>
                  <Field label="Colaborador" className="xl:col-span-2">
                    <EmployeeSelect value={documentForm.employeeId} employees={employees} onChange={(value) => setDocumentForm((current) => ({ ...current, employeeId: value }))} />
                  </Field>
                  <Field label="Tipo">
                    <Input value={documentForm.documentType} onChange={(event) => setDocumentForm((current) => ({ ...current, documentType: event.target.value }))} placeholder="contrato, aso, recibo" />
                  </Field>
                  <Field label="Titulo">
                    <Input value={documentForm.title} onChange={(event) => setDocumentForm((current) => ({ ...current, title: event.target.value }))} placeholder="Contrato de admissao" />
                  </Field>
                  <Field label="Vencimento">
                    <Input type="date" value={documentForm.expiresAt} onChange={(event) => setDocumentForm((current) => ({ ...current, expiresAt: event.target.value }))} />
                  </Field>
                  <Field label="Sensibilidade">
                    <Select value={documentForm.sensitive} onValueChange={(value) => setDocumentForm((current) => ({ ...current, sensitive: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Sensivel</SelectItem>
                        <SelectItem value="false">Nao sensivel</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Arquivo privado" className="md:col-span-2 xl:col-span-4">
                    <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.doc,.docx" onChange={handleDocumentFileChange} />
                  </Field>
                  <div className="flex items-end">
                    <Button type="submit" className="w-full" disabled={savingKey === 'document'}>
                      {savingKey === 'document' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Salvar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documentos trabalhistas</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <EmptyState message="Nenhum documento registrado." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Documento</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Protecao</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((document) => (
                      <TableRow key={document.id}>
                        <TableCell>
                          <p className="font-medium">{document.title}</p>
                          <p className="text-xs text-muted-foreground">{document.document_type}</p>
                        </TableCell>
                        <TableCell>{employeeById.get(document.employee_id)?.full_name || 'Colaborador'}</TableCell>
                        <TableCell>{formatDate(document.expires_at)}</TableCell>
                        <TableCell>
                          <Badge variant={document.sensitive ? 'destructive' : 'secondary'}>{document.sensitive ? 'Sensivel' : 'Padrao'}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canManageDocuments ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button type="button" variant="outline" size="sm" disabled={!document.file_url || savingKey === `document-open-${document.id}`} onClick={() => void handleOpenDocument(document)}>
                                <ExternalLink className="h-4 w-4" />
                                Abrir
                              </Button>
                              <Button type="button" variant="outline" size="sm" onClick={() => setDocumentToDelete(document)}>
                                <Trash2 className="h-4 w-4" />
                                Remover
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Restrito</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="afastamentos" className="space-y-4">
          {canManageLeave && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Ferias, ausencias e licencas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" onSubmit={handleCreateLeave}>
                  <Field label="Colaborador" className="xl:col-span-2">
                    <EmployeeSelect value={leaveForm.employeeId} employees={employees} onChange={(value) => setLeaveForm((current) => ({ ...current, employeeId: value }))} />
                  </Field>
                  <Field label="Tipo">
                    <Select value={leaveForm.leaveType} onValueChange={(value) => setLeaveForm((current) => ({ ...current, leaveType: value as HrLeaveType }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(leaveTypeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Inicio">
                    <Input type="date" value={leaveForm.startDate} onChange={(event) => setLeaveForm((current) => ({ ...current, startDate: event.target.value }))} />
                  </Field>
                  <Field label="Fim">
                    <Input type="date" value={leaveForm.endDate} onChange={(event) => setLeaveForm((current) => ({ ...current, endDate: event.target.value }))} />
                  </Field>
                  <Field label="Motivo" className="md:col-span-2 xl:col-span-5">
                    <Textarea value={leaveForm.reason} onChange={(event) => setLeaveForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Motivo, documento relacionado ou observacao interna." />
                  </Field>
                  <div className="md:col-span-2 xl:col-span-5">
                    <Button type="submit" disabled={savingKey === 'leave'}>
                      {savingKey === 'leave' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Registrar solicitacao
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Solicitacoes</CardTitle>
            </CardHeader>
            <CardContent>
              {leaveRequests.length === 0 ? (
                <EmptyState message="Nenhuma solicitacao registrada." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Periodo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveRequests.map((leave) => (
                      <TableRow key={leave.id}>
                        <TableCell>{employeeById.get(leave.employee_id)?.full_name || 'Colaborador'}</TableCell>
                        <TableCell>
                          <p>{leaveTypeLabels[leave.leave_type]}</p>
                          <p className="text-xs text-muted-foreground">{leave.reason || '-'}</p>
                        </TableCell>
                        <TableCell>{formatDate(leave.start_date)} a {formatDate(leave.end_date)}</TableCell>
                        <TableCell>
                          <Badge variant={leave.status === 'approved' ? 'secondary' : leave.status === 'rejected' || leave.status === 'canceled' ? 'destructive' : 'outline'}>
                            {leaveStatusLabels[leave.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canManageLeave ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              {leave.status === 'requested' ? (
                                <>
                                  <Button type="button" variant="outline" size="sm" disabled={savingKey === `leave-${leave.id}`} onClick={() => void handleUpdateLeaveStatus(leave, 'approved')}>
                                    <CheckCircle2 className="h-4 w-4" />
                                    Aprovar
                                  </Button>
                                  <Button type="button" variant="outline" size="sm" disabled={savingKey === `leave-${leave.id}`} onClick={() => void handleUpdateLeaveStatus(leave, 'rejected')}>
                                    <XCircle className="h-4 w-4" />
                                    Rejeitar
                                  </Button>
                                </>
                              ) : null}
                              {leave.status !== 'canceled' ? (
                                <Button type="button" variant="outline" size="sm" disabled={savingKey === `leave-${leave.id}`} onClick={() => void handleUpdateLeaveStatus(leave, 'canceled')}>
                                  Cancelar
                                </Button>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Leitura</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="folha" className="space-y-4">
          {canManagePayroll && (
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <WalletCards className="h-4 w-4 text-primary" />
                    Criar folha
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-3" onSubmit={handleCreatePayrollRun}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Inicio">
                        <Input type="date" value={payrollRunForm.periodStart} onChange={(event) => setPayrollRunForm((current) => ({ ...current, periodStart: event.target.value }))} />
                      </Field>
                      <Field label="Fim">
                        <Input type="date" value={payrollRunForm.periodEnd} onChange={(event) => setPayrollRunForm((current) => ({ ...current, periodEnd: event.target.value }))} />
                      </Field>
                    </div>
                    <Button type="submit" disabled={savingKey === 'payroll-run'}>
                      {savingKey === 'payroll-run' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Criar folha
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Lancar evento</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleCreatePayrollItem}>
                    <Field label="Folha" className="xl:col-span-2">
                      <Select value={payrollItemForm.payrollRunId} onValueChange={(value) => setPayrollItemForm((current) => ({ ...current, payrollRunId: value }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione a folha" /></SelectTrigger>
                        <SelectContent>
                          {payrollRuns.filter((run) => run.status === 'draft').map((run) => (
                            <SelectItem key={run.id} value={run.id}>{formatDate(run.period_start)} a {formatDate(run.period_end)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Colaborador" className="xl:col-span-2">
                      <EmployeeSelect value={payrollItemForm.employeeId} employees={employees} onChange={(value) => setPayrollItemForm((current) => ({ ...current, employeeId: value }))} />
                    </Field>
                    <Field label="Codigo">
                      <Input value={payrollItemForm.eventCode} onChange={(event) => setPayrollItemForm((current) => ({ ...current, eventCode: event.target.value }))} placeholder="SAL, VT, INSS" />
                    </Field>
                    <Field label="Tipo">
                      <Select value={payrollItemForm.eventType} onValueChange={(value) => setPayrollItemForm((current) => ({ ...current, eventType: value as HrPayrollEventType }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(payrollEventTypeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Valor">
                      <Input inputMode="decimal" value={payrollItemForm.amount} onChange={(event) => setPayrollItemForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0,00" />
                    </Field>
                    <Field label="Quantidade">
                      <Input inputMode="decimal" value={payrollItemForm.quantity} onChange={(event) => setPayrollItemForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="Opcional" />
                    </Field>
                    <Field label="Descricao" className="md:col-span-2 xl:col-span-4">
                      <Input value={payrollItemForm.description} onChange={(event) => setPayrollItemForm((current) => ({ ...current, description: event.target.value }))} placeholder="Salario, desconto, adicional, base informativa." />
                    </Field>
                    <div className="md:col-span-2 xl:col-span-4">
                      <Button type="submit" disabled={savingKey === 'payroll-item'}>
                        {savingKey === 'payroll-item' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Lancar evento
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fechamentos de folha</CardTitle>
            </CardHeader>
            <CardContent>
              {payrollRuns.length === 0 ? (
                <EmptyState message="Nenhum fechamento de folha criado." />
              ) : (
                <div className="space-y-3">
                  {payrollRuns.map((run) => {
                    const items = payrollItemsByRun.get(run.id) ?? [];
                    return (
                      <div key={run.id} className="rounded-lg border border-border/70 p-4">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">{formatDate(run.period_start)} a {formatDate(run.period_end)}</p>
                              <Badge variant={run.status === 'draft' ? 'outline' : run.status === 'canceled' ? 'destructive' : 'secondary'}>{payrollStatusLabels[run.status]}</Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">Bruto {formatMoney(run.gross_total)} · Liquido {formatMoney(run.net_total)} · {items.length} eventos</p>
                          </div>
                          {canManagePayroll ? (
                            <div className="flex flex-wrap gap-2 lg:justify-end">
                              {run.status === 'draft' ? (
                                <Button type="button" variant="outline" size="sm" disabled={savingKey === `payroll-${run.id}`} onClick={() => void handleUpdatePayrollStatus(run, 'closed')}>
                                  <CheckCircle2 className="h-4 w-4" />
                                  Fechar
                                </Button>
                              ) : null}
                              {run.status === 'closed' ? (
                                <Button type="button" variant="outline" size="sm" disabled={savingKey === `payroll-${run.id}`} onClick={() => void handleUpdatePayrollStatus(run, 'exported')}>
                                  <Download className="h-4 w-4" />
                                  Exportar
                                </Button>
                              ) : null}
                              {run.status !== 'canceled' ? (
                                <Button type="button" variant="outline" size="sm" disabled={savingKey === `payroll-${run.id}`} onClick={() => void handleUpdatePayrollStatus(run, 'canceled')}>
                                  Cancelar
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        {items.length > 0 ? (
                          <div className="mt-3 divide-y rounded-md border border-border/60">
                            {items.map((item) => (
                              <div key={item.id} className="grid gap-2 p-3 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                                <div>
                                  <p className="font-medium">{item.event_code} · {item.description}</p>
                                  <p className="text-xs text-muted-foreground">{employeeById.get(item.employee_id)?.full_name || 'Colaborador'} · {payrollEventTypeLabels[item.event_type]}</p>
                                </div>
                                <p className={item.event_type === 'discount' ? 'font-semibold text-destructive' : 'font-semibold'}>
                                  {item.event_type === 'discount' ? '-' : ''}{formatMoney(item.amount)}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relatorios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Relatorios de RH
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <ReportCard title="Colaboradores" description={`${employees.length} registros com status, vinculo e departamento.`} disabled={!canExportHr} onClick={exportEmployees} />
              <ReportCard title="Ponto" description={`${timeEntries.length} marcacoes carregadas para auditoria.`} disabled={!canExportHr} onClick={exportTimeEntries} />
              <ReportCard title="Folha" description={`${payrollRuns.length} fechamentos com totais bruto e liquido.`} disabled={!canExportHr} onClick={exportPayroll} />
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Ativos" value={activeEmployees} icon={<UsersRound className="h-5 w-5 text-primary" />} />
            <MetricCard title="Ponto pendente" value={pendingTimeEntries} icon={<Clock3 className="h-5 w-5 text-primary" />} />
            <MetricCard title="Afastamentos pendentes" value={pendingLeaves} icon={<CalendarDays className="h-5 w-5 text-primary" />} />
            <MetricCard title="Documentos a vencer" value={expiringDocuments} icon={<AlertTriangle className="h-5 w-5 text-primary" />} />
          </div>
        </TabsContent>

        <TabsContent value="conformidade" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Regras brasileiras e LGPD
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {complianceRules.length === 0 ? (
                <EmptyState message="Nenhuma referencia de conformidade carregada." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {complianceRules.map((rule) => (
                    <div key={rule.id} className="rounded-lg border border-border/70 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{rule.title}</p>
                        <Badge variant={rule.severity === 'critical' ? 'destructive' : rule.severity === 'high' ? 'default' : 'outline'}>{complianceSeverityLabels[rule.severity]}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{rule.requirement_summary}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{rule.category}</Badge>
                        {rule.source_url ? (
                          <a className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline" href={rule.source_url} target="_blank" rel="noreferrer">
                            {rule.source_name || 'Fonte'}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span>{rule.source_name || 'Regra interna'}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
                Estas referencias ajudam a organizar o controle interno. A validacao juridica e contabilidade continuam necessarias para cada empresa, sindicato, jornada e evento de folha.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Auditoria de RH
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!canViewAudit ? (
                <EmptyState message="Seu acesso nao permite visualizar auditoria de RH." />
              ) : auditEvents.length === 0 ? (
                <EmptyState message="Nenhum evento de auditoria registrado." />
              ) : (
                <div className="divide-y rounded-lg border border-border/70">
                  {auditEvents.map((event) => (
                    <div key={event.id} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div>
                        <p className="font-medium">{event.description || event.event_type}</p>
                        <p className="text-sm text-muted-foreground">{event.event_type} · {event.employee_id ? employeeById.get(event.employee_id)?.full_name || 'Colaborador' : 'Geral'}</p>
                      </div>
                      <p className="text-sm text-muted-foreground sm:text-right">{formatDateTime(event.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(documentToDelete)} onOpenChange={(open) => !open && setDocumentToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover documento</DialogTitle>
            <DialogDescription>
              O registro e o arquivo privado serao removidos do RH. Esta acao fica registrada na auditoria.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDocumentToDelete(null)}>Cancelar</Button>
            <Button type="button" variant="destructive" disabled={Boolean(documentToDelete && savingKey === `document-delete-${documentToDelete.id}`)} onClick={() => void handleDeleteDocument()}>
              {documentToDelete && savingKey === `document-delete-${documentToDelete.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function MetricCard({ title, value, icon }: { title: string; value: number; icon: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">{message}</p>;
}

function EmployeeSelect({ value, employees, onChange }: { value: string; employees: HrEmployee[]; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
      <SelectContent>
        {employees.map((employee) => (
          <SelectItem key={employee.id} value={employee.id}>{employee.full_name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ScheduleSelect({ value, schedules, onChange }: { value: string; schedules: HrWorkSchedule[]; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Selecione a escala" /></SelectTrigger>
      <SelectContent>
        {schedules.map((schedule) => (
          <SelectItem key={schedule.id} value={schedule.id}>{schedule.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ReportCard({ title, description, disabled, onClick }: { title: string; description: string; disabled: boolean; onClick: () => void }) {
  return (
    <div className="rounded-lg border border-border/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <FileText className="h-5 w-5 text-primary" />
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-4 w-full" disabled={disabled} onClick={onClick}>
        <Download className="h-4 w-4" />
        Exportar CSV
      </Button>
      {disabled ? <p className="mt-2 text-xs text-muted-foreground">Requer permissao de exportacao de RH.</p> : null}
    </div>
  );
}

function formatWeekdays(days: number[] | undefined) {
  if (!days || days.length === 0) return 'Sem dias';
  const labels = new Map(weekdayOptions.map((day) => [day.value, day.label]));
  return days.map((day) => labels.get(day) ?? String(day)).join(', ');
}
