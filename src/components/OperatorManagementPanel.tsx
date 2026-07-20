import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { BriefcaseBusiness, CalendarDays, Camera, Eye, KeyRound, MapPin, Pencil, Percent, Plus, Trash2, Upload, Users, Wallet, XCircle } from 'lucide-react';
import type { Expense, Sale } from '@/types';
import { getOperatorCredentialError, operatorCredentialHint } from '../../shared/security/operatorCredential';
import { getPublicErrorMessage, getRedactedLogValue } from '../../shared/security/redaction';
import { readDesktopActivation } from '@/lib/desktopActivation';
import { deleteOfflineOperatorAccess, saveOfflineOperatorAccess } from '@/lib/offlineOperatorAccess';
import { OperatorPermissionSelector, type OperatorPermissionOption } from '@/components/OperatorPermissionSelector';
import { usePermissions } from '@/contexts/usePermissions';
import {
  OPERATIONAL_MANAGER_PERMISSION_KEYS,
  SENSITIVE_ADMIN_PERMISSION_KEYS,
  isErpPermissionKey,
  togglePermissionWithDependencies,
  type ErpPermissionKey,
} from '@/lib/permissions';

// Generated Supabase types are behind the current schema for these admin tables.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface OperatorProfile {
  user_id: string;
  username: string;
  role: StaffRole;
  job_title: string | null;
  created_at: string;
  commission_enabled?: boolean | null;
  commission_rate_pct?: number | string | null;
}

type StaffRole = 'operator' | 'waiter' | 'hr';

interface OpenCashSession {
  id: string;
  operator_user_id: string;
  operator_name: string;
  opening_amount: number;
  opened_at: string;
}

type PaymentMethodKey = 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito';

interface OpenCashSummary {
  entriesTotal: number;
  cashOutTotal: number;
  currentBalance: number;
  paymentTotals: Record<PaymentMethodKey, number>;
  otherEntriesTotal: number;
  salesCount: number;
  cashOutCount: number;
  hasLegacyCashOutGap: boolean;
}
interface OperatorFunctionResponse {
  success?: boolean;
  operators?: Array<OperatorProfile & {
    full_name?: string | null;
    photo_url?: string | null;
    address_zip_code?: string | null;
    address_street?: string | null;
    address_number?: string | null;
    address_complement?: string | null;
    address_neighborhood?: string | null;
    address_city?: string | null;
    address_state?: string | null;
    work_journey?: string | null;
    permission_keys?: string[];
    commission_enabled?: boolean | null;
    commission_rate_pct?: number | string | null;
  }>;
  openCashSessions?: OpenCashSession[];
  cashSession?: {
    id: string;
  };
  operator?: {
    user_id: string;
    username: string;
    role?: StaffRole;
    job_title?: string;
    commission_enabled?: boolean | null;
    commission_rate_pct?: number | string | null;
  };
  error?: string;
}

interface AdminAccessAuthorization {
  accessToken?: string;
  login: string;
  password: string;
}

interface EmployeeProfileDetails {
  profile_user_id: string | null;
  full_name?: string | null;
  photo_url?: string | null;
  address_zip_code?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  work_journey?: string | null;
}

interface OperatorManagementPanelProps {
  createDialogOpen?: boolean;
  onCreateDialogOpenChange?: (open: boolean) => void;
  initialStaffRole?: StaffRole;
}

const fallbackJobTitle: Record<StaffRole, string> = {
  operator: 'Colaborador',
  waiter: 'Colaborador',
  hr: 'Analista de RH',
};
const staffRoleLabels: Record<StaffRole, string> = {
  operator: 'Colaborador',
  waiter: 'Colaborador',
  hr: 'Colaborador',
};
const isHrPermissionKey = (permissionKey: ErpPermissionKey) => permissionKey.startsWith('hr.');
const isEmployeePortalPermissionKey = (permissionKey: ErpPermissionKey) => permissionKey.startsWith('employee_portal.');
const isEnterpriseOnlyPermissionKey = (permissionKey: ErpPermissionKey) =>
  isHrPermissionKey(permissionKey) || isEmployeePortalPermissionKey(permissionKey);
const lockedStaffPermissionKeys = new Set<ErpPermissionKey>();
const managerProtectedGrantKeys = new Set<ErpPermissionKey>([
  ...SENSITIVE_ADMIN_PERMISSION_KEYS,
  'staff.manage',
  'multi_store.manage',
]);
const ensureRequiredStaffPermissions = (permissionKeys: Iterable<ErpPermissionKey>) => new Set<ErpPermissionKey>([
  ...permissionKeys,
  ...lockedStaffPermissionKeys,
]);
const resolveStaffRoleFromPermissions = (_permissionKeys: Iterable<ErpPermissionKey>): StaffRole => 'operator';

const normalizeLabel = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';
const normalizePersonName = (value: string | null | undefined) => value?.trim().replace(/\s+/g, ' ') ?? '';
const parsePercentInput = (value: string) => {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};
const formatPercentInput = (value: number | string | null | undefined) => {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed).replace('.', ',') : '';
};
const normalizePersonNameKey = (value: string | null | undefined) =>
  normalizePersonName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const normalizeOptionalText = (value: string | null | undefined) => value?.trim() ?? '';
const formatMoney = (value: number) => `R$ ${value.toFixed(2)}`;

const weekDayOptions = [
  { key: 'seg', label: 'Seg' },
  { key: 'ter', label: 'Ter' },
  { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' },
  { key: 'sex', label: 'Sex' },
  { key: 'sab', label: 'Sab' },
  { key: 'dom', label: 'Dom' },
] as const;
type WeekDayKey = (typeof weekDayOptions)[number]['key'];

const parseBasicWorkJourney = (value: string | null | undefined) => {
  const [daysPart = '', timePart = ''] = (value ?? '').split('|').map((part) => part.trim());
  const days = new Set<WeekDayKey>();
  const normalizedDaysPart = daysPart
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  weekDayOptions.forEach((day) => {
    if (normalizedDaysPart.includes(day.key)) days.add(day.key);
  });

  const timeMatch = timePart.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
  return {
    days,
    startTime: timeMatch?.[1] ?? '',
    endTime: timeMatch?.[2] ?? '',
  };
};

const formatBasicWorkJourney = (
  days: ReadonlySet<WeekDayKey>,
  startTime: string,
  endTime: string,
) => {
  const selectedDays = weekDayOptions
    .filter((day) => days.has(day.key))
    .map((day) => day.label)
    .join(', ');
  const timeRange = startTime && endTime ? `${startTime}-${endTime}` : '';

  if (selectedDays && timeRange) return `${selectedDays} | ${timeRange}`;
  return selectedDays || timeRange;
};

export function OperatorManagementPanel({
  createDialogOpen: controlledCreateDialogOpen,
  onCreateDialogOpenChange,
  initialStaffRole,
}: OperatorManagementPanelProps) {
  const { isAdmin, ownerUserId, session, user, username: currentUsername, profileEmail } = useAuth();
  const { hasPermission } = usePermissions();
  const { sales, expenses, loading: dataLoading } = useData();
  const [operators, setOperators] = useState<OperatorProfile[]>([]);
  const [openCashSessions, setOpenCashSessions] = useState<OpenCashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [openingCash, setOpeningCash] = useState(false);
  const [closingCash, setClosingCash] = useState(false);
  const [deletingOperatorId, setDeletingOperatorId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [commissionEnabled, setCommissionEnabled] = useState(false);
  const [commissionRatePct, setCommissionRatePct] = useState('');
  const [adminAuthorizationOpen, setAdminAuthorizationOpen] = useState(false);
  const [pendingAccessAction, setPendingAccessAction] = useState<'create' | 'update' | 'reset_password' | null>(null);
  const [adminAuthorizationEmail, setAdminAuthorizationEmail] = useState('');
  const [adminAuthorizationPassword, setAdminAuthorizationPassword] = useState('');
  const [adminAuthorizationError, setAdminAuthorizationError] = useState('');
  const [permissionOptions, setPermissionOptions] = useState<OperatorPermissionOption[]>([]);
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<Set<ErpPermissionKey>>(new Set());
  const [permissionKeysByOperatorId, setPermissionKeysByOperatorId] = useState<Record<string, Set<ErpPermissionKey>>>({});
  const [loadingPermissionOptions, setLoadingPermissionOptions] = useState(false);
  const [createStep, setCreateStep] = useState<'data' | 'permissions' | 'review'>('data');
  const [openingAmount, setOpeningAmount] = useState('');
  const [openCashDialogOpen, setOpenCashDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [operatorToOpenCash, setOperatorToOpenCash] = useState<OperatorProfile | null>(null);
  const [cashSessionToClose, setCashSessionToClose] = useState<{
    operator: OperatorProfile;
    session: OpenCashSession;
    summary: OpenCashSummary | null;
  } | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<OperatorProfile | null>(null);
  const [editingOperator, setEditingOperator] = useState<OperatorProfile | null>(null);
  const [closeCashAdminEmail, setCloseCashAdminEmail] = useState('');
  const [closeCashAdminPassword, setCloseCashAdminPassword] = useState('');
  const [closeCashError, setCloseCashError] = useState('');
  const [fullName, setFullName] = useState('');
  const [operatorFullNamesById, setOperatorFullNamesById] = useState<Record<string, string>>({});
  const [employeeDetailsByOperatorId, setEmployeeDetailsByOperatorId] = useState<Record<string, EmployeeProfileDetails>>({});
  const [photoUrl, setPhotoUrl] = useState('');
  const [addressZipCode, setAddressZipCode] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [addressNeighborhood, setAddressNeighborhood] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [workScheduleDays, setWorkScheduleDays] = useState<Set<WeekDayKey>>(new Set());
  const [workScheduleStartTime, setWorkScheduleStartTime] = useState('');
  const [workScheduleEndTime, setWorkScheduleEndTime] = useState('');
  const [latestCredential, setLatestCredential] = useState<{
    username: string;
    jobTitle: string;
  } | null>(null);
  const [internalCreateDialogOpen, setInternalCreateDialogOpen] = useState(false);

  const createDialogOpen = controlledCreateDialogOpen ?? internalCreateDialogOpen;
  const setCreateDialogOpen = onCreateDialogOpenChange ?? setInternalCreateDialogOpen;
  const canManageStaffAccess = isAdmin || hasPermission('staff.manage');
  const canManageCashActions = isAdmin || hasPermission('pdv.open_cash');
  const canDeleteStaffAccess = isAdmin;
  const accessAuthorizationLabel = isAdmin ? 'administrador' : 'gerente';

  const resetEmployeeBasicProfileForm = useCallback(() => {
    setPhotoUrl('');
    setAddressZipCode('');
    setAddressStreet('');
    setAddressNumber('');
    setAddressComplement('');
    setAddressNeighborhood('');
    setAddressCity('');
    setAddressState('');
    setWorkScheduleDays(new Set());
    setWorkScheduleStartTime('');
    setWorkScheduleEndTime('');
  }, []);

  const setEmployeeBasicProfileForm = useCallback((details?: EmployeeProfileDetails | null) => {
    const parsedJourney = parseBasicWorkJourney(details?.work_journey);
    setPhotoUrl(normalizeOptionalText(details?.photo_url));
    setAddressZipCode(normalizeOptionalText(details?.address_zip_code));
    setAddressStreet(normalizeOptionalText(details?.address_street));
    setAddressNumber(normalizeOptionalText(details?.address_number));
    setAddressComplement(normalizeOptionalText(details?.address_complement));
    setAddressNeighborhood(normalizeOptionalText(details?.address_neighborhood));
    setAddressCity(normalizeOptionalText(details?.address_city));
    setAddressState(normalizeOptionalText(details?.address_state));
    setWorkScheduleDays(parsedJourney.days);
    setWorkScheduleStartTime(parsedJourney.startTime);
    setWorkScheduleEndTime(parsedJourney.endTime);
  }, []);

  const buildEmployeeDetailsPayload = useCallback(() => ({
    photoUrl: normalizeOptionalText(photoUrl),
    addressZipCode: normalizeOptionalText(addressZipCode),
    addressStreet: normalizeOptionalText(addressStreet),
    addressNumber: normalizeOptionalText(addressNumber),
    addressComplement: normalizeOptionalText(addressComplement),
    addressNeighborhood: normalizeOptionalText(addressNeighborhood),
    addressCity: normalizeOptionalText(addressCity),
    addressState: normalizeOptionalText(addressState).toUpperCase(),
    workJourney: formatBasicWorkJourney(workScheduleDays, workScheduleStartTime, workScheduleEndTime),
  }), [
    addressCity,
    addressComplement,
    addressNeighborhood,
    addressNumber,
    addressState,
    addressStreet,
    addressZipCode,
    photoUrl,
    workScheduleDays,
    workScheduleEndTime,
    workScheduleStartTime,
  ]);

  const handlePhotoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Importe um arquivo de imagem.');
      return;
    }

    if (file.size > 1_500_000) {
      toast.error('Use uma foto com ate 1,5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setPhotoUrl(reader.result);
    };
    reader.onerror = () => toast.error('Nao foi possivel importar a foto.');
    reader.readAsDataURL(file);
  };

  const toggleWorkScheduleDay = (day: WeekDayKey, checked: boolean) => {
    setWorkScheduleDays((current) => {
      const next = new Set(current);
      if (checked) next.add(day);
      else next.delete(day);
      return next;
    });
  };

  const resetCreateForm = useCallback(() => {
    setFullName('');
    setUsername('');
    setPassword('');
    setJobTitle('');
    setCommissionEnabled(false);
    setCommissionRatePct('');
    setSelectedPermissionKeys(ensureRequiredStaffPermissions([]));
    resetEmployeeBasicProfileForm();
    setCreateStep('data');
  }, [resetEmployeeBasicProfileForm]);

  const resetAdminAuthorization = useCallback(() => {
    setAdminAuthorizationOpen(false);
    setPendingAccessAction(null);
    setAdminAuthorizationEmail('');
    setAdminAuthorizationPassword('');
    setAdminAuthorizationError('');
  }, []);

  const handleCreateDialogOpenChange = useCallback((open: boolean) => {
    setCreateDialogOpen(open);

    if (!open) {
      setEditingOperator(null);
      resetAdminAuthorization();
      resetCreateForm();
    }
  }, [resetAdminAuthorization, resetCreateForm, setCreateDialogOpen]);

  const accessDialogOpen = createDialogOpen || Boolean(editingOperator);

  useEffect(() => {
    if (!createDialogOpen || editingOperator || !initialStaffRole) return;
    setJobTitle((current) => current.trim() ? current : fallbackJobTitle[initialStaffRole]);
  }, [createDialogOpen, editingOperator, initialStaffRole]);

  const handleAccessDialogOpenChange = useCallback((open: boolean) => {
    if (open) return;
    setEditingOperator(null);
    if (createDialogOpen) setCreateDialogOpen(false);
    resetAdminAuthorization();
    resetCreateForm();
  }, [createDialogOpen, resetAdminAuthorization, resetCreateForm, setCreateDialogOpen]);

  useEffect(() => {
    if (!accessDialogOpen || permissionOptions.length > 0) return;
    setLoadingPermissionOptions(true);
    void db.from('erp_permission_catalog')
      .select('permission_key, module_key, name, description')
      .order('module_key')
      .order('name')
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (error) {
          console.error('Erro ao carregar acessos do operador:', getRedactedLogValue(error));
          toast.error('Nao foi possivel carregar os acessos disponiveis.');
          return;
        }
        setPermissionOptions(((data ?? []) as OperatorPermissionOption[]).filter((permission) =>
          isErpPermissionKey(permission.permission_key)
          && !isEnterpriseOnlyPermissionKey(permission.permission_key)
        ));
      })
      .finally(() => setLoadingPermissionOptions(false));
  }, [accessDialogOpen, permissionOptions.length]);

  const visiblePermissionOptions = useMemo(
    () => isAdmin
      ? permissionOptions
      : permissionOptions.filter((permission) => !managerProtectedGrantKeys.has(permission.permission_key)),
    [isAdmin, permissionOptions],
  );

  const resolveFunctionErrorMessage = useCallback(async (
    error: unknown,
    fallbackMessage: string,
    data?: OperatorFunctionResponse
  ) => {
    let functionErrorMessage = data?.error || '';

    if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
      try {
        const errorPayload = await error.context.clone().json() as { error?: string; message?: string };
        functionErrorMessage = errorPayload.error || errorPayload.message || functionErrorMessage;
      } catch {
        functionErrorMessage = error.context.status === 401 && !functionErrorMessage
          ? 'Sua sessão expirou. Entre novamente para continuar.'
          : functionErrorMessage;
      }
    }

    return functionErrorMessage || getPublicErrorMessage(error, fallbackMessage);
  }, []);

  const saveOperatorOfflineAccessIfPossible = useCallback(async (
    operator: OperatorFunctionResponse['operator'],
    secret: string,
  ) => {
    if (!operator || !ownerUserId || typeof window === 'undefined' || !window.electronAPI) {
      return;
    }

    const activation = readDesktopActivation();
    if (!activation || activation.ownerUserId !== ownerUserId) {
      return;
    }

    try {
      if (operator.role === 'hr') {
        return;
      }

      await saveOfflineOperatorAccess({
        userId: operator.user_id,
        ownerUserId,
        username: operator.username,
        email: null,
        role: 'operator',
        secret,
      });
    } catch (error) {
      console.error('Nao foi possivel salvar o acesso offline do operador:', getRedactedLogValue(error));
      toast.warning('Colaborador salvo online, mas nao foi possivel preparar o login offline nesta maquina.');
    }
  }, [ownerUserId]);

  const loadData = useCallback(async () => {
    if (!canManageStaffAccess || !ownerUserId) {
      setOperators([]);
      setOpenCashSessions([]);
      setOperatorFullNamesById({});
      setEmployeeDetailsByOperatorId({});
      setPermissionKeysByOperatorId({});
      setLoading(false);
      return;
    }

    setLoading(true);

    if (!isAdmin) {
      if (!session?.access_token) {
        setOperators([]);
        setOpenCashSessions([]);
        setOperatorFullNamesById({});
        setEmployeeDetailsByOperatorId({});
        setPermissionKeysByOperatorId({});
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke<OperatorFunctionResponse>('manage-operators', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: 'list' },
      });

      if (error || !data?.success) {
        toast.error(await resolveFunctionErrorMessage(error, 'Nao foi possivel carregar os acessos dos colaboradores.', data));
        setOperators([]);
        setOpenCashSessions([]);
        setOperatorFullNamesById({});
        setEmployeeDetailsByOperatorId({});
        setPermissionKeysByOperatorId({});
        setLoading(false);
        return;
      }

      const nextOperators = (data.operators ?? []).map(operator => ({
        ...operator,
        role: operator.role === 'waiter' ? 'waiter' : operator.role === 'hr' ? 'hr' : 'operator',
      }));
      const nextOperatorFullNamesById: Record<string, string> = {};
      const nextEmployeeDetailsByOperatorId: Record<string, EmployeeProfileDetails> = {};
      const nextPermissionKeysByOperatorId: Record<string, Set<ErpPermissionKey>> = {};

      for (const operator of data.operators ?? []) {
        if (operator.full_name) nextOperatorFullNamesById[operator.user_id] = operator.full_name;
        nextEmployeeDetailsByOperatorId[operator.user_id] = {
          profile_user_id: operator.user_id,
          full_name: operator.full_name ?? null,
          photo_url: operator.photo_url ?? null,
          address_zip_code: operator.address_zip_code ?? null,
          address_street: operator.address_street ?? null,
          address_number: operator.address_number ?? null,
          address_complement: operator.address_complement ?? null,
          address_neighborhood: operator.address_neighborhood ?? null,
          address_city: operator.address_city ?? null,
          address_state: operator.address_state ?? null,
          work_journey: operator.work_journey ?? null,
        };
        nextPermissionKeysByOperatorId[operator.user_id] = ensureRequiredStaffPermissions(
          (operator.permission_keys ?? []).filter(isErpPermissionKey).filter((permissionKey) => !isEnterpriseOnlyPermissionKey(permissionKey)),
        );
      }

      setOperators(nextOperators);
      setOpenCashSessions((data.openCashSessions ?? []) as OpenCashSession[]);
      setOperatorFullNamesById(nextOperatorFullNamesById);
      setEmployeeDetailsByOperatorId(nextEmployeeDetailsByOperatorId);
      setPermissionKeysByOperatorId(nextPermissionKeysByOperatorId);
      setLoading(false);
      return;
    }

    const [
      { data: operatorRows, error: operatorError },
      { data: openRows, error: openError },
      { data: permissionRows, error: permissionError },
      { data: employeeRows, error: employeeError },
    ] = await Promise.all([
      db
        .from('profiles')
        .select('user_id, username, role, job_title, created_at, commission_enabled, commission_rate_pct')
        .eq('owner_user_id', ownerUserId)
        .in('role', ['operator', 'waiter', 'hr'])
        .order('created_at', { ascending: false }),
      db
        .from('cash_sessions')
        .select('id, operator_user_id, operator_name, opening_amount, opened_at')
        .eq('owner_user_id', ownerUserId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false }),
      db
        .from('erp_staff_permission_overrides')
        .select('user_id, permission_key, allowed')
        .eq('owner_user_id', ownerUserId)
        .eq('allowed', true),
      db
        .from('hr_employees')
        .select('profile_user_id, full_name, photo_url, address_zip_code, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, work_journey')
        .eq('owner_user_id', ownerUserId)
        .not('profile_user_id', 'is', null),
    ]);

    if (operatorError) {
      console.error('Erro ao carregar operadores:', getRedactedLogValue(operatorError));
      toast.error('Não foi possível carregar os colaboradores');
    }

    if (openError) {
      console.error('Erro ao carregar caixas abertos:', getRedactedLogValue(openError));
      toast.error('Não foi possível carregar os caixas abertos');
    }

    if (permissionError) {
      console.error('Erro ao carregar acessos dos colaboradores:', getRedactedLogValue(permissionError));
      toast.error('Nao foi possivel carregar os acessos dos colaboradores');
    }

    if (employeeError) {
      console.error('Erro ao carregar nomes do RH:', getRedactedLogValue(employeeError));
    }

    setOperators(((operatorRows as OperatorProfile[]) ?? []).map(operator => ({
      ...operator,
      role: operator.role === 'waiter' ? 'waiter' : operator.role === 'hr' ? 'hr' : 'operator',
    })));
    setOpenCashSessions((openRows as OpenCashSession[]) ?? []);
    const nextOperatorFullNamesById: Record<string, string> = {};
    const nextEmployeeDetailsByOperatorId: Record<string, EmployeeProfileDetails> = {};
    for (const row of ((employeeRows ?? []) as EmployeeProfileDetails[])) {
      if (!row.profile_user_id) continue;
      if (row.full_name) nextOperatorFullNamesById[row.profile_user_id] = row.full_name;
      nextEmployeeDetailsByOperatorId[row.profile_user_id] = row;
    }
    setOperatorFullNamesById(nextOperatorFullNamesById);
    setEmployeeDetailsByOperatorId(nextEmployeeDetailsByOperatorId);
    const nextPermissionKeysByOperatorId: Record<string, Set<ErpPermissionKey>> = {};
    for (const row of (permissionRows ?? []) as Array<{ user_id: string; permission_key: string }>) {
      if (!isErpPermissionKey(row.permission_key)) continue;
      if (isEnterpriseOnlyPermissionKey(row.permission_key)) continue;
      nextPermissionKeysByOperatorId[row.user_id] ??= new Set<ErpPermissionKey>();
      nextPermissionKeysByOperatorId[row.user_id].add(row.permission_key);
    }
    setPermissionKeysByOperatorId(nextPermissionKeysByOperatorId);
    setLoading(false);
  }, [canManageStaffAccess, isAdmin, ownerUserId, resolveFunctionErrorMessage, session?.access_token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openSessionByOperatorId = new Map(openCashSessions.map(session => [session.operator_user_id, session]));
  const hasSingleOpenSession = openCashSessions.length === 1;
  const isLoading = loading || dataLoading;

  const matchesSessionSale = useCallback((sale: Sale, cashSession: OpenCashSession) => {
    if (sale.status === 'cancelled') return false;
    if (new Date(sale.date).getTime() < new Date(cashSession.opened_at).getTime()) return false;
    return normalizeLabel(sale.seller_name) === normalizeLabel(cashSession.operator_name);
  }, []);

  const matchesSessionExpense = useCallback((expense: Expense, cashSession: OpenCashSession) => {
    if (expense.category !== 'Saída de caixa') return false;
    if (new Date(expense.date).getTime() < new Date(cashSession.opened_at).getTime()) return false;
    return hasSingleOpenSession;
  }, [hasSingleOpenSession]);

  const openCashSummaryByOperatorId = useMemo(() => {
    return new Map<string, OpenCashSummary>(
      openCashSessions.map(cashSession => {
        const sessionSales = sales.filter(sale => matchesSessionSale(sale, cashSession));
        const sessionCashOuts = expenses.filter(expense => matchesSessionExpense(expense, cashSession));
        const paymentTotals: Record<PaymentMethodKey, number> = {
          dinheiro: 0,
          pix: 0,
          cartao_debito: 0,
          cartao_credito: 0,
        };

        let otherEntriesTotal = 0;

        for (const sale of sessionSales) {
          if (sale.payment_method in paymentTotals) {
            paymentTotals[sale.payment_method as PaymentMethodKey] += Number(sale.total || 0);
            continue;
          }

          otherEntriesTotal += Number(sale.total || 0);
        }

        const entriesTotal = sessionSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
        const cashOutTotal = sessionCashOuts.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
        const hasLegacyCashOutGap = !hasSingleOpenSession && expenses.some(expense =>
          expense.category === 'Saída de caixa'
          && new Date(expense.date).getTime() >= new Date(cashSession.opened_at).getTime()
        );

        return [
          cashSession.operator_user_id,
          {
            entriesTotal,
            cashOutTotal,
            currentBalance: Number(cashSession.opening_amount || 0) + entriesTotal - cashOutTotal,
            paymentTotals,
            otherEntriesTotal,
            salesCount: sessionSales.length,
            cashOutCount: sessionCashOuts.length,
            hasLegacyCashOutGap,
          },
        ];
      })
    );
  }, [expenses, hasSingleOpenSession, matchesSessionExpense, matchesSessionSale, openCashSessions, sales]);

  const togglePermission = (permissionKey: ErpPermissionKey, checked: boolean) => {
    if (lockedStaffPermissionKeys.has(permissionKey)) return;
    setSelectedPermissionKeys((current) => ensureRequiredStaffPermissions(togglePermissionWithDependencies(current, permissionKey, checked)));
  };

  const togglePermissionModule = (permissionKeys: ErpPermissionKey[], checked: boolean) => {
    setSelectedPermissionKeys((current) => ensureRequiredStaffPermissions(permissionKeys.reduce(
      (next, permissionKey) => lockedStaffPermissionKeys.has(permissionKey)
        ? next
        : togglePermissionWithDependencies(next, permissionKey, checked),
      ensureRequiredStaffPermissions(current),
    )));
  };

  const toggleManagerPermissions = (checked: boolean) => {
    const visibleKeys = new Set(visiblePermissionOptions.map((permission) => permission.permission_key));
    const managerKeys = OPERATIONAL_MANAGER_PERMISSION_KEYS.filter((permissionKey) => visibleKeys.has(permissionKey));

    setSelectedPermissionKeys((current) => ensureRequiredStaffPermissions(managerKeys.reduce(
      (next, permissionKey) => togglePermissionWithDependencies(next, permissionKey, checked),
      ensureRequiredStaffPermissions(current),
    )));
  };

  const selectedPermissionNames = visiblePermissionOptions
    .filter((permission) => selectedPermissionKeys.has(permission.permission_key))
    .map((permission) => permission.name);
  const inferredStaffRole = resolveStaffRoleFromPermissions(selectedPermissionKeys);
  const normalizedFullName = normalizePersonName(fullName);
  const duplicateFullName = normalizedFullName
    ? operators.find((operator) =>
      operator.user_id !== editingOperator?.user_id
      && normalizePersonNameKey(operatorFullNamesById[operator.user_id] ?? operator.username) === normalizePersonNameKey(normalizedFullName),
    )
    : undefined;

  const operatorCanOperateCash = (operator: OperatorProfile) =>
    operator.role !== 'hr' && (permissionKeysByOperatorId[operator.user_id]?.has('pdv.open_cash') ?? false);

  const operatorHasManagerProtectedAccess = (operator: OperatorProfile) => {
    const permissionKeys = permissionKeysByOperatorId[operator.user_id] ?? new Set<ErpPermissionKey>();
    return [...permissionKeys].some((permissionKey) => managerProtectedGrantKeys.has(permissionKey));
  };

  const handleEditOperator = (operator: OperatorProfile) => {
    if (!isAdmin && (operator.user_id === user?.id || operatorHasManagerProtectedAccess(operator))) {
      toast.error('Gerente pode editar somente colaboradores operacionais comuns.');
      return;
    }

    setEditingOperator(operator);
    setFullName(operatorFullNamesById[operator.user_id] ?? operator.username);
    setUsername(operator.username);
    setPassword('');
    resetAdminAuthorization();
    setJobTitle(operator.job_title?.trim() || fallbackJobTitle[operator.role]);
    setCommissionEnabled(operator.commission_enabled === true);
    setCommissionRatePct(formatPercentInput(operator.commission_rate_pct));
    setSelectedPermissionKeys(ensureRequiredStaffPermissions(permissionKeysByOperatorId[operator.user_id] ?? []));
    setEmployeeBasicProfileForm(employeeDetailsByOperatorId[operator.user_id]);
    setCreateStep('data');
  };

  if (!canManageStaffAccess) return null;

  const validateAccessFormBeforeAuthorization = () => {
    if (!session?.access_token) {
      toast.error('Sua sessão expirou. Entre novamente para cadastrar colaboradores.');
      return false;
    }

    if (!normalizedFullName || normalizedFullName.length < 3) {
      toast.error('Informe o nome completo do colaborador.');
      return false;
    }

    if (duplicateFullName) {
      toast.error('Ja existe colaborador com esse nome completo. Use um segundo nome, sobrenome ou identificador diferente.');
      return false;
    }

    if (!username.trim() || !password.trim() || !jobTitle.trim()) {
      toast.error('Preencha nome, funcao, usuario e PIN');
      return false;
    }

    if (selectedPermissionKeys.size === 0) {
      toast.error('Selecione ao menos um acesso para o colaborador.');
      setCreateStep('permissions');
      return false;
    }

    if (!isAdmin && [...selectedPermissionKeys].some((permissionKey) => managerProtectedGrantKeys.has(permissionKey))) {
      toast.error('Gerente não pode conceder acessos administrativos sensíveis.');
      setCreateStep('permissions');
      return false;
    }

    const credentialError = getOperatorCredentialError(password.trim());
    if (credentialError) {
      toast.error(credentialError);
      return false;
    }

    const commissionRate = parsePercentInput(commissionRatePct);
    if (isAdmin && commissionEnabled && (commissionRate <= 0 || commissionRate > 100)) {
      toast.error('Informe uma comissão entre 0,01% e 100%.');
      return false;
    }

    return true;
  };

  const validateUpdateAccessBeforeAuthorization = () => {
    if (!session?.access_token || !editingOperator) {
      toast.error('Sua sessao expirou. Entre novamente para editar colaboradores.');
      return false;
    }

    if (jobTitle.trim().length < 2 || jobTitle.trim().length > 60) {
      toast.error('Informe uma funcao entre 2 e 60 caracteres.');
      return false;
    }

    if (!normalizedFullName || normalizedFullName.length < 3) {
      toast.error('Informe o nome completo do colaborador.');
      return false;
    }

    if (duplicateFullName) {
      toast.error('Ja existe colaborador com esse nome completo. Use um segundo nome, sobrenome ou identificador diferente.');
      return false;
    }

    if (selectedPermissionKeys.size === 0) {
      toast.error('Selecione ao menos um acesso para o colaborador.');
      setCreateStep('permissions');
      return false;
    }

    if (!isAdmin && [...selectedPermissionKeys].some((permissionKey) => managerProtectedGrantKeys.has(permissionKey))) {
      toast.error('Gerente não pode conceder acessos administrativos sensíveis.');
      setCreateStep('permissions');
      return false;
    }

    const commissionRate = parsePercentInput(commissionRatePct);
    if (isAdmin && commissionEnabled && (commissionRate <= 0 || commissionRate > 100)) {
      toast.error('Informe uma comissão entre 0,01% e 100%.');
      return false;
    }

    return true;
  };

  const requestAdminAuthorization = () => {
    const isUpdate = Boolean(editingOperator);
    const valid = isUpdate ? validateUpdateAccessBeforeAuthorization() : validateAccessFormBeforeAuthorization();
    if (!valid) return;

    setPendingAccessAction(isUpdate ? 'update' : 'create');
    setAdminAuthorizationEmail('');
    setAdminAuthorizationPassword('');
    setAdminAuthorizationError('');
    setAdminAuthorizationOpen(true);
  };

  const verifyAccessForOperatorSave = async (
    login: string,
    password: string,
  ): Promise<AdminAccessAuthorization | null> => {
    const normalizedLogin = login.trim().toLowerCase();
    const normalizedPassword = password.trim();

    if (!session?.access_token) {
      setAdminAuthorizationError('Sua sessao expirou. Entre novamente para continuar.');
      return null;
    }

    return { login: normalizedLogin, password: normalizedPassword };
  };

  const handleCreateOperator = async (adminEmail: string, adminPassword: string, adminAccessToken?: string) => {
    setCreating(true);
    const commissionPayload = isAdmin
      ? {
        commissionEnabled,
        commissionRatePct: commissionEnabled ? parsePercentInput(commissionRatePct) : 0,
      }
      : {};

    const { data, error } = await supabase.functions.invoke<OperatorFunctionResponse>('manage-operators', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        action: 'create',
        fullName: normalizedFullName,
        username: username.trim(),
        password: password.trim(),
        jobTitle: jobTitle.trim(),
        staffRole: inferredStaffRole,
        permissionKeys: [...ensureRequiredStaffPermissions(selectedPermissionKeys)],
        ...commissionPayload,
        ...buildEmployeeDetailsPayload(),
        adminEmail,
        adminPassword,
        adminAccessToken,
      },
    });

    if (error || !data?.success || !data.operator) {
      const message = await resolveFunctionErrorMessage(error, 'Não foi possível criar o colaborador', data);
      toast.error(message);
      setAdminAuthorizationError(message);
      setAdminAuthorizationPassword('');
      setCreating(false);
      return false;
    }

    setLatestCredential({
      username: data.operator.username,
      jobTitle: data.operator.job_title || jobTitle.trim(),
    });
    await saveOperatorOfflineAccessIfPossible(data.operator, password.trim());
    resetCreateForm();
    handleCreateDialogOpenChange(false);
    toast.success('Colaborador criado com sucesso');
    await loadData();
    setCreating(false);
    resetAdminAuthorization();
    return true;
  };

  const handleUpdateOperatorAccess = async (adminEmail: string, adminPassword: string, adminAccessToken?: string) => {
    if (!editingOperator) return false;
    setCreating(true);
    const commissionPayload = isAdmin
      ? {
        commissionEnabled,
        commissionRatePct: commissionEnabled ? parsePercentInput(commissionRatePct) : 0,
      }
      : {};
    const { data, error } = await supabase.functions.invoke<OperatorFunctionResponse>('manage-operators', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: {
        action: 'update_access',
        operatorUserId: editingOperator.user_id,
        fullName: normalizedFullName,
        jobTitle: jobTitle.trim(),
        staffRole: inferredStaffRole,
        permissionKeys: [...ensureRequiredStaffPermissions(selectedPermissionKeys)],
        ...commissionPayload,
        ...buildEmployeeDetailsPayload(),
        adminEmail,
        adminPassword,
        adminAccessToken,
      },
    });

    if (error || !data?.success) {
      const message = await resolveFunctionErrorMessage(error, 'Nao foi possivel atualizar o colaborador', data);
      toast.error(message);
      setAdminAuthorizationError(message);
      setAdminAuthorizationPassword('');
      setCreating(false);
      return false;
    }

    handleAccessDialogOpenChange(false);
    toast.success('Funcao e acessos atualizados');
    await loadData();
    setCreating(false);
    resetAdminAuthorization();
    return true;
  };

  const handleConfirmAdminAuthorization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const adminEmail = adminAuthorizationEmail.trim();
    const adminPassword = adminAuthorizationPassword.trim();

    if (!adminEmail || !adminPassword) {
      setAdminAuthorizationError(`Digite login e senha do ${accessAuthorizationLabel}.`);
      return;
    }

    setAdminAuthorizationError('');
    setCreating(true);
    const authorization = await verifyAccessForOperatorSave(adminEmail, adminPassword);
    if (!authorization) {
      setCreating(false);
      return;
    }

    try {
      if (pendingAccessAction === 'create') {
        await handleCreateOperator(authorization.login, authorization.password, authorization.accessToken);
        return;
      }
      if (pendingAccessAction === 'update') {
        await handleUpdateOperatorAccess(authorization.login, authorization.password, authorization.accessToken);
        return;
      }
      if (pendingAccessAction === 'reset_password') {
        await handleResetOperatorPassword(authorization.login, authorization.password, authorization.accessToken);
      }
    } finally {
      setCreating(false);
    }
  };

  const requestResetPasswordAuthorization = () => {
    if (!session?.access_token) {
      toast.error('Sua sessão expirou. Entre novamente para redefinir senhas.');
      return;
    }

    if (!selectedOperator) return;
    if (!isAdmin && (selectedOperator.user_id === user?.id || operatorHasManagerProtectedAccess(selectedOperator))) {
      toast.error('Gerente pode redefinir PIN somente de colaboradores operacionais comuns.');
      return;
    }

    if (!resetPassword.trim()) {
      toast.error('Informe o novo PIN');
      return;
    }
    const credentialError = getOperatorCredentialError(resetPassword.trim());
    if (credentialError) {
      toast.error(credentialError);
      return;
    }

    setPendingAccessAction('reset_password');
    setAdminAuthorizationEmail('');
    setAdminAuthorizationPassword('');
    setAdminAuthorizationError('');
    setAdminAuthorizationOpen(true);
  };

  const handleResetOperatorPassword = async (adminEmail: string, adminPassword: string, adminAccessToken?: string) => {
    if (!session?.access_token || !selectedOperator) return false;
    setResetting(true);

    const { data, error } = await supabase.functions.invoke<OperatorFunctionResponse>('manage-operators', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        action: 'reset_password',
        operatorUserId: selectedOperator.user_id,
        password: resetPassword.trim(),
        adminEmail,
        adminPassword,
        adminAccessToken,
      },
    });

    if (error || !data?.success || !data.operator) {
      toast.error(await resolveFunctionErrorMessage(error, 'Não foi possível redefinir a senha', data));
      setAdminAuthorizationError(await resolveFunctionErrorMessage(error, 'Não foi possível redefinir a senha', data));
      setResetting(false);
      return false;
    }

    setLatestCredential({
      username: data.operator.username,
      jobTitle: selectedOperator.job_title?.trim() || fallbackJobTitle[selectedOperator.role],
    });
    await saveOperatorOfflineAccessIfPossible(data.operator, resetPassword.trim());
    setResetPassword('');
    setSelectedOperator(null);
    setResetDialogOpen(false);
    toast.success('Senha redefinida com sucesso');
    await loadData();
    setResetting(false);
    resetAdminAuthorization();
    return true;
  };

  const handleOpenCashForOperator = async () => {
    if (!session?.access_token) {
      toast.error('Sua sessão expirou. Entre novamente para abrir caixas.');
      return;
    }

    if (!operatorToOpenCash) return;

    const parsedOpeningAmount = Number.parseFloat(openingAmount || '0');
    if (Number.isNaN(parsedOpeningAmount) || parsedOpeningAmount < 0) {
      toast.error('Informe um valor inicial valido');
      return;
    }

    setOpeningCash(true);

    const { data, error } = await supabase.functions.invoke<OperatorFunctionResponse>('manage-operators', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        action: 'open_cash',
        operatorUserId: operatorToOpenCash.user_id,
        openingAmount: Number(parsedOpeningAmount.toFixed(2)),
      },
    });

    if (error || !data?.success || !data.cashSession) {
      console.error('Erro ao abrir caixa do operador:', getRedactedLogValue(error));
      toast.error(await resolveFunctionErrorMessage(error, 'Não foi possível abrir o caixa para este colaborador', data));
      setOpeningCash(false);
      return;
    }

    toast.success(`Caixa aberto para ${operatorToOpenCash.username}`);
    setOpenCashDialogOpen(false);
    setOperatorToOpenCash(null);
    setOpeningAmount('');
    await loadData();
    setOpeningCash(false);
  };

  const resetCloseCashState = () => {
    setCashSessionToClose(null);
    setCloseCashAdminEmail('');
    setCloseCashAdminPassword('');
    setCloseCashError('');
  };

  const handleCloseCashWithAdmin = async () => {
    if (!cashSessionToClose) return;
    if (!session?.access_token) {
      setCloseCashError('Sua sessão expirou. Entre novamente para fechar caixa.');
      return;
    }

    const normalizedAdminEmail = closeCashAdminEmail.trim().toLowerCase();
    const adminPassword = closeCashAdminPassword.trim();

    if (!normalizedAdminEmail) {
      setCloseCashError('Digite o email do administrador.');
      return;
    }

    if (!adminPassword) {
      setCloseCashError('Digite a senha do administrador.');
      return;
    }

    setClosingCash(true);
    setCloseCashError('');

    try {
      const { data: verificationData, error: verificationError } = await supabase.functions.invoke<OperatorFunctionResponse>('manage-operators', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          action: 'verify_admin',
          adminEmail: normalizedAdminEmail,
          adminPassword,
        },
      });

      if (verificationError || !verificationData?.success) {
        setCloseCashError(await resolveFunctionErrorMessage(verificationError, 'Email ou senha de administrador incorretos.', verificationData));
        return;
      }

      const closedAt = new Date().toISOString();
      const closingBalance = cashSessionToClose.summary?.currentBalance
        ?? Number(cashSessionToClose.session.opening_amount || 0);

      const { error: closeError } = await db
        .from('cash_sessions')
        .update({
          status: 'closed',
          closed_at: closedAt,
          closed_by_user_id: user?.id ?? null,
          closed_by_name: currentUsername || profileEmail || session.user.email || normalizedAdminEmail,
          closing_balance: Number(closingBalance.toFixed(2)),
        })
        .eq('id', cashSessionToClose.session.id);

      if (closeError) {
        console.error('Erro ao fechar caixa pelas configurações:', getRedactedLogValue(closeError));
        setCloseCashError('Não foi possível registrar o fechamento do caixa.');
        return;
      }

      toast.success(`Caixa de ${cashSessionToClose.operator.username} fechado`);
      resetCloseCashState();
      await loadData();
    } catch (error) {
      console.error('Erro ao validar administrador para fechar caixa:', getRedactedLogValue(error));
      setCloseCashError('Não foi possível validar o administrador.');
    } finally {
      setClosingCash(false);
    }
  };

  const handleDeleteOperator = async (operator: OperatorProfile) => {
    if (!session?.access_token) {
      toast.error('Sua sessão expirou. Entre novamente para excluir colaboradores.');
      return;
    }

    setDeletingOperatorId(operator.user_id);

    const { data, error } = await supabase.functions.invoke<OperatorFunctionResponse>('manage-operators', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        action: 'delete',
        operatorUserId: operator.user_id,
      },
    });

    if (error || !data?.success) {
      console.error('Erro ao excluir operador:', getRedactedLogValue(error));
      toast.error(await resolveFunctionErrorMessage(error, 'Não foi possível excluir o colaborador', data));
      setDeletingOperatorId(null);
      return;
    }

    if (ownerUserId) {
      deleteOfflineOperatorAccess(ownerUserId, operator.username);
    }

    toast.success(`Colaborador ${operator.username} excluido com sucesso`);
    await loadData();
    setDeletingOperatorId(null);
  };

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-lg">Colaboradores, acessos e escala básica</CardTitle>
              <p className="text-sm text-muted-foreground">
                Use Editar para ajustar cadastro, foto, endereço, escala e acessos individuais.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <Button onClick={() => handleCreateDialogOpenChange(true)} className="w-full lg:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar colaborador
              </Button>

              <div className={`grid gap-2 ${isAdmin ? 'grid-cols-2 sm:w-[280px]' : 'sm:w-[180px]'}`}>
                <div className="rounded-lg border border-border bg-secondary/20 p-3">
                  <p className="text-xs text-muted-foreground">Equipe</p>
                  <p className="text-2xl font-bold">
                    <Users className="mr-2 inline h-4 w-4 text-primary" />
                    {operators.length}
                  </p>
                </div>
                {isAdmin ? (
                  <div className="rounded-lg border border-border bg-secondary/20 p-3">
                    <p className="text-xs text-muted-foreground">Caixas abertos</p>
                    <p className="text-2xl font-bold">
                      <Wallet className="mr-2 inline h-4 w-4 text-primary" />
                      {openCashSessions.length}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {latestCredential && (
            <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 shrink-0 text-primary" />
                <span><strong>{latestCredential.username}</strong> · {latestCredential.jobTitle}</span>
              </div>
              <span className="text-xs text-muted-foreground">Credencial salva e protegida.</span>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="font-semibold">Equipe cadastrada</h3>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando equipe...</p>
            ) : operators.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum acesso operacional cadastrado.</p>
            ) : (
              <div className="divide-y rounded-lg border border-border/70">
                {operators.map(operator => {
                  const openSession = openSessionByOperatorId.get(operator.user_id);
                  const openCashSummary = openSession ? openCashSummaryByOperatorId.get(operator.user_id) : null;
                  const canOperateCash = operatorCanOperateCash(operator);
                  const employeeDetails = employeeDetailsByOperatorId[operator.user_id];
                  const displayName = operatorFullNamesById[operator.user_id] || operator.username;
                  const canEditStaffRecord = isAdmin || (operator.user_id !== user?.id && !operatorHasManagerProtectedAccess(operator));

                  return (
                    <div key={operator.user_id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        {employeeDetails?.photo_url ? (
                          <img
                            src={employeeDetails.photo_url}
                            alt={`Foto de ${displayName}`}
                            className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                            {displayName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold">{displayName}</p>
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                              <BriefcaseBusiness className="h-3 w-3" />
                              {staffRoleLabels[operator.role]}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${openSession ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                              {openSession ? 'Caixa aberto' : canOperateCash ? 'Caixa fechado' : 'Sem caixa'}
                            </span>
                            {isAdmin && operator.commission_enabled ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                <Percent className="h-3 w-3" />
                                {formatPercentInput(operator.commission_rate_pct)}%
                              </span>
                            ) : null}
                          </div>
                          <p className="truncate text-sm text-muted-foreground">
                            @{operator.username} · {operator.job_title?.trim() || fallbackJobTitle[operator.role]}
                            {openSession ? ` · ${formatMoney(openCashSummary?.currentBalance ?? Number(openSession.opening_amount || 0))}` : ''}
                          </p>
                          {employeeDetails?.work_journey ? (
                            <p className="truncate text-xs text-muted-foreground">{employeeDetails.work_journey}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {canEditStaffRecord ? (
                          <>
                          <Button variant="outline" size="sm" onClick={() => handleEditOperator(operator)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedOperator(operator);
                              setResetPassword('');
                              setResetDialogOpen(true);
                            }}
                          >
                            <KeyRound className="mr-2 h-4 w-4" />
                            PIN
                          </Button>
                          </>
                        ) : null}
                          {canManageCashActions && !openSession && canOperateCash && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setOperatorToOpenCash(operator);
                                setOpeningAmount('0.00');
                                setOpenCashDialogOpen(true);
                              }}
                            >
                              <Wallet className="mr-2 h-4 w-4" />
                              Abrir caixa
                            </Button>
                          )}
                          {canManageCashActions && openSession && canOperateCash && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCashSessionToClose({
                                  operator,
                                  session: openSession,
                                  summary: openCashSummary ?? null,
                                });
                                setCloseCashAdminEmail('');
                                setCloseCashAdminPassword('');
                                setCloseCashError('');
                              }}
                            >
                              <Wallet className="mr-2 h-4 w-4" />
                              Fechar caixa
                            </Button>
                          )}

                          {canDeleteStaffAccess ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={deletingOperatorId === operator.user_id}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {deletingOperatorId === operator.user_id ? 'Excluindo...' : 'Excluir'}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir colaborador?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  O colaborador "{operator.username}" sera removido do sistema.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => void handleDeleteOperator(operator)}
                                >
                                  Excluir colaborador
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={accessDialogOpen} onOpenChange={handleAccessDialogOpenChange}>
        <DialogContent className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[90vh] sm:max-w-6xl sm:rounded-lg">
          <DialogHeader>
            <div className="border-b px-4 py-4 sm:px-6">
              <DialogTitle>{editingOperator ? 'Editar colaborador e acessos' : 'Cadastrar colaborador'}</DialogTitle>
              <DialogDescription className="mt-1 text-sm">
                {isAdmin ? 'O administrador' : 'O gerente'} define cadastro, foto, endereco, escala basica e acessos marcando os checkboxes.
              </DialogDescription>
              <div className="mt-3 grid grid-cols-3 gap-2 md:hidden">
                {(['data', 'permissions', 'review'] as const).map((step, index) => (
                  <Button key={step} type="button" size="sm" variant={createStep === step ? 'default' : 'outline'} onClick={() => setCreateStep(step)}>
                    {index + 1}. {step === 'data' ? 'Dados' : step === 'permissions' ? 'Acessos' : 'Revisão'}
                  </Button>
                ))}
              </div>
            </div>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 md:grid-cols-[390px_minmax(0,1fr)]">
            <form
              className={`${createStep === 'data' ? 'block' : 'hidden'} overflow-y-auto border-r p-4 md:block sm:p-6`}
              onSubmit={(event) => {
                event.preventDefault();
                requestAdminAuthorization();
              }}
            >
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Nome completo</Label>
                  <Input
                    value={fullName}
                    onChange={event => setFullName(event.target.value)}
                    placeholder="Ex: Joao Silva"
                    maxLength={100}
                    autoComplete="name"
                  />
                  <p className="text-xs text-muted-foreground">
                    Nomes completos iguais não são permitidos; o primeiro nome pode repetir se o sobrenome for diferente.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-start gap-3">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt="Foto do colaborador"
                        className="h-20 w-20 shrink-0 rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-background text-muted-foreground">
                        <Camera className="h-7 w-7" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                      <Label>Foto</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" asChild>
                          <label className="cursor-pointer">
                            <Upload className="mr-2 h-3.5 w-3.5" />
                            Importar
                            <input className="sr-only" type="file" accept="image/*" onChange={handlePhotoFileChange} />
                          </label>
                        </Button>
                        {photoUrl ? (
                          <Button type="button" variant="outline" size="sm" onClick={() => setPhotoUrl('')}>
                            <XCircle className="mr-2 h-3.5 w-3.5" />
                            Remover
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Função</Label>
                  <Input
                    value={jobTitle}
                    onChange={event => setJobTitle(event.target.value)}
                    placeholder="Ex: Caixa da manha, Gerente, Atendimento"
                    maxLength={60}
                    autoComplete="organization-title"
                  />
                  <p className="text-xs text-muted-foreground">O administrador escreve o nome. A função não libera permissões automaticamente.</p>
                </div>
                <div className="space-y-1">
                  <Label>Usuário</Label>
                  <Input
                    value={username}
                    onChange={event => setUsername(event.target.value)}
                    placeholder="Ex: colaborador.caixa"
                    readOnly={Boolean(editingOperator)}
                    autoComplete="username"
                  />
                </div>
                {!editingOperator && (
                  <div className="space-y-1">
                    <Label>PIN inicial</Label>
                    <PasswordInput value={password} onChange={event => setPassword(event.target.value)} placeholder="Use 4 a 8 numeros" />
                    <p className="text-xs text-muted-foreground">{operatorCredentialHint}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {editingOperator ? 'O usuário não muda nesta tela para preservar o login.' : 'Use de 3 a 24 caracteres com letras, números, ponto, hífen ou underscore.'}
                </p>
                <div className="rounded-lg border border-border p-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-4 w-4 text-primary" />
                    Endereço
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>CEP</Label>
                      <Input value={addressZipCode} onChange={event => setAddressZipCode(event.target.value)} placeholder="00000-000" autoComplete="postal-code" />
                    </div>
                    <div className="space-y-1">
                      <Label>Estado</Label>
                      <Input value={addressState} onChange={event => setAddressState(event.target.value.toUpperCase().slice(0, 2))} placeholder="SP" maxLength={2} autoComplete="address-level1" />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Rua</Label>
                      <Input value={addressStreet} onChange={event => setAddressStreet(event.target.value)} placeholder="Rua, avenida..." autoComplete="address-line1" />
                    </div>
                    <div className="space-y-1">
                      <Label>Número</Label>
                      <Input value={addressNumber} onChange={event => setAddressNumber(event.target.value)} placeholder="123" autoComplete="address-line2" />
                    </div>
                    <div className="space-y-1">
                      <Label>Complemento</Label>
                      <Input value={addressComplement} onChange={event => setAddressComplement(event.target.value)} placeholder="Apto, sala..." autoComplete="address-line3" />
                    </div>
                    <div className="space-y-1">
                      <Label>Bairro</Label>
                      <Input value={addressNeighborhood} onChange={event => setAddressNeighborhood(event.target.value)} placeholder="Bairro" autoComplete="address-level3" />
                    </div>
                    <div className="space-y-1">
                      <Label>Cidade</Label>
                      <Input value={addressCity} onChange={event => setAddressCity(event.target.value)} placeholder="Cidade" autoComplete="address-level2" />
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Escala básica
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {weekDayOptions.map((day) => (
                      <label key={day.key} className="flex items-center gap-2 rounded-md border border-border px-2 py-2 text-xs">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={workScheduleDays.has(day.key)}
                          onChange={event => toggleWorkScheduleDay(day.key, event.target.checked)}
                        />
                        {day.label}
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Entrada</Label>
                      <Input type="time" value={workScheduleStartTime} onChange={event => setWorkScheduleStartTime(event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Saída</Label>
                      <Input type="time" value={workScheduleEndTime} onChange={event => setWorkScheduleEndTime(event.target.value)} />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatBasicWorkJourney(workScheduleDays, workScheduleStartTime, workScheduleEndTime) || 'Nenhuma escala definida.'}
                  </p>
                </div>
                {isAdmin && (
                  <div className="rounded-lg border border-border p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                        <Percent className="h-4 w-4 text-primary" />
                        Comissão
                      </div>
                      <Switch
                        aria-label="Ativar comissão do colaborador"
                        checked={commissionEnabled}
                        onCheckedChange={setCommissionEnabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Percentual sobre vendas</Label>
                      <Input
                        inputMode="decimal"
                        value={commissionRatePct}
                        disabled={!commissionEnabled}
                        onChange={event => setCommissionRatePct(event.target.value.replace(/[^\d,.]/g, '').slice(0, 6))}
                        placeholder="Ex: 3"
                      />
                      <p className="text-xs text-muted-foreground">
                        Entra no relatório de comissões quando estiver ativo. O cálculo usa vendas válidas do período vinculadas ao colaborador.
                      </p>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-sm font-medium">Acessos do colaborador</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Marque somente os módulos que este colaborador pode abrir no sistema.
                  </p>
                </div>
                <div className="hidden rounded-lg border bg-muted/30 p-3 text-sm md:block">
                  <p className="font-medium">Resumo</p>
                  <p className="text-muted-foreground">{staffRoleLabels[inferredStaffRole]} · {normalizedFullName || 'Nome nao informado'} · {jobTitle || 'Funcao nao informada'} · {selectedPermissionKeys.size} acessos</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatBasicWorkJourney(workScheduleDays, workScheduleStartTime, workScheduleEndTime) || 'Escala nao informada'}</p>
                  {isAdmin && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Comissão: {commissionEnabled ? `${parsePercentInput(commissionRatePct).toFixed(2).replace('.', ',')}%` : 'inativa'}
                    </p>
                  )}
                </div>
              </div>
            </form>

            <div className={`${createStep === 'permissions' ? 'block' : 'hidden'} overflow-y-auto p-4 md:block sm:p-6`}>
              <OperatorPermissionSelector
                permissions={visiblePermissionOptions}
                selected={selectedPermissionKeys}
                locked={lockedStaffPermissionKeys}
                managerPermissionKeys={isAdmin ? OPERATIONAL_MANAGER_PERMISSION_KEYS : []}
                loading={loadingPermissionOptions}
                onToggle={togglePermission}
                onToggleModule={togglePermissionModule}
                onToggleManager={isAdmin ? toggleManagerPermissions : undefined}
              />
            </div>

            <div className={`${createStep === 'review' ? 'block' : 'hidden'} overflow-y-auto p-4 md:hidden`}>
              <div className="space-y-4 rounded-lg border p-4">
                <div><p className="text-xs text-muted-foreground">Tipo calculado</p><p className="font-semibold">{staffRoleLabels[inferredStaffRole]}</p></div>
                <div><p className="text-xs text-muted-foreground">Nome completo</p><p className="font-semibold">{normalizedFullName || 'Não informado'}</p></div>
                <div><p className="text-xs text-muted-foreground">Função</p><p className="font-semibold">{jobTitle || 'Não informada'}</p></div>
                <div><p className="text-xs text-muted-foreground">Usuário</p><p className="font-semibold">{username || 'Não informado'}</p></div>
                <div><p className="text-xs text-muted-foreground">Endereço</p><p className="font-semibold">{[addressStreet, addressNumber, addressCity, addressState].filter(Boolean).join(', ') || 'Não informado'}</p></div>
                <div><p className="text-xs text-muted-foreground">Escala</p><p className="font-semibold">{formatBasicWorkJourney(workScheduleDays, workScheduleStartTime, workScheduleEndTime) || 'Não informada'}</p></div>
                {isAdmin && <div><p className="text-xs text-muted-foreground">Comissão</p><p className="font-semibold">{commissionEnabled ? `${parsePercentInput(commissionRatePct).toFixed(2).replace('.', ',')}%` : 'Inativa'}</p></div>}
                <div><p className="text-xs text-muted-foreground">Acessos ({selectedPermissionNames.length})</p><p className="mt-1 text-sm">{selectedPermissionNames.join(', ') || 'Nenhum acesso selecionado'}</p></div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t p-4 sm:px-6">
            <div className="hidden w-full justify-end gap-2 md:flex">
              <Button type="button" variant="outline" onClick={() => handleAccessDialogOpenChange(false)}>Cancelar</Button>
              <Button
                type="button"
                onClick={requestAdminAuthorization}
                disabled={creating || loadingPermissionOptions}
              >
                {creating ? 'Salvando...' : editingOperator ? 'Salvar alteracoes' : 'Salvar cadastro'}
              </Button>
            </div>
            <div className="flex w-full justify-between gap-2 md:hidden">
              <Button type="button" variant="outline" onClick={() => createStep === 'data' ? handleAccessDialogOpenChange(false) : setCreateStep(createStep === 'review' ? 'permissions' : 'data')}>
                {createStep === 'data' ? 'Cancelar' : 'Voltar'}
              </Button>
              {createStep === 'data' && <Button type="button" onClick={() => setCreateStep('permissions')}>Continuar</Button>}
              {createStep === 'permissions' && <Button type="button" onClick={() => setCreateStep('review')} disabled={selectedPermissionKeys.size === 0}>Revisar</Button>}
              {createStep === 'review' && (
                <Button type="button" onClick={requestAdminAuthorization} disabled={creating}>
                  {creating ? 'Salvando...' : editingOperator ? 'Salvar' : 'Salvar cadastro'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={adminAuthorizationOpen}
        onOpenChange={(open) => {
          if (!open && !creating) resetAdminAuthorization();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar autorização</DialogTitle>
            <DialogDescription>
              Para criar, alterar acessos ou redefinir senha, confirme com o login e a senha/PIN do {accessAuthorizationLabel}. Esses dados nao ficam salvos.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleConfirmAdminAuthorization}>
            <div className="space-y-1">
              <Label>Login do {accessAuthorizationLabel}</Label>
              <Input
                type={isAdmin ? 'email' : 'text'}
                name="operator-access-admin-login"
                value={adminAuthorizationEmail}
                onChange={event => setAdminAuthorizationEmail(event.target.value)}
                placeholder={isAdmin ? 'admin@empresa.com' : 'usuario.rh'}
                autoComplete="off"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Senha/PIN do {accessAuthorizationLabel}</Label>
              <PasswordInput
                name="operator-access-admin-password"
                value={adminAuthorizationPassword}
                onChange={event => setAdminAuthorizationPassword(event.target.value)}
                placeholder="Digite a senha"
                autoComplete="new-password"
              />
            </div>
            {adminAuthorizationError ? (
              <p className="text-sm font-medium text-destructive">{adminAuthorizationError}</p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetAdminAuthorization} disabled={creating}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creating}>
                {creating || resetting ? 'Validando...' : pendingAccessAction === 'reset_password' ? 'Confirmar e redefinir' : 'Confirmar e salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(cashSessionToClose)}
        onOpenChange={open => {
          if (!open) {
            resetCloseCashState();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fechar caixa do colaborador</DialogTitle>
            <DialogDescription>
              Confirme com o administrador para registrar o fechamento do caixa.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCloseCashWithAdmin();
            }}
          >
            <div className="rounded-md border border-border bg-secondary/30 p-3 text-sm">
              <p className="text-muted-foreground">Colaborador</p>
              <p className="font-semibold">{cashSessionToClose?.operator.username || '-'}</p>
              <p className="mt-2 text-muted-foreground">Total atual</p>
              <p className="font-semibold">
                {formatMoney(cashSessionToClose?.summary?.currentBalance ?? Number(cashSessionToClose?.session.opening_amount || 0))}
              </p>
            </div>

            <div className="space-y-1">
              <Label>Login do administrador (email)</Label>
              <Input
                type="email"
                name="operator-close-cash-admin-login"
                value={closeCashAdminEmail}
                onChange={event => setCloseCashAdminEmail(event.target.value)}
                placeholder="admin@empresa.com"
                autoComplete="off"
              />
            </div>

            <div className="space-y-1">
              <Label>Senha do administrador</Label>
              <PasswordInput
                name="operator-close-cash-admin-password"
                value={closeCashAdminPassword}
                onChange={event => setCloseCashAdminPassword(event.target.value)}
                placeholder="Digite a senha"
                autoComplete="new-password"
              />
            </div>

            {closeCashError && (
              <p className="text-sm font-medium text-destructive">{closeCashError}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetCloseCashState} disabled={closingCash}>
                Cancelar
              </Button>
              <Button type="submit" disabled={closingCash}>
                {closingCash ? 'Validando...' : 'Confirmar fechamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openCashDialogOpen}
        onOpenChange={open => {
          setOpenCashDialogOpen(open);
          if (!open) {
            setOperatorToOpenCash(null);
            setOpeningAmount('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Abrir caixa para colaborador</DialogTitle>
            <DialogDescription>
              Informe o valor inicial para abrir o caixa do colaborador selecionado.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleOpenCashForOperator();
            }}
          >
            <div className="space-y-1">
              <Label>Colaborador</Label>
              <Input value={operatorToOpenCash?.username || ''} readOnly />
            </div>
            <div className="space-y-1">
              <Label>Valor inicial</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={openingAmount}
                onChange={event => setOpeningAmount(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O colaborador selecionado tera o caixa aberto com este valor inicial.
            </p>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenCashDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={openingCash}>
                {openingCash ? 'Abrindo...' : 'Abrir caixa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={resetDialogOpen}
        onOpenChange={open => {
          setResetDialogOpen(open);
          if (!open) {
            setResetPassword('');
            setSelectedOperator(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir PIN do colaborador</DialogTitle>
            <DialogDescription>
              Defina um novo PIN para o colaborador usar no login.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              requestResetPasswordAuthorization();
            }}
          >
            <div className="space-y-1">
              <Label>Colaborador</Label>
              <Input value={selectedOperator?.username || ''} readOnly />
            </div>
            <div className="space-y-1">
              <Label>Novo PIN</Label>
              <PasswordInput
                value={resetPassword}
                onChange={event => setResetPassword(event.target.value)}
                placeholder="Use 4 a 8 numeros"
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">{operatorCredentialHint}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={resetting}>
                {resetting ? 'Salvando...' : 'Salvar nova senha'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
