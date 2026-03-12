import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { colombiaApi } from "@/integrations/aws/colombiaApi";
import type { PatientSearchResult } from "@/integrations/aws/colombiaTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, User, Phone, Mail, MapPin, CalendarDays, ShieldCheck, ShieldX, ShieldAlert, CalendarPlus, Receipt, AlertTriangle, Clock } from "lucide-react";

const DOC_TYPES = [
  { value: "CC", label: "Cédula Ciudadanía" },
  { value: "TI", label: "Tarjeta Identidad" },
  { value: "RC", label: "Registro Civil" },
  { value: "PA", label: "Pasaporte" },
  { value: "CE", label: "Cédula Extranjería" },
  { value: "PE", label: "Permiso Especial" },
];

const APPOINTMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  CONFIRMADA: { label: "Confirmada",  color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  COMPLETADA: { label: "Completada",  color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  CANCELADA:  { label: "Cancelada",   color: "bg-red-500/15 text-red-400 border-red-500/20" },
  NO_SHOW:    { label: "No asistió",  color: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
  DISPONIBLE: { label: "Disponible",  color: "bg-gray-500/15 text-gray-400 border-gray-500/20" },
};

export default function PatientSearch() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cedula, setCedula]   = useState("");
  const [tipoDoc, setTipoDoc] = useState("CC");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<PatientSearchResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const handleSearch = async () => {
    const clean = cedula.replace(/\D/g, "").trim();
    if (!clean || clean.length < 5) { setError("Ingrese un número de documento válido (mínimo 5 dígitos)"); return; }
    setLoading(true); setError(null); setResult(null);
    let parsed: PatientSearchResult;
    try {
      parsed = await colombiaApi.invoke("mediflow-patient-search", { cedula: clean, tipo_doc: tipoDoc, include_appointments: true });
    } catch (e: any) {
      setLoading(false);
      setError(`Error de conexión: ${e.message}`);
      return;
    }
    setLoading(false);
    if (!parsed?.success) { setError(parsed?.alert || "No se encontró información para este documento"); return; }
    setResult(parsed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleSearch(); };

  const getEpsStatusConfig = (estado?: string) => {
    switch (estado) {
      case "ACTIVO":        return { icon: ShieldCheck, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "ACTIVO" };
      case "SUSPENDIDO":    return { icon: ShieldAlert, color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20",     label: "SUSPENDIDO" };
      case "INACTIVO":      return { icon: ShieldX,     color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",         label: "INACTIVO" };
      case "NO_ENCONTRADO": return { icon: ShieldX,     color: "text-gray-400",    bg: "bg-gray-500/10 border-gray-500/20",       label: "NO ENCONTRADO" };
      default:              return { icon: ShieldAlert, color: "text-gray-400",    bg: "bg-gray-500/10 border-gray-500/20",       label: estado || "DESCONOCIDO" };
    }
  };

  const formatDate = (d?: string) => { if (!d) return "—"; try { return new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" }); } catch { return d; } };
  const formatDateTime = (d?: string) => { if (!d) return "—"; try { return new Date(d).toLocaleDateString("es-CO", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return d; } };

  const epsConfig = result?.eligibility ? getEpsStatusConfig(result.eligibility.estado) : null;
  const EpsIcon   = epsConfig?.icon ?? ShieldAlert;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Buscar Paciente</h1>
        <p className="text-sm text-muted-foreground mt-1">Verificación ADRES BDUA + historial DGH en tiempo real</p>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3 items-center">
            <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 shrink-0">
              {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.value} — {d.label}</option>)}
            </select>
            <Input ref={inputRef} placeholder="Número de documento..." value={cedula} onChange={(e) => setCedula(e.target.value.replace(/\D/g, ""))} onKeyDown={handleKeyDown} className="flex-1 focus-visible:ring-emerald-500/30" maxLength={12} autoFocus />
            <Button onClick={handleSearch} disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? "Buscando..." : "Buscar"}
            </Button>
          </div>
          {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
        </CardContent>
      </Card>

      {result?.alert && <p className="text-sm text-amber-400 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{result.alert}</p>}

      {result && (
        <div className="space-y-4">
          {/* Patient Info */}
          {result.patient && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{result.patient.nombres} {result.patient.apellidos}</h3>
                      <p className="text-sm text-muted-foreground">{result.patient.tipo_doc}: {result.patient.cedula}{result.patient.fecha_nacimiento && ` · Nac: ${formatDate(result.patient.fecha_nacimiento)}`}{result.patient.sexo && ` · ${result.patient.sexo === "M" ? "Masculino" : "Femenino"}`}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">{result.patient.dgh_patient_id}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6 text-sm text-muted-foreground">
                  {result.patient.telefono && <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{result.patient.telefono}</p>}
                  {result.patient.email && <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{result.patient.email}</p>}
                  {result.patient.ciudad && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{result.patient.ciudad}</p>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* EPS Eligibility */}
          {result.eligibility && epsConfig && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg border ${epsConfig.bg}`}>
                      <EpsIcon className={`h-5 w-5 ${epsConfig.color}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{result.eligibility.eps_nombre || "EPS no identificada"}</span>
                        <Badge variant="outline" className={epsConfig.color}>{epsConfig.label}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        {result.eligibility.regimen && <span>{result.eligibility.regimen}</span>}
                        {result.eligibility.tipo_afiliado && <><span>·</span><span>{result.eligibility.tipo_afiliado}</span></>}
                        {result.eligibility.fecha_afiliacion && <><span>·</span><span>Desde {formatDate(result.eligibility.fecha_afiliacion)}</span></>}
                        {result.eligibility.municipio && <><span>·</span><span>{result.eligibility.municipio}</span></>}
                      </div>
                    </div>
                  </div>
                  {result.eligibility.mock && <Badge variant="secondary" className="text-[10px]">MOCK</Badge>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button onClick={() => navigate("/colombia/agendar", { state: { patient: result.patient, eligibility: result.eligibility } })} disabled={!result.can_schedule} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white gap-2"><CalendarPlus className="h-4 w-4" />Agendar Nueva Cita</Button>
            <Button variant="outline" onClick={() => navigate("/colombia/facturacion", { state: { patient: result.patient } })} className="flex-1 gap-2"><Receipt className="h-4 w-4" />Ver Facturación</Button>
          </div>

          {/* Appointments */}
          {result.appointments && result.appointments.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Últimas Citas</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {result.appointments.map((appt) => {
                  const statusCfg = APPOINTMENT_STATUS_CONFIG[appt.status] ?? { label: appt.status, color: "bg-gray-500/15 text-gray-400 border-gray-500/20" };
                  return (
                    <div key={appt.dgh_appointment_id} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                      <div>
                        <p className="text-sm font-medium text-foreground">{appt.especialidad}</p>
                        <p className="text-xs text-muted-foreground">{appt.medico_nombre}</p>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <p className="text-xs text-muted-foreground">{formatDateTime(appt.scheduled_at)}</p>
                        <Badge variant="outline" className={statusCfg.color}>{statusCfg.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {result.appointments && result.appointments.length === 0 && result.patient && (
            <p className="text-sm text-muted-foreground text-center py-4">No hay citas registradas para este paciente.</p>
          )}
        </div>
      )}

      {/* Empty State */}
      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Search className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-sm font-medium">Ingrese el número de documento para buscar un paciente</p>
          <p className="text-xs mt-1">Verifica afiliación en ADRES + historial en DGH</p>
        </div>
      )}
    </div>
  );
}
