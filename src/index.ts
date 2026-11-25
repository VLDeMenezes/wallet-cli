#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { runSyncApi } from "./commands/sync-api.js";

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

program.parse();
