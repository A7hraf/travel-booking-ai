import { expect, test } from "@playwright/test";
import path from "node:path";
import { PASSWORD, expectRedirectedAway, isoDateInDays, login, newPage, sendChat } from "./helpers";

const fixtures = path.resolve("tests/fixtures");
const stamp = Date.now();
const owner = { name: "Nadia Newco", email: `nadia${stamp}@example.com` };
const company = `Nile Star ${stamp}`;
const pkgTitle = `Siwa Oasis Retreat ${stamp}`;
const employeeEmail = `ed${stamp}@example.com`;

test.describe.serial("travel marketplace", () => {
  test("company onboarding: apply, support validates, admin approves", async ({ browser }) => {
    const applicant = await newPage(browser);
    await applicant.goto("/register");
    await applicant.locator("main [name=name]").fill(owner.name);
    await applicant.locator("main [name=email]").fill(owner.email);
    await applicant.locator("main [name=password]").fill(PASSWORD);
    await Promise.all([applicant.waitForURL("**/chat"), applicant.locator("main button[type=submit]").click()]);

    await applicant.goto("/apply-company");
    const fields: Record<string, string> = {
      companyName: company,
      legalName: "Nile Star LLC",
      registrationNumber: "RN-1",
      taxId: "TX-1",
      country: "Egypt",
      city: "Giza",
      address: "1 Pyramid Rd, Giza",
      contactPhone: "+20 111 222",
      description: "Small group desert and Nile tours for families.",
    };
    for (const [k, v] of Object.entries(fields)) await applicant.locator(`main [name=${k}]`).fill(v);
    for (const k of ["business_license", "tax_certificate", "owner_id"]) {
      await applicant.locator(`input[name=${k}]`).setInputFiles(path.join(fixtures, "document.pdf"));
    }
    await applicant.locator("main button[type=submit]").click();
    await expect(applicant.getByText("Waiting for the support team")).toBeVisible();

    // Documents are private
    const support = await newPage(browser);
    await login(support, "support@example.com");
    await support.goto("/notifications");
    await expect(support.getByText("New company application")).toBeVisible();
    await support.goto("/support/applications");
    await Promise.all([support.waitForURL(/\/support\/applications\/\w+$/), support.getByRole("link", { name: company }).click()]);
    const docHref = await support.locator('a[href^="/api/documents/"]').first().getAttribute("href");
    expect((await support.request.get(docHref!)).status()).toBe(200);
    const anonymous = await newPage(browser);
    expect((await anonymous.request.get(docHref!)).status()).toBe(401);

    await support.getByRole("button", { name: /Validate/ }).click();
    await support.waitForURL(/\/support\/applications$/);
    await expect(support.locator("tr", { hasText: company }).getByText("validated")).toBeVisible();

    const admin = await newPage(browser);
    await login(admin, "admin@example.com");
    await admin.goto("/admin/applications");
    await Promise.all([admin.waitForURL(/\/admin\/applications\/\w+$/), admin.getByRole("link", { name: company }).click()]);
    await admin.getByRole("button", { name: /Approve/ }).click();
    await admin.waitForURL(/\/admin\/applications$/);
    await expect(admin.locator("tr", { hasText: company }).getByText("approved")).toBeVisible();

    await applicant.goto("/company");
    await expect(applicant.getByRole("heading", { name: company })).toBeVisible();
    await applicant.goto("/notifications");
    await expect(applicant.getByText("Your company is approved!")).toBeVisible();
  });

  test("owner publishes a package with a photo and adds an employee", async ({ browser }) => {
    const page = await newPage(browser);
    await login(page, owner.email);
    await page.goto("/company/packages/new");
    const values: Record<string, string> = {
      title: pkgTitle,
      destination: "Siwa",
      country: "Egypt",
      durationDays: "4",
      pricePerPerson: "500",
      costPerPerson: "300",
      seatsTotal: "10",
      maxGroupSize: "4",
      description: "Four days in the Siwa oasis with salt lakes and desert camping.",
      availableFrom: isoDateInDays(1),
      availableTo: isoDateInDays(200),
    };
    for (const [k, v] of Object.entries(values)) await page.locator(`main [name=${k}]`).fill(v);
    await page.locator("main select[name=status]").selectOption("ACTIVE");
    await page.locator("main input[name=images]").setInputFiles(path.join(fixtures, "photo.png"));
    await Promise.all([page.waitForURL("**/company/packages"), page.locator("main button[type=submit]").click()]);

    await page.goto("/packages");
    const card = page.getByRole("link", { name: new RegExp(pkgTitle) });
    await expect(card).toBeVisible();
    const img = card.locator("img");
    await expect(img).toHaveAttribute("src", /\/api\/images\//);
    expect((await page.request.get((await img.getAttribute("src"))!)).headers()["content-type"]).toBe("image/png");

    await page.goto("/company/team");
    await page.locator("main [name=name]").fill("Ed Employee");
    await page.locator("main [name=email]").fill(employeeEmail);
    await page.locator("main [name=password]").fill(PASSWORD);
    await page.getByRole("button", { name: "Add employee" }).click();
    await expect(page.getByText(`${employeeEmail} added`)).toBeVisible();

    const employee = await newPage(browser);
    await login(employee, employeeEmail);
    await expectRedirectedAway(employee, "/company/profit");
    await expectRedirectedAway(employee, "/company/team");
  });

  test("customer books through the AI; staff reply, confirm and record payment", async ({ browser }) => {
    const customer = await newPage(browser);
    await login(customer, "customer@example.com");
    await customer.goto("/chat");
    await Promise.all([customer.waitForURL(/\/chat\/\w+$/), customer.locator("main").getByRole("button", { name: "New trip chat" }).click()]);
    await sendChat(customer, "We are 2 people looking for a trip to Egypt");
    await expect(customer.getByText(`${pkgTitle}: 500 USD per person`)).toBeVisible();

    await sendChat(customer, `Great, book the Siwa Oasis one on ${isoDateInDays(30)}`);
    await expect(customer.getByText(/Your booking request TB-\w+ is in/)).toBeVisible();
    await expect(customer.getByText(`Conversation transferred to ${company}`)).toBeVisible();
    const reference = (await customer.getByText(/Your booking request/).textContent())!.match(/TB-\w+/)![0];
    // Header refreshes to the handed-off state
    await expect(customer.getByText("A member of the travel company's team will reply here.")).toBeVisible();

    const employee = await newPage(browser);
    await login(employee, employeeEmail);
    await employee.goto("/notifications");
    await expect(employee.getByText("New customer conversation")).toBeVisible();
    await employee.goto("/company/conversations");
    await Promise.all([employee.waitForURL(/\/inbox\/\w+$/), employee.getByRole("link", { name: "Carla Customer" }).first().click()]);
    await employee.getByRole("button", { name: "Assign to me" }).click();
    await sendChat(employee, "Hi Carla, Ed here. Confirming your Siwa trip now.");

    await expect(customer.getByText("Ed here. Confirming your Siwa trip now.")).toBeVisible({ timeout: 10_000 });

    await employee.goto("/company/bookings");
    const row = employee.locator("main .md\\:hidden > div", { hasText: reference });
    await row.getByRole("button", { name: "Confirm" }).click();
    await expect(row.getByText("confirmed")).toBeVisible();
    await row.getByText("Record payment").click();
    await row.locator("select[name=method]").selectOption("BANK_TRANSFER");
    await row.locator("input[name=reference]").fill("TRX-889");
    await row.getByRole("button", { name: "Mark as paid" }).click();
    await expect(employee.locator("main .md\\:hidden > div", { hasText: reference }).getByText("paid", { exact: true })).toBeVisible();

    await customer.goto("/bookings");
    const booking = customer.locator("main .card", { hasText: reference });
    await expect(booking.getByText("confirmed")).toBeVisible();
    await expect(booking.getByText("paid", { exact: true })).toBeVisible();
    await customer.goto("/notifications");
    await expect(customer.getByText("Payment received")).toBeVisible();

    // Owner profit: 2 x 500 revenue - 2 x 300 cost - 10% commission = 300
    const ownerPage = await newPage(browser);
    await login(ownerPage, owner.email);
    await ownerPage.goto("/company/profit");
    await expect(ownerPage.getByText("$300.00").first()).toBeVisible();
  });

  test("customer can skip the AI and reach support", async ({ browser }) => {
    const customer = await newPage(browser);
    await login(customer, "customer@example.com");
    await customer.goto("/chat");
    await Promise.all([customer.waitForURL(/\/chat\/\w+$/), customer.locator("main").getByRole("button", { name: "New trip chat" }).click()]);
    await customer.getByRole("button", { name: "Talk to a person instead" }).click();
    await expect(customer.getByText("Conversation transferred to the support team")).toBeVisible();

    const support = await newPage(browser);
    await login(support, "support@example.com");
    await support.goto("/support");
    await expect(support.getByText("Customer asked to talk to a person.").first()).toBeVisible();
  });

  test("only one AI reply runs at a time per chat", async ({ browser }) => {
    const customer = await newPage(browser);
    await login(customer, "customer@example.com");
    await customer.goto("/chat");
    await Promise.all([customer.waitForURL(/\/chat\/\w+$/), customer.locator("main").getByRole("button", { name: "New trip chat" }).click()]);
    const id = customer.url().split("/").pop();
    const post = (content: string) => customer.request.post(`/api/conversations/${id}/messages`, { data: { content } });
    const [first, second] = await Promise.all([post("slow reply please"), new Promise((r) => setTimeout(r, 300)).then(() => post("hello?"))]);
    expect(first.status()).toBe(200);
    expect(second.status()).toBe(409);
  });

  test("access control", async ({ browser }) => {
    const customer = await newPage(browser);
    await login(customer, "customer@example.com");
    await expectRedirectedAway(customer, "/admin");
    await expectRedirectedAway(customer, "/support");
    await expectRedirectedAway(customer, "/company");

    // Conversations that don't belong to you are not reachable
    const res = await customer.request.get("/api/conversations/does-not-exist/messages");
    expect(res.status()).toBe(404);

    const anonymous = await newPage(browser);
    expect((await anonymous.request.post("/api/conversations/x/messages", { data: { content: "hi" } })).status()).toBe(401);
  });

  test("installable app and health check", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    expect(await (await request.get("/api/health")).json()).toEqual({ ok: true });
  });
});
