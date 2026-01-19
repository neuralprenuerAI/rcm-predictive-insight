import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.2.0";
import { safeLog, logError, logOperation } from "../_shared/safeLogger.ts";

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
    const { connectionId, environment = "sandbox", scopeOverride } = await req.json();
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    logOperation("ecw-get-token", { 
      userId: user.id, 
      resourceType: "api_connection", 
      resourceId: connectionId,
      status: "started" 
    });

    // Fetch API connection details
    const { data: connection, error: connError } = await supabaseClient
      .from("api_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (connError) {
      logError("Connection fetch error", connError);
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
    
    // Log only non-sensitive operation metadata
    console.log("Environment:", environment);
    console.log("Token endpoint configured");

    // Generate JWT payload - CRITICAL: aud MUST be the token endpoint URL
    const now = Math.floor(Date.now() / 1000);
    const jti = crypto.randomUUID();
    const jwtPayload = {
      iss: credentials.client_id,
      sub: credentials.client_id,
      aud: tokenUrl, // MUST be token endpoint, NOT FHIR URL
      jti: jti,
      iat: now,
      exp: now + 300, // 5 minutes expiration
    };

    // Validate private key format
    const privateKeyStr = credentials.private_key.trim();
    if (!privateKeyStr.includes("-----BEGIN PRIVATE KEY-----")) {
      throw new Error("Private key must be in PKCS#8 PEM format (-----BEGIN PRIVATE KEY-----)");
    }

    // Import private key using jose library
    console.log("Importing private key...");
    const privateKey = await importPKCS8(privateKeyStr, "RS384");
    console.log("Private key imported successfully");

    // Create JWT header
    const jwtHeader = {
      alg: "RS384",
      typ: "JWT",
      kid: credentials.kid || "neuralprenuer-key-1",
    };

    // Create and sign JWT
    const jwt = await new SignJWT(jwtPayload)
      .setProtectedHeader(jwtHeader)
      .sign(privateKey);

    console.log("JWT generated successfully");

    // Use scopeOverride if provided, otherwise use connection's scope
    const effectiveScope = scopeOverride || credentials.scope;
    
    // Validate scope is configured
    if (!effectiveScope) {
      throw new Error("No scope configured for this connection. Please edit the connection and select data types.");
    }

    // Build token request
    const tokenRequestBody = new URLSearchParams({
      grant_type: "client_credentials",
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: jwt,
      scope: effectiveScope,
    });

    console.log("Making token request...");

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenRequestBody.toString(),
    });

    console.log("Token response status:", tokenResponse.status);

    if (!tokenResponse.ok) {
      const rawText = await tokenResponse.text();
      let parsed: any = null;
      try { parsed = JSON.parse(rawText); } catch (_) {}
      const message = parsed?.error_description || parsed?.error || "Token request failed";
      logError("Token request failed", { status: tokenResponse.status, error: message });
      throw new Error(`Token request failed: ${message}`);
    }

    const tokenData = await tokenResponse.json();
    
    logOperation("ecw-get-token", { 
      userId: user.id, 
      resourceType: "access_token", 
      status: "obtained",
    });

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
      logError("Failed to update token in database", updateError);
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
    logError("Error in ecw-get-token", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
