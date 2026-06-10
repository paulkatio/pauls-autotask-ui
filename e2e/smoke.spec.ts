import { test, expect } from "@playwright/test";

// Kernpfad-Smoke-Tests. Authentifizierung über den geteilten Mock-Cookie
// (siehe auth.setup.ts). Schreibtests AUSSCHLIESSLICH am Prod-Testticket 56313
// („ZZZ TESTTICKET", T20260609.0014, Firma SSIG-IT GmbH, companyID 0).
const TEST_TICKET = 56313;

// Schreibtests (Status-Edit am Testticket) sind lokal standardmäßig AN. Mit
// E2E_SKIP_WRITE_TESTS=1 (oder true/yes) lassen sie sich abschalten – nützlich,
// um das Testticket bei einem Lauf nicht zu mutieren (z. B. in CI / read-only).
const SKIP_WRITE_TESTS = ["1", "true", "yes"].includes(
  (process.env.E2E_SKIP_WRITE_TESTS ?? "").trim().toLowerCase(),
);

test.describe("Smoke", () => {
  test("Dashboard rendert KPIs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Übersicht" })).toBeVisible();
    await expect(page.getByText("Meine offenen Tickets")).toBeVisible();
  });

  test("Meine Tickets lädt mit Tabelle", async ({ page }) => {
    await page.goto("/tickets/my");
    await expect(page.getByRole("heading", { name: "Meine Tickets" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("Teamtickets lädt", async ({ page }) => {
    await page.goto("/tickets/team");
    await expect(
      page.getByRole("heading", { name: /Teamtickets|Nicht zugewiesene|Tickets von/ }),
    ).toBeVisible();
  });

  test("Meine Zeiten lädt mit Summen", async ({ page }) => {
    await page.goto("/zeiten");
    await expect(page.getByRole("heading", { name: "Meine Zeiten" })).toBeVisible();
    await expect(page.getByText("Gesamt")).toBeVisible();
  });

  test("Ticketdetail rendert", async ({ page }) => {
    await page.goto(`/tickets/${TEST_TICKET}`);
    await expect(page.getByRole("heading", { name: /ZZZ TEST/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Zeiten" })).toBeVisible();
  });

  test("Command-Palette findet das Testticket", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    const input = page.getByRole("textbox", { name: "Suche" });
    await expect(input).toBeVisible();
    await input.fill("ZZZ TESTTICKET");
    // Spotlight-Spalte „Ticket-Name": Treffer ist ein klickbarer Button.
    const hit = page.getByRole("button", { name: /ZZZ TESTTICKET/ });
    await expect(hit).toBeVisible();
    await hit.click();
    await expect(page).toHaveURL(new RegExp(`/tickets/${TEST_TICKET}$`));
  });

  test("Zeit-erfassen-Dialog öffnet", async ({ page }) => {
    await page.goto(`/tickets/${TEST_TICKET}`);
    await page.getByRole("button", { name: "Zeit erfassen" }).click();
    await expect(
      page.getByText("Zusammenfassung der ausgeführten Arbeit"),
    ).toBeVisible();
  });

  test("Neues-Ticket-Dialog öffnet", async ({ page }) => {
    await page.goto("/tickets/my");
    await page.getByRole("button", { name: "Neues Ticket" }).click();
    await expect(
      page.getByRole("heading", { name: "Neues Ticket" }),
    ).toBeVisible();
    await expect(page.getByText("Firma und Titel sind Pflicht")).toBeVisible();
  });

  // Einziger Schreibtest: Status am Testticket ändern und wieder zurücksetzen.
  // Hinweis: das Testticket trägt teils einen automatisch gesetzten Status (z. B.
  // „Fälligkeit überschritten"), der NICHT in der manuell wählbaren Picklist steht –
  // dann wird auf einen normal wählbaren Wert zurückgesetzt (Workflow re-setzt selbst).
  test("Status inline ändern + zurücksetzen (Testticket)", async ({ page }) => {
    test.skip(
      SKIP_WRITE_TESTS,
      "Schreibtests deaktiviert (E2E_SKIP_WRITE_TESTS gesetzt).",
    );
    await page.goto(`/tickets/${TEST_TICKET}`);
    const status = page.getByRole("combobox", { name: "Status" });
    await expect(status).toBeVisible();

    async function setStatus(name: string) {
      await status.click();
      await expect(page.getByRole("listbox")).toBeVisible();
      await page.getByRole("option", { name, exact: true }).click();
      await expect(page.getByText("Gespeichert.").first()).toBeVisible();
    }

    const original = (await status.innerText()).trim();
    const target = original.includes("In Bearbeitung") ? "Neu" : "In Bearbeitung";

    // Ändern (Schreibpfad belegt durch Erfolgs-Toast).
    await setStatus(target);

    // Zurücksetzen: Original, falls wählbar, sonst ein neutraler Standard.
    await status.click();
    await expect(page.getByRole("listbox")).toBeVisible();
    const canRestore =
      original.length > 0 &&
      original !== target &&
      (await page.getByRole("option", { name: original, exact: true }).count()) > 0;
    // Fallback muss sich vom gerade gesetzten Zielwert unterscheiden (sonst No-Op).
    const fallback = target === "In Bearbeitung" ? "Neu" : "In Bearbeitung";
    const restore = canRestore ? original : fallback;
    await page.getByRole("option", { name: restore, exact: true }).click();
    await expect(page.getByText("Gespeichert.").first()).toBeVisible();
  });
});
