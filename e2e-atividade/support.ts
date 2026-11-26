import { test as base, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "..");

function execSql(sql: string) {
  const result = spawnSync(
    "docker",
    [
      "compose",
      "-f",
      "compose.atividade.e2e.yml",
      "-p",
      "atividade-e2e",
      "exec",
      "-T",
      "database",
      "psql",
      "-U",
      "postgres",
      "-d",
      "atividade_e2e",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
      input: sql,
    },
  );
  if (result.error || result.status !== 0) {
    throw new Error(
      `Falha ao preparar o banco E2E da atividade: ${result.error?.message ?? result.stderr}`,
    );
  }
}

export function clearDatabase() {
  execSql("TRUNCATE enrollments, courses, students RESTART IDENTITY CASCADE;\n");
}

export function resetDatabase() {
  const seed = readFileSync(resolve(projectRoot, "database/seed.sql"), "utf8");
  execSql(
    "TRUNCATE enrollments, courses, students RESTART IDENTITY CASCADE;\n" + seed,
  );
}

export const test = base.extend({
  page: async ({ page }, use) => {
    resetDatabase();
    await page.goto("/");
    await expect(page.getByTestId("list-message")).toHaveAttribute(
      "data-state",
      "success",
    );
    await use(page);
  },
});

export { expect };
