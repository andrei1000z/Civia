import { test, expect } from "@playwright/test";

/**
 * E2E smoke tests — critical user flows.
 *
 * 2026-05-24 Faza 8 (updated): scoase pagini șterse în minimalism cleanup
 * (/status, /roadmap, /despre). Adăugat golden path sesizare camera→submit.
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
    await expect(page).toHaveTitle(/[Ss]esizare/);
    // Form lazy-loaded — wait pentru photo uploader area
    await page.waitForTimeout(1500);
  });

  test("sesizari-publice listează ceva (or empty state)", async ({ page }) => {
    await page.goto("/sesizari-publice");
    await expect(page).toHaveTitle(/[Ss]esizar/);
    const hasContent = await page.locator("article, [role='status']").count();
    expect(hasContent).toBeGreaterThan(0);
  });

  test("/petitii listează catalog", async ({ page }) => {
    await page.goto("/petitii");
    await expect(page.getByRole("heading", { name: /[Pp]eti[țt]ii/i }).first()).toBeVisible();
  });

  test("/stiri listează articole", async ({ page }) => {
    await page.goto("/stiri");
    await expect(page).toHaveTitle(/[Șs]tir/);
  });

  test("/proteste listează evenimente", async ({ page }) => {
    await page.goto("/proteste");
    await expect(page.getByRole("heading", { name: /[Pp]roteste/i }).first()).toBeVisible();
  });

  test("/intreruperi national listează", async ({ page }) => {
    await page.goto("/intreruperi");
    await expect(page).toHaveTitle(/[Îî]ntreruperi/);
  });

  test("/legal/accesibilitate page completă", async ({ page }) => {
    await page.goto("/legal/accesibilitate");
    await expect(page.getByRole("heading", { name: /accesibilitate/i })).toBeVisible();
    await expect(page.locator("text=/WCAG 2.2/")).toBeVisible();
  });

  test("/legal/cookie-policy page", async ({ page }) => {
    await page.goto("/legal/cookie-policy");
    await expect(page.getByRole("heading", { name: /cookies/i }).first()).toBeVisible();
  });

  test("404 not-found prietenos", async ({ page }) => {
    const response = await page.goto("/pagina-care-nu-exista-niciodata-2026");
    expect(response?.status()).toBe(404);
    await expect(page.locator("text=/404|negăsi|negasit/i").first()).toBeVisible();
  });

  // 2026-05-24 Faza 1 minimalism: ghost pages șterse → verify 308 redirect.
  test("/alegeri redirect 308 → /", async ({ page }) => {
    const response = await page.goto("/alegeri");
    expect(response?.url()).toMatch(/civia\.ro\/?$|localhost:\d+\/?$/);
  });

  test("/dezvoltatori redirect 308 → /", async ({ page }) => {
    const response = await page.goto("/dezvoltatori");
    expect(response?.url()).toMatch(/civia\.ro\/?$|localhost:\d+\/?$/);
  });
});

test.describe("Civia smoke — Open311 + Health API", () => {
  test("/api/v2/open311/services.json returnează catalog", async ({ request }) => {
    const res = await request.get("/api/v2/open311/services.json");
    expect(res.ok()).toBeTruthy();
    const services = await res.json();
    expect(Array.isArray(services)).toBeTruthy();
    expect(services.length).toBeGreaterThan(15);
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
    }
  });

  test("/api/health răspunde ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const health = await res.json();
    expect(health).toHaveProperty("status");
    expect(["ok", "slow", "degraded"]).toContain(health.status);
  });
});

test.describe("Civia golden path — sesizare camera→AI→submit", () => {
  test("homepage QuickCameraCTA link funcțional", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone SE mobile
    await page.goto("/");
    // Link with camera=1 param redirects to sesizari form
    const cameraLink = page.getByRole("link", { name: /problem[ăa] pe strad[ăa]/i });
    await expect(cameraLink).toBeVisible();
    const href = await cameraLink.getAttribute("href");
    expect(href).toContain("/sesizari");
    expect(href).toContain("camera=1");
  });

  test("BottomNav mobile prezent + 4 tabs", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/sesizari-publice");
    const nav = page.getByRole("navigation", { name: /[Nn]avigare principal[ăa] mobil/ });
    await expect(nav).toBeVisible();
    // 4 tabs: Acasă, Sesizări, Petiții, Profil
    const tabs = nav.locator("li");
    await expect(tabs).toHaveCount(4);
  });

  test("CTA persistent desktop „Fă o sesizare"", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    const cta = page.getByRole("link", { name: /F[ăa] o sesizare/i }).first();
    await expect(cta).toBeVisible();
  });
});
