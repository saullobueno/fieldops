import { expect, test } from "@playwright/test";

import { e2eBaseUrls } from "../../playwright.config";
import { loginAsAdmin } from "./helpers";

/**
 * O board de despacho demo só tem ordens não atribuídas na data fixa
 * 2026-01-16 (`demoUnassigned` em dispatch.service.ts) — o seletor de data
 * da página precisa apontar para essa data antes do drag-and-drop.
 *
 * @dnd-kit usa Pointer Events (não a API HTML5 de drag-and-drop nativa), por
 * isso o gesto é simulado com mouse.move/down/up em vez de `dragTo()`.
 */
test("despachante arrasta uma ordem não atribuída para a faixa de um técnico", async ({ page }) => {
  page.on("response", (response) => {
    if (response.status() === 401) {
      console.log(`401 recebido: ${response.request().method()} ${response.url()}`);
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.log(`[browser console] ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    console.log(`[browser pageerror] ${error.message}`);
  });

  await loginAsAdmin(page);

  await page.goto(`${e2eBaseUrls.web}/despacho`);
  await page.getByLabel("Selecionar data do despacho").fill("2026-01-16");

  const sourceCard = page.getByTestId("unassigned-card-WO-1003");
  const targetLane = page.getByTestId("technician-lane-Carla Nunes");

  await expect(sourceCard).toBeVisible();
  await expect(targetLane).toBeVisible();

  const sourceBox = await sourceCard.boundingBox();
  const targetBox = await targetLane.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error("Não foi possível medir a posição dos elementos de drag-and-drop.");
  }
  console.log("sourceBox", sourceBox);
  console.log("targetBox", targetBox);

  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 5, startY + 5, { steps: 2 });
  await page.screenshot({ path: "test-results/debug-mid-drag-1.png" });
  await page.mouse.move(endX, endY, { steps: 20 });
  await page.screenshot({ path: "test-results/debug-mid-drag-2.png" });
  await page.mouse.up();

  await page.screenshot({ fullPage: true, path: "test-results/debug-after-drop.png" });
  await expect(targetLane.getByText("WO-1003")).toBeVisible();
});
