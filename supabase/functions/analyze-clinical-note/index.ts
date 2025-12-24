import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClinicalNoteInput {
  noteContent: string;
  noteType?: string;
  patientName?: string;
  patientId?: string;
  encounterDate?: string;
  providerName?: string;
  specialty?: string;
  source?: string;
}

interface ExtractedData {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  reviewOfSystems: string[];
  physicalExam: Record<string, string>;
  assessment: string[];
  plan: string[];
  proceduresPerformed: string[];
  medicationsAdministered: string[];
  timeSpent: number | null;
  mdmComplexity: string;
  diagnoses: Array<{ code?: string; description: string }>;
  vitals: Record<string, string>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error("Not authenticated");
    }

    const input: ClinicalNoteInput = await req.json();
    
    if (!input.noteContent || input.noteContent.trim().length < 50) {
      throw new Error("Clinical note content is required and must be at least 50 characters");
    }

    console.log("Analyzing clinical note, length:", input.noteContent.length);

    // Store the clinical note first
    const { data: clinicalNote, error: insertError } = await supabaseClient
      .from("clinical_notes")
      .insert({
        user_id: user.id,
        patient_id: input.patientId || null,
        patient_name: input.patientName || null,
        encounter_date: input.encounterDate || null,
        note_type: input.noteType || "progress_note",
        raw_content: input.noteContent,
        source: input.source || "paste",
        provider_name: input.providerName || null,
        specialty: input.specialty || null,
        status: "processing",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting clinical note:", insertError);
      throw new Error("Failed to save clinical note");
    }

    console.log("Clinical note saved with ID:", clinicalNote.id);

    // Call AI to extract structured data
    const startTime = Date.now();
    const extractedData = await extractClinicalData(input.noteContent, input.specialty);
    const processingTime = Date.now() - startTime;

    console.log("AI extraction completed in", processingTime, "ms");

    // Update the clinical note with parsed content
    const { error: updateError } = await supabaseClient
      .from("clinical_notes")
      .update({
        parsed_content: extractedData,
        status: "completed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", clinicalNote.id);

    if (updateError) {
      console.error("Error updating clinical note:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        clinicalNoteId: clinicalNote.id,
        extractedData,
        processingTimeMs: processingTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in analyze-clinical-note:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function extractClinicalData(noteContent: string, specialty?: string): Promise<ExtractedData> {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  
  if (!geminiApiKey) {
    console.log("No Gemini API key, using basic extraction");
    return basicExtraction(noteContent);
  }

  const specialtyContext = specialty 
    ? `This is a ${specialty} clinical note.` 
    : "This is a clinical note.";

  const prompt = `You are a medical coding expert. Analyze this clinical note and extract structured information for billing purposes.

${specialtyContext}

CLINICAL NOTE:
${noteContent}

Extract and return a JSON object with these fields:
{
  "chiefComplaint": "main reason for visit",
  "historyOfPresentIllness": "detailed HPI narrative",
  "reviewOfSystems": ["system1: findings", "system2: findings"],
  "physicalExam": {
    "general": "findings",
    "cardiovascular": "findings",
    "respiratory": "findings",
    "other_systems": "findings"
  },
  "assessment": ["diagnosis 1", "diagnosis 2"],
  "plan": ["plan item 1", "plan item 2"],
  "proceduresPerformed": ["procedure 1 with details", "procedure 2"],
  "medicationsAdministered": ["medication 1 with dose and route", "medication 2"],
  "timeSpent": number_of_minutes_or_null,
  "mdmComplexity": "straightforward|low|moderate|high",
  "diagnoses": [
    {"code": "ICD-10 if mentioned", "description": "diagnosis description"}
  ],
  "vitals": {
    "bp": "value",
    "hr": "value",
    "temp": "value",
    "weight": "value"
  }
}

Focus on:
1. Any procedures performed (injections, tests, wound care, etc.)
2. Medications given in office (not just prescribed)
3. Time documented for the visit
4. Complexity indicators for E/M level
5. All diagnoses mentioned

Return ONLY valid JSON, no other text.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      return basicExtraction(noteContent);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error("No text in Gemini response");
      return basicExtraction(noteContent);
    }

    // Clean and parse JSON
    let jsonStr = text.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    }
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }

    const extracted = JSON.parse(jsonStr.trim());
    return {
      chiefComplaint: extracted.chiefComplaint || "",
      historyOfPresentIllness: extracted.historyOfPresentIllness || "",
      reviewOfSystems: extracted.reviewOfSystems || [],
      physicalExam: extracted.physicalExam || {},
      assessment: extracted.assessment || [],
      plan: extracted.plan || [],
      proceduresPerformed: extracted.proceduresPerformed || [],
      medicationsAdministered: extracted.medicationsAdministered || [],
      timeSpent: extracted.timeSpent || null,
      mdmComplexity: extracted.mdmComplexity || "low",
      diagnoses: extracted.diagnoses || [],
      vitals: extracted.vitals || {},
    };

  } catch (error) {
    console.error("Error calling Gemini:", error);
    return basicExtraction(noteContent);
  }
}

function basicExtraction(noteContent: string): ExtractedData {
  const lowerContent = noteContent.toLowerCase();
  
  // Basic keyword detection for procedures
  const procedures: string[] = [];
  if (lowerContent.includes("injection") || lowerContent.includes("injected")) {
    procedures.push("Injection performed");
  }
  if (lowerContent.includes("ecg") || lowerContent.includes("ekg") || lowerContent.includes("electrocardiogram")) {
    procedures.push("ECG performed");
  }
  if (lowerContent.includes("wound care") || lowerContent.includes("debridement")) {
    procedures.push("Wound care/debridement");
  }
  if (lowerContent.includes("i&d") || lowerContent.includes("incision and drainage")) {
    procedures.push("I&D performed");
  }

  // Detect medications administered
  const medications: string[] = [];
  const commonMeds = ["toradol", "ketorolac", "depo-medrol", "kenalog", "b12", "dexamethasone"];
  
  for (const med of commonMeds) {
    if (lowerContent.includes(med)) {
      medications.push(med.charAt(0).toUpperCase() + med.slice(1) + " administered");
    }
  }

  // Detect complexity
  let mdmComplexity = "low";
  if (lowerContent.includes("multiple") || lowerContent.includes("chronic conditions") || lowerContent.includes("comorbid")) {
    mdmComplexity = "moderate";
  }
  if (lowerContent.includes("severe") || lowerContent.includes("complex") || lowerContent.includes("acute exacerbation")) {
    mdmComplexity = "high";
  }

  // Extract time if mentioned
  let timeSpent = null;
  const timeMatch = noteContent.match(/(\d+)\s*(minutes?|mins?)\s*(spent|total|face[\s-]?to[\s-]?face)?/i);
  if (timeMatch) {
    timeSpent = parseInt(timeMatch[1]);
  }

  return {
    chiefComplaint: "",
    historyOfPresentIllness: "",
    reviewOfSystems: [],
    physicalExam: {},
    assessment: [],
    plan: [],
    proceduresPerformed: procedures,
    medicationsAdministered: medications,
    timeSpent,
    mdmComplexity,
    diagnoses: [],
    vitals: {},
  };
}
