import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Loader2, UserPlus, Phone, MapPin, Heart, Globe, AlertCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { awsApi } from "@/integrations/aws/awsApi";
import { awsCrud } from "@/lib/awsCrud";

interface CreatePatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  connectionId: string | null;
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
  { code: "de", display: "German" }
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

// Generate a unique account number
const generateAccountNumber = (): string => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `NEW${timestamp}${random}`;
};

export function CreatePatientModal({ isOpen, onClose, onSuccess, connectionId }: CreatePatientModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state with empty initial values
  const [formData, setFormData] = useState({
    // Account Number (required for ECW)
    accountNumber: "",
    
    // Basic Information
    prefix: "none",
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "none",
    birthDate: "",
    gender: "",
    birthSex: "unspecified",
    active: true,
    maritalStatus: "unspecified",
    race: "unspecified",
    ethnicity: "unspecified",

    // Contact Information
    homePhone: "",
    workPhone: "",
    mobilePhone: "",
    email: "",
    preferredLanguage: "unspecified",

    // Address
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "unspecified",
    postalCode: "",
    country: "US",

    // Emergency Contact
    emergencyContactName: "",
    emergencyContactRelationship: "unspecified",
    emergencyContactPhone: ""
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        accountNumber: generateAccountNumber(),
        prefix: "none",
        firstName: "",
        middleName: "",
        lastName: "",
        suffix: "none",
        birthDate: "",
        gender: "",
        birthSex: "unspecified",
        active: true,
        maritalStatus: "unspecified",
        race: "unspecified",
        ethnicity: "unspecified",
        homePhone: "",
        workPhone: "",
        mobilePhone: "",
        email: "",
        preferredLanguage: "unspecified",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "unspecified",
        postalCode: "",
        country: "US",
        emergencyContactName: "",
        emergencyContactRelationship: "unspecified",
        emergencyContactPhone: ""
      });
      setErrors({});
      setActiveTab("basic");
    }
  }, [isOpen]);

  // Handle input changes
  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Regenerate account number
  const handleRegenerateAccountNumber = () => {
    handleChange("accountNumber", generateAccountNumber());
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required fields
    if (!formData.accountNumber.trim()) {
      newErrors.accountNumber = "Account number is required";
    }
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
      newErrors.homePhone = "Invalid phone number (10 digits required)";
    }
    if (formData.workPhone && !phoneRegex.test(formData.workPhone.replace(/\D/g, ""))) {
      newErrors.workPhone = "Invalid phone number (10 digits required)";
    }
    if (formData.mobilePhone && !phoneRegex.test(formData.mobilePhone.replace(/\D/g, ""))) {
      newErrors.mobilePhone = "Invalid phone number (10 digits required)";
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

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before creating the patient.",
        variant: "destructive"
      });
      return;
    }

    if (!connectionId) {
      toast({
        title: "No Connection",
        description: "Please select an ECW connection first.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Helper function to clean "unspecified" and "none" values
      const cleanValue = (val: string | undefined): string | undefined => {
        if (!val || val === "none" || val === "unspecified") return undefined;
        return val;
      };

      // Prepare race data if selected
      const raceCode = cleanValue(formData.race);
      const raceData = raceCode ? {
        code: raceCode,
        display: RACE_OPTIONS.find(r => r.code === raceCode)?.display || raceCode
      } : undefined;

      // Prepare ethnicity data if selected
      const ethnicityCode = cleanValue(formData.ethnicity);
      const ethnicityData = ethnicityCode ? {
        code: ethnicityCode,
        display: ETHNICITY_OPTIONS.find(e => e.code === ethnicityCode)?.display || ethnicityCode
      } : undefined;

      // Prepare language data if selected
      const languageCode = cleanValue(formData.preferredLanguage);
      const languageData = languageCode ? {
        code: languageCode,
        display: LANGUAGE_OPTIONS.find(l => l.code === languageCode)?.display || languageCode
      } : undefined;

      // Build the create payload
      const createPayload = {
        connectionId: connectionId,
        accountNumber: formData.accountNumber.trim(),
        data: {
          prefix: cleanValue(formData.prefix),
          firstName: formData.firstName.trim(),
          middleName: formData.middleName?.trim() || undefined,
          lastName: formData.lastName.trim(),
          suffix: cleanValue(formData.suffix),
          birthDate: formData.birthDate,
          gender: formData.gender,
          active: formData.active,
          maritalStatus: cleanValue(formData.maritalStatus),
          homePhone: formData.homePhone?.trim() || undefined,
          workPhone: formData.workPhone?.trim() || undefined,
          mobilePhone: formData.mobilePhone?.trim() || undefined,
          email: formData.email?.trim() || undefined,
          addressLine1: formData.addressLine1?.trim() || undefined,
          addressLine2: formData.addressLine2?.trim() || undefined,
          city: formData.city?.trim() || undefined,
          state: cleanValue(formData.state),
          postalCode: formData.postalCode?.trim() || undefined,
          country: formData.country || "US",
          race: raceData,
          ethnicity: ethnicityData,
          birthSex: cleanValue(formData.birthSex),
          preferredLanguage: languageData,
          emergencyContactName: formData.emergencyContactName?.trim() || undefined,
          emergencyContactRelationship: cleanValue(formData.emergencyContactRelationship),
          emergencyContactPhone: formData.emergencyContactPhone?.trim() || undefined
        }
      };

      console.log("=== PATIENT CREATE START ===");
      console.log("Payload:", createPayload);

      // Call the edge function
      const { data: response, error } = await awsApi.invoke("ecw-patient-create", {
        body: createPayload
      });

      console.log("ECW Response:", response);
      console.log("ECW Error:", error);

      if (error) {
        throw new Error(error.message || "Failed to create patient in ECW");
      }

      if (!response?.success) {
        throw new Error(response?.error || "Failed to create patient in ECW");
      }

      // ECW creation successful - now save to local database
      console.log("ECW create successful, saving to local database...");

      const { data: { user } } = await supabase.auth.getUser();

      // Build raw_fhir_data for local storage
      const rawFhirData = {
        resourceType: "Patient",
        id: response.externalId,
        identifier: [
          { use: "usual", value: formData.accountNumber },
          { use: "secondary", value: formData.accountNumber }
        ],
        name: [{
          family: formData.lastName,
          given: [formData.firstName, formData.middleName].filter(Boolean),
          prefix: cleanValue(formData.prefix) ? [formData.prefix] : [],
          suffix: cleanValue(formData.suffix) ? [formData.suffix] : []
        }],
        birthDate: formData.birthDate,
        gender: formData.gender,
        telecom: [
          formData.homePhone && { system: "phone", value: formData.homePhone, use: "home" },
          formData.mobilePhone && { system: "phone", value: formData.mobilePhone, use: "mobile" },
          formData.workPhone && { system: "phone", value: formData.workPhone, use: "work" },
          formData.email && { system: "email", value: formData.email, use: "home" }
        ].filter(Boolean),
        address: (formData.addressLine1 || formData.city) ? [{
          use: "home",
          line: [formData.addressLine1, formData.addressLine2].filter(Boolean),
          city: formData.city,
          state: cleanValue(formData.state),
          postalCode: formData.postalCode,
          country: formData.country
        }] : []
      };

      // Insert new patient into local database
      const result = await awsCrud.insert("patients", {
        external_id: response.externalId || formData.accountNumber,
        source: "ecw",
        source_connection_id: connectionId,
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        middle_name: formData.middleName?.trim() || null,
        prefix: cleanValue(formData.prefix) || null,
        suffix: cleanValue(formData.suffix) || null,
        date_of_birth: formData.birthDate,
        gender: formData.gender,
        phone: formData.mobilePhone?.trim() || formData.homePhone?.trim() || null,
        email: formData.email?.trim() || null,
        address_line1: formData.addressLine1?.trim() || null,
        address_line2: formData.addressLine2?.trim() || null,
        city: formData.city?.trim() || null,
        state: cleanValue(formData.state) || null,
        postal_code: formData.postalCode?.trim() || null,
        user_id: user?.id,
        raw_fhir_data: rawFhirData,
        last_synced_at: new Date().toISOString()
      }, user?.id || "");
      
      const newPatient = result.data;
        console.error("Failed to save patient locally:", insertError);
        // Don't throw - ECW creation succeeded, just warn about local save
        toast({
          title: "Patient Created in ECW",
          description: "Patient was created in ECW but failed to save locally. Please sync patients to update.",
          variant: "default"
        });
      } else {
        console.log("Patient saved locally:", newPatient);
      }

      // Log to audit table
      try {
        if (user) {
          await awsCrud.insert('patient_audit_log', {
            patient_id: newPatient?.id || null,
            patient_external_id: response.externalId || formData.accountNumber,
            user_id: user.id,
            action: "patient_create",
            changes: null,
            before_data: null,
            after_data: {
              firstName: formData.firstName,
              lastName: formData.lastName,
              birthDate: formData.birthDate,
              gender: formData.gender,
              accountNumber: formData.accountNumber
            },
            source: "ecw",
            status: "success"
          }, user.id);
        }
      } catch (auditError) {
        console.error("Failed to log audit:", auditError);
      }

      console.log("=== PATIENT CREATE COMPLETE ===");

      toast({
        title: "Patient Created",
        description: `Successfully created ${formData.firstName} ${formData.lastName} in eClinicalWorks.`
      });

      onSuccess();
      onClose();

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create patient";
      console.error("Patient create error:", error);

      // Log failed attempt to audit table
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await awsCrud.insert('patient_audit_log', {
            patient_id: null,
            patient_external_id: formData.accountNumber,
            user_id: user.id,
            action: "patient_create",
            changes: null,
            before_data: null,
            after_data: null,
            source: "ecw",
            status: "failed",
            error_message: errorMessage
          }, user.id);
        }
      } catch (auditError) {
        console.error("Failed to log audit:", auditError);
      }

      // Show user-friendly error message
      let displayError = errorMessage;
      
      // Map common ECW errors
      if (displayError.includes("already exists") || displayError.includes("100")) {
        displayError = "A patient with this account number already exists in ECW. Please use a different account number.";
      } else if (displayError.includes("103")) {
        displayError = "Invalid account number format. Please try a different account number.";
      } else if (displayError.includes("203")) {
        displayError = "Invalid characters in the data. Please check for special characters and try again.";
      } else if (displayError.includes("401") || displayError.includes("Authentication")) {
        displayError = "Authentication failed. Please reconnect to ECW in Settings.";
      } else if (displayError.includes("403") || displayError.includes("authorized")) {
        displayError = "Not authorized. Please ensure Patient Create scope is enabled in your ECW connection.";
      } else if (displayError.includes("408") || displayError.includes("timeout")) {
        displayError = "Request timed out. Please try again.";
      } else if (displayError.includes("500")) {
        displayError = "ECW server error. Please try again later.";
      }

      toast({
        title: "Create Failed",
        description: displayError,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create New Patient
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Basic
            </TabsTrigger>
            <TabsTrigger value="contact" className="gap-2">
              <Phone className="h-4 w-4" />
              Contact
            </TabsTrigger>
            <TabsTrigger value="address" className="gap-2">
              <MapPin className="h-4 w-4" />
              Address
            </TabsTrigger>
            <TabsTrigger value="other" className="gap-2">
              <Heart className="h-4 w-4" />
              Other
            </TabsTrigger>
          </TabsList>

          {/* Basic Information Tab */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            {/* Account Number - ECW Required */}
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg border border-dashed">
              <Label htmlFor="accountNumber" className="text-sm font-medium">
                ECW Account Number *
              </Label>
              <div className="flex gap-2">
                <Input
                  id="accountNumber"
                  value={formData.accountNumber}
                  onChange={(e) => handleChange("accountNumber", e.target.value)}
                  className={`flex-1 ${errors.accountNumber ? "border-destructive" : "border-primary/30"}`}
                  placeholder="Unique account number for ECW"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleRegenerateAccountNumber}
                  title="Generate new account number"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              {errors.accountNumber && <p className="text-xs text-destructive">{errors.accountNumber}</p>}
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                This must be unique. If this number already exists in ECW, creation will fail.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-4">
              {/* Prefix */}
              <div className="space-y-2">
                <Label>Prefix</Label>
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
                  placeholder="Enter first name"
                />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
              </div>

              {/* Middle Name */}
              <div className="space-y-2">
                <Label htmlFor="middleName">Middle Name</Label>
                <Input
                  id="middleName"
                  value={formData.middleName}
                  onChange={(e) => handleChange("middleName", e.target.value)}
                  placeholder="Enter middle name"
                />
              </div>

              {/* Suffix */}
              <div className="space-y-2">
                <Label>Suffix</Label>
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
                  placeholder="Enter last name"
                />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
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
                {errors.birthDate && <p className="text-xs text-destructive">{errors.birthDate}</p>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Gender */}
              <div className="space-y-2">
                <Label>Gender *</Label>
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
                {errors.gender && <p className="text-xs text-destructive">{errors.gender}</p>}
              </div>

              {/* Birth Sex */}
              <div className="space-y-2">
                <Label>Birth Sex</Label>
                <Select value={formData.birthSex} onValueChange={(v) => handleChange("birthSex", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unspecified">Not specified</SelectItem>
                    <SelectItem value="M">Male</SelectItem>
                    <SelectItem value="F">Female</SelectItem>
                    <SelectItem value="UNK">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Marital Status */}
              <div className="space-y-2">
                <Label>Marital Status</Label>
                <Select value={formData.maritalStatus} onValueChange={(v) => handleChange("maritalStatus", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unspecified">Not specified</SelectItem>
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
                <Label>Race</Label>
                <Select value={formData.race} onValueChange={(v) => handleChange("race", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unspecified">Not specified</SelectItem>
                    {RACE_OPTIONS.map(r => (
                      <SelectItem key={r.code} value={r.code}>{r.display}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ethnicity */}
              <div className="space-y-2">
                <Label>Ethnicity</Label>
                <Select value={formData.ethnicity} onValueChange={(v) => handleChange("ethnicity", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unspecified">Not specified</SelectItem>
                    {ETHNICITY_OPTIONS.map(e => (
                      <SelectItem key={e.code} value={e.code}>{e.display}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-2 pt-2">
              <Switch
                checked={formData.active}
                onCheckedChange={(v) => handleChange("active", v)}
              />
              <Label>Active Patient</Label>
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
                {errors.homePhone && <p className="text-xs text-destructive">{errors.homePhone}</p>}
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
                {errors.mobilePhone && <p className="text-xs text-destructive">{errors.mobilePhone}</p>}
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
                {errors.workPhone && <p className="text-xs text-destructive">{errors.workPhone}</p>}
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
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
            </div>

            {/* Preferred Language */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Preferred Language
              </Label>
              <Select value={formData.preferredLanguage} onValueChange={(v) => handleChange("preferredLanguage", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unspecified">Not specified</SelectItem>
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
                  placeholder="Apt, Suite, Unit, etc."
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
                  <Label>State</Label>
                  <Select value={formData.state} onValueChange={(v) => handleChange("state", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unspecified">Select state</SelectItem>
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
                  {errors.postalCode && <p className="text-xs text-destructive">{errors.postalCode}</p>}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Other Tab (Emergency Contact) */}
          <TabsContent value="other" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-medium">
                <Heart className="h-5 w-5 text-red-500" />
                Emergency Contact
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                  <Label>Relationship</Label>
                  <Select 
                    value={formData.emergencyContactRelationship} 
                    onValueChange={(v) => handleChange("emergencyContactRelationship", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unspecified">Select relationship</SelectItem>
                      {RELATIONSHIP_OPTIONS.map(r => (
                        <SelectItem key={r.code} value={r.code}>{r.display}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Contact Phone */}
                <div className="space-y-2 col-span-2">
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

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading} className="bg-green-600 hover:bg-green-700">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Create Patient
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreatePatientModal;
