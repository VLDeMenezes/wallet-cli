import fs from "node:fs/promises";
import path from "node:path";
import openapiTS, { astToString } from "openapi-typescript";
import pc from "picocolors";

export interface SyncApiOptions {
  url: string;
  out: string;
  specOut: string;
}

export async function runSyncApi(options: SyncApiOptions): Promise<void> {
  const { url, out, specOut } = options;

  console.log(pc.cyan(`Descargando spec OpenAPI desde ${url}...`));
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Error al obtener Swagger (${response.status} ${response.statusText})`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `La URL devolvió "${contentType}" en lugar de JSON. Verifica la ruta del JSON de Swagger (ej. /api-json).`,
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
  console.log(pc.green(`✔ Tipos generados en: ${out}`));
  console.log(
    pc.dim(
      `  Spec guardada en: ${specOut} (${endpointCount} rutas detectadas)`,
    ),
  );
}
