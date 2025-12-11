import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// FIXED token endpoints - ECW does NOT use SMART discovery
const TOKEN_ENDPOINTS = {
  sandbox: "https://staging-oauthserver.ecwcloud.com/oauth/oauth2/token",
  production: "https://oauthserver.eclinicalworks.com/oauth/oauth2/token",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { connectionId, environment = "sandbox" } = await req.json();
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    console.log("Fetching API connection details for connection:", connectionId);

    // Fetch API connection details
    const { data: connection, error: connError } = await supabaseClient
      .from("api_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (connError) {
      console.error("Connection fetch error:", connError);
      throw new Error("Failed to fetch connection");
    }

    if (!connection) {
      throw new Error("Connection not found or you don't have access");
    }

    console.log("Connection found, generating JWT token");

    // Parse credentials from connection
    const credentials = connection.credentials as {
      client_id: string;
      private_key: string;
      issuer_url: string;
      kid?: string;
      scope?: string;
    };

    if (!credentials?.client_id || !credentials?.private_key) {
      throw new Error("Missing client_id or private_key in credentials");
    }

    // Select token endpoint based on environment
    const tokenUrl = TOKEN_ENDPOINTS[environment as keyof typeof TOKEN_ENDPOINTS] || TOKEN_ENDPOINTS.sandbox;
    console.log("Using token endpoint:", tokenUrl, "environment:", environment);

    // Generate JWT payload
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = {
      iss: credentials.client_id,
      sub: credentials.client_id,
      aud: tokenUrl,
      jti: crypto.randomUUID(),
      iat: now,
      exp: now + 300, // 5 minutes expiration
    };

    // Import private key using jose library
    const privateKey = await jose.importPKCS8(credentials.private_key, "RS384");

    // Create and sign JWT
    const jwt = await new jose.SignJWT(jwtPayload)
      .setProtectedHeader({
        alg: "RS384",
        typ: "JWT",
        kid: credentials.kid || "neuralprenuer-key-1",
      })
      .sign(privateKey);

    console.log("JWT generated, requesting access token", { aud: jwtPayload.aud, kid: credentials.kid });

    // Request access token
    const tokenRequestBody = new URLSearchParams({
      grant_type: "client_credentials",
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: jwt,
      scope: credentials.scope || "system/Patient.read system/Encounter.read system/Coverage.read system/Observation.read system/Claim.read system/Procedure.read",
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenRequestBody.toString(),
    });

    if (!tokenResponse.ok) {
      const rawText = await tokenResponse.text();
      let parsed: any = null;
      try { parsed = JSON.parse(rawText); } catch (_) {}
      const message = parsed?.error_description || parsed?.error || rawText;
      console.error("Token request failed:", parsed ?? rawText);
      throw new Error(`Token request failed: ${message}`);
    }

    const tokenData = await tokenResponse.json();
    console.log("Access token obtained successfully");

    // Store the token in the connection for reuse
    const { error: updateError } = await supabaseClient
      .from("api_connections")
      .update({
        credentials: {
          ...credentials,
          access_token: tokenData.access_token,
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        },
        last_sync: new Date().toISOString(),
      })
      .eq("id", connectionId);

    if (updateError) {
      console.error("Failed to update token in database:", updateError);
    }

    return new Response(
      JSON.stringify({
        access_token: tokenData.access_token,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        scope: tokenData.scope,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ecw-get-token:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
