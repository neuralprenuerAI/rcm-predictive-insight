import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { connectionId } = await req.json();
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
      .single();

    if (connError) {
      console.error("Connection fetch error:", connError);
      throw new Error("Connection not found");
    }

    console.log("Connection found, generating JWT token");

    // Parse credentials from connection
    const credentials = connection.credentials as {
      client_id: string;
      private_key: string;
      issuer_url: string;
    };

    // Get token URL from metadata
    const metadataUrl = `${credentials.issuer_url}/metadata?_format=json`;
    console.log("Fetching metadata from:", metadataUrl);
    
    const metadataResponse = await fetch(metadataUrl);
    if (!metadataResponse.ok) {
      throw new Error(`Failed to fetch metadata: ${metadataResponse.statusText}`);
    }
    
    const metadata = await metadataResponse.json();
    const tokenUrl = metadata.rest?.[0]?.security?.extension?.[0]?.extension?.find(
      (ext: any) => ext.url === "token"
    )?.valueUri;

    if (!tokenUrl) {
      throw new Error("Could not find token URL in metadata");
    }

    console.log("Token URL found:", tokenUrl);

    // Generate JWT for client assertion
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = {
      iss: credentials.client_id,
      sub: credentials.client_id,
      aud: tokenUrl,
      jti: crypto.randomUUID(),
      iat: now,
      nbf: now,
      exp: now + 300, // 5 minutes expiration
    };
    // Import private key for signing
    const privateKeyPem = credentials.private_key;
    
    // Remove PEM headers and decode base64
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    const pemContents = privateKeyPem
      .replace(pemHeader, "")
      .replace(pemFooter, "")
      .replace(/\s/g, "");
    
    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

    // Import the key
    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryDer,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["sign"]
    );

    // Helper function for base64url encoding
    const base64urlEncode = (data: ArrayBuffer | string): string => {
      let binary: string;
      if (typeof data === 'string') {
        binary = new TextEncoder().encode(data).reduce((acc, byte) => acc + String.fromCharCode(byte), '');
      } else {
        binary = new Uint8Array(data).reduce((acc, byte) => acc + String.fromCharCode(byte), '');
      }
      return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    };

    // Create JWT header
    const header = {
      alg: "RS256",
      typ: "JWT",
    };

    // Encode header and payload
    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedPayload = base64urlEncode(JSON.stringify(jwtPayload));
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    // Sign the JWT
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      new TextEncoder().encode(dataToSign)
    );

    // Encode signature
    const encodedSignature = base64urlEncode(signature);

    const clientAssertion = `${dataToSign}.${encodedSignature}`;

    console.log("JWT generated, requesting access token", { alg: header.alg, aud: jwtPayload.aud });

    // Request access token
    const tokenRequestBody = new URLSearchParams({
      grant_type: "client_credentials",
      scope: "system/Patient.read system/Group.read",
      client_id: credentials.client_id,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: clientAssertion,
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
