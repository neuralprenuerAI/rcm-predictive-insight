import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Loader2, User, Phone, MapPin, Heart, Globe, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { awsApi } from "@/integrations/aws/awsApi";
import { awsCrud } from "@/lib/awsCrud";

interface Patient {
  id: string;
  external_id: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  prefix?: string;
  suffix?: string;
  date_of_birth: string;
  gender: string;
  phone?: string;
  email?: string;
  address?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  raw_fhir_data?: any;
  source_connection_id?: string;
}

interface EditPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  onSuccess: () => void;
}

// US States for dropdown
const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" }, { code: "DC", name: "District of Columbia" }
];

// Race options (OMB categories)
const RACE_OPTIONS = [
  { code: "1002-5", display: "American Indian or Alaska Native" },
  { code: "2028-9", display: "Asian" },
  { code: "2054-5", display: "Black or African American" },
  { code: "2076-8", display: "Native Hawaiian or Other Pacific Islander" },
  { code: "2106-3", display: "White" },
  { code: "UNK", display: "Unknown" },
  { code: "ASKU", display: "Declined to Specify" }
];

// Ethnicity options
const ETHNICITY_OPTIONS = [
  { code: "2135-2", display: "Hispanic or Latino" },
  { code: "2186-5", display: "Not Hispanic or Latino" },
  { code: "UNK", display: "Unknown" },
  { code: "ASKU", display: "Declined to Specify" }
];

// Marital status options
const MARITAL_STATUS_OPTIONS = [
  { code: "S", display: "Single" },
  { code: "M", display: "Married" },
  { code: "D", display: "Divorced" },
  { code: "W", display: "Widowed" },
  { code: "L", display: "Legally Separated" },
  { code: "P", display: "Domestic Partner" },
  { code: "U", display: "Unknown" }
];

// Language options
const LANGUAGE_OPTIONS = [
  { code: "en", display: "English" },
  { code: "es", display: "Spanish" },
  { code: "zh", display: "Chinese" },
  { code: "vi", display: "Vietnamese" },
  { code: "ko", display: "Korean" },
  { code: "tl", display: "Tagalog" },
  { code: "ru", display: "Russian" },
  { code: "ar", display: "Arabic" },
  { code: "fr", display: "French" },
  { code: "pt", display: "Portuguese" },
  { code: "de", display: "German" },
  { code: "other", display: "Other" }
];

// Emergency contact relationship options
const RELATIONSHIP_OPTIONS = [
  { code: "E", display: "Emergency Contact" },
  { code: "C", display: "Parent" },
  { code: "N", display: "Next of Kin" },
  { code: "S", display: "Spouse" },
  { code: "F", display: "Family Member" },
  { code: "O", display: "Other" }
];

// Name prefix options
const PREFIX_OPTIONS = ["Mr.", "Mrs.", "Ms.", "Miss", "Dr.", "Prof."];

// Name suffix options  
const SUFFIX_OPTIONS = ["Jr.", "Sr.", "II", "III", "IV", "MD", "PhD", "RN", "Esq."];

export function EditPatientModal({ isOpen, onClose, patient, onSuccess }: EditPatientModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [formData, setFormData] = useState({
    // Basic Information
    prefix: "",
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    birthDate: "",
    gender: "",
    birthSex: "",
    active: true,
    deceased: false,
    maritalStatus: "",
    race: "",
    ethnicity: "",

    // Contact Information
    homePhone: "",
    workPhone: "",
    mobilePhone: "",
    email: "",
    preferredLanguage: "",

    // Address
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",

    // Emergency Contact
    emergencyContactName: "",
    emergencyContactRelationship: "",
    emergencyContactPhone: ""
  });

  // Load patient data when modal opens
  useEffect(() => {
    if (patient && isOpen) {
      const fhirData = patient.raw_fhir_data || {};
      
      // Extract phone numbers by type from FHIR telecom
      const telecoms = fhirData.telecom || [];
      const homePhone = telecoms.find((t: any) => t.system === "phone" && t.use === "home")?.value || "";
      const workPhone = telecoms.find((t: any) => t.system === "phone" && t.use === "work")?.value || "";
      const mobilePhone = telecoms.find((t: any) => t.system === "phone" && t.use === "mobile")?.value || patient.phone || "";
      const email = telecoms.find((t: any) => t.system === "email")?.value || patient.email || "";

      // Extract address from FHIR
      const address = fhirData.address?.[0] || {};
      
      // Extract extensions
      const extensions = fhirData.extension || [];
      const raceExt = extensions.find((e: any) => e.url?.includes("us-core-race"));
      const ethnicityExt = extensions.find((e: any) => e.url?.includes("us-core-ethnicity"));
      const birthSexExt = extensions.find((e: any) => e.url?.includes("us-core-birthsex"));

      // Extract emergency contact
      const contact = fhirData.contact?.[0] || {};
      const contactName = contact.name ? 
        [...(contact.name.given || []), contact.name.family].filter(Boolean).join(" ") : "";

      // Extract name parts
      const fhirName = fhirData.name?.[0] || {};

      setFormData({
        prefix: fhirName.prefix?.[0] || patient.prefix || "none",
        firstName: fhirName.given?.[0] || patient.first_name || "",
        middleName: fhirName.given?.[1] || patient.middle_name || "",
        lastName: fhirName.family || patient.last_name || "",
        suffix: fhirName.suffix?.[0] || patient.suffix || "none",
        birthDate: patient.date_of_birth || fhirData.birthDate || "",
        gender: patient.gender || fhirData.gender || "",
        birthSex: birthSexExt?.valueCode || "none",
        active: fhirData.active !== undefined ? fhirData.active : true,
        deceased: fhirData.deceasedBoolean || false,
        maritalStatus: fhirData.maritalStatus?.coding?.[0]?.code || "none",
        race: raceExt?.extension?.find((e: any) => e.url === "ombCategory")?.valueCoding?.code || "none",
        ethnicity: ethnicityExt?.extension?.find((e: any) => e.url === "ombCategory")?.valueCoding?.code || "none",
        homePhone,
        workPhone,
        mobilePhone,
        email,
        preferredLanguage: fhirData.communication?.[0]?.language?.coding?.[0]?.code || "none",
        addressLine1: address.line?.[0] || patient.address || "",
        addressLine2: address.line?.[1] || patient.address_line2 || "",
        city: address.city || patient.city || "",
        state: address.state || patient.state || "none",
        postalCode: address.postalCode || patient.postal_code || "",
        country: address.country || "US",
        emergencyContactName: contactName,
        emergencyContactRelationship: contact.relationship?.[0]?.coding?.[0]?.code || "none",
        emergencyContactPhone: contact.telecom?.[0]?.value || ""
      });

      setErrors({});
      setActiveTab("basic");
    }
  }, [patient, isOpen]);

  // Handle input changes
  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field is edited
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required fields
    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }
    if (!formData.birthDate) {
      newErrors.birthDate = "Date of birth is required";
    }
    if (!formData.gender) {
      newErrors.gender = "Gender is required";
    }

    // Phone validation (10 digits)
    const phoneRegex = /^[\d\s\-\(\)]{10,}$/;
    if (formData.homePhone && !phoneRegex.test(formData.homePhone.replace(/\D/g, ""))) {
      newErrors.homePhone = "Invalid phone number";
    }
    if (formData.workPhone && !phoneRegex.test(formData.workPhone.replace(/\D/g, ""))) {
      newErrors.workPhone = "Invalid phone number";
    }
    if (formData.mobilePhone && !phoneRegex.test(formData.mobilePhone.replace(/\D/g, ""))) {
      newErrors.mobilePhone = "Invalid phone number";
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = "Invalid email address";
    }

    // ZIP code validation (5 digits)
    if (formData.postalCode && !/^\d{5}(-\d{4})?$/.test(formData.postalCode)) {
      newErrors.postalCode = "Invalid ZIP code (use 5 digits or 5+4 format)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Clean value helper - converts "none" placeholder back to undefined
  const cleanValue = (val: string): string | undefined => {
    if (val === "none" || val === "") return undefined;
    return val;
  };

  // Get account number from FHIR data
  const getAccountNumber = (pat: Patient): string => {
    const fhirData = pat.raw_fhir_data || {};
    const identifiers = fhirData.identifier || [];
    
    // Find secondary identifier (account number)
    const secondaryId = identifiers.find((id: any) => id.use === "secondary");
    if (secondaryId?.value) return secondaryId.value;
    
    // Fall back to usual identifier
    const usualId = identifiers.find((id: any) => id.use === "usual");
    if (usualId?.value) return usualId.value;
    
    // Fall back to external_id
    return pat.external_id;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm() || !patient) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving.",
        variant: "destructive"
      });
      return;
    }

    // Check for missing connection ID
    if (!patient.source_connection_id) {
      toast({
        title: "Cannot Update",
        description: "This patient is not linked to an ECW connection. Please sync patients first.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Get the account number for patient matching
      const accountNumber = getAccountNumber(patient);

      // Prepare race data if selected
      const raceValue = cleanValue(formData.race);
      const raceData = raceValue ? {
        code: raceValue,
        display: RACE_OPTIONS.find(r => r.code === raceValue)?.display || raceValue
      } : undefined;

      // Prepare ethnicity data if selected
      const ethnicityValue = cleanValue(formData.ethnicity);
      const ethnicityData = ethnicityValue ? {
        code: ethnicityValue,
        display: ETHNICITY_OPTIONS.find(e => e.code === ethnicityValue)?.display || ethnicityValue
      } : undefined;

      // Prepare language data if selected
      const languageValue = cleanValue(formData.preferredLanguage);
      const languageData = languageValue ? {
        code: languageValue,
        display: LANGUAGE_OPTIONS.find(l => l.code === languageValue)?.display || languageValue
      } : undefined;

      // Build the update payload
      const updatePayload = {
        connectionId: patient.source_connection_id,
        patientExternalId: patient.external_id,
        accountNumber: accountNumber,
        data: {
          prefix: cleanValue(formData.prefix),
          firstName: formData.firstName,
          middleName: formData.middleName || undefined,
          lastName: formData.lastName,
          suffix: cleanValue(formData.suffix),
          birthDate: formData.birthDate,
          gender: formData.gender,
          active: formData.active,
          deceased: formData.deceased,
          maritalStatus: cleanValue(formData.maritalStatus),
          homePhone: formData.homePhone || undefined,
          workPhone: formData.workPhone || undefined,
          mobilePhone: formData.mobilePhone || undefined,
          email: formData.email || undefined,
          addressLine1: formData.addressLine1 || undefined,
          addressLine2: formData.addressLine2 || undefined,
          city: formData.city || undefined,
          state: cleanValue(formData.state),
          postalCode: formData.postalCode || undefined,
          country: formData.country || "US",
          race: raceData,
          ethnicity: ethnicityData,
          birthSex: cleanValue(formData.birthSex),
          preferredLanguage: languageData,
          emergencyContactName: formData.emergencyContactName || undefined,
          emergencyContactRelationship: cleanValue(formData.emergencyContactRelationship),
          emergencyContactPhone: formData.emergencyContactPhone || undefined
        }
      };

      // Store before data for audit log
      const beforeData = {
        firstName: patient.first_name,
        lastName: patient.last_name,
        birthDate: patient.date_of_birth,
        gender: patient.gender,
        phone: patient.phone,
        email: patient.email
      };

      console.log("Sending patient update:", updatePayload);

      // Call the edge function
      const { data: response, error } = await awsApi.invoke("ecw-patient-update", {
        body: updatePayload
      });

      if (error) {
        throw new Error(error.message || "Failed to update patient");
      }

      if (!response?.success) {
        throw new Error(response?.error || "Failed to update patient in ECW");
      }

      // Update succeeded - now update local database with ALL fields
      const stateValue = cleanValue(formData.state);
      const prefixValue = cleanValue(formData.prefix);
      const suffixValue = cleanValue(formData.suffix);
      
      // Build updated FHIR data to keep raw_fhir_data in sync
      const updatedFhirData = {
        ...patient.raw_fhir_data,
        name: [{
          family: formData.lastName,
          given: [formData.firstName, formData.middleName].filter(Boolean),
          prefix: prefixValue ? [prefixValue] : [],
          suffix: suffixValue ? [suffixValue] : []
        }],
        birthDate: formData.birthDate,
        gender: formData.gender,
        active: formData.active,
        deceasedBoolean: formData.deceased,
        telecom: [
          formData.homePhone && { system: "phone", value: formData.homePhone, use: "home" },
          formData.mobilePhone && { system: "phone", value: formData.mobilePhone, use: "mobile" },
          formData.workPhone && { system: "phone", value: formData.workPhone, use: "work" },
          formData.email && { system: "email", value: formData.email, use: "home" }
        ].filter(Boolean),
        address: [{
          use: "home",
          line: [formData.addressLine1, formData.addressLine2].filter(Boolean),
          city: formData.city || undefined,
          state: stateValue || undefined,
          postalCode: formData.postalCode || undefined,
          country: formData.country || "US"
        }]
      };

      const { data: { user: currentUser } } = await supabase.auth.getUser();

      const localUpdateResult = await awsCrud.update('patients', {
        first_name: formData.firstName,
        last_name: formData.lastName,
        middle_name: formData.middleName || null,
        prefix: prefixValue || null,
        suffix: suffixValue || null,
        date_of_birth: formData.birthDate,
        gender: formData.gender,
        phone: formData.mobilePhone || formData.homePhone || null,
        email: formData.email || null,
        address: formData.addressLine1 || null,
        city: formData.city || null,
        state: stateValue || null,
        postal_code: formData.postalCode || null,
        raw_fhir_data: updatedFhirData,
        updated_at: new Date().toISOString()
      }, { id: patient.id }, currentUser?.id || "");

      if (localUpdateResult.error) {
        console.error("Failed to update local database:", localUpdateResult.error);
        // Don't throw - ECW update succeeded
      }

      // Log to audit table
      const afterData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        birthDate: formData.birthDate,
        gender: formData.gender,
        phone: formData.mobilePhone || formData.homePhone,
        email: formData.email
      };

      // Calculate what changed
      const changes: Record<string, { from: any; to: any }> = {};
      Object.keys(afterData).forEach(key => {
        const beforeVal = beforeData[key as keyof typeof beforeData];
        const afterVal = afterData[key as keyof typeof afterData];
        if (beforeVal !== afterVal) {
          changes[key] = { from: beforeVal, to: afterVal };
        }
      });

      if (currentUser) {
        await awsCrud.insert('patient_audit_log', {
          patient_id: patient.id,
          patient_external_id: patient.external_id,
          user_id: currentUser.id,
          action: "patient_update",
          changes: changes,
          before_data: beforeData,
          after_data: afterData,
          source: "ecw",
          status: "success"
        }, currentUser.id);
      }

      toast({
        title: "Patient Updated",
        description: `Successfully updated ${formData.firstName} ${formData.lastName} in eClinicalWorks.`
      });

      onSuccess();
      onClose();

    } catch (error: unknown) {
      console.error("Patient update error:", error);
      const errorMsg = error instanceof Error ? error.message : "Failed to update patient";

      // Log failed attempt to audit table
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await awsCrud.insert('patient_audit_log', {
            patient_id: patient.id,
            patient_external_id: patient.external_id,
            user_id: user.id,
            action: "patient_update",
            changes: null,
            before_data: null,
            after_data: null,
            source: "ecw",
            status: "failed",
            error_message: errorMsg
          }, user.id);
        }
      } catch (auditError) {
        console.error("Failed to log audit:", auditError);
      }

      // Show user-friendly error message
      let errorMessage = errorMsg;
      
      // Map common ECW errors to user-friendly messages
      if (errorMessage.includes("100") || errorMessage.includes("not found")) {
        errorMessage = "Patient not found in ECW. The account number or date of birth may not match.";
      } else if (errorMessage.includes("103")) {
        errorMessage = "Invalid patient ID. Please try refreshing the patient data.";
      } else if (errorMessage.includes("203")) {
        errorMessage = "Invalid characters in the data. Please check for special characters.";
      } else if (errorMessage.includes("401") || errorMessage.includes("Authentication")) {
        errorMessage = "Authentication failed. Please reconnect to ECW in Settings.";
      } else if (errorMessage.includes("403") || errorMessage.includes("authorized")) {
        errorMessage = "Not authorized. Please ensure Patient Update scope is enabled.";
      } else if (errorMessage.includes("408") || errorMessage.includes("timeout")) {
        errorMessage = "Request timed out. Please try again.";
      } else if (errorMessage.includes("500")) {
        errorMessage = "ECW server error. Please try again later.";
      }

      toast({
        title: "Update Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!patient) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Edit Patient: {patient.first_name} {patient.last_name}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="basic" className="flex items-center gap-1">
              <User className="h-4 w-4" />
              Basic
            </TabsTrigger>
            <TabsTrigger value="contact" className="flex items-center gap-1">
              <Phone className="h-4 w-4" />
              Contact
            </TabsTrigger>
            <TabsTrigger value="address" className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              Address
            </TabsTrigger>
            <TabsTrigger value="other" className="flex items-center gap-1">
              <Heart className="h-4 w-4" />
              Other
            </TabsTrigger>
          </TabsList>

          {/* Basic Information Tab */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-4 gap-4">
              {/* Prefix */}
              <div className="space-y-2">
                <Label htmlFor="prefix">Prefix</Label>
                <Select value={formData.prefix} onValueChange={(v) => handleChange("prefix", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {PREFIX_OPTIONS.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* First Name */}
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleChange("firstName", e.target.value)}
                  className={errors.firstName ? "border-destructive" : ""}
                />
                {errors.firstName && <p className="text-sm text-destructive">{errors.firstName}</p>}
              </div>

              {/* Middle Name */}
              <div className="space-y-2">
                <Label htmlFor="middleName">Middle Name</Label>
                <Input
                  id="middleName"
                  value={formData.middleName}
                  onChange={(e) => handleChange("middleName", e.target.value)}
                />
              </div>

              {/* Suffix */}
              <div className="space-y-2">
                <Label htmlFor="suffix">Suffix</Label>
                <Select value={formData.suffix} onValueChange={(v) => handleChange("suffix", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {SUFFIX_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Last Name */}
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  className={errors.lastName ? "border-destructive" : ""}
                />
                {errors.lastName && <p className="text-sm text-destructive">{errors.lastName}</p>}
              </div>

              {/* Date of Birth */}
              <div className="space-y-2">
                <Label htmlFor="birthDate">Date of Birth *</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => handleChange("birthDate", e.target.value)}
                  className={errors.birthDate ? "border-destructive" : ""}
                />
                {errors.birthDate && <p className="text-sm text-destructive">{errors.birthDate}</p>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Gender */}
              <div className="space-y-2">
                <Label htmlFor="gender">Gender *</Label>
                <Select value={formData.gender} onValueChange={(v) => handleChange("gender", v)}>
                  <SelectTrigger className={errors.gender ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
                {errors.gender && <p className="text-sm text-destructive">{errors.gender}</p>}
              </div>

              {/* Birth Sex */}
              <div className="space-y-2">
                <Label htmlFor="birthSex">Birth Sex</Label>
                <Select value={formData.birthSex} onValueChange={(v) => handleChange("birthSex", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    <SelectItem value="M">Male</SelectItem>
                    <SelectItem value="F">Female</SelectItem>
                    <SelectItem value="UNK">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Marital Status */}
              <div className="space-y-2">
                <Label htmlFor="maritalStatus">Marital Status</Label>
                <Select value={formData.maritalStatus} onValueChange={(v) => handleChange("maritalStatus", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {MARITAL_STATUS_OPTIONS.map(m => (
                      <SelectItem key={m.code} value={m.code}>{m.display}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Race */}
              <div className="space-y-2">
                <Label htmlFor="race">Race</Label>
                <Select value={formData.race} onValueChange={(v) => handleChange("race", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select race" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {RACE_OPTIONS.map(r => (
                      <SelectItem key={r.code} value={r.code}>{r.display}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ethnicity */}
              <div className="space-y-2">
                <Label htmlFor="ethnicity">Ethnicity</Label>
                <Select value={formData.ethnicity} onValueChange={(v) => handleChange("ethnicity", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select ethnicity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {ETHNICITY_OPTIONS.map(e => (
                      <SelectItem key={e.code} value={e.code}>{e.display}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-8 pt-2">
              {/* Active Status */}
              <div className="flex items-center gap-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(v) => handleChange("active", v)}
                />
                <Label htmlFor="active">Active Patient</Label>
              </div>

              {/* Deceased Status */}
              <div className="flex items-center gap-2">
                <Switch
                  id="deceased"
                  checked={formData.deceased}
                  onCheckedChange={(v) => handleChange("deceased", v)}
                />
                <Label htmlFor="deceased">Mark as Deceased</Label>
              </div>
            </div>
          </TabsContent>

          {/* Contact Information Tab */}
          <TabsContent value="contact" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Home Phone */}
              <div className="space-y-2">
                <Label htmlFor="homePhone">Home Phone</Label>
                <Input
                  id="homePhone"
                  placeholder="(555) 123-4567"
                  value={formData.homePhone}
                  onChange={(e) => handleChange("homePhone", e.target.value)}
                  className={errors.homePhone ? "border-destructive" : ""}
                />
                {errors.homePhone && <p className="text-sm text-destructive">{errors.homePhone}</p>}
              </div>

              {/* Mobile Phone */}
              <div className="space-y-2">
                <Label htmlFor="mobilePhone">Mobile Phone</Label>
                <Input
                  id="mobilePhone"
                  placeholder="(555) 123-4567"
                  value={formData.mobilePhone}
                  onChange={(e) => handleChange("mobilePhone", e.target.value)}
                  className={errors.mobilePhone ? "border-destructive" : ""}
                />
                {errors.mobilePhone && <p className="text-sm text-destructive">{errors.mobilePhone}</p>}
              </div>

              {/* Work Phone */}
              <div className="space-y-2">
                <Label htmlFor="workPhone">Work Phone</Label>
                <Input
                  id="workPhone"
                  placeholder="(555) 123-4567"
                  value={formData.workPhone}
                  onChange={(e) => handleChange("workPhone", e.target.value)}
                  className={errors.workPhone ? "border-destructive" : ""}
                />
                {errors.workPhone && <p className="text-sm text-destructive">{errors.workPhone}</p>}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="patient@example.com"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>
            </div>

            {/* Preferred Language */}
            <div className="space-y-2">
              <Label htmlFor="preferredLanguage" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Preferred Language
              </Label>
              <Select value={formData.preferredLanguage} onValueChange={(v) => handleChange("preferredLanguage", v)}>
                <SelectTrigger className="w-full md:w-1/2">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {LANGUAGE_OPTIONS.map(l => (
                    <SelectItem key={l.code} value={l.code}>{l.display}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Address Tab */}
          <TabsContent value="address" className="space-y-4 mt-4">
            <div className="space-y-4">
              {/* Street Address Line 1 */}
              <div className="space-y-2">
                <Label htmlFor="addressLine1">Street Address</Label>
                <Input
                  id="addressLine1"
                  placeholder="123 Main Street"
                  value={formData.addressLine1}
                  onChange={(e) => handleChange("addressLine1", e.target.value)}
                />
              </div>

              {/* Street Address Line 2 */}
              <div className="space-y-2">
                <Label htmlFor="addressLine2">Street Address Line 2</Label>
                <Input
                  id="addressLine2"
                  placeholder="Apt 4B, Suite 100, etc."
                  value={formData.addressLine2}
                  onChange={(e) => handleChange("addressLine2", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* City */}
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="City"
                    value={formData.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                  />
                </div>

                {/* State */}
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select value={formData.state} onValueChange={(v) => handleChange("state", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select state</SelectItem>
                      {US_STATES.map(s => (
                        <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* ZIP Code */}
                <div className="space-y-2">
                  <Label htmlFor="postalCode">ZIP Code</Label>
                  <Input
                    id="postalCode"
                    placeholder="12345"
                    value={formData.postalCode}
                    onChange={(e) => handleChange("postalCode", e.target.value)}
                    className={errors.postalCode ? "border-destructive" : ""}
                  />
                  {errors.postalCode && <p className="text-sm text-destructive">{errors.postalCode}</p>}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Other Tab (Emergency Contact) */}
          <TabsContent value="other" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-medium">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Emergency Contact
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Contact Name */}
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactName">Contact Name</Label>
                  <Input
                    id="emergencyContactName"
                    placeholder="Full name"
                    value={formData.emergencyContactName}
                    onChange={(e) => handleChange("emergencyContactName", e.target.value)}
                  />
                </div>

                {/* Relationship */}
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactRelationship">Relationship</Label>
                  <Select 
                    value={formData.emergencyContactRelationship} 
                    onValueChange={(v) => handleChange("emergencyContactRelationship", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select relationship</SelectItem>
                      {RELATIONSHIP_OPTIONS.map(r => (
                        <SelectItem key={r.code} value={r.code}>{r.display}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Contact Phone */}
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
                  <Input
                    id="emergencyContactPhone"
                    placeholder="(555) 123-4567"
                    value={formData.emergencyContactPhone}
                    onChange={(e) => handleChange("emergencyContactPhone", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditPatientModal;
