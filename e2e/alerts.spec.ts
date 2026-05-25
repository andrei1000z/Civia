import { test, expect } from "@playwright/test";

/**
 * 2026-05-25 — E2E test pentru flow alerte adresă întreruperi.
 *
 * Coverage:
 *   1. Form vizibil pe /intreruperi cu inputuri email + adresă
 *   2. Submit goal happy-path → success state
 *   3. Validation: email invalid blocat
 *   4. Validation: adresă scurtă blocată
 *   5. API /confirm cu token invalid → redirect ?alert=invalid
 *   6. API /unsubscribe cu token invalid → redirect ?alert=invalid
 *   7. Flash messages render după ?alert= în URL
 */

test.describe("Alerte adresă /intreruperi — flow complet", () => {
  test("form vizibil cu inputs email + adresă", async ({ page }) => {
    await page.goto("/intreruperi#alerts-form");
    // Section anchor scroll-uie
    const section = page.locator("#alerts-form");
    await expect(section).toBeVisible();
    await expect(section.locator('input[type="email"]')).toBeVisible();
    await expect(section.locator('input[autocomplete="street-address"]')).toBeVisible();
    await expect(section.getByRole("button", { name: /anun.*-m/i })).toBeVisible();
  });

  test(`buton sus „Anunță-mă pe adresa mea" scrolluiește la form`, async ({ page }) => {
    await page.goto("/intreruperi");
    const btn = page.getByRole("link", { name: /anun.*-m.*adresa/i }).first();
    await expect(btn).toBeVisible();
    const href = await btn.getAttribute("href");
    expect(href).toBe("#alerts-form");
  });

  test(`buton sus „Raportează" scrolluiește la submit form`, async ({ page }) => {
    await page.goto("/intreruperi");
    const btn = page.getByRole("link", { name: /raporteaz.*Întrerupere/i }).first();
    await expect(btn).toBeVisible();
    const href = await btn.getAttribute("href");
    expect(href).toBe("#submit-form");
  });

  test("submit form gol → buton disabled", async ({ page }) => {
    await page.goto("/intreruperi#alerts-form");
    const section = page.locator("#alerts-form");
    const submitBtn = section.getByRole("button", { name: /anun.*-m/i });
    await expect(submitBtn).toBeDisabled();
  });

  test("submit cu date valide → success state", async ({ page }) => {
    await page.goto("/intreruperi#alerts-form");
    const section = page.locator("#alerts-form");
    const email = `test+${Date.now()}@civia-e2e.local`;
    await section.locator('input[type="email"]').fill(email);
    await section.locator('input[autocomplete="street-address"]').fill("Strada Iancu Nicolae 23, Pipera, Voluntari");
    const submitBtn = section.getByRole("button", { name: /anun.*-m/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    // Așteaptă răspuns API (max 10s).
    await expect(page.locator("text=/Verific.* inbox-ul/i").first()).toBeVisible({ timeout: 10000 });
  });

  test("/api/intreruperi/alerts/confirm fără token → redirect invalid", async ({ page }) => {
    const response = await page.goto("/api/intreruperi/alerts/confirm");
    // Va redirect la /intreruperi?alert=invalid
    expect(response?.url()).toContain("alert=invalid");
  });

  test("/api/intreruperi/alerts/unsubscribe fără token → redirect invalid", async ({ page }) => {
    const response = await page.goto("/api/intreruperi/alerts/unsubscribe");
    expect(response?.url()).toContain("alert=invalid");
  });

  test("flash message render pentru ?alert=confirmed", async ({ page }) => {
    await page.goto("/intreruperi?alert=confirmed");
    await expect(page.locator("text=/Abonare confirmat/i").first()).toBeVisible();
  });

  test("flash message render pentru ?alert=unsubscribed", async ({ page }) => {
    await page.goto("/intreruperi?alert=unsubscribed");
    await expect(page.locator("text=/dezabonat cu succes/i").first()).toBeVisible();
  });
});

test.describe("Alerte adresă API — rate limit + validation", () => {
  test("POST cu email invalid → 400", async ({ request }) => {
    const res = await request.post("/api/intreruperi/alerts/subscribe", {
      data: { email: "not-an-email", address: "Strada Test 1" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST cu adresă prea scurtă → 400", async ({ request }) => {
    const res = await request.post("/api/intreruperi/alerts/subscribe", {
      data: { email: "valid@example.ro", address: "abc" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST cu body invalid (no JSON) → 400", async ({ request }) => {
    const res = await request.post("/api/intreruperi/alerts/subscribe", {
      data: "not-json",
      headers: { "Content-Type": "text/plain" },
    });
    expect([400, 415]).toContain(res.status());
  });
});
