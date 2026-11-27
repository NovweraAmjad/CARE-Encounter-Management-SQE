const { chromium } = require("@playwright/test");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ baseURL: "http://localhost:4000" });
  await page.goto("http://localhost:4000/login");
  await page.getByRole("textbox", { name: "Username" }).fill("care-doctor");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("Ohcn@123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });
  console.log(JSON.stringify({
    url: page.url(),
    title: await page.title(),
  }));
  await page.screenshot({
    path: "screenshots/login-probe.png",
    fullPage: true,
  });
  await browser.close();
})();
