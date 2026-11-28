/**
 * Section 4 - Session / token storage control review (passive observation only).
 *
 * After a normal UI login as care-doctor, records:
 *   - every browser cookie for the app/API origins and its attributes
 *   - which localStorage keys hold credentials (names and lengths only, never values)
 *   - security-relevant headers on the login API response and the SPA document
 *   - whether the token persists across a page reload
 * Output: evidence/session-controls.json
 */
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const FIXTURE_PASSWORD = process.env.CARE_FIXTURE_PASSWORD ?? "Ohcn@123";
const EVIDENCE_DIR = path.resolve(__dirname, "..", "evidence");
const SECURITY_HEADERS = [
  "content-security-policy", "strict-transport-security", "x-frame-options",
  "x-content-type-options", "referrer-policy", "cross-origin-opener-policy",
  "access-control-allow-origin", "access-control-allow-credentials", "cache-control", "set-cookie",
];

const pick = (headers: Record<string, string>) =>
  Object.fromEntries(SECURITY_HEADERS.map((h) => [h, headers[h] ?? null]));

test("SC-01 session token storage, cookies and headers after login", async ({ page, context }) => {
  let loginHeaders: Record<string, string> = {};
  let loginRequestHeaders: Record<string, string> = {};
  page.on("response", async (r) => {
    if (r.url().includes("/api/v1/auth/login/") && r.request().method() === "POST") {
      loginHeaders = await r.allHeaders();
      loginRequestHeaders = await r.request().allHeaders();
    }
  });

  const doc = await page.goto("/login");
  const documentHeaders = doc ? await doc.allHeaders() : {};
  await page.getByRole("textbox", { name: "Username" }).fill("care-doctor");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(FIXTURE_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });

  const cookies = (await context.cookies(["http://localhost:4000", "http://127.0.0.1:9000"])).map(
    (c) => ({
      name: c.name, domain: c.domain, path: c.path, httpOnly: c.httpOnly,
      secure: c.secure, sameSite: c.sameSite, session: c.expires === -1,
    }),
  );
  const storage = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => /token|auth|session/i.test(k))
      .map((k) => ({
        key: k,
        length: (localStorage.getItem(k) ?? "").length,
        looks_like_jwt: /^[\w-]+\.[\w-]+\.[\w-]+$/.test(localStorage.getItem(k) ?? ""),
      })),
  );
  // Demonstrates the exposure: any script running in the page origin can read it.
  const readableByPageScript = await page.evaluate(
    () => localStorage.getItem("care_access_token") !== null,
  );

  // localStorage survives reloads and new tabs, unlike an in-memory token.
  await page.reload();
  const afterReload = await page.evaluate(() => localStorage.getItem("care_access_token") !== null);

  const result = {
    generated: new Date().toISOString(),
    account: "care-doctor (synthetic fixture account)",
    login_request: {
      authorization_header_sent: "authorization" in loginRequestHeaders,
      cookie_header_sent: "cookie" in loginRequestHeaders,
    },
    login_response_headers: pick(loginHeaders),
    spa_document_headers: pick(documentHeaders),
    browser_cookies: cookies,
    credential_keys_in_localStorage: storage,
    access_token_readable_by_page_javascript: readableByPageScript,
    token_persists_after_reload: afterReload,
  };
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE_DIR, "session-controls.json"), JSON.stringify(result, null, 2));

  // Assertions describe what was observed; they make the run fail loudly if the
  // storage model changes (e.g. a move to HttpOnly cookies) so the report is revisited.
  expect(storage.map((s) => s.key)).toContain("care_access_token");
  expect(readableByPageScript).toBe(true);
});

test("SC-02 logout revokes the access and refresh tokens server-side", async ({ request }) => {
  const API = "http://127.0.0.1:9000";
  const login = await request.post(`${API}/api/v1/auth/login/`, {
    data: { username: "care-doctor", password: FIXTURE_PASSWORD },
  });
  expect(login.status()).toBe(200);
  const { access, refresh } = await login.json();
  const bearer = { Authorization: `Bearer ${access}` };

  const before = await request.get(`${API}/api/v1/users/getcurrentuser/`, { headers: bearer });
  const logout = await request.post(`${API}/api/v1/auth/logout/`, {
    headers: bearer,
    data: { access, refresh },
  });
  const afterAccess = await request.get(`${API}/api/v1/users/getcurrentuser/`, { headers: bearer });
  const afterRefresh = await request.post(`${API}/api/v1/auth/token/refresh/`, { data: { refresh } });
  const afterAccessBody = await afterAccess.text();
  const afterRefreshBody = await afterRefresh.text();

  const result = {
    generated: new Date().toISOString(),
    account: "care-doctor (synthetic fixture account)",
    source: "care/config/auth_views.py LogoutView (cache blacklist, 1800 s) + config/authentication.py CustomJWTAuthentication",
    steps: [
      { step: "GET /api/v1/users/getcurrentuser/ with new access token", status: before.status() },
      { step: "POST /api/v1/auth/logout/ {access, refresh}", status: logout.status() },
      { step: "GET /api/v1/users/getcurrentuser/ with the same access token", status: afterAccess.status(), body: afterAccessBody.slice(0, 120) },
      { step: "POST /api/v1/auth/token/refresh/ with the same refresh token", status: afterRefresh.status(), body: afterRefreshBody.slice(0, 120) },
    ],
    note: "CARE answers revoked tokens with HTTP 403 (not 401): CustomJWTAuthentication.authenticate_header in config/authentication.py changes the default challenge, so DRF returns 403.",
  };
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE_DIR, "logout-revocation.json"), JSON.stringify(result, null, 2));

  expect(before.status()).toBe(200);
  expect([200, 204]).toContain(logout.status());
  // Rejected = 401/403 with an "Invalid Token" body (not merely any error).
  expect([401, 403]).toContain(afterAccess.status());
  expect(afterAccessBody).toMatch(/invalid token/i);
  expect([401, 403]).toContain(afterRefresh.status());
  expect(afterRefreshBody).toMatch(/invalid token/i);
});
