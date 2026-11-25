#!/usr/bin/env node

// src/index.ts
import { Command } from "commander";
import pc2 from "picocolors";

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
    console.error(pc2.red(`\u2716 Error en sync-api: ${message}`));
    process.exit(1);
  }
});
program.parse();
