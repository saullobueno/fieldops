import type { Page } from "@playwright/test";

import { e2eBaseUrls } from "../../playwright.config";

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto(`${e2eBaseUrls.web}/login`);
  await page.getByLabel("Email").fill("admin@acmefield.example");
  await page.getByLabel("Senha").fill("demo1234");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(`${e2eBaseUrls.web}/`);
}

export async function loginAsTechnician(page: Page): Promise<void> {
  await page.goto(`${e2eBaseUrls.mobileWeb}/login`);
  await page.getByLabel("Email").fill("ana@acmefield.example");
  await page.getByLabel("Senha").fill("demo1234");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(`${e2eBaseUrls.mobileWeb}/`);
}
