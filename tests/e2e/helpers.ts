import { expect, type Browser, type Page } from "@playwright/test";

export const PASSWORD = "password123";

export async function newPage(browser: Browser) {
  const context = await browser.newContext();
  return context.newPage();
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.locator("main [name=email]").fill(email);
  await page.locator("main [name=password]").fill(password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.locator("main button[type=submit]").click()]);
}

export async function sendChat(page: Page, text: string) {
  await page.getByPlaceholder("Type a message…").fill(text);
  await page.locator("main").getByRole("button", { name: "Send" }).click();
}

export function isoDateInDays(days: number) {
  return new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
}

export async function expectRedirectedAway(page: Page, path: string) {
  await page.goto(path);
  await expect(page).not.toHaveURL(new RegExp(`${path}$`));
}
