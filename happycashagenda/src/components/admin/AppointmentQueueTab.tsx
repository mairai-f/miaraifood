import { useMemo } from 'react';
import { Briefcase, Clock, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/utils';
import { useAgendaBranding } from '@/hooks/useAgendaBranding';

interface ExtraService {
  id: string;
  name: string;
  price: number;
  duration_minutes?: number;
}

interface Appointment {
  id: string;
  client_name: string;
  client_phone: string | null;
  appointment_date: string;
  appointment_time: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  barber: { name: string; id?: string };
  service: { name: string; price: number; id?: string; duration_minutes?: number };
  barber_id: string;
  service_id: string;
  extraServices: ExtraService[];
}

interface AppointmentQueueTabProps {
  appointments: Appointment[];
}

export function AppointmentQueueTab({ appointments }: AppointmentQueueTabProps) {
  const { settings } = useAgendaBranding();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const queue = useMemo(() => {
    return appointments
      .filter(a => a.status === 'scheduled' && a.appointment_date >= todayStr)
      .sort((a, b) => {
        if (a.appointment_date !== b.appointment_date) return a.appointment_date.localeCompare(b.appointment_date);
        return a.appointment_time.localeCompare(b.appointment_time);
      });
  }, [appointments, todayStr]);

  const getTotalPrice = (apt: Appointment) => {
    const extras = apt.extraServices.reduce((s, e) => s + (e.price || 0), 0);
    return (apt.service?.price || 0) + extras;
  };

  const getTotalDuration = (apt: Appointment) => {
    const extras = apt.extraServices.reduce((s, e) => s + (e.duration_minutes || 0), 0);
    return (apt.service?.duration_minutes || 0) + extras;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-bold">Fila de Atendimento</h2>
        <Badge variant="secondary" className="text-sm">{queue.length} na fila</Badge>
      </div>

      {queue.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Nenhum cliente na fila</p>
            <p className="text-sm">Não há agendamentos pendentes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {queue.map((apt, index) => {
            const isToday = apt.appointment_date === todayStr;
            const allServices = [apt.service?.name, ...apt.extraServices.map(e => e.name)].filter(Boolean);

            return (
              <Card key={apt.id} className={`border-l-4 ${index === 0 && isToday ? 'border-l-primary bg-primary/5' : 'border-l-border'}`}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 && isToday ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-semibold">{apt.client_name}</span>
                          {index === 0 && isToday && <Badge className="text-[10px] px-1.5 py-0">Próximo</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {settings.professionalLabel}: <span className="font-medium text-foreground">{apt.barber?.name}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-medium">
                        {isToday ? 'Hoje' : format(parseLocalDate(apt.appointment_date), "dd/MM", { locale: ptBR })} às {apt.appointment_time.slice(0, 5)}
                      </div>
                      <div className="text-lg font-bold text-primary">R$ {getTotalPrice(apt).toFixed(0)}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3 ml-11">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Briefcase className="w-3.5 h-3.5" />
                      {allServices.join(' + ')}
                    </div>
                    <span className="text-muted-foreground">•</span>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {getTotalDuration(apt)} min
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
