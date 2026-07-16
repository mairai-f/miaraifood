import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Clock3,
  Download,
  ExternalLink,
  FolderOpen,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
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
  photo_url: string | null;
  address_zip_code: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  unit_name: string | null;
  contract_type: string | null;
  work_journey: string | null;
  salary_amount: number | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
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
    daily_rules?: Record<string, {
      start_time?: string;
      end_time?: string;
      break_minutes?: number;
    }>;
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
  photoUrl: string;
  addressZipCode: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  unitName: string;
  contractType: string;
  workJourney: string;
  salaryAmount: string;
  bankName: string;
  bankAgency: string;
  bankAccount: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  admissionDate: string;
  terminationDate: string;
  notes: string;
};

type ScheduleFormState = {
  name: string;
  description: string;
  toleranceMinutes: string;
  dayRules: Record<number, {
    enabled: boolean;
    startTime: string;
    endTime: string;
    breakMinutes: string;
  }>;
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

const OperatorManagementPanel = lazy(() =>
  import('@/components/OperatorManagementPanel').then((module) => ({
    default: module.OperatorManagementPanel,
  })),
);

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
  photoUrl: '',
  addressZipCode: '',
  addressStreet: '',
  addressNumber: '',
  addressComplement: '',
  addressNeighborhood: '',
  addressCity: '',
  addressState: '',
  unitName: '',
  contractType: '',
  workJourney: '',
  salaryAmount: '',
  bankName: '',
  bankAgency: '',
  bankAccount: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  admissionDate: '',
  terminationDate: '',
  notes: '',
};

const scheduleInitialForm: ScheduleFormState = {
  name: '',
  description: '',
  toleranceMinutes: '10',
  dayRules: {
    0: { enabled: false, startTime: '08:00', endTime: '17:00', breakMinutes: '60' },
    1: { enabled: true, startTime: '08:00', endTime: '17:00', breakMinutes: '60' },
    2: { enabled: true, startTime: '08:00', endTime: '17:00', breakMinutes: '60' },
    3: { enabled: true, startTime: '08:00', endTime: '17:00', breakMinutes: '60' },
    4: { enabled: true, startTime: '08:00', endTime: '17:00', breakMinutes: '60' },
    5: { enabled: true, startTime: '08:00', endTime: '17:00', breakMinutes: '60' },
    6: { enabled: false, startTime: '08:00', endTime: '17:00', breakMinutes: '60' },
  },
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
const normalizeNameKey = (value: string) =>
  normalizeName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

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

const nullableMoney = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return asNumber(trimmed);
};

const onlyDigits = (value: string) => value.replace(/\D/g, '');

const formatCep = (value: string) => {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const getEmployeeInitials = (name: string) => {
  const parts = normalizeName(name).split(' ').filter(Boolean);
  return `${parts[0]?.[0] ?? 'H'}${parts[1]?.[0] ?? parts[0]?.[1] ?? 'C'}`.toUpperCase();
};

const isRecentEmployee = (createdAt: string) => {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() - created <= 1000 * 60 * 60 * 24 * 15;
};

const buildEmployeeSearchText = (employee: HrEmployee) =>
  normalizeNameKey([
    employee.full_name,
    employee.preferred_name,
    employee.employee_code,
    employee.cpf,
    employee.email,
    employee.phone,
    employee.department,
    employee.position,
    employee.unit_name,
  ].filter(Boolean).join(' '));

const csvEscape = (value: unknown) => {
  const text = String(value ?? '');
  if (!/[",\n;]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
};

const htmlEscape = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const employeeBaseColumns = 'id, employee_code, full_name, preferred_name, cpf, email, phone, status, employment_type, admission_date, termination_date, department, position, notes, created_at, updated_at';
const employeeProfileColumns = 'id, employee_code, full_name, preferred_name, cpf, email, phone, status, employment_type, admission_date, termination_date, department, position, photo_url, address_zip_code, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, unit_name, contract_type, work_journey, salary_amount, bank_name, bank_agency, bank_account, emergency_contact_name, emergency_contact_phone, notes, created_at, updated_at';

const isMissingEmployeeProfileColumnError = (message: string | undefined) => {
  if (!message) return false;
  return [
    'photo_url',
    'address_zip_code',
    'contract_type',
    'salary_amount',
    'emergency_contact_name',
  ].some((column) => message.includes(column));
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
  const { ownerUserId, user, role, isAdmin } = useAuth();
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeProfileOpen, setEmployeeProfileOpen] = useState(false);
  const [employeeEditMode, setEmployeeEditMode] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [profileAssignmentForm, setProfileAssignmentForm] = useState({
    scheduleId: '',
    startsOn: new Date().toISOString().slice(0, 10),
    endsOn: '',
  });

  const canManageEmployees = hasPermission('hr.employees.manage');
  const canManageTimeClock = hasPermission('hr.time_clock.manage');
  const canManageSchedules = hasPermission('hr.schedules.manage');
  const canManageDocuments = hasPermission('hr.documents.manage');
  const canManageLeave = hasPermission('hr.leave.manage');
  const canManagePayroll = hasPermission('hr.payroll.manage');
  const canExportHr = hasPermission('hr.exports.manage');
  const canViewAudit = hasPermission('hr.audit.view');
  const canManageAccesses = isAdmin || hasPermission('hr.access.manage');
  const canEditEmployeeForm = canManageEmployees && (!editingEmployeeId || employeeEditMode);

  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const scheduleById = useMemo(() => new Map(workSchedules.map((schedule) => [schedule.id, schedule])), [workSchedules]);
  const selectedEmployee = editingEmployeeId ? employeeById.get(editingEmployeeId) ?? null : null;
  const filteredEmployees = useMemo(() => {
    const search = normalizeNameKey(employeeSearch);
    if (!search) return employees;
    return employees.filter((employee) => buildEmployeeSearchText(employee).includes(search));
  }, [employeeSearch, employees]);

  const selectedEmployeeDocuments = useMemo(
    () => selectedEmployee ? documents.filter((document) => document.employee_id === selectedEmployee.id) : [],
    [documents, selectedEmployee],
  );
  const selectedEmployeeTimeEntries = useMemo(
    () => selectedEmployee ? timeEntries.filter((entry) => entry.employee_id === selectedEmployee.id).slice(0, 12) : [],
    [selectedEmployee, timeEntries],
  );
  const selectedEmployeeLeaves = useMemo(
    () => selectedEmployee ? leaveRequests.filter((leave) => leave.employee_id === selectedEmployee.id) : [],
    [leaveRequests, selectedEmployee],
  );
  const selectedEmployeeAssignments = useMemo(
    () => selectedEmployee ? scheduleAssignments.filter((assignment) => assignment.employee_id === selectedEmployee.id) : [],
    [scheduleAssignments, selectedEmployee],
  );
  const selectedEmployeePayrollItems = useMemo(
    () => selectedEmployee ? payrollItems.filter((item) => item.employee_id === selectedEmployee.id).slice(0, 20) : [],
    [payrollItems, selectedEmployee],
  );
  const selectedEmployeeAuditEvents = useMemo(
    () => selectedEmployee ? auditEvents.filter((event) => event.employee_id === selectedEmployee.id).slice(0, 20) : [],
    [auditEvents, selectedEmployee],
  );

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
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

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
      ] = await Promise.all([
        db.from('hr_employees')
          .select(employeeProfileColumns)
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
      ]);

      let resolvedEmployeesResponse = employeesResponse;
      if (employeesResponse.error && isMissingEmployeeProfileColumnError(employeesResponse.error.message)) {
        resolvedEmployeesResponse = await db.from('hr_employees')
          .select(employeeBaseColumns)
          .eq('owner_user_id', ownerUserId)
          .order('full_name', { ascending: true });
        setLoadError('Os campos novos do perfil RH ainda dependem da migration no banco. Carreguei o RH com os dados atuais.');
      }

      const error = resolvedEmployeesResponse.error
        || documentsResponse.error
        || schedulesResponse.error
        || assignmentsResponse.error
        || timeResponse.error
        || leavesResponse.error
        || payrollRunsResponse.error
        || payrollItemsResponse.error
        || auditResponse.error;

      if (error) throw new Error(error.message);

      setEmployees((resolvedEmployeesResponse.data ?? []) as HrEmployee[]);
      setDocuments((documentsResponse.data ?? []) as HrEmployeeDocument[]);
      setWorkSchedules((schedulesResponse.data ?? []) as HrWorkSchedule[]);
      setScheduleAssignments((assignmentsResponse.data ?? []) as HrScheduleAssignment[]);
      setTimeEntries((timeResponse.data ?? []) as HrTimeClockEntry[]);
      setLeaveRequests((leavesResponse.data ?? []) as HrLeaveRequest[]);
      setPayrollRuns((payrollRunsResponse.data ?? []) as HrPayrollRun[]);
      setPayrollItems((payrollItemsResponse.data ?? []) as HrPayrollItem[]);
      setAuditEvents((auditResponse.data ?? []) as HrAuditEvent[]);
    } catch (error) {
      console.error('Nao foi possivel carregar o RH:', getRedactedLogValue(error));
      const message = getPublicErrorMessage(error, 'Nao foi possivel carregar o RH.');
      setLoadError(message);
      toast.error(message);
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
    if (!documentForm.employeeId && employees[0]) {
      setDocumentForm((current) => ({ ...current, employeeId: employees[0].id }));
    }
    if (!leaveForm.employeeId && employees[0]) {
      setLeaveForm((current) => ({ ...current, employeeId: employees[0].id }));
    }
    if (!payrollItemForm.employeeId && employees[0]) {
      setPayrollItemForm((current) => ({ ...current, employeeId: employees[0].id }));
    }
  }, [documentForm.employeeId, employees, leaveForm.employeeId, payrollItemForm.employeeId, timeClockForm.employeeId]);

  useEffect(() => {
    if (!profileAssignmentForm.scheduleId && workSchedules[0]) {
      setProfileAssignmentForm((current) => ({ ...current, scheduleId: workSchedules[0].id }));
    }
    if (!payrollItemForm.payrollRunId && payrollRuns[0]) {
      setPayrollItemForm((current) => ({ ...current, payrollRunId: payrollRuns[0].id }));
    }
  }, [payrollItemForm.payrollRunId, payrollRuns, profileAssignmentForm.scheduleId, workSchedules]);

  const resetEmployeeForm = () => {
    setEditingEmployeeId(null);
    setEmployeeEditMode(false);
    setEmployeeForm(employeeInitialForm);
  };

  const openNewEmployeeProfile = () => {
    resetEmployeeForm();
    setEmployeeEditMode(true);
    setTimeClockForm((current) => ({ ...current, employeeId: '', notes: '' }));
    setDocumentForm((current) => ({ ...current, employeeId: '', title: '', expiresAt: '' }));
    setDocumentFile(null);
    setLeaveForm((current) => ({ ...current, employeeId: '', startDate: '', endDate: '', reason: '' }));
    setPayrollItemForm((current) => ({ ...current, employeeId: '', eventCode: '', description: '', amount: '', quantity: '' }));
    setProfileAssignmentForm({
      scheduleId: workSchedules.find((schedule) => schedule.active)?.id ?? workSchedules[0]?.id ?? '',
      startsOn: new Date().toISOString().slice(0, 10),
      endsOn: '',
    });
    setEmployeeProfileOpen(true);
  };

  const handleEditEmployee = (employee: HrEmployee, startEditing = false) => {
    setEditingEmployeeId(employee.id);
    setEmployeeEditMode(startEditing);
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
      photoUrl: employee.photo_url ?? '',
      addressZipCode: employee.address_zip_code ?? '',
      addressStreet: employee.address_street ?? '',
      addressNumber: employee.address_number ?? '',
      addressComplement: employee.address_complement ?? '',
      addressNeighborhood: employee.address_neighborhood ?? '',
      addressCity: employee.address_city ?? '',
      addressState: employee.address_state ?? '',
      unitName: employee.unit_name ?? '',
      contractType: employee.contract_type ?? '',
      workJourney: employee.work_journey ?? '',
      salaryAmount: employee.salary_amount !== null && employee.salary_amount !== undefined ? String(employee.salary_amount).replace('.', ',') : '',
      bankName: employee.bank_name ?? '',
      bankAgency: employee.bank_agency ?? '',
      bankAccount: employee.bank_account ?? '',
      emergencyContactName: employee.emergency_contact_name ?? '',
      emergencyContactPhone: employee.emergency_contact_phone ?? '',
      admissionDate: employee.admission_date ?? '',
      terminationDate: employee.termination_date ?? '',
      notes: employee.notes ?? '',
    });
    setTimeClockForm((current) => ({ ...current, employeeId: employee.id, notes: '' }));
    setDocumentForm((current) => ({ ...current, employeeId: employee.id, title: '', expiresAt: '' }));
    setDocumentFile(null);
    setLeaveForm((current) => ({ ...current, employeeId: employee.id, startDate: '', endDate: '', reason: '' }));
    setPayrollItemForm((current) => ({ ...current, employeeId: employee.id, eventCode: '', description: '', amount: '', quantity: '' }));
    setProfileAssignmentForm({
      scheduleId: workSchedules.find((schedule) => schedule.active)?.id ?? workSchedules[0]?.id ?? '',
      startsOn: new Date().toISOString().slice(0, 10),
      endsOn: '',
    });
    setEmployeeProfileOpen(true);
  };

  const handleSaveEmployee = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!ownerUserId || !user?.id) return;

    const fullName = normalizeName(employeeForm.fullName);
    if (fullName.length < 3) {
      toast.error('Informe o nome completo do funcionário.');
      return;
    }

    const duplicateEmployee = employees.find((employee) =>
      employee.id !== editingEmployeeId && normalizeNameKey(employee.full_name) === normalizeNameKey(fullName),
    );
    if (duplicateEmployee) {
      toast.error('Ja existe funcionário com esse nome completo. Use um segundo nome, sobrenome ou identificador diferente.');
      return;
    }

    const zipDigits = onlyDigits(employeeForm.addressZipCode);
    const hasAddressData = Boolean(
      zipDigits
      || employeeForm.addressStreet.trim()
      || employeeForm.addressCity.trim()
      || employeeForm.addressState.trim(),
    );
    if (zipDigits && zipDigits.length !== 8) {
      toast.error('Informe um CEP com 8 digitos.');
      return;
    }
    if (hasAddressData && !employeeForm.addressNumber.trim()) {
      toast.error('Informe o numero do endereco do funcionário.');
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
        photo_url: emptyToNull(employeeForm.photoUrl),
        address_zip_code: zipDigits ? formatCep(zipDigits) : null,
        address_street: emptyToNull(employeeForm.addressStreet),
        address_number: emptyToNull(employeeForm.addressNumber),
        address_complement: emptyToNull(employeeForm.addressComplement),
        address_neighborhood: emptyToNull(employeeForm.addressNeighborhood),
        address_city: emptyToNull(employeeForm.addressCity),
        address_state: emptyToNull(employeeForm.addressState.toUpperCase()),
        unit_name: emptyToNull(employeeForm.unitName),
        contract_type: emptyToNull(employeeForm.contractType),
        work_journey: emptyToNull(employeeForm.workJourney),
        salary_amount: nullableMoney(employeeForm.salaryAmount),
        bank_name: emptyToNull(employeeForm.bankName),
        bank_agency: emptyToNull(employeeForm.bankAgency),
        bank_account: emptyToNull(employeeForm.bankAccount),
        emergency_contact_name: emptyToNull(employeeForm.emergencyContactName),
        emergency_contact_phone: emptyToNull(employeeForm.emergencyContactPhone),
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
        await writeAuditEvent('employee.updated', `Funcionário atualizado: ${fullName}`, editingEmployeeId, { status: employeeForm.status });
        toast.success('Funcionário atualizado.');
      } else {
        const { data, error } = await db.from('hr_employees').insert([{
          ...payload,
          created_by: user.id,
        }]).select('id').single();
        if (error) throw new Error(error.message);
        await writeAuditEvent('employee.created', `Funcionário cadastrado: ${fullName}`, data?.id, { employment_type: employeeForm.employmentType });
        toast.success('Funcionário cadastrado no RH.');
      }

      resetEmployeeForm();
      setEmployeeProfileOpen(false);
      await loadHrData();
    } catch (error) {
      console.error('Nao foi possivel salvar funcionário no RH:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel salvar o funcionário.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleLookupCep = async () => {
    const zipDigits = onlyDigits(employeeForm.addressZipCode);
    if (zipDigits.length !== 8) {
      toast.error('Informe um CEP com 8 digitos.');
      return;
    }

    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${zipDigits}/json/`);
      if (!response.ok) throw new Error('CEP indisponivel');
      const data = await response.json() as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data.erro) throw new Error('CEP nao encontrado');

      setEmployeeForm((current) => ({
        ...current,
        addressZipCode: formatCep(zipDigits),
        addressStreet: data.logradouro || current.addressStreet,
        addressNeighborhood: data.bairro || current.addressNeighborhood,
        addressCity: data.localidade || current.addressCity,
        addressState: data.uf || current.addressState,
      }));
      toast.success('Endereco preenchido pelo CEP.');
    } catch (error) {
      console.error('Nao foi possivel consultar CEP:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel buscar o CEP.'));
    } finally {
      setCepLoading(false);
    }
  };

  const handleAssignProfileSchedule = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!ownerUserId || !user?.id || !selectedEmployee) return;
    if (!profileAssignmentForm.scheduleId || !profileAssignmentForm.startsOn) {
      toast.error('Selecione escala e data inicial.');
      return;
    }

    setSavingKey('profile-assignment');

    try {
      const { data, error } = await db.from('hr_employee_schedule_assignments').insert([{
        owner_user_id: ownerUserId,
        employee_id: selectedEmployee.id,
        schedule_id: profileAssignmentForm.scheduleId,
        starts_on: profileAssignmentForm.startsOn,
        ends_on: profileAssignmentForm.endsOn || null,
        created_by: user.id,
      }]).select('id').single();

      if (error) throw new Error(error.message);
      await writeAuditEvent('schedule.assigned', 'Escala atribuida no perfil do funcionário', selectedEmployee.id, {
        schedule_id: profileAssignmentForm.scheduleId,
        assignment_id: data?.id,
      });
      setProfileAssignmentForm((current) => ({ ...current, endsOn: '' }));
      toast.success('Escala atribuida ao funcionário.');
      await loadHrData();
    } catch (error) {
      console.error('Nao foi possivel atribuir escala no perfil:', getRedactedLogValue(error));
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel atribuir a escala.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleRegisterTimeEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!ownerUserId || !user?.id) return;
    if (!timeClockForm.employeeId) {
      toast.error('Selecione o funcionário do ponto.');
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

    const enabledDayRules = weekdayOptions
      .map((day) => ({ day: day.value, rule: scheduleForm.dayRules[day.value] }))
      .filter(({ rule }) => rule?.enabled && rule.startTime && rule.endTime);
    if (enabledDayRules.length === 0) {
      toast.error('Informe pelo menos um dia com entrada e saida.');
      return;
    }

    const dailyRules = Object.fromEntries(enabledDayRules.map(({ day, rule }) => [
      String(day),
      {
        start_time: rule.startTime,
        end_time: rule.endTime,
        break_minutes: asNumber(rule.breakMinutes),
      },
    ]));
    const firstRule = enabledDayRules[0].rule;

    setSavingKey('schedule');

    try {
      const { data, error } = await db.from('hr_work_schedules').insert([{
        owner_user_id: ownerUserId,
        name,
        description: emptyToNull(scheduleForm.description),
        timezone: 'America/Sao_Paulo',
        weekly_rules: {
          days: enabledDayRules.map(({ day }) => day),
          daily_rules: dailyRules,
          start_time: firstRule.startTime,
          end_time: firstRule.endTime,
          break_minutes: asNumber(firstRule.breakMinutes),
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

  const updateScheduleDayRule = (
    weekday: number,
    patch: Partial<ScheduleFormState['dayRules'][number]>,
  ) => {
    setScheduleForm((current) => {
      const currentRule = current.dayRules[weekday] ?? { enabled: false, startTime: '08:00', endTime: '17:00', breakMinutes: '60' };
      return {
        ...current,
        dayRules: {
          ...current.dayRules,
          [weekday]: { ...currentRule, ...patch },
        },
      };
    });
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
      toast.error('Selecione funcionário e titulo do documento.');
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
      toast.error('Informe funcionário, inicio e fim.');
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
      toast.error('Selecione folha, funcionário e descricao.');
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
    downloadCsv('happycash-rh-funcionarios.csv', [
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
      'funcionario',
      'tipo',
      'data_hora',
      'origem',
      'status',
      'escala',
      'observacao',
    ], timeEntries.map((entry) => [
      employeeById.get(entry.employee_id)?.full_name ?? 'Funcionário',
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

  const handleExportEmployeePhoto = () => {
    const photoUrl = employeeForm.photoUrl.trim();
    if (!photoUrl) {
      toast.info('Este funcionário nao possui foto cadastrada.');
      return;
    }
    window.open(photoUrl, '_blank', 'noopener,noreferrer');
  };

  const handleOpenEmployeePdf = () => {
    const employee = selectedEmployee;
    const fullName = normalizeName(employeeForm.fullName || employee?.full_name || 'Funcionário');
    const photoUrl = employeeForm.photoUrl.trim();
    const scheduleSummary = selectedEmployeeAssignments
      .map((assignment) => {
        const schedule = scheduleById.get(assignment.schedule_id);
        return `${htmlEscape(schedule?.name || 'Escala')}: ${htmlEscape(formatDate(assignment.starts_on))} a ${htmlEscape(formatDate(assignment.ends_on))} - ${htmlEscape(formatScheduleRules(schedule))}`;
      })
      .join('<br>');
    const documentsSummary = selectedEmployeeDocuments
      .map((document) => `${htmlEscape(document.title)} (${htmlEscape(document.document_type)}) - vencimento ${htmlEscape(formatDate(document.expires_at))}`)
      .join('<br>');
    const leavesSummary = selectedEmployeeLeaves
      .map((leave) => `${htmlEscape(leaveTypeLabels[leave.leave_type])}: ${htmlEscape(formatDate(leave.start_date))} a ${htmlEscape(formatDate(leave.end_date))} - ${htmlEscape(leaveStatusLabels[leave.status])}`)
      .join('<br>');
    const payrollSummary = selectedEmployeePayrollItems
      .map((item) => `${htmlEscape(item.event_code)} - ${htmlEscape(item.description)}: ${htmlEscape(formatMoney(item.amount))}`)
      .join('<br>');
    const timeSummary = selectedEmployeeTimeEntries
      .map((entry) => `${htmlEscape(timeClockEntryLabels[entry.entry_type])}: ${htmlEscape(formatDateTime(entry.occurred_at))} - ${htmlEscape(timeClockStatusLabels[entry.status])}`)
      .join('<br>');

    const popup = window.open('', '_blank');
    if (!popup) {
      toast.error('Nao foi possivel abrir o PDF. Verifique o bloqueador de pop-up.');
      return;
    }

    popup.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Pasta RH - ${htmlEscape(fullName)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #172033; }
    header { display: flex; gap: 18px; align-items: center; border-bottom: 2px solid #2647b8; padding-bottom: 18px; margin-bottom: 22px; }
    img { width: 96px; height: 96px; border-radius: 12px; object-fit: cover; border: 1px solid #d8deef; }
    h1 { margin: 0; font-size: 24px; color: #2647b8; }
    h2 { font-size: 15px; color: #2647b8; border-bottom: 1px solid #d8deef; padding-bottom: 6px; margin-top: 22px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 18px; }
    .field { border: 1px solid #d8deef; border-radius: 8px; padding: 10px; min-height: 44px; }
    .label { display: block; font-size: 11px; color: #64708f; text-transform: uppercase; margin-bottom: 4px; }
    [contenteditable="true"] { outline: 2px dashed transparent; }
    [contenteditable="true"]:focus { outline-color: #2647b8; }
    @media print { body { margin: 18mm; } button { display: none; } }
  </style>
</head>
<body>
  <button onclick="window.print()" style="margin-bottom:16px;padding:10px 14px;border:0;border-radius:8px;background:#2647b8;color:white;font-weight:700">Imprimir / salvar PDF</button>
  <header>
    ${photoUrl ? `<img src="${htmlEscape(photoUrl)}" alt="Foto de ${htmlEscape(fullName)}" />` : ''}
    <div>
      <h1 contenteditable="true">${htmlEscape(fullName)}</h1>
      <p contenteditable="true">${htmlEscape([employeeForm.employeeCode, employeeForm.department, employeeForm.position, employeeForm.unitName].filter(Boolean).join(' · ') || 'Pasta funcional')}</p>
    </div>
  </header>
  <h2>Cadastro</h2>
  <section class="grid" contenteditable="true">
    <div class="field"><span class="label">CPF</span>${htmlEscape(employeeForm.cpf || '-')}</div>
    <div class="field"><span class="label">Email</span>${htmlEscape(employeeForm.email || '-')}</div>
    <div class="field"><span class="label">Telefone</span>${htmlEscape(employeeForm.phone || '-')}</div>
    <div class="field"><span class="label">Emergencia</span>${htmlEscape([employeeForm.emergencyContactName, employeeForm.emergencyContactPhone].filter(Boolean).join(' - ') || '-')}</div>
  </section>
  <h2>Endereco</h2>
  <section class="field" contenteditable="true">${htmlEscape([employeeForm.addressStreet, employeeForm.addressNumber, employeeForm.addressComplement, employeeForm.addressNeighborhood, employeeForm.addressCity, employeeForm.addressState, employeeForm.addressZipCode].filter(Boolean).join(', ') || '-')}</section>
  <h2>Contrato</h2>
  <section class="grid" contenteditable="true">
    <div class="field"><span class="label">Vinculo</span>${htmlEscape(employmentTypeLabels[employeeForm.employmentType])}</div>
    <div class="field"><span class="label">Status</span>${htmlEscape(statusLabels[employeeForm.status])}</div>
    <div class="field"><span class="label">Admissao</span>${htmlEscape(formatDate(employeeForm.admissionDate))}</div>
    <div class="field"><span class="label">Desligamento</span>${htmlEscape(formatDate(employeeForm.terminationDate))}</div>
    <div class="field"><span class="label">Salario</span>${htmlEscape(employeeForm.salaryAmount || '-')}</div>
    <div class="field"><span class="label">Jornada</span>${htmlEscape(employeeForm.workJourney || '-')}</div>
  </section>
  <h2>Escalas</h2><section class="field" contenteditable="true">${scheduleSummary || '-'}</section>
  <h2>Ponto</h2><section class="field" contenteditable="true">${timeSummary || '-'}</section>
  <h2>Ferias e afastamentos</h2><section class="field" contenteditable="true">${leavesSummary || '-'}</section>
  <h2>Documentos</h2><section class="field" contenteditable="true">${documentsSummary || '-'}</section>
  <h2>Folha</h2><section class="field" contenteditable="true">${payrollSummary || '-'}</section>
  <h2>Observacoes</h2><section class="field" contenteditable="true">${htmlEscape(employeeForm.notes || '-')}</section>
</body>
</html>`);
    popup.document.close();
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

      {loadError ? (
        <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-100">
          {loadError}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Funcionarios ativos" value={activeEmployees} icon={<UsersRound className="h-5 w-5 text-primary" />} />
        <MetricCard title="Ponto pendente" value={pendingTimeEntries} icon={<Clock3 className="h-5 w-5 text-primary" />} />
        <MetricCard title="Solicitacoes" value={pendingLeaves} icon={<CalendarDays className="h-5 w-5 text-primary" />} />
        <MetricCard title="Folhas abertas" value={openPayroll} icon={<WalletCards className="h-5 w-5 text-primary" />} />
        <MetricCard title="Docs vencendo" value={expiringDocuments} icon={<AlertTriangle className="h-5 w-5 text-primary" />} />
      </div>

      <Tabs defaultValue="funcionarios" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="funcionarios">Funcionarios</TabsTrigger>
          {canManageAccesses ? <TabsTrigger value="acessos">Acessos</TabsTrigger> : null}
          <TabsTrigger value="relatorios">Relatorios</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="funcionarios" className="space-y-4">
          <Card>
            <CardHeader className="gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <UsersRound className="h-4 w-4 text-primary" />
                  Funcionarios
                </CardTitle>
                {canManageEmployees ? (
                  <Button type="button" onClick={openNewEmployeeProfile}>
                    <Plus className="h-4 w-4" />
                    Novo funcionario
                  </Button>
                ) : null}
              </div>
              <div className="relative max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={employeeSearch}
                  onChange={(event) => setEmployeeSearch(event.target.value)}
                  placeholder="Buscar por nome, letras, CPF, email, cargo ou setor"
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
            </CardHeader>
            <CardContent>
              {filteredEmployees.length === 0 ? (
                <EmptyState message="Nenhum funcionario cadastrado no RH." />
              ) : (
                <div className="divide-y rounded-lg border border-border/70">
                  {filteredEmployees.map((employee) => {
                    const employeeAssignments = scheduleAssignments.filter((assignment) => assignment.employee_id === employee.id);
                    const currentAssignment = employeeAssignments[0];
                    const currentSchedule = currentAssignment ? scheduleById.get(currentAssignment.schedule_id) : null;

                    return (
                      <div
                        key={employee.id}
                        role="button"
                        tabIndex={0}
                        className="grid cursor-pointer gap-3 p-4 transition hover:bg-muted/30 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                        onClick={() => handleEditEmployee(employee, false)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleEditEmployee(employee, false);
                          }
                        }}
                      >
                        <div className="flex min-w-0 gap-3">
                          <Avatar className="h-11 w-11 border border-border">
                            <AvatarImage src={employee.photo_url ?? undefined} alt={employee.full_name} />
                            <AvatarFallback>{getEmployeeInitials(employee.full_name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-semibold">{employee.full_name}</p>
                              <Badge variant={employee.status === 'active' ? 'default' : employee.status === 'terminated' ? 'destructive' : 'secondary'}>
                                {statusLabels[employee.status]}
                              </Badge>
                              <Badge variant="outline">{isRecentEmployee(employee.created_at) ? 'Novo cadastro' : 'Funcionário antigo'}</Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {[employee.employee_code, employee.department, employee.position, employee.unit_name].filter(Boolean).join(' · ') || 'Sem setor definido'}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {[employee.email, employee.phone, currentSchedule?.name].filter(Boolean).join(' · ') || 'Sem contato ou escala'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 md:justify-end">
                          <Button type="button" variant="outline" size="sm" onClick={(event) => { event.stopPropagation(); handleEditEmployee(employee, false); }}>
                            <FolderOpen className="h-4 w-4" />
                            Pasta
                          </Button>
                          {canManageEmployees ? (
                            <Button type="button" variant="outline" size="sm" onClick={(event) => { event.stopPropagation(); handleEditEmployee(employee, true); }}>
                              <Pencil className="h-4 w-4" />
                              Editar
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canManageAccesses ? (
          <TabsContent value="acessos" className="space-y-4">
            <Suspense fallback={<SectionLoader label="Carregando acessos do RH..." />}>
              <OperatorManagementPanel />
            </Suspense>
          </TabsContent>
        ) : null}

        <TabsContent value="relatorios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Relatorios de RH
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <ReportCard title="Funcionarios" description={`${employees.length} registros com status, vinculo e departamento.`} disabled={!canExportHr} onClick={exportEmployees} />
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
                        <p className="text-sm text-muted-foreground">{event.event_type} · {event.employee_id ? employeeById.get(event.employee_id)?.full_name || 'Funcionário' : 'Geral'}</p>
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

      <Dialog
        open={employeeProfileOpen}
        onOpenChange={(open) => {
          setEmployeeProfileOpen(open);
          if (!open) resetEmployeeForm();
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              {editingEmployeeId ? 'Pasta do funcionário' : 'Novo funcionário'}
            </DialogTitle>
            <DialogDescription>
              Cadastro funcional, endereco, contrato, documentos, ponto, escalas, ferias, folha e historico do funcionário.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center">
              <Avatar className="h-16 w-16 border border-border">
                <AvatarImage src={employeeForm.photoUrl || undefined} alt={employeeForm.fullName || 'Funcionário'} />
                <AvatarFallback>{getEmployeeInitials(employeeForm.fullName || 'HappyCash')}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold">{employeeForm.fullName || 'Funcionário'}</p>
                <p className="text-sm text-muted-foreground">
                  {[employeeForm.employeeCode, employeeForm.department, employeeForm.position].filter(Boolean).join(' · ') || 'Cadastro em edicao'}
                </p>
              </div>
              <Badge variant={employeeForm.status === 'active' ? 'default' : employeeForm.status === 'terminated' ? 'destructive' : 'secondary'}>
                {statusLabels[employeeForm.status]}
              </Badge>
              <div className="flex flex-wrap gap-2 sm:ml-auto">
                <Button type="button" variant="outline" size="sm" onClick={handleExportEmployeePhoto} disabled={!employeeForm.photoUrl.trim()}>
                  <Download className="h-4 w-4" />
                  Foto
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleOpenEmployeePdf}>
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
                {canManageEmployees && editingEmployeeId && !employeeEditMode ? (
                  <Button type="button" size="sm" onClick={() => setEmployeeEditMode(true)}>
                    <Pencil className="h-4 w-4" />
                    Editar dados
                  </Button>
                ) : null}
              </div>
            </div>

            <Tabs defaultValue="cadastro" className="space-y-4">
              <TabsList className="h-auto flex-wrap justify-start">
                <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
                <TabsTrigger value="endereco">Endereco</TabsTrigger>
                <TabsTrigger value="contrato">Contrato</TabsTrigger>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
                <TabsTrigger value="ponto">Ponto</TabsTrigger>
                <TabsTrigger value="escala">Escala</TabsTrigger>
                <TabsTrigger value="ferias">Ferias</TabsTrigger>
                <TabsTrigger value="folha">Folha</TabsTrigger>
                <TabsTrigger value="historico">Historico</TabsTrigger>
              </TabsList>

              <TabsContent value="cadastro" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Codigo">
                  <Input value={employeeForm.employeeCode} onChange={(event) => setEmployeeForm((current) => ({ ...current, employeeCode: event.target.value }))} placeholder="Ex: 0001" autoComplete="off" disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="Nome completo" className="xl:col-span-2">
                  <Input value={employeeForm.fullName} onChange={(event) => setEmployeeForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Nome do funcionário" autoComplete="name" disabled={!canEditEmployeeForm} />
                  <p className="text-xs text-muted-foreground">O nome completo nao pode ser igual ao de outro funcionário.</p>
                </Field>
                <Field label="Nome social">
                  <Input value={employeeForm.preferredName} onChange={(event) => setEmployeeForm((current) => ({ ...current, preferredName: event.target.value }))} placeholder="Opcional" autoComplete="nickname" disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="CPF">
                  <Input value={employeeForm.cpf} onChange={(event) => setEmployeeForm((current) => ({ ...current, cpf: event.target.value }))} placeholder="000.000.000-00" autoComplete="off" disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="Email">
                  <Input type="email" value={employeeForm.email} onChange={(event) => setEmployeeForm((current) => ({ ...current, email: event.target.value }))} placeholder="email@empresa.com" autoComplete="email" disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="Telefone">
                  <Input value={employeeForm.phone} onChange={(event) => setEmployeeForm((current) => ({ ...current, phone: event.target.value }))} placeholder="(00) 00000-0000" autoComplete="tel" disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="Foto">
                  <Input value={employeeForm.photoUrl} onChange={(event) => setEmployeeForm((current) => ({ ...current, photoUrl: event.target.value }))} placeholder="URL da foto" autoComplete="url" disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="Contato de emergencia" className="md:col-span-2">
                  <Input value={employeeForm.emergencyContactName} onChange={(event) => setEmployeeForm((current) => ({ ...current, emergencyContactName: event.target.value }))} placeholder="Nome do contato" autoComplete="name" disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="Telefone emergencia" className="md:col-span-2">
                  <Input value={employeeForm.emergencyContactPhone} onChange={(event) => setEmployeeForm((current) => ({ ...current, emergencyContactPhone: event.target.value }))} placeholder="(00) 00000-0000" autoComplete="tel" disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="Observacoes" className="md:col-span-2 xl:col-span-4">
                  <Textarea value={employeeForm.notes} onChange={(event) => setEmployeeForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Observacoes internas, exames, beneficios ou alertas do cadastro." disabled={!canEditEmployeeForm} />
                </Field>
              </TabsContent>

              <TabsContent value="endereco" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="CEP">
                  <div className="flex gap-2">
                    <Input value={employeeForm.addressZipCode} onChange={(event) => setEmployeeForm((current) => ({ ...current, addressZipCode: formatCep(event.target.value) }))} placeholder="00000-000" autoComplete="postal-code" disabled={!canEditEmployeeForm} />
                    <Button type="button" variant="outline" onClick={() => void handleLookupCep()} disabled={!canEditEmployeeForm || cepLoading}>
                      {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                </Field>
                <Field label="Rua" className="xl:col-span-2">
                  <Input value={employeeForm.addressStreet} onChange={(event) => setEmployeeForm((current) => ({ ...current, addressStreet: event.target.value }))} placeholder="Rua, avenida ou travessa" autoComplete="address-line1" disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="Numero">
                  <Input value={employeeForm.addressNumber} onChange={(event) => setEmployeeForm((current) => ({ ...current, addressNumber: event.target.value }))} placeholder="Numero" autoComplete="address-line2" disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="Complemento">
                  <Input value={employeeForm.addressComplement} onChange={(event) => setEmployeeForm((current) => ({ ...current, addressComplement: event.target.value }))} placeholder="Casa, apto, bloco" autoComplete="address-line3" disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="Bairro">
                  <Input value={employeeForm.addressNeighborhood} onChange={(event) => setEmployeeForm((current) => ({ ...current, addressNeighborhood: event.target.value }))} placeholder="Bairro" autoComplete="address-level3" disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="Cidade">
                  <Input value={employeeForm.addressCity} onChange={(event) => setEmployeeForm((current) => ({ ...current, addressCity: event.target.value }))} placeholder="Cidade" autoComplete="address-level2" disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="UF">
                  <Input value={employeeForm.addressState} onChange={(event) => setEmployeeForm((current) => ({ ...current, addressState: event.target.value.toUpperCase().slice(0, 2) }))} placeholder="SP" autoComplete="address-level1" disabled={!canEditEmployeeForm} />
                </Field>
              </TabsContent>

              <TabsContent value="contrato" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Vinculo">
                  <Select value={employeeForm.employmentType} onValueChange={(value) => setEmployeeForm((current) => ({ ...current, employmentType: value as HrEmploymentType }))} disabled={!canEditEmployeeForm}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(employmentTypeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={employeeForm.status} onValueChange={(value) => setEmployeeForm((current) => ({ ...current, status: value as HrEmployeeStatus }))} disabled={!canEditEmployeeForm}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Tipo de contrato">
                  <Input value={employeeForm.contractType} onChange={(event) => setEmployeeForm((current) => ({ ...current, contractType: event.target.value }))} placeholder="CLT mensal, horista, PJ..." autoComplete="off" disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="Salario">
                  <Input inputMode="decimal" value={employeeForm.salaryAmount} onChange={(event) => setEmployeeForm((current) => ({ ...current, salaryAmount: event.target.value }))} placeholder="0,00" autoComplete="off" disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="Setor">
                  <Input value={employeeForm.department} onChange={(event) => setEmployeeForm((current) => ({ ...current, department: event.target.value }))} placeholder="Ex: Operacao" autoComplete="organization" disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="Cargo">
                  <Input value={employeeForm.position} onChange={(event) => setEmployeeForm((current) => ({ ...current, position: event.target.value }))} placeholder="Ex: Caixa" autoComplete="organization-title" disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="Unidade">
                  <Input value={employeeForm.unitName} onChange={(event) => setEmployeeForm((current) => ({ ...current, unitName: event.target.value }))} placeholder="Loja, filial ou setor" autoComplete="organization" disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="Jornada">
                  <Input value={employeeForm.workJourney} onChange={(event) => setEmployeeForm((current) => ({ ...current, workJourney: event.target.value }))} placeholder="44h semanais, 12x36..." autoComplete="off" disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="Admissao">
                  <Input type="date" value={employeeForm.admissionDate} onChange={(event) => setEmployeeForm((current) => ({ ...current, admissionDate: event.target.value }))} disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="Desligamento">
                  <Input type="date" value={employeeForm.terminationDate} onChange={(event) => setEmployeeForm((current) => ({ ...current, terminationDate: event.target.value }))} disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="Banco">
                  <Input value={employeeForm.bankName} onChange={(event) => setEmployeeForm((current) => ({ ...current, bankName: event.target.value }))} placeholder="Banco" autoComplete="off" disabled={!canEditEmployeeForm} />
                </Field>
                <Field label="Agencia e conta">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input value={employeeForm.bankAgency} onChange={(event) => setEmployeeForm((current) => ({ ...current, bankAgency: event.target.value }))} placeholder="Agencia" autoComplete="off" disabled={!canEditEmployeeForm} />
                    <Input value={employeeForm.bankAccount} onChange={(event) => setEmployeeForm((current) => ({ ...current, bankAccount: event.target.value }))} placeholder="Conta" autoComplete="off" disabled={!canEditEmployeeForm} />
                  </div>
                </Field>
              </TabsContent>

              <TabsContent value="documentos" className="space-y-3">
                {selectedEmployee && canManageDocuments ? (
                  <form className="grid gap-3 rounded-lg border border-border/70 p-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={handleCreateDocument}>
                    <Field label="Tipo">
                      <Input value={documentForm.documentType} onChange={(event) => setDocumentForm((current) => ({ ...current, documentType: event.target.value }))} placeholder="contrato, aso, recibo" />
                    </Field>
                    <Field label="Titulo" className="xl:col-span-2">
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
                        Adicionar documento
                      </Button>
                    </div>
                  </form>
                ) : null}

                {selectedEmployeeDocuments.length === 0 ? (
                  <EmptyState message="Nenhum documento registrado para este funcionário." />
                ) : (
                  <div className="divide-y rounded-lg border border-border/70">
                    {selectedEmployeeDocuments.map((document) => (
                      <div key={document.id} className="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                        <div>
                          <p className="font-medium">{document.title}</p>
                          <p className="text-sm text-muted-foreground">{document.document_type} · vencimento {formatDate(document.expires_at)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 md:justify-end">
                          <Button type="button" variant="outline" size="sm" disabled={!document.file_url || savingKey === `document-open-${document.id}`} onClick={() => void handleOpenDocument(document)}>
                            <ExternalLink className="h-4 w-4" />
                            Abrir
                          </Button>
                          {canManageDocuments ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => setDocumentToDelete(document)}>
                              <Trash2 className="h-4 w-4" />
                              Remover
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="ponto" className="space-y-3">
                {selectedEmployee && canManageTimeClock ? (
                  <form className="grid gap-3 rounded-lg border border-border/70 p-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleRegisterTimeEntry}>
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
                    <div className="flex items-end">
                      <Button type="submit" className="w-full" disabled={savingKey === 'time'}>
                        {savingKey === 'time' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
                        Registrar ponto
                      </Button>
                    </div>
                    <Field label="Observacao" className="md:col-span-2 xl:col-span-4">
                      <Textarea value={timeClockForm.notes} onChange={(event) => setTimeClockForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Motivo do ajuste, local ou observacao do ponto." />
                    </Field>
                  </form>
                ) : null}

                {selectedEmployeeTimeEntries.length === 0 ? (
                  <EmptyState message="Nenhuma marcacao de ponto para este funcionário." />
                ) : (
                  <div className="divide-y rounded-lg border border-border/70">
                    {selectedEmployeeTimeEntries.map((entry) => (
                      <div key={entry.id} className="grid gap-2 p-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                        <div>
                          <p className="font-medium">{timeClockEntryLabels[entry.entry_type]}</p>
                          <p className="text-sm text-muted-foreground">{formatDateTime(entry.occurred_at)} · {entry.schedule_id ? scheduleById.get(entry.schedule_id)?.name || 'Escala' : 'Sem escala'}</p>
                        </div>
                        <Badge variant={entry.status === 'valid' ? 'secondary' : entry.status === 'canceled' ? 'destructive' : 'outline'}>{timeClockStatusLabels[entry.status]}</Badge>
                        {canManageTimeClock ? (
                          <div className="flex flex-wrap gap-2 md:justify-end">
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
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="escala" className="space-y-4">
                {canManageSchedules ? (
                  <form className="grid gap-3 rounded-lg border border-border/70 p-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={handleCreateSchedule}>
                    <Field label="Nova escala" className="md:col-span-2 xl:col-span-3">
                      <Input value={scheduleForm.name} onChange={(event) => setScheduleForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex: Comercial segunda a sexta" />
                    </Field>
                    <Field label="Tolerancia min.">
                      <Input inputMode="numeric" value={scheduleForm.toleranceMinutes} onChange={(event) => setScheduleForm((current) => ({ ...current, toleranceMinutes: event.target.value }))} />
                    </Field>
                    <div className="space-y-2 md:col-span-2 xl:col-span-5">
                      <Label>Dias e horarios</Label>
                      <div className="grid gap-2">
                        {weekdayOptions.map((day) => {
                          const rule = scheduleForm.dayRules[day.value];
                          return (
                            <div key={day.value} className="grid gap-2 rounded-md border border-border/60 p-2 sm:grid-cols-[92px_1fr_1fr_1fr] sm:items-center">
                              <Button
                                type="button"
                                size="sm"
                                variant={rule.enabled ? 'default' : 'outline'}
                                onClick={() => updateScheduleDayRule(day.value, { enabled: !rule.enabled })}
                              >
                                {day.label}
                              </Button>
                              <Input type="time" value={rule.startTime} disabled={!rule.enabled} onChange={(event) => updateScheduleDayRule(day.value, { startTime: event.target.value })} aria-label={`Entrada ${day.label}`} />
                              <Input type="time" value={rule.endTime} disabled={!rule.enabled} onChange={(event) => updateScheduleDayRule(day.value, { endTime: event.target.value })} aria-label={`Saida ${day.label}`} />
                              <Input inputMode="numeric" value={rule.breakMinutes} disabled={!rule.enabled} onChange={(event) => updateScheduleDayRule(day.value, { breakMinutes: event.target.value })} aria-label={`Intervalo ${day.label}`} placeholder="Intervalo min." />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <Field label="Descricao" className="md:col-span-2 xl:col-span-4">
                      <Textarea value={scheduleForm.description} onChange={(event) => setScheduleForm((current) => ({ ...current, description: event.target.value }))} placeholder="Regras internas, folgas, observacoes de jornada." />
                    </Field>
                    <div className="flex items-end">
                      <Button type="submit" className="w-full" disabled={savingKey === 'schedule'}>
                        {savingKey === 'schedule' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Criar escala
                      </Button>
                    </div>
                  </form>
                ) : null}

                {selectedEmployee && canManageSchedules ? (
                  <div className="grid gap-3 rounded-lg border border-border/70 p-4 md:grid-cols-4">
                    <Field label="Escala" className="md:col-span-2">
                      <ScheduleSelect value={profileAssignmentForm.scheduleId} schedules={workSchedules.filter((schedule) => schedule.active)} onChange={(value) => setProfileAssignmentForm((current) => ({ ...current, scheduleId: value }))} />
                    </Field>
                    <Field label="Inicio">
                      <Input type="date" value={profileAssignmentForm.startsOn} onChange={(event) => setProfileAssignmentForm((current) => ({ ...current, startsOn: event.target.value }))} />
                    </Field>
                    <Field label="Fim">
                      <Input type="date" value={profileAssignmentForm.endsOn} onChange={(event) => setProfileAssignmentForm((current) => ({ ...current, endsOn: event.target.value }))} />
                    </Field>
                    <div className="md:col-span-4">
                      <Button type="button" disabled={savingKey === 'profile-assignment'} onClick={() => void handleAssignProfileSchedule()}>
                        {savingKey === 'profile-assignment' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Atribuir escala
                      </Button>
                    </div>
                  </div>
                ) : null}

                {selectedEmployeeAssignments.length === 0 ? (
                  <EmptyState message="Nenhuma escala atribuida para este funcionário." />
                ) : (
                  <div className="divide-y rounded-lg border border-border/70">
                    {selectedEmployeeAssignments.map((assignment) => (
                      <div key={assignment.id} className="grid gap-2 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                        <div>
                          <p className="font-medium">{scheduleById.get(assignment.schedule_id)?.name || 'Escala'}</p>
                          <p className="text-sm text-muted-foreground">{formatDate(assignment.starts_on)} a {formatDate(assignment.ends_on)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{formatScheduleRules(scheduleById.get(assignment.schedule_id))}</p>
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
              </TabsContent>

              <TabsContent value="ferias" className="space-y-3">
                {selectedEmployee && canManageLeave ? (
                  <form className="grid gap-3 rounded-lg border border-border/70 p-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={handleCreateLeave}>
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
                    <Field label="Motivo" className="md:col-span-2">
                      <Input value={leaveForm.reason} onChange={(event) => setLeaveForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Motivo ou documento relacionado" />
                    </Field>
                    <div className="flex items-end">
                      <Button type="submit" className="w-full" disabled={savingKey === 'leave'}>
                        {savingKey === 'leave' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Registrar
                      </Button>
                    </div>
                  </form>
                ) : null}

                {selectedEmployeeLeaves.length === 0 ? (
                  <EmptyState message="Nenhuma ferias, ausencia ou licenca registrada para este funcionário." />
                ) : (
                  <div className="divide-y rounded-lg border border-border/70">
                    {selectedEmployeeLeaves.map((leave) => (
                      <div key={leave.id} className="grid gap-2 p-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                        <div>
                          <p className="font-medium">{leaveTypeLabels[leave.leave_type]}</p>
                          <p className="text-sm text-muted-foreground">{formatDate(leave.start_date)} a {formatDate(leave.end_date)} · {leave.reason || '-'}</p>
                        </div>
                        <Badge variant={leave.status === 'approved' ? 'secondary' : leave.status === 'rejected' || leave.status === 'canceled' ? 'destructive' : 'outline'}>{leaveStatusLabels[leave.status]}</Badge>
                        {canManageLeave ? (
                          <div className="flex flex-wrap gap-2 md:justify-end">
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
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="folha" className="space-y-3">
                {selectedEmployee && canManagePayroll ? (
                  <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                    <form className="grid gap-3 rounded-lg border border-border/70 p-4" onSubmit={handleCreatePayrollRun}>
                      <p className="font-semibold">Criar fechamento</p>
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

                    <form className="grid gap-3 rounded-lg border border-border/70 p-4 md:grid-cols-2" onSubmit={handleCreatePayrollItem}>
                      <p className="font-semibold md:col-span-2">Lancar evento para {selectedEmployee.full_name}</p>
                      <Field label="Folha" className="md:col-span-2">
                        <Select value={payrollItemForm.payrollRunId} onValueChange={(value) => setPayrollItemForm((current) => ({ ...current, payrollRunId: value }))}>
                          <SelectTrigger><SelectValue placeholder="Selecione a folha" /></SelectTrigger>
                          <SelectContent>
                            {payrollRuns.filter((run) => run.status === 'draft').map((run) => (
                              <SelectItem key={run.id} value={run.id}>{formatDate(run.period_start)} a {formatDate(run.period_end)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                      <Field label="Descricao" className="md:col-span-2">
                        <Input value={payrollItemForm.description} onChange={(event) => setPayrollItemForm((current) => ({ ...current, description: event.target.value }))} placeholder="Salario, desconto, adicional, base informativa." />
                      </Field>
                      <div className="md:col-span-2">
                        <Button type="submit" disabled={savingKey === 'payroll-item'}>
                          {savingKey === 'payroll-item' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                          Lancar evento
                        </Button>
                      </div>
                    </form>
                  </div>
                ) : null}

                {selectedEmployeePayrollItems.length === 0 ? (
                  <EmptyState message="Nenhum evento de folha registrado para este funcionário." />
                ) : (
                  <div className="divide-y rounded-lg border border-border/70">
                    {selectedEmployeePayrollItems.map((item) => (
                      <div key={item.id} className="grid gap-2 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                        <div>
                          <p className="font-medium">{item.event_code} · {item.description}</p>
                          <p className="text-sm text-muted-foreground">{payrollEventTypeLabels[item.event_type]} · {formatDateTime(item.created_at)}</p>
                        </div>
                        <p className={item.event_type === 'discount' ? 'font-semibold text-destructive' : 'font-semibold'}>
                          {item.event_type === 'discount' ? '-' : ''}{formatMoney(item.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="historico" className="space-y-3">
                {selectedEmployeeAuditEvents.length === 0 ? (
                  <EmptyState message="Nenhum historico registrado para este funcionário." />
                ) : (
                  <div className="divide-y rounded-lg border border-border/70">
                    {selectedEmployeeAuditEvents.map((event) => (
                      <div key={event.id} className="grid gap-2 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                        <div>
                          <p className="font-medium">{event.description || event.event_type}</p>
                          <p className="text-sm text-muted-foreground">{event.event_type}</p>
                        </div>
                        <p className="text-sm text-muted-foreground md:text-right">{formatDateTime(event.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEmployeeProfileOpen(false)}>Fechar</Button>
            {canManageEmployees && (!editingEmployeeId || employeeEditMode) ? (
              <Button type="button" disabled={savingKey === 'employee'} onClick={() => void handleSaveEmployee()}>
                {savingKey === 'employee' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {editingEmployeeId ? 'Salvar alteracoes' : 'Salvar cadastro'}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

function SectionLoader({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </CardContent>
    </Card>
  );
}

function EmployeeSelect({ value, employees, onChange }: { value: string; employees: HrEmployee[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selectedEmployee = employees.find((employee) => employee.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">{selectedEmployee?.full_name ?? 'Selecione o funcionário'}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(420px,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar funcionário..." />
          <CommandList>
            <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
            <CommandGroup>
              {employees.map((employee) => (
                <CommandItem
                  key={employee.id}
                  value={buildEmployeeSearchText(employee)}
                  onSelect={() => {
                    onChange(employee.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === employee.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="min-w-0">
                    <p className="truncate">{employee.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{[employee.department, employee.position, employee.email].filter(Boolean).join(' · ') || 'Sem dados complementares'}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
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

function formatScheduleRules(schedule: HrWorkSchedule | null | undefined) {
  if (!schedule?.weekly_rules) return 'Sem regra de horario';
  const labels = new Map(weekdayOptions.map((day) => [day.value, day.label]));
  const dailyRules = schedule.weekly_rules.daily_rules;
  if (dailyRules && Object.keys(dailyRules).length > 0) {
    return Object.entries(dailyRules)
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([day, rule]) => `${labels.get(Number(day)) ?? day} ${rule.start_time ?? '--:--'}-${rule.end_time ?? '--:--'} (${rule.break_minutes ?? 0}min)`)
      .join(' · ');
  }

  return `${formatWeekdays(schedule.weekly_rules.days)} · ${schedule.weekly_rules.start_time ?? '--:--'}-${schedule.weekly_rules.end_time ?? '--:--'} (${schedule.weekly_rules.break_minutes ?? 0}min)`;
}
