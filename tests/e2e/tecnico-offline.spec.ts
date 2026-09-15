import { expect, test } from "@playwright/test";

import { e2eBaseUrls } from "../../playwright.config";
import { loginAsTechnician } from "./helpers";

/**
 * Fluxo offline do técnico: `context.setOffline()` emula a condição de rede
 * no nível do Chromium (CDP), então o `navigator.onLine`/eventos
 * `online`/`offline` da página reagem como num dispositivo real perdendo
 * conexão — sem precisar mockar `fetch` manualmente.
 */
test("técnico enfileira checklist offline e sincroniza automaticamente ao voltar online", async ({
  context,
  page
}) => {
  await loginAsTechnician(page);
  await page.goto(`${e2eBaseUrls.mobileWeb}/`);

  await expect(page.getByText("Online", { exact: true })).toBeVisible();
  await expect(page.getByText(/0 comando\(s\) pendente\(s\)/)).toBeVisible();
  await expect(page.getByText("WO-1001")).toBeVisible();
  await page.getByRole("button", { name: "Abrir detalhes" }).first().click();
  await expect(page.getByRole("heading", { name: "Checklist" })).toBeVisible();
  await page
    .locator("label")
    .filter({ hasText: "Registrar leitura elétrica" })
    .getByRole("spinbutton")
    .fill("220");

  await context.setOffline(true);
  await expect(page.getByText("Offline", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Salvar checklist" }).click();

  await expect(page.getByText(/1 comando\(s\) pendente\(s\)/)).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText("Online", { exact: true })).toBeVisible();
  await expect(page.getByText(/0 comando\(s\) pendente\(s\)/)).toBeVisible({ timeout: 20_000 });
});
