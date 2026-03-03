import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { awsApi } from "@/integrations/aws/awsApi";
import { toast } from "sonner";
import { Building2, User, Phone, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PracticeProfileData {
  practiceName: string;
  practiceStreet: string;
  practiceCity: string;
  practiceState: string;
  practiceZip: string;
  practicePhone: string;
  practiceFax: string;
  practiceTin: string;
  providerName: string;
  providerNpi: string;
  providerSpecialty: string;
  providerCredentials: string;
  placeOfService: string;
  billingContactName: string;
  billingContactPhone: string;
  billingContactEmail: string;
}

const emptyProfile: PracticeProfileData = {
  practiceName: "",
  practiceStreet: "",
  practiceCity: "",
  practiceState: "",
  practiceZip: "",
  practicePhone: "",
  practiceFax: "",
  practiceTin: "",
  providerName: "",
  providerNpi: "",
  providerSpecialty: "",
  providerCredentials: "",
  placeOfService: "",
  billingContactName: "",
  billingContactPhone: "",
  billingContactEmail: "",
};

const credentialOptions = ["MD", "DO", "NP", "PA", "DPM", "OD", "DDS", "DMD", "DC", "PhD", "PsyD", "LCSW", "RN", "Other"];

export default function PracticeProfile() {
  const [profile, setProfile] = useState<PracticeProfileData>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    const requiredFields: (keyof PracticeProfileData)[] = ["practiceName", "providerName", "providerNpi"];
    setIsComplete(requiredFields.every((f) => profile[f]?.trim()));
  }, [profile]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await awsApi.invoke("practice-profile", { body: { action: "get" } });
      if (res.data && !res.error) {
        const p = res.data.profile || res.data;
        setProfile((prev) => ({
          ...prev,
          practiceName: p.practice_name || "",
          practiceStreet: p.practice_address || "",
          practiceCity: p.practice_city || "",
          practiceState: p.practice_state || "",
          practiceZip: p.practice_zip || "",
          practicePhone: p.practice_phone || "",
          practiceFax: p.practice_fax || "",
          practiceTin: p.practice_tin || "",
          providerName: p.provider_name || "",
          providerNpi: p.provider_npi || "",
          providerSpecialty: p.provider_specialty || "",
          providerCredentials: p.provider_credentials || "",
          placeOfService: p.place_of_service || "",
          billingContactName: p.billing_contact_name || "",
          billingContactPhone: p.billing_contact_phone || "",
          billingContactEmail: p.billing_contact_email || "",
        }));
      }
    } catch {
      // No profile yet — that's fine
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    const requestBody = {
      action: "save",
      practice_name: profile.practiceName,
      practice_address: profile.practiceStreet,
      practice_city: profile.practiceCity,
      practice_state: profile.practiceState,
      practice_zip: profile.practiceZip,
      practice_phone: profile.practicePhone,
      practice_fax: profile.practiceFax,
      practice_tin: profile.practiceTin,
      provider_name: profile.providerName,
      provider_npi: profile.providerNpi,
      provider_specialty: profile.providerSpecialty,
      provider_credentials: profile.providerCredentials,
      place_of_service: profile.placeOfService,
      billing_contact_name: profile.billingContactName,
      billing_contact_phone: profile.billingContactPhone,
      billing_contact_email: profile.billingContactEmail,
    };
    console.log("Saving practice profile with body:", requestBody);
    try {
      const res = await awsApi.invoke("practice-profile", { body: requestBody });
      if (res.error) throw res.error;
      toast.success("Practice profile saved successfully");
    } catch {
      toast.error("Failed to save practice profile");
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof PracticeProfileData, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Practice Profile</h1>
        <p className="text-muted-foreground">Manage your practice information for auto-filling appeal letters</p>
      </div>

      {!isComplete && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Complete your practice profile to auto-fill appeal letters with your practice information.
          </AlertDescription>
        </Alert>
      )}

      {/* Practice Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Practice Information
          </CardTitle>
          <CardDescription>Your practice details used in appeal letters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="practiceName">Practice Name *</Label>
            <Input id="practiceName" value={profile.practiceName} onChange={(e) => update("practiceName", e.target.value)} placeholder="Acme Medical Group" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="practiceStreet">Street Address</Label>
            <Input id="practiceStreet" value={profile.practiceStreet} onChange={(e) => update("practiceStreet", e.target.value)} placeholder="123 Main Street, Suite 100" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="practiceCity">City</Label>
              <Input id="practiceCity" value={profile.practiceCity} onChange={(e) => update("practiceCity", e.target.value)} placeholder="Columbus" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="practiceState">State</Label>
              <Input id="practiceState" value={profile.practiceState} onChange={(e) => update("practiceState", e.target.value)} placeholder="OH" maxLength={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="practiceZip">ZIP</Label>
              <Input id="practiceZip" value={profile.practiceZip} onChange={(e) => update("practiceZip", e.target.value)} placeholder="43215" maxLength={10} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="practicePhone">Phone</Label>
              <Input id="practicePhone" value={profile.practicePhone} onChange={(e) => update("practicePhone", e.target.value)} placeholder="(614) 555-0100" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="practiceFax">Fax</Label>
              <Input id="practiceFax" value={profile.practiceFax} onChange={(e) => update("practiceFax", e.target.value)} placeholder="(614) 555-0101" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="practiceTin">Tax ID (TIN)</Label>
            <Input id="practiceTin" value={profile.practiceTin} onChange={(e) => update("practiceTin", e.target.value)} placeholder="XX-XXXXXXX" maxLength={10} />
          </div>
        </CardContent>
      </Card>

      {/* Provider Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Provider Information
          </CardTitle>
          <CardDescription>Rendering provider details for appeal letters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="providerName">Provider Name *</Label>
            <Input id="providerName" value={profile.providerName} onChange={(e) => update("providerName", e.target.value)} placeholder="Dr. Jane Smith" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="providerNpi">NPI *</Label>
            <Input id="providerNpi" value={profile.providerNpi} onChange={(e) => update("providerNpi", e.target.value)} placeholder="1234567890" maxLength={10} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="providerSpecialty">Specialty</Label>
              <Input id="providerSpecialty" value={profile.providerSpecialty} onChange={(e) => update("providerSpecialty", e.target.value)} placeholder="Internal Medicine" />
            </div>
            <div className="space-y-2">
              <Label>Credentials</Label>
              <Select value={profile.providerCredentials} onValueChange={(v) => update("providerCredentials", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select credentials" />
                </SelectTrigger>
                <SelectContent>
                  {credentialOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="placeOfService">Place of Service</Label>
            <Input id="placeOfService" value={profile.placeOfService} onChange={(e) => update("placeOfService", e.target.value)} placeholder="11 - Office" />
          </div>
        </CardContent>
      </Card>

      {/* Billing Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Billing Contact
          </CardTitle>
          <CardDescription>Contact person for billing inquiries</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="billingContactName">Contact Name</Label>
            <Input id="billingContactName" value={profile.billingContactName} onChange={(e) => update("billingContactName", e.target.value)} placeholder="John Doe" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="billingContactPhone">Phone</Label>
              <Input id="billingContactPhone" value={profile.billingContactPhone} onChange={(e) => update("billingContactPhone", e.target.value)} placeholder="(614) 555-0102" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingContactEmail">Email</Label>
              <Input id="billingContactEmail" type="email" value={profile.billingContactEmail} onChange={(e) => update("billingContactEmail", e.target.value)} placeholder="billing@practice.com" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={saveProfile} disabled={saving} className="w-full">
        {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Save Practice Profile"}
      </Button>
    </div>
  );
}
