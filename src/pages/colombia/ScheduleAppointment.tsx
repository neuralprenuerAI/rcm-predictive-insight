import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { colombiaApi } from "@/integrations/aws/colombiaApi";
import type { ColombiaPatient, EpsEligibility } from "@/integrations/aws/colombiaTypes";
import { Calendar, Clock, User, Stethoscope, MapPin, CheckCircle, AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScheduleForm {
  especialidad: string;
  scheduled_date: string;
  scheduled_time: string;
  medico_nombre: string;
  consultorio: string;
  sede: string;
  motivo_consulta: string;
  send_notification: boolean;
}

interface ScheduleResult {
  success: boolean;
  appointment: {
    dgh_appointment_id: string;
    status: string;
    scheduled_at: string;
    especialidad: string;
    medico_nombre: string;
    consultorio: string;
    sede: string;
  };
  confirmation_code: string;
  notification_sent: boolean;
  alert: string | null;
  mock: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ESPECIALIDADES = [
  "MEDICINA GENERAL",
  "PEDIATRÍA",
  "GINECOLOGÍA Y OBSTETRICIA",
  "CARDIOLOGÍA",
  "DERMATOLOGÍA",
  "ORTOPEDIA Y TRAUMATOLOGÍA",
  "OFTALMOLOGÍA",
  "OTORRINOLARINGOLOGÍA",
  "NEUROLOGÍA",
  "ENDOCRINOLOGÍA",
  "GASTROENTEROLOGÍA",
  "NEUMOLOGÍA",
  "UROLOGÍA",
  "PSIQUIATRÍA",
  "PSICOLOGÍA",
  "NUTRICIÓN Y DIETÉTICA",
  "FISIOTERAPIA Y REHABILITACIÓN",
  "ODONTOLOGÍA GENERAL",
];

const SEDES = ["SEDE PRINCIPAL", "SEDE NORTE", "SEDE SUR", "SEDE OCCIDENTE"];

const TIME_SLOTS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function ScheduleAppointment() {
  const location = useLocation();
  const navigate = useNavigate();

  const preloaded = location.state as {
    patient?: ColombiaPatient;
    eligibility?: EpsEligibility;
  } | null;

  const patient = preloaded?.patient ?? null;
  const eligibility = preloaded?.eligibility ?? null;

  const [form, setForm] = useState<ScheduleForm>({
    especialidad: "MEDICINA GENERAL",
    scheduled_date: "",
    scheduled_time: "09:00",
    medico_nombre: "",
    consultorio: "101",
    sede: "SEDE PRINCIPAL",
    motivo_consulta: "",
    send_notification: true,
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const minDate = new Date().toISOString().split("T")[0];

  const canSchedule =
    !eligibility ||
    eligibility.estado === "ACTIVO" ||
    eligibility.estado === "SUSPENDIDO";

  function setField<K extends keyof ScheduleForm>(key: K, value: ScheduleForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!patient) { setError("Debe buscar un paciente primero."); return; }
    if (!form.scheduled_date) { setError("Seleccione una fecha."); return; }
    if (!form.motivo_consulta.trim()) { setError("Ingrese el motivo de consulta."); return; }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const scheduled_at = `${form.scheduled_date}T${form.scheduled_time}:00`;

      let parsed: ScheduleResult;
      try {
        parsed = await colombiaApi.invoke("mediflow-schedule-appointment", {
          cedula: patient.cedula,
          tipo_doc: patient.tipo_doc,
          especialidad: form.especialidad,
          scheduled_at,
          medico_nombre: form.medico_nombre || undefined,
          consultorio: form.consultorio,
          sede: form.sede,
          motivo_consulta: form.motivo_consulta,
          send_notification: form.send_notification,
        });
      } catch (e: any) {
        setError(e.message || "Error de conexión.");
        return;
      }

      if (parsed?.success) {
        setResult(parsed);
      } else {
        setError((parsed as any)?.error || (parsed as any)?.alert || "No se pudo agendar la cita.");
      }
    } catch (e: any) {
      setError(e.message || "Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  // ── Success screen ───────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-card rounded-2xl shadow-lg border border-border overflow-hidden">
          {/* Header */}
          <div className="bg-emerald-600 text-white p-6 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold">¡Cita Confirmada!</h2>
            <p className="text-emerald-100 text-sm mt-1">
              Código: <span className="font-mono font-bold">{result.confirmation_code}</span>
            </p>
            {result.mock && (
              <span className="inline-block mt-2 px-2 py-0.5 bg-white/20 rounded text-xs font-medium">
                MODO DEMO
              </span>
            )}
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            {result.alert && (
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-600 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {result.alert}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <InfoCard icon={<Stethoscope className="w-3.5 h-3.5" />} label="Especialidad" value={result.appointment.especialidad} />
              <InfoCard icon={<User className="w-3.5 h-3.5" />} label="Médico" value={result.appointment.medico_nombre || "Por asignar"} />
              <InfoCard icon={<Calendar className="w-3.5 h-3.5" />} label="Fecha" value={formatDate(result.appointment.scheduled_at)} />
              <InfoCard icon={<Clock className="w-3.5 h-3.5" />} label="Hora" value={formatTime(result.appointment.scheduled_at)} />
              <InfoCard icon={<MapPin className="w-3.5 h-3.5" />} label="Consultorio" value={result.appointment.consultorio} />
              <InfoCard icon={<MapPin className="w-3.5 h-3.5" />} label="Sede" value={result.appointment.sede} />
            </div>

            <p className="text-xs text-muted-foreground text-center">
              {result.notification_sent
                ? "✅ Confirmación enviada por WhatsApp al paciente."
                : "📵 Notificación no enviada (Twilio no configurado en modo demo)."}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-6 pt-0">
            <button
              onClick={() => navigate("/colombia/pacientes")}
              className="flex-1 py-2.5 px-4 border border-border rounded-lg text-foreground text-sm font-medium hover:bg-muted transition-colors"
            >
              Buscar otro paciente
            </button>
            <button
              onClick={() => { setResult(null); setForm(f => ({ ...f, motivo_consulta: "", scheduled_date: "" })); }}
              className="flex-1 py-2.5 px-4 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              Agendar otra cita
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Agendar Cita</h1>
          <p className="text-sm text-muted-foreground">Complete los datos para reservar el turno en DGH</p>
        </div>
      </div>

      {/* No patient warning */}
      {!patient && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">No hay paciente seleccionado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Busque un paciente primero en{" "}
              <button onClick={() => navigate("/colombia/pacientes")} className="underline font-medium">
                Buscar Paciente
              </button>{" "}
              y use el botón "Agendar Nueva Cita".
            </p>
          </div>
        </div>
      )}

      {/* Patient card */}
      {patient && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {patient.nombres} {patient.apellidos}
                </p>
                <p className="text-xs text-muted-foreground">
                  {patient.tipo_doc}: {patient.cedula} · Tel: {patient.telefono}
                </p>
              </div>
            </div>
            {eligibility && (
              <div className="text-right">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                  eligibility.estado === "ACTIVO" ? "bg-emerald-500/15 text-emerald-400" :
                  eligibility.estado === "SUSPENDIDO" ? "bg-amber-500/15 text-amber-400" :
                  "bg-red-500/15 text-red-400"
                }`}>
                  {eligibility.estado}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">{eligibility.eps_nombre}</p>
              </div>
            )}
          </div>

          {eligibility?.estado === "INACTIVO" && (
            <div className="mx-4 mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Paciente INACTIVO en EPS. No se puede agendar hasta regularizar su afiliación.
            </div>
          )}
          {eligibility?.estado === "SUSPENDIDO" && (
            <div className="mx-4 mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Afiliación suspendida. Informe al paciente antes de confirmar.
            </div>
          )}
        </div>
      )}

      {/* Form */}
      <div className="border border-border rounded-xl divide-y divide-border">
        {/* Especialidad */}
        <div className="p-4">
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Especialidad *
          </label>
          <select
            value={form.especialidad}
            onChange={e => setField("especialidad", e.target.value)}
            className="w-full border border-input rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-background"
          >
            {ESPECIALIDADES.map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>

        {/* Date + Time */}
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Fecha *
            </label>
            <input
              type="date"
              min={minDate}
              value={form.scheduled_date}
              onChange={e => setField("scheduled_date", e.target.value)}
              className="w-full border border-input rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Hora</label>
            <select
              value={form.scheduled_time}
              onChange={e => setField("scheduled_time", e.target.value)}
              className="w-full border border-input rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-background"
            >
              {TIME_SLOTS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Médico + Consultorio */}
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Médico</label>
            <input
              type="text"
              placeholder="Nombre del médico"
              value={form.medico_nombre}
              onChange={e => setField("medico_nombre", e.target.value.toUpperCase())}
              className="w-full border border-input rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Consultorio</label>
            <input
              type="text"
              placeholder="Ej: 201"
              value={form.consultorio}
              onChange={e => setField("consultorio", e.target.value)}
              className="w-full border border-input rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-background"
            />
          </div>
        </div>

        {/* Sede */}
        <div className="p-4">
          <label className="block text-sm font-medium text-foreground mb-1.5">Sede</label>
          <select
            value={form.sede}
            onChange={e => setField("sede", e.target.value)}
            className="w-full border border-input rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-background"
          >
            {SEDES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Motivo */}
        <div className="p-4">
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Motivo de consulta *
          </label>
          <textarea
            rows={3}
            placeholder="Describa brevemente el motivo de la consulta"
            value={form.motivo_consulta}
            onChange={e => setField("motivo_consulta", e.target.value)}
            className="w-full border border-input rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-background resize-none"
          />
        </div>

        {/* WhatsApp toggle */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Enviar confirmación por WhatsApp</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Se enviará al {patient?.telefono || "número registrado"}
            </p>
          </div>
          <button
            onClick={() => setField("send_notification", !form.send_notification)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              form.send_notification ? "bg-emerald-500" : "bg-muted"
            }`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              form.send_notification ? "translate-x-5" : "translate-x-0.5"
            }`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading || !patient || !canSchedule}
        className="w-full py-3 px-6 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-sm"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Agendando en DGH...
          </>
        ) : (
          <>
            <Calendar className="w-4 h-4" />
            Confirmar Cita
          </>
        )}
      </button>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-muted rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-CO", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
  } catch { return iso; }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-CO", {
      hour: "2-digit", minute: "2-digit", hour12: true
    });
  } catch { return iso; }
}
