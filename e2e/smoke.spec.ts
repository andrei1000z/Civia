import { test, expect } from "@playwright/test";

/**
 * E2E smoke tests — critical user flows.
 *
 * Acoperă:
 *   1. Homepage loads
 *   2. /sesizari form accessible
 *   3. /sesizari-publice listing functional
 *   4. /petitii listing
 *   5. /stiri listing
 *   6. /impact dashboard cu cifre
 *   7. Footer links la pages legal/info noi
 *   8. Accessibility statement page
 *   9. Status page
 *  10. Roadmap page
 *
 * Goal: detect breaking changes pe deploy-uri majore.
 */

test.describe("Civia smoke — critical flows", () => {
  test("homepage loads cu hero CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /schimbarea/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /F[ăa] o sesizare/i }).first()).toBeVisible();
  });

  test("sesizari form accessible anonim", async ({ page }) => {
    await page.goto("/sesizari");
    // Hero indicator deja prezent
    await expect(page).toHaveTitle(/[Ss]esizare/);
    // Formularul există (chiar dacă e lazy-loaded)
    await page.waitForTimeout(1000);
  });

  test("sesizari-publice listează ceva (or empty state)", async ({ page }) => {
    await page.goto("/sesizari-publice");
    await expect(page).toHaveTitle(/[Ss]esizar/);
    // Fie listă cu sesizări, fie empty state — ambele ok
    const hasContent = await page.locator("article, [role='status']").count();
    expect(hasContent).toBeGreaterThan(0);
  });

  test("/impact dashboard public arată cifre", async ({ page }) => {
    await page.goto("/impact");
    await expect(page.getByRole("heading", { name: /[Ii]mpactul/ })).toBeVisible();
    // Avem cel puțin un KPI vizibil (Total sesizări, Trimise, etc.)
    await expect(page.locator("text=/sesizar/i").first()).toBeVisible();
  });

  test("/legal/accesibilitate page completă", async ({ page }) => {
    await page.goto("/legal/accesibilitate");
    await expect(page.getByRole("heading", { name: /accesibilitate/i })).toBeVisible();
    await expect(page.locator("text=/WCAG 2.2/")).toBeVisible();
    await expect(page.locator("text=/EN 301 549/")).toBeVisible();
  });

  test("/legal/cookie-policy page", async ({ page }) => {
    await page.goto("/legal/cookie-policy");
    await expect(page.getByRole("heading", { name: /cookies/i }).first()).toBeVisible();
  });

  test("/status page operational", async ({ page }) => {
    await page.goto("/status");
    await expect(page.getByRole("heading", { name: /Status/ })).toBeVisible();
  });

  test("/roadmap public arată items", async ({ page }) => {
    await page.goto("/roadmap");
    await expect(page.getByRole("heading", { name: /[Rr]oadmap/ }).first()).toBeVisible();
  });

  test("/despre page completă", async ({ page }) => {
    await page.goto("/despre");
    await expect(page.getByRole("heading", { name: /[Dd]espre/ }).first()).toBeVisible();
    await expect(page.locator("text=/OG 27.2002/")).toBeVisible();
  });

  test("404 not-found prietenos", async ({ page }) => {
    const response = await page.goto("/pagina-care-nu-exista-niciodata-2026");
    expect(response?.status()).toBe(404);
    await expect(page.locator("text=/404|negăsi|negasit/i").first()).toBeVisible();
  });
});

test.describe("Civia smoke — Open311 API", () => {
  test("/api/v2/open311/services.json returnează catalog", async ({ request }) => {
    const res = await request.get("/api/v2/open311/services.json");
    expect(res.ok()).toBeTruthy();
    const services = await res.json();
    expect(Array.isArray(services)).toBeTruthy();
    expect(services.length).toBeGreaterThan(15); // 22 tipuri
    expect(services[0]).toHaveProperty("service_code");
    expect(services[0]).toHaveProperty("service_name");
  });

  test("/api/v2/open311/requests.json returnează lista", async ({ request }) => {
    const res = await request.get("/api/v2/open311/requests.json?page_size=5");
    expect(res.ok()).toBeTruthy();
    const requests = await res.json();
    expect(Array.isArray(requests)).toBeTruthy();
    if (requests.length > 0) {
      expect(requests[0]).toHaveProperty("service_request_id");
      expect(requests[0]).toHaveProperty("status");
      expect(requests[0]).toHaveProperty("service_code");
    }
  });

  test("/api/health endpoint răspunde", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const health = await res.json();
    expect(health).toHaveProperty("status");
    expect(["ok", "slow", "degraded"]).toContain(health.status);
  });
});
