import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const jwks = {
  keys: [
    {
      kty: "RSA",
      alg: "RS384",
      use: "sig",
      kid: "neuralprenuer-key-1",
      n: "mExztVloAeju0i9L2fH3XjMjOqHfze7WAbxeaTI_tKALHAsUd0zqcVqv62IrvzL-bw3RB-5qizoPj6MBINXbKdM9oJpH-9GErxgX7StqM8z0bU0umrVm6pRC85r-hj93q8uOloA31qCHeedonShSDq8PyksV_eF9u3lpcNJsrbyF-8hTQiPIyjvyRNMsgwNsoad_Y7vshENYQdHgNbR9fumXNL8w1oLoGtJY-rChqby5UwC4zOrPZKYjAUM-CPToa-S8SylSVdwGtj2bzfXu7XHWX3OOdv92PyIgLvTLSp3enBxW8GDnGlNl7Rx4jeiX398l5ATUXETv297DWrWNlw",
      e: "AQAB"
    }
  ]
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  return new Response(JSON.stringify(jwks), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
