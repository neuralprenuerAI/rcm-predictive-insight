import { useState, useEffect } from "react";
import { colombiaApi } from "@/integrations/aws/colombiaApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Building2, Globe, Database, Phone, Key,
  CheckCircle2, XCircle, Loader2, Save, TestTube2,
  Eye, EyeOff, AlertTriangle, RefreshCw
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────
interface ConnectionStatus {
  tested: boolean;
  success: boolean | null;
  message: string;
}

interface SectionState {
  saving: boolean;
  testing: boolean;
  saved: boolean;
  connection: ConnectionStatus;
}

const defaultSection = (): SectionState => ({
  saving: false,
  testing: false,
  saved: false,
  connection: { tested: false, success: null, message: "" },
});

// ── Helpers ────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: ConnectionStatus }) => {
  if (!status.tested) return <Badge variant="outline" className="text-gray-400 border-gray-600">Sin probar</Badge>;
  if (status.success) return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">✅ Conectado</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">❌ Error</Badge>;
};

const PasswordInput = ({ id, value, onChange, placeholder }: any) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder || "••••••••"}
        className="bg-gray-800 border-gray-600 text-white pr-10"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export default function ColombiaConfig() {
  const IPS_ID = "ips-001";

  // ── Profile state ──────────────────────────────────────────
  const [profile, setProfile] = useState({
    nombre_ips: "", nit: "", codigo_habilitacion: "",
    direccion: "", telefono: "", email: "",
    ciudad: "", departamento: "", representante_legal: "",
  });

  // ── Credentials state ──────────────────────────────────────
  const [factramed, setFactramed] = useState({ username: "", password: "" });
  const [dgh, setDgh] = useState({ host: "", port: "1433", database: "", username: "", password: "" });
  const [apitude, setApitude] = useState({ api_key: "" });
  const [twilio, setTwilio] = useState({ account_sid: "", auth_token: "", phone_number: "" });

  // ── Section states ─────────────────────────────────────────
  const [sections, setSections] = useState({
    profile:   defaultSection(),
    factramed: defaultSection(),
    dgh:       defaultSection(),
    apitude:   defaultSection(),
    twilio:    defaultSection(),
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // ── Load config on mount ───────────────────────────────────
  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await colombiaApi.invoke("mediflow-config-load", { ips_id: IPS_ID });
      const data = typeof res.body === "string" ? JSON.parse(res.body) : res.body || res;

      if (data.ips_profile) {
        setProfile({
          nombre_ips:          data.ips_profile.nombre_ips || "",
          nit:                 data.ips_profile.nit || "",
          codigo_habilitacion: data.ips_profile.codigo_habilitacion || "",
          direccion:           data.ips_profile.direccion || "",
          telefono:            data.ips_profile.telefono || "",
          email:               data.ips_profile.email || "",
          ciudad:              data.ips_profile.ciudad || "",
          departamento:        data.ips_profile.departamento || "",
          representante_legal: data.ips_profile.representante_legal || "",
        });
      }

      const c = data.connections || {};
      if (c.factramed?.configured) {
        setFactramed({ username: c.factramed.username || "", password: "" });
        setSections(s => ({ ...s, factramed: { ...s.factramed, connection: { tested: true, success: true, message: "Credenciales guardadas" } } }));
      }
      if (c.dgh?.configured) {
        setDgh({ host: c.dgh.host || "", port: String(c.dgh.port || 1433), database: c.dgh.database || "", username: c.dgh.username || "", password: "" });
        setSections(s => ({ ...s, dgh: { ...s.dgh, connection: { tested: true, success: true, message: "Credenciales guardadas" } } }));
      }
      if (c.apitude?.configured) {
        setSections(s => ({ ...s, apitude: { ...s.apitude, connection: { tested: true, success: true, message: "API key guardada" } } }));
      }
      if (c.twilio?.configured) {
        setTwilio({ account_sid: "", auth_token: "", phone_number: c.twilio.phone_number || "" });
        setSections(s => ({ ...s, twilio: { ...s.twilio, connection: { tested: true, success: true, message: "Credenciales guardadas" } } }));
      }
    } catch (e: any) {
      setLoadError("Error cargando configuración: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Generic save ───────────────────────────────────────────
  const save = async (section: string, data: object) => {
    setSections(s => ({ ...s, [section]: { ...s[section], saving: true, saved: false } }));
    try {
      await colombiaApi.invoke("mediflow-config-save", { ips_id: IPS_ID, section, data });
      setSections(s => ({ ...s, [section]: { ...s[section], saving: false, saved: true } }));
      setTimeout(() => setSections(s => ({ ...s, [section]: { ...s[section], saved: false } })), 3000);
    } catch (e: any) {
      setSections(s => ({ ...s, [section]: { ...s[section], saving: false } }));
      alert("Error guardando: " + e.message);
    }
  };

  // ── Test connections ───────────────────────────────────────
  const testFactramed = async () => {
    setSections(s => ({ ...s, factramed: { ...s.factramed, testing: true } }));
    try {
      const res = await colombiaApi.invoke("mediflow-factramed-submit", { action: "test", ips_id: IPS_ID });
      const data = typeof res.body === "string" ? JSON.parse(res.body) : res.body || res;
      const ok = !data.error && (data.mock_mode === false || data.task_id);
      setSections(s => ({ ...s, factramed: { ...s.factramed, testing: false, connection: { tested: true, success: ok, message: ok ? "Portal FACTRAMED accesible" : (data.error || "No se pudo conectar") } } }));
    } catch (e: any) {
      setSections(s => ({ ...s, factramed: { ...s.factramed, testing: false, connection: { tested: true, success: false, message: e.message } } }));
    }
  };

  const testDgh = async () => {
    setSections(s => ({ ...s, dgh: { ...s.dgh, testing: true } }));
    try {
      const res = await colombiaApi.invoke("mediflow-dgh-read", { action: "ping", ips_id: IPS_ID });
      const data = typeof res.body === "string" ? JSON.parse(res.body) : res.body || res;
      const ok = !data.error;
      setSections(s => ({ ...s, dgh: { ...s.dgh, testing: false, connection: { tested: true, success: ok, message: ok ? "DGH conectado correctamente" : (data.error || "Error de conexión") } } }));
    } catch (e: any) {
      setSections(s => ({ ...s, dgh: { ...s.dgh, testing: false, connection: { tested: true, success: false, message: e.message } } }));
    }
  };

  const testApitude = async () => {
    setSections(s => ({ ...s, apitude: { ...s.apitude, testing: true } }));
    try {
      const res = await colombiaApi.invoke("mediflow-eligibility", { cedula: "1234567890", tipo_documento: "CC", ips_id: IPS_ID });
      const data = typeof res.body === "string" ? JSON.parse(res.body) : res.body || res;
      const ok = !data.error || data.cached !== undefined || data.eps_nombre !== undefined;
      setSections(s => ({ ...s, apitude: { ...s.apitude, testing: false, connection: { tested: true, success: ok, message: ok ? "ADRES API respondiendo correctamente" : (data.error || "Error de conexión") } } }));
    } catch (e: any) {
      setSections(s => ({ ...s, apitude: { ...s.apitude, testing: false, connection: { tested: true, success: false, message: e.message } } }));
    }
  };

  const testTwilio = async () => {
    setSections(s => ({ ...s, twilio: { ...s.twilio, testing: true } }));
    try {
      const res = await colombiaApi.invoke("mediflow-notifications", { action: "test", ips_id: IPS_ID, phone: twilio.phone_number || "+573000000000", message: "MediFlow AI: Prueba de conexión exitosa ✅" });
      const data = typeof res.body === "string" ? JSON.parse(res.body) : res.body || res;
      const ok = !data.error;
      setSections(s => ({ ...s, twilio: { ...s.twilio, testing: false, connection: { tested: true, success: ok, message: ok ? "WhatsApp enviado correctamente" : (data.error || "Error Twilio") } } }));
    } catch (e: any) {
      setSections(s => ({ ...s, twilio: { ...s.twilio, testing: false, connection: { tested: true, success: false, message: e.message } } }));
    }
  };

  // ── Save button ────────────────────────────────────────────
  const SaveButton = ({ section, onClick }: { section: string; onClick: () => void }) => {
    const s = sections[section as keyof typeof sections];
    return (
      <Button onClick={onClick} disabled={s.saving} className="bg-blue-600 hover:bg-blue-700 text-white">
        {s.saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</> :
         s.saved  ? <><CheckCircle2 className="w-4 h-4 mr-2 text-green-400" />Guardado</> :
                    <><Save className="w-4 h-4 mr-2" />Guardar</>}
      </Button>
    );
  };

  const TestButton = ({ section, onClick, label }: { section: string; onClick: () => void; label: string }) => {
    const s = sections[section as keyof typeof sections];
    return (
      <Button onClick={onClick} disabled={s.testing} variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
        {s.testing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Probando...</> :
                     <><TestTube2 className="w-4 h-4 mr-2" />{label}</>}
      </Button>
    );
  };

  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-3" />
          <p className="text-gray-400">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">⚙️ Configuración</h1>
          <p className="text-gray-400 text-sm mt-1">Conecta MediFlow AI con tus sistemas y credenciales</p>
        </div>
        <Button onClick={loadConfig} variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
          <RefreshCw className="w-4 h-4 mr-2" />Recargar
        </Button>
      </div>

      {loadError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-red-300 text-sm">{loadError}</p>
        </div>
      )}

      {/* ── 1. PERFIL IPS ─────────────────────────────────── */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-white text-base">Perfil IPS</CardTitle>
                <p className="text-gray-400 text-xs">Información de tu institución prestadora</p>
              </div>
            </div>
            <SaveButton section="profile" onClick={() => save("profile", profile)} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Nombre IPS *</Label>
              <Input value={profile.nombre_ips} onChange={e => setProfile(p => ({ ...p, nombre_ips: e.target.value }))} placeholder="Clínica San José S.A.S." className="bg-gray-800 border-gray-600 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">NIT *</Label>
              <Input value={profile.nit} onChange={e => setProfile(p => ({ ...p, nit: e.target.value }))} placeholder="900.123.456-7" className="bg-gray-800 border-gray-600 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Código Habilitación MinSalud</Label>
              <Input value={profile.codigo_habilitacion} onChange={e => setProfile(p => ({ ...p, codigo_habilitacion: e.target.value }))} placeholder="110010123456" className="bg-gray-800 border-gray-600 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Representante Legal</Label>
              <Input value={profile.representante_legal} onChange={e => setProfile(p => ({ ...p, representante_legal: e.target.value }))} placeholder="Nombre completo" className="bg-gray-800 border-gray-600 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Ciudad</Label>
              <Input value={profile.ciudad} onChange={e => setProfile(p => ({ ...p, ciudad: e.target.value }))} placeholder="Bogotá" className="bg-gray-800 border-gray-600 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Departamento</Label>
              <Input value={profile.departamento} onChange={e => setProfile(p => ({ ...p, departamento: e.target.value }))} placeholder="Cundinamarca" className="bg-gray-800 border-gray-600 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Teléfono</Label>
              <Input value={profile.telefono} onChange={e => setProfile(p => ({ ...p, telefono: e.target.value }))} placeholder="+57 1 234 5678" className="bg-gray-800 border-gray-600 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Email</Label>
              <Input value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} placeholder="facturacion@clinica.com.co" className="bg-gray-800 border-gray-600 text-white" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-gray-300 text-sm">Dirección</Label>
            <Input value={profile.direccion} onChange={e => setProfile(p => ({ ...p, direccion: e.target.value }))} placeholder="Calle 123 # 45-67, Barrio..." className="bg-gray-800 border-gray-600 text-white" />
          </div>
        </CardContent>
      </Card>

      {/* ── 2. FACTRAMED ──────────────────────────────────── */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Globe className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <CardTitle className="text-white text-base">FACTRAMED — Nueva EPS</CardTitle>
                <p className="text-gray-400 text-xs">factramed.nuevaeps.com.co · Radicación automática de RIPS</p>
              </div>
            </div>
            <StatusBadge status={sections.factramed.connection} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Usuario *</Label>
              <Input value={factramed.username} onChange={e => setFactramed(f => ({ ...f, username: e.target.value }))} placeholder="usuario@ips.com.co" className="bg-gray-800 border-gray-600 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Contraseña *</Label>
              <PasswordInput id="factramed-pass" value={factramed.password} onChange={(e: any) => setFactramed(f => ({ ...f, password: e.target.value }))} />
            </div>
          </div>
          {sections.factramed.connection.tested && (
            <div className={`text-xs p-2 rounded ${sections.factramed.connection.success ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              {sections.factramed.connection.message}
            </div>
          )}
          <div className="flex gap-3">
            <SaveButton section="factramed" onClick={() => save("factramed", factramed)} />
            <TestButton section="factramed" onClick={testFactramed} label="Probar portal" />
          </div>
        </CardContent>
      </Card>

      {/* ── 3. DGH ────────────────────────────────────────── */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Database className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-white text-base">Dinámica Gerencial (DGH)</CardTitle>
                <p className="text-gray-400 text-xs">SYAC HIS · SQL Server · Pacientes, citas y encuentros</p>
              </div>
            </div>
            <StatusBadge status={sections.dgh.connection} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-gray-300 text-sm">Host / IP del servidor *</Label>
              <Input value={dgh.host} onChange={e => setDgh(d => ({ ...d, host: e.target.value }))} placeholder="192.168.1.10 o servidor.ips.local" className="bg-gray-800 border-gray-600 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Puerto</Label>
              <Input value={dgh.port} onChange={e => setDgh(d => ({ ...d, port: e.target.value }))} placeholder="1433" className="bg-gray-800 border-gray-600 text-white" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Base de datos *</Label>
              <Input value={dgh.database} onChange={e => setDgh(d => ({ ...d, database: e.target.value }))} placeholder="DGH_PROD" className="bg-gray-800 border-gray-600 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Usuario *</Label>
              <Input value={dgh.username} onChange={e => setDgh(d => ({ ...d, username: e.target.value }))} placeholder="sa" className="bg-gray-800 border-gray-600 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Contraseña *</Label>
              <PasswordInput id="dgh-pass" value={dgh.password} onChange={(e: any) => setDgh(d => ({ ...d, password: e.target.value }))} />
            </div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3">
            <p className="text-yellow-400 text-xs">⚠️ El servidor DGH debe ser accesible desde internet o tener VPN configurada. Puerto 1433 debe estar abierto hacia AWS us-east-2.</p>
          </div>
          {sections.dgh.connection.tested && (
            <div className={`text-xs p-2 rounded ${sections.dgh.connection.success ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              {sections.dgh.connection.message}
            </div>
          )}
          <div className="flex gap-3">
            <SaveButton section="dgh" onClick={() => save("dgh", dgh)} />
            <TestButton section="dgh" onClick={testDgh} label="Probar conexión" />
          </div>
        </CardContent>
      </Card>

      {/* ── 4. APITUDE / ADRES ────────────────────────────── */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Key className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <CardTitle className="text-white text-base">Apitude · ADRES BDUA</CardTitle>
                <p className="text-gray-400 text-xs">apitude.co · Verificación EPS en tiempo real por cédula</p>
              </div>
            </div>
            <StatusBadge status={sections.apitude.connection} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-gray-300 text-sm">API Key *</Label>
            <PasswordInput id="apitude-key" value={apitude.api_key} onChange={(e: any) => setApitude({ api_key: e.target.value })} placeholder="Pega tu API key de apitude.co" />
          </div>
          <p className="text-gray-500 text-xs">Obtén tu API key en <span className="text-cyan-400">apitude.co</span> → Dashboard → API Keys. Costo: ~$0.01 por consulta.</p>
          {sections.apitude.connection.tested && (
            <div className={`text-xs p-2 rounded ${sections.apitude.connection.success ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              {sections.apitude.connection.message}
            </div>
          )}
          <div className="flex gap-3">
            <SaveButton section="apitude" onClick={() => save("apitude", apitude)} />
            <TestButton section="apitude" onClick={testApitude} label="Probar API" />
          </div>
        </CardContent>
      </Card>

      {/* ── 5. TWILIO ─────────────────────────────────────── */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center">
                <Phone className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <CardTitle className="text-white text-base">Twilio · WhatsApp</CardTitle>
                <p className="text-gray-400 text-xs">Confirmaciones, recordatorios y seguimiento de citas</p>
              </div>
            </div>
            <StatusBadge status={sections.twilio.connection} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Account SID *</Label>
              <Input value={twilio.account_sid} onChange={e => setTwilio(t => ({ ...t, account_sid: e.target.value }))} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" className="bg-gray-800 border-gray-600 text-white font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Auth Token *</Label>
              <PasswordInput id="twilio-token" value={twilio.auth_token} onChange={(e: any) => setTwilio(t => ({ ...t, auth_token: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-gray-300 text-sm">Número WhatsApp (formato internacional) *</Label>
            <Input value={twilio.phone_number} onChange={e => setTwilio(t => ({ ...t, phone_number: e.target.value }))} placeholder="+14155238886" className="bg-gray-800 border-gray-600 text-white" />
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3">
            <p className="text-blue-400 text-xs">💡 Requiere aprobación de Meta para WhatsApp Business. Usa el Sandbox de Twilio para pruebas: <span className="font-mono">+14155238886</span></p>
          </div>
          {sections.twilio.connection.tested && (
            <div className={`text-xs p-2 rounded ${sections.twilio.connection.success ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              {sections.twilio.connection.message}
            </div>
          )}
          <div className="flex gap-3">
            <SaveButton section="twilio" onClick={() => save("twilio", twilio)} />
            <TestButton section="twilio" onClick={testTwilio} label="Enviar WhatsApp prueba" />
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
