import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const jsonResponse = (request: Request, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...Object.fromEntries(buildCorsHeaders(request, {
        allowedMethods: ["POST", "OPTIONS"],
      }).headers.entries()),
      "Content-Type": "application/json",
    },
  });

Deno.serve((request) => {
  if (request.method === "OPTIONS") {
    return handleCorsPreflight(request, {
      allowedMethods: ["POST", "OPTIONS"],
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(request, { error: "Metodo nao suportado." }, 405);
  }

  return jsonResponse(
    request,
    {
      error: "A ativacao manual de plano foi desativada por seguranca. Use a cobranca Pix oficial.",
      code: "ACTIVATE_PLAN_DISABLED",
    },
    410,
  );
});
