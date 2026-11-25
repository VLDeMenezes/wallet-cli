#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { runSyncApi } from "./commands/sync-api.js";
import { runWebhook } from "./commands/webhook.js";

const program = new Command();

program
  .name("wallet-cli")
  .description("CLI interna para flujo de Beland")
  .version("0.1.0");

program
  .command("sync-api")
  .description("Sincroniza tipos TypeScript desde el OpenAPI/Swagger de NestJS")
  .option(
    "-u, --url <url>",
    "URL del JSON de Swagger",
    process.env.WALLET_SWAGGER_URL ||
      "https://beland-backend-production-e86c.up.railway.app/docs",
  )
  .option(
    "-o, --out <path>",
    "Ruta de salida de los tipos generados",
    "./generated/wallet-api.ts",
  )
  .option(
    "-s, --spec-out <path>",
    "Ruta donde guardar el snapshot del OpenAPI JSON",
    "./generated/openapi.json",
  )
  .action(async (opts) => {
    try {
      await runSyncApi(opts);
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(pc.red(`✖ Error en sync-api: ${message}`));
      process.exit(1);
    }
  });

program
  .command("webhook")
  .description(
    "Envía un evento de webhook firmado con HMAC-SHA256 al backend NestJS",
  )
  .argument(
    "<event>",
    "Evento a simular: deposit.settled | transfer.settled | transfer.failed",
  )
  .option(
    "-u, --url <url>",
    "URL del endpoint de webhooks en NestJS",
    process.env.WALLET_WEBHOOK_URL || "http://localhost:3000/webhooks/psp",
  )
  .option(
    "-s, --secret <secret>",
    "Secreto compartido para firmar con HMAC-SHA256",
    process.env.WALLET_WEBHOOK_SECRET || "",
  )
  .option("--user-id <id>", "ID de usuario de prueba")
  .option("--tx-id <id>", "ID de transacción de prueba")
  .option("--amount <amount>", "Monto de la operación (ej. 50.00)")
  .option("--currency <code>", "Código de moneda ISO", "EUR")
  .option("--reason <reason>", "Motivo de fallo para transfer.failed")
  .option(
    "--header-name <name>",
    "Nombre de la cabecera de firma",
    "X-Wallet-Signature",
  )
  .action(async (event, opts) => {
    try {
      await runWebhook({ ...opts, event });
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(pc.red(`✖ Error en webhook: ${message}`));
      process.exit(1);
    }
  });

program.parse();
