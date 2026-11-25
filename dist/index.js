#!/usr/bin/env node

// src/index.ts
import { Command } from "commander";
import pc3 from "picocolors";

// src/commands/sync-api.ts
import fs from "fs/promises";
import path from "path";
import openapiTS, { astToString } from "openapi-typescript";
import pc from "picocolors";
async function runSyncApi(options) {
  const { url, out, specOut } = options;
  console.log(pc.cyan(`Descargando spec OpenAPI desde ${url}...`));
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Error al obtener Swagger (${response.status} ${response.statusText})`
    );
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `La URL devolvi\xF3 "${contentType}" en lugar de JSON. Verifica la ruta del JSON de Swagger (ej. /api-json).`
    );
  }
  const rawSpecText = await response.text();
  const parsedSpec = JSON.parse(rawSpecText);
  const specPath = path.resolve(process.cwd(), specOut);
  const outPath = path.resolve(process.cwd(), out);
  await fs.mkdir(path.dirname(specPath), { recursive: true });
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(specPath, JSON.stringify(parsedSpec, null, 2), "utf8");
  const ast = await openapiTS(parsedSpec);
  const generatedTypes = astToString(ast);
  await fs.writeFile(outPath, generatedTypes, "utf8");
  const endpointCount = Object.keys(parsedSpec.paths ?? {}).length;
  console.log(pc.green(`\u2714 Tipos generados en: ${out}`));
  console.log(
    pc.dim(
      `  Spec guardada en: ${specOut} (${endpointCount} rutas detectadas)`
    )
  );
}

// src/commands/webhook.ts
import crypto from "crypto";
import pc2 from "picocolors";
var SUPPORTED_EVENTS = [
  "deposit.settled",
  "transfer.settled",
  "transfer.failed"
];
function isSupportedEvent(event) {
  return SUPPORTED_EVENTS.includes(event);
}
function buildPayload(options, eventId, timestamp) {
  const basePayload = {
    id: eventId,
    type: options.event,
    createdAt: timestamp,
    livemode: false
  };
  switch (options.event) {
    case "deposit.settled":
      return {
        ...basePayload,
        data: {
          transactionId: options.txId ?? `tx_dep_${crypto.randomBytes(4).toString("hex")}`,
          userId: options.userId ?? "usr_demo_001",
          amount: Number(options.amount ?? "50.00"),
          currency: options.currency.toUpperCase(),
          status: "SETTLED",
          method: "SEPA_INSTANT"
        }
      };
    case "transfer.settled":
      return {
        ...basePayload,
        data: {
          transactionId: options.txId ?? `tx_trf_${crypto.randomBytes(4).toString("hex")}`,
          senderUserId: options.userId ?? "usr_demo_001",
          recipientUserId: "usr_demo_002",
          amount: Number(options.amount ?? "25.00"),
          currency: options.currency.toUpperCase(),
          status: "SETTLED"
        }
      };
    case "transfer.failed":
      return {
        ...basePayload,
        data: {
          transactionId: options.txId ?? `tx_err_${crypto.randomBytes(4).toString("hex")}`,
          senderUserId: options.userId ?? "usr_demo_001",
          amount: Number(options.amount ?? "120.00"),
          currency: options.currency.toUpperCase(),
          status: "FAILED",
          failureReason: options.reason ?? "INSUFFICIENT_FUNDS"
        }
      };
    default:
      throw new Error(`Evento no soportado: ${options.event}`);
  }
}
function signPayload(rawBody, secret, timestamp) {
  const signedContent = `${timestamp}.${rawBody}`;
  const digest = crypto.createHmac("sha256", secret).update(signedContent, "utf8").digest("hex");
  return `t=${timestamp},v1=${digest}`;
}
async function runWebhook(options) {
  if (!isSupportedEvent(options.event)) {
    throw new Error(
      `Evento "${options.event}" no v\xE1lido. Usa uno de: ${SUPPORTED_EVENTS.join(", ")}`
    );
  }
  if (!options.secret) {
    throw new Error(
      "Falta el secreto HMAC. P\xE1salo con --secret o define WALLET_WEBHOOK_SECRET."
    );
  }
  const eventId = `evt_${crypto.randomBytes(6).toString("hex")}`;
  const timestamp = Math.floor(Date.now() / 1e3).toString();
  const payload = buildPayload(options, eventId, timestamp);
  const rawBody = JSON.stringify(payload);
  const signature = signPayload(rawBody, options.secret, timestamp);
  console.log(
    pc2.cyan(`Enviando webhook "${options.event}" a ${options.url}...`)
  );
  console.log(pc2.dim(`Payload: ${rawBody}`));
  const response = await fetch(options.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Id": eventId,
      [options.headerName]: signature
    },
    body: rawBody
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      `El endpoint respondi\xF3 con ${response.status} ${response.statusText}: ${responseText}`
    );
  }
  console.log(
    pc2.green(`\u2714 Webhook entregado (${response.status} ${response.statusText})`)
  );
  if (responseText) {
    console.log(pc2.dim(`Respuesta: ${responseText}`));
  }
}

// src/index.ts
var program = new Command();
program.name("wallet-cli").description("CLI interna para flujo de Beland").version("0.1.0");
program.command("sync-api").description("Sincroniza tipos TypeScript desde el OpenAPI/Swagger de NestJS").option(
  "-u, --url <url>",
  "URL del JSON de Swagger",
  process.env.WALLET_SWAGGER_URL || "https://beland-backend-production-e86c.up.railway.app/docs"
).option(
  "-o, --out <path>",
  "Ruta de salida de los tipos generados",
  "./generated/wallet-api.ts"
).option(
  "-s, --spec-out <path>",
  "Ruta donde guardar el snapshot del OpenAPI JSON",
  "./generated/openapi.json"
).action(async (opts) => {
  try {
    await runSyncApi(opts);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(pc3.red(`\u2716 Error en sync-api: ${message}`));
    process.exit(1);
  }
});
program.command("webhook").description(
  "Env\xEDa un evento de webhook firmado con HMAC-SHA256 al backend NestJS"
).argument(
  "<event>",
  "Evento a simular: deposit.settled | transfer.settled | transfer.failed"
).option(
  "-u, --url <url>",
  "URL del endpoint de webhooks en NestJS",
  process.env.WALLET_WEBHOOK_URL || "http://localhost:3000/webhooks/psp"
).option(
  "-s, --secret <secret>",
  "Secreto compartido para firmar con HMAC-SHA256",
  process.env.WALLET_WEBHOOK_SECRET || ""
).option("--user-id <id>", "ID de usuario de prueba").option("--tx-id <id>", "ID de transacci\xF3n de prueba").option("--amount <amount>", "Monto de la operaci\xF3n (ej. 50.00)").option("--currency <code>", "C\xF3digo de moneda ISO", "EUR").option("--reason <reason>", "Motivo de fallo para transfer.failed").option(
  "--header-name <name>",
  "Nombre de la cabecera de firma",
  "X-Wallet-Signature"
).action(async (event, opts) => {
  try {
    await runWebhook({ ...opts, event });
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(pc3.red(`\u2716 Error en webhook: ${message}`));
    process.exit(1);
  }
});
program.parse();
