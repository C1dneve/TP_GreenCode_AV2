import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

function filesBelow(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? filesBelow(path) : path.endsWith(".ts") ? [path] : [];
  });
}

test("routes e controllers de produção não acessam Prisma diretamente", () => {
  const root = join(process.cwd(), "src", "modules");
  const violations: string[] = [];
  for (const path of filesBelow(root)) {
    if (!/(?:routes|controller)\.ts$/.test(path)) continue;
    const source = readFileSync(path, "utf8");
    if (/\bPrismaClient\b|\bPrisma\.|\bprisma\s*\.|\$transaction\s*\(/.test(source)) violations.push(relative(process.cwd(), path));
  }
  assert.deepEqual(violations, [], `Acesso Prisma encontrado em camadas HTTP: ${violations.join(", ")}`);
});

test("services de produção não dependem dos tipos HTTP do Fastify", () => {
  const root = join(process.cwd(), "src", "modules");
  const violations: string[] = [];
  for (const path of filesBelow(root)) {
    if (!/\.service\.ts$/.test(path)) continue;
    const source = readFileSync(path, "utf8");
    if (/FastifyRequest|FastifyReply|FastifyInstance/.test(source)) violations.push(relative(process.cwd(), path));
  }
  assert.deepEqual(violations, [], `Dependência Fastify encontrada em services: ${violations.join(", ")}`);
});
