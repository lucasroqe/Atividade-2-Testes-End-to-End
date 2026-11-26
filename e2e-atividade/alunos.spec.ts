import { test, expect, clearDatabase } from "./support";

const initialStudents = [
  { ra: "258001", name: "Ana Clara Silva" },
  { ra: "258002", name: "Bruno Henrique Santos" },
  { ra: "258003", name: "Camila Oliveira Souza" },
];

test("exibe os alunos cadastrados no banco ao abrir a página", async ({
  page,
}) => {
  await expect(page.getByTestId("students-table")).toBeVisible();
  await expect(page.getByTestId("list-message")).toHaveText("");

  const rows = page.getByTestId("student-row");
  await expect(rows).toHaveCount(initialStudents.length);

  for (let i = 0; i < initialStudents.length; i++) {
    const cells = rows.nth(i).getByRole("cell");
    await expect(cells.nth(0)).toHaveText(initialStudents[i].ra);
    await expect(cells.nth(1)).toHaveText(initialStudents[i].name);
  }
});

test("cadastra aluno válido, atualiza a tabela e limpa o formulário", async ({
  page,
}) => {
  const raInput = page.getByLabel("RA", { exact: true });
  const nameInput = page.getByLabel("Nome", { exact: true });
  const submitButton = page.getByRole("button", { name: "Cadastrar aluno" });

  await raInput.fill("258010");
  await nameInput.fill("Diego Ferreira");

  const postResponse = page.waitForResponse(
    (res) =>
      new URL(res.url()).pathname === "/api/students" &&
      res.request().method() === "POST",
  );
  const listResponse = page.waitForResponse(
    (res) =>
      new URL(res.url()).pathname === "/api/students" &&
      res.request().method() === "GET",
  );

  await submitButton.click();

  expect((await postResponse).status()).toBe(201);
  expect((await listResponse).status()).toBe(200);

  const formMessage = page.getByTestId("form-message");
  await expect(formMessage).toHaveAttribute("data-state", "success");
  await expect(formMessage).toHaveText("Aluno cadastrado com sucesso.");

  await expect(raInput).toHaveValue("");
  await expect(nameInput).toHaveValue("");

  const rows = page.getByTestId("student-row");
  await expect(rows).toHaveCount(4);

  const newRow = rows.filter({ hasText: "258010" });
  await expect(newRow).toHaveCount(1);
  await expect(newRow.getByRole("cell").nth(1)).toHaveText("Diego Ferreira");
});

test("mantém o aluno cadastrado na tabela após recarregar a página", async ({
  page,
}) => {
  await page.getByLabel("RA", { exact: true }).fill("258011");
  await page.getByLabel("Nome", { exact: true }).fill("Eduarda Lima");

  const postResponse = page.waitForResponse(
    (res) =>
      new URL(res.url()).pathname === "/api/students" &&
      res.request().method() === "POST",
  );

  await page.getByRole("button", { name: "Cadastrar aluno" }).click();
  expect((await postResponse).status()).toBe(201);

  await expect(page.getByTestId("student-row")).toHaveCount(4);

  await page.reload();
  await expect(page.getByTestId("list-message")).toHaveAttribute(
    "data-state",
    "success",
  );

  const rows = page.getByTestId("student-row");
  await expect(rows).toHaveCount(4);

  const savedRow = rows.filter({ hasText: "258011" });
  await expect(savedRow).toHaveCount(1);
  await expect(savedRow.getByRole("cell").nth(1)).toHaveText("Eduarda Lima");
});

for (const scenario of [
  { label: "ambos vazios", ra: "", name: "", invalidField: "RA" as const },
  { label: "Nome vazio", ra: "258015", name: "", invalidField: "Nome" as const },
  {
    label: "RA vazio",
    ra: "",
    name: "Fernanda Costa",
    invalidField: "RA" as const,
  },
]) {
  test(`impede cadastro quando campos obrigatórios estão vazios: ${scenario.label}`, async ({
    page,
  }) => {
    const postRequests: string[] = [];
    page.on("request", (req) => {
      if (
        req.method() === "POST" &&
        new URL(req.url()).pathname === "/api/students"
      ) {
        postRequests.push(req.url());
      }
    });

    if (scenario.ra)
      await page.getByLabel("RA", { exact: true }).fill(scenario.ra);
    if (scenario.name)
      await page.getByLabel("Nome", { exact: true }).fill(scenario.name);

    await page.getByRole("button", { name: "Cadastrar aluno" }).click();

    const field = page.getByLabel(scenario.invalidField, { exact: true });
    const missing = await field.evaluate(
      (el: HTMLInputElement) => el.validity.valueMissing,
    );
    expect(missing).toBe(true);
    expect(postRequests).toHaveLength(0);
    await expect(page.getByTestId("form-message")).toHaveText("");
    await expect(page.getByTestId("student-row")).toHaveCount(
      initialStudents.length,
    );
  });
}

for (const scenario of [
  { label: "negativo", ra: "-10" },
  { label: "zero", ra: "0" },
  { label: "decimal", ra: "12.5" },
  { label: "maior que 2147483647", ra: "2147483648" },
]) {
  test(`rejeita RA inválido (${scenario.label})`, async ({ page }) => {
    const postRequests: string[] = [];
    page.on("request", (req) => {
      if (
        req.method() === "POST" &&
        new URL(req.url()).pathname === "/api/students"
      ) {
        postRequests.push(req.url());
      }
    });

    const raInput = page.getByLabel("RA", { exact: true });
    await raInput.fill(scenario.ra);
    await page.getByLabel("Nome", { exact: true }).fill("Lucas Mendes");
    await page.getByRole("button", { name: "Cadastrar aluno" }).click();

    const isValid = await raInput.evaluate((el: HTMLInputElement) =>
      el.checkValidity(),
    );
    expect(isValid).toBe(false);
    expect(postRequests).toHaveLength(0);
    await expect(page.getByTestId("form-message")).toHaveText("");
    await expect(page.getByTestId("student-row")).toHaveCount(
      initialStudents.length,
    );
  });
}

for (const scenario of [
  { label: "menos de 3 caracteres", name: "Al", expectCustomMessage: false },
  { label: "apenas espaços", name: "   ", expectCustomMessage: true },
  {
    label: "espaços nas extremidades",
    name: "  Jo  ",
    expectCustomMessage: true,
  },
]) {
  test(`rejeita nome inválido (${scenario.label})`, async ({ page }) => {
    const postRequests: string[] = [];
    page.on("request", (req) => {
      if (
        req.method() === "POST" &&
        new URL(req.url()).pathname === "/api/students"
      ) {
        postRequests.push(req.url());
      }
    });

    const nameInput = page.getByLabel("Nome", { exact: true });
    await page.getByLabel("RA", { exact: true }).fill("258020");
    await nameInput.fill(scenario.name);
    await page.getByRole("button", { name: "Cadastrar aluno" }).click();

    const validation = await nameInput.evaluate((el: HTMLInputElement) => ({
      valid: el.checkValidity(),
      message: el.validationMessage,
    }));

    expect(validation.valid).toBe(false);
    if (scenario.expectCustomMessage) {
      expect(validation.message).toBe(
        "Informe um nome com pelo menos 3 caracteres.",
      );
    }
    expect(postRequests).toHaveLength(0);
    await expect(page.getByTestId("form-message")).toHaveText("");
    await expect(page.getByTestId("student-row")).toHaveCount(
      initialStudents.length,
    );
  });
}

test("rejeita RA duplicado, exibe erro e mantém campos preenchidos", async ({
  page,
}) => {
  const raInput = page.getByLabel("RA", { exact: true });
  const nameInput = page.getByLabel("Nome", { exact: true });

  await raInput.fill("258001");
  await nameInput.fill("Pedro Alves");

  const postResponse = page.waitForResponse(
    (res) =>
      new URL(res.url()).pathname === "/api/students" &&
      res.request().method() === "POST",
  );

  await page.getByRole("button", { name: "Cadastrar aluno" }).click();

  expect((await postResponse).status()).toBe(409);

  const formMessage = page.getByTestId("form-message");
  await expect(formMessage).toHaveAttribute("data-state", "error");
  await expect(formMessage).toHaveText(
    "Não foi possível cadastrar o aluno. Já existe um estudante com este RA.",
  );

  await expect(raInput).toHaveValue("258001");
  await expect(nameInput).toHaveValue("Pedro Alves");
  await expect(page.getByTestId("student-row")).toHaveCount(
    initialStudents.length,
  );
  await expect(page.getByTestId("students-list")).not.toContainText(
    "Pedro Alves",
  );
});

test("exibe mensagem quando não existem alunos cadastrados", async ({
  page,
}) => {
  clearDatabase();

  const listResponse = page.waitForResponse(
    (res) =>
      new URL(res.url()).pathname === "/api/students" &&
      res.request().method() === "GET",
  );

  await page.reload();
  expect((await listResponse).status()).toBe(200);

  const listMessage = page.getByTestId("list-message");
  await expect(listMessage).toHaveAttribute("data-state", "success");
  await expect(listMessage).toHaveText("Nenhum aluno cadastrado.");
  await expect(page.getByTestId("student-row")).toHaveCount(0);
});
