import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, RefreshCw, X } from "lucide-react";
import { Link } from "wouter";
import { lojaHeaders } from "@/lib/loja";

type Appointment = {
  id: string;
  clientId: string;
  petId: string;
  petName?: string;
  clientName?: string;
  serviceName: string;
  startsAt: string;
  durationMinutes: number;
  status: "scheduled" | "checked_in" | "in_service" | "ready" | "completed" | "cancelled";
  notes: string | null;
};

const statusLabels: Record<Appointment["status"], string> = {
  scheduled: "Agendado",
  checked_in: "Pet recebido",
  in_service: "Em atendimento",
  ready: "Pronto",
  completed: "Concluído",
  cancelled: "Cancelado",
};

function headers(): Record<string, string> {
  const token = window.localStorage.getItem("miar-owner-token") ?? window.sessionStorage.getItem("miar-owner-token") ?? "";
  return { Authorization: `Bearer ${token}`, ...lojaHeaders(), "Content-Type": "application/json" };
}

export default function Agendamentos() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/appointments", { headers: headers() });
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar os agendamentos.");
      setAppointments(data as Appointment[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os agendamentos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateStatus = async (appointment: Appointment, status: Appointment["status"]) => {
    setSavingId(appointment.id);
    setError("");
    try {
      const response = await fetch(`/api/appointments/${encodeURIComponent(appointment.id)}/status`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Não foi possível atualizar o agendamento.");
      setAppointments((current) => current.map((item) => item.id === appointment.id ? data as Appointment : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o agendamento.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main className="min-h-[calc(100vh-88px)] bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/painel" className="text-xs text-slate-500 hover:text-slate-200">← Voltar ao painel</Link>
        <div className="mt-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-400">Petshop</p>
            <h1 className="mt-2 text-3xl font-semibold">Agenda de atendimentos</h1>
            <p className="mt-2 text-sm text-slate-400">Acompanhe os horários de banho, tosa e veterinário.</p>
          </div>
          <button type="button" onClick={() => void load()} aria-label="Atualizar agenda" className="rounded-lg border border-slate-700 p-2.5 text-slate-300 hover:border-emerald-400 hover:text-emerald-300"><RefreshCw size={17} /></button>
        </div>
        {error && <p role="alert" className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
        {loading ? <p className="mt-8 text-sm text-slate-500">Carregando agenda...</p> : appointments.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-dashed border-slate-700 p-10 text-center"><CalendarClock className="mx-auto text-slate-600" size={32} /><p className="mt-3 text-sm text-slate-400">Nenhum atendimento no próximo período.</p></section>
        ) : (
          <div className="mt-8 space-y-3">
            {appointments.map((appointment) => (
              <article key={appointment.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{appointment.serviceName}</h2><span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-semibold uppercase text-slate-300">{statusLabels[appointment.status]}</span></div>
                  <p className="mt-2 text-sm text-emerald-300">{new Date(appointment.startsAt).toLocaleString("pt-BR")} · {appointment.durationMinutes} min</p>
                  <p className="mt-1 text-xs text-slate-500">Pet: {appointment.petName ?? appointment.petId} · Tutor: {appointment.clientName ?? appointment.clientId}</p>
                  {appointment.notes && <p className="mt-2 text-sm text-slate-400">{appointment.notes}</p>}
                </div>
                {appointment.status !== "completed" && appointment.status !== "cancelled" && <div className="mt-4 flex flex-wrap gap-2 sm:mt-0 sm:justify-end"><button type="button" disabled={savingId === appointment.id} onClick={() => void updateStatus(appointment, appointment.status === "scheduled" ? "checked_in" : appointment.status === "checked_in" ? "in_service" : appointment.status === "in_service" ? "ready" : "completed")} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"><Check size={14} /> Avançar status</button><button type="button" disabled={savingId === appointment.id} onClick={() => void updateStatus(appointment, "cancelled")} aria-label="Cancelar agendamento" className="rounded-lg border border-rose-500/30 p-2 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"><X size={15} /></button></div>}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
