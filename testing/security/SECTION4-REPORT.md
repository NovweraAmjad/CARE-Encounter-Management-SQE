# Section 4 – Defensive Security Assessment: CARE Encounter Management

**Scope.** The two Section 3 workflows on the team's local copy of CARE:

- **W1:** create a patient encounter, including keyboard navigation and correcting an invalid value.
- **W2:** complete an existing encounter.

**Method.** Passive inspection, source and configuration review, and normal application actions only. No active scanning, fuzzing or brute forcing was done. Only synthetic fixture data and local fixture accounts were used. No application source code was changed.

**Date of final run:** 2026-11-28. All evidence paths below are relative to `testing/security/`.

---

## 1. Summary

| Area | Result |
|---|---|
| Role-based access checks (Playwright) | **10/10 pass.** Covers 2 roles plus anonymous, with 4 allowed and 6 denied decisions, at both API and UI level. |
| Session and token controls (Playwright) | **2/2 pass.** No session cookies are used, tokens are stored in `localStorage`, and logout revokes both tokens on the server. |
| ZAP passive scan during W1 and W2 | 9,252 messages captured across `localhost:4000` and `localhost:9000`. 12 alert types, all classified. **0 High.** One genuine Medium on the backend (CORS `*`, local settings only). The other frontend alerts are development-server artifacts or false positives. |
| Dependency audit | 194 backend packages: **119 unique advisories in 8 packages** (7 Critical, 54 High). 1,352 frontend packages: **9 Moderate**, all build-time tooling. The two test-tooling projects have 0. |
| Section 3 regression | W1 and W2 still pass, both with their own config and through the ZAP proxy. |

**Findings by priority.** Details are in §6.

| ID | Severity | Finding |
|---|---|---|
| F-01 | Medium | Access and refresh JWTs are stored in `localStorage`, where page JavaScript can read them. |
| F-02 | Medium | The production CSP is `Report-Only`, so it doesn't block anything. This leaves nothing to contain an XSS attack that targets F-01. |
| F-03 | High | Backend direct dependencies have published advisories (Django, DRF, PyJWT, authlib, Pillow, urllib3), plus the transitive dependency cryptography. |
| F-04 | Low | Local settings allow any CORS origin (`Access-Control-Allow-Origin: *` observed) and `ALLOWED_HOSTS=*`. |
| F-05 | Low | 9 moderate npm advisories, all in frontend build tooling (devDependencies). |
| F-06 | Info | The local backend reveals its server and version (`Server: Werkzeug/3.1.6 Python/3.13.18`). |

---

## 2. Attack surface

### 2.1 Frontend routes (React SPA, TanStack Router; Vite dev server on `:4000`)

| Route | Workflow | Source |
|---|---|---|
| `/login` | W1, W2 | `care_fe/src/routes/_public*` |
| `/facility/:facilityId/patient/:patientId` | W1 (patient home, then "Create Encounter" dialog) | `care_fe/src/routes/_app/` |
| `/facility/:facilityId/patient/:patientId/encounter/:encounterId/:tab` (`updates`) | W1 (redirect after create), W2 | `care_fe/src/routes/_app/facility.$facilityId.patient.$patientId.encounter.$encounterId.$tab.tsx` |

### 2.2 Backend API endpoints (Django REST Framework on `:9000`), confirmed in ZAP traffic

| Method and endpoint | Used by | Authorization in source |
|---|---|---|
| `POST /api/v1/auth/login/` | both | Public. SimpleJWT `TokenObtainPairView` (`care/config/urls.py:35`) |
| `POST /api/v1/auth/token/refresh/` | both (SPA refresh) | Rotating refresh tokens (`config/settings/base.py:442`) |
| `POST /api/v1/auth/logout/` | logout | Blacklists access and refresh tokens (`config/auth_views.py:175-205`) |
| `GET /api/v1/users/getcurrentuser/` | both | Authenticated user |
| `GET /api/v1/facility/`, `GET /api/v1/facility/{id}/organizations/` | both | Facility membership |
| `GET /api/v1/patient/{id}/` | both | `can_view_patient_obj` (`security/authorization/patient.py:49`) |
| `GET /api/v1/encounter/?facility=` / `?patient=` | both | `get_filtered_encounters` / `can_view_patient_obj` (`emr/api/viewsets/encounter.py:231-273`) |
| `POST /api/v1/encounter/` | W1 | `authorize_create` → `can_create_encounter_obj` (`encounter.py:223`) |
| `GET /api/v1/encounter/{id}/` | W1, W2 | `authorize_retrieve` → patient **or** encounter read (`encounter.py:154`) |
| `PUT /api/v1/encounter/{id}/` | W2 (status → completed) | `authorize_update` → `can_update_encounter_obj`, refused once the encounter is closed (`security/authorization/encounter.py`) |

ZAP recorded 59 distinct backend method and path combinations during W1 and W2 (`zap/reports/zap-analysis.md`).

### 2.3 Data and models

| Model (`care/care/emr/models`, `care/care/facility/models`) | Data touched |
|---|---|
| `Encounter` | status, class, priority, period, facility, patient, organization cache |
| `EncounterOrganization`, `FacilityOrganization`, `FacilityOrganizationUser` | links encounters and users to facility departments and roles. These links drive authorization. |
| `Patient` | name, phone, year of birth, address (Faker-generated) |
| `Facility`, `User`, `RolePermission` | facility "FACILITY WITH PATIENTS"; fixture users; role → permission mapping |

All records come from CARE's `load_fixtures` command (`care/care/fixtures/scripts/default_fixtures.py`) and are synthetic.

### 2.4 Roles and test accounts (from fixtures, confirmed by the server)

| Account | Role (fixture) | Facility membership | Server view (`evidence/authorization-results.json → role_evidence`) |
|---|---|---|---|
| `care-doctor` | Doctor (`default_fixtures.py:104`) | Facility "Administration" org (`default_fixtures.py:403-406`) | role orgs `[Doctor, Health Department]`, facilities `[FACILITY WITH PATIENTS]`, not superuser |
| `care-volunteer` | Volunteer (`default_fixtures.py:108`) | none | role orgs `[Volunteer]`, facilities `[]`, not superuser |

The password is the shared fixture password printed by `load_fixtures`. It's a local test credential and isn't repeated here.

> **Note for readers:** the volunteer's Faker display name happens to be "Jagrati Doctor". It appears in the AC-10 screenshot, but it's only a name: the account's role is Volunteer (server-confirmed above).

---

## 3. Access matrix

**Expected decisions** come from `care/care/security/permissions/encounter.py`. All encounter permissions (`can_create_encounter`, `can_list_encounter`, `can_read_encounter`, `can_write_encounter`) are granted only to `CLINICAL_DATA_ACCESS_ROLES = [Admin, Doctor, Nurse, Facility Admin]`. **Volunteer is not included.** All API views also require `IsAuthenticated` (`config/settings/base.py:408`).

| Action | Endpoint | care-doctor | care-volunteer | anonymous | Verified by |
|---|---|---|---|---|---|
| Read encounter | `GET /encounter/{id}/` | ✅ Allow | ⛔ Deny (403) | ⛔ Deny (403) | AC-01, AC-02, AC-08 |
| List facility encounters | `GET /encounter/?facility=` | ✅ Allow | ⛔ Deny (empty result) | — | AC-03, AC-04 |
| Create encounter | `POST /encounter/` | ✅ Allow | ⛔ Deny (403) | — | W1 (Section 3), AC-05 |
| Update or complete encounter | `PUT /encounter/{id}/` | ✅ Allow | ⛔ Deny (403) | — | AC-07, W2 (Section 3), AC-06 |
| Open encounter page in UI | `/facility/…/encounter/{id}/updates` | ✅ Allow | ⛔ Deny (403 + error toast) | — | AC-09, AC-10 |

---

## 4. Automated authorization checks (Playwright)

- **Spec:** `specs/authorization.spec.ts`
- **Run:** `npx playwright test --config=playwright.security.config.ts`
- **Result:** 10 passed (`evidence/security-suite-console.log`)
- **Machine-readable output:** `evidence/authorization-results.json`; table: `evidence/authorization-results.md`

| ID | Role | Action | Expected | Observed (HTTP) | Result | Evidence |
|---|---|---|---|---|---|---|
| AC-01 | care-doctor | Read encounter | Allowed | Allowed (200) | PASS | Response `id` equals requested encounter |
| AC-02 | care-volunteer | Read same encounter | Denied | Denied (403) | PASS | `{"detail":"You do not have permission to view this patient"}` |
| AC-03 | care-doctor | List facility encounters | Allowed | Allowed (200) | PASS | `count=323` |
| AC-04 | care-volunteer | List facility encounters | Denied | Denied (200, empty) | PASS | `count=0`. The queryset is filtered by role (`get_filtered_encounters`). |
| AC-05 | care-volunteer | Create encounter | Denied | Denied (403) | PASS | `{"detail":"You do not have permission to create encounter"}` |
| AC-06 | care-volunteer | Update status → cancelled | Denied | Denied (403) | PASS | `"You do not have permission to update encounter"`; status still `planned` afterwards |
| AC-07 | care-doctor | Update (same values) | Allowed | Allowed (200) | PASS | No-op PUT on an open (`planned`) encounter |
| AC-08 | anonymous | Read encounter | Denied | Denied (403) | PASS | `"Authentication credentials were not provided."` |
| AC-09 | care-doctor | Open encounter page (UI) | Allowed | Allowed (API 200) | PASS | Encounter region visible: `evidence/screenshots/AC-09-doctor-encounter.png` |
| AC-10 | care-volunteer | Open encounter page (UI) | Denied | Denied (API 403) | PASS | Region not rendered; toasts "You do not have permission to view this encounter/patient": `evidence/screenshots/AC-10-volunteer-encounter.png` |

**Design notes**

- AC-06 and AC-07 deliberately use an **open** encounter. A closed encounter is refused by the status rule in `can_update_encounter_obj` regardless of role, so testing on one wouldn't isolate the role check.
- No check creates or changes data. Denied requests change nothing, and AC-07 re-sends the current values.

---

## 5. Security control review

### 5.1 Control 1: backend role checks ✅ Verified

- **Source.** Each mutating or reading action calls the `AuthorizationController`:
  - `authorize_create`, `authorize_update` and `authorize_retrieve` in `care/care/emr/api/viewsets/encounter.py:154-229`
  - `EncounterAccess` in `care/care/security/authorization/encounter.py`
  - Permissions are resolved through `FacilityOrganizationUser` role membership.
- **Runtime.** AC-01 to AC-10 confirm the rules are enforced on the server. The UI only displays the server's 403 (AC-10), so the frontend isn't relied on for access control.
- **Under ZAP.** Every encounter API call in W1 and W2 carried `Authorization: Bearer`. No unauthenticated encounter call succeeded.
- **Observation (not a defect).** A volunteer gets **200 with an empty list** rather than 403 for the facility list (AC-04). The data is still withheld. The behaviour is consistent with the queryset-filter design.
- **Observation (not verified).** `authorize_retrieve` also allows encounter read to anyone who can view the **patient**. Volunteer holds `can_list_patients` (`permissions/patient.py`). With the current fixtures, the volunteer can't see the patient (`GET /patient/{id}/` → 404), so this path couldn't be exercised. It's recommended as a follow-up test (R-6) rather than reported as a finding.

### 5.2 Control 2: session cookie attributes ➖ Not applicable (by design), verified

- **Observed.**
  - ZAP recorded **0 `Set-Cookie` headers in 9,252 messages** (`zap/reports/zap-analysis.md`).
  - After a real UI login, the browser holds **0 cookies** for either origin (`evidence/session-controls.json → browser_cookies: []`).
  - The login request sends no `Cookie` header.
- **Why.** CARE authenticates API calls with a **bearer JWT in the `Authorization` header**, not a Django session cookie:
  - `care_fe/src/Utils/request/utils.ts:90` reads the token from `localStorage` and sets `Authorization: Bearer …`.
  - The first DRF authentication class is `CustomJWTAuthentication` (`base.py:399-406`).

  With no session cookie issued, HttpOnly, Secure and SameSite have nothing to apply to, and cookie-based CSRF doesn't apply to these API calls.
- **Config, should session auth ever be used** (e.g. Django admin): `SESSION_COOKIE_HTTPONLY=True` and `CSRF_COOKIE_HTTPONLY=True` (`base.py:312-314`); `SESSION_COOKIE_SECURE=True` and `CSRF_COOKIE_SECURE=True` in `deployment.py:30-32`. These are correct for production. Local settings omit `Secure` because the server runs over plain HTTP.
- **Consequence.** Session protection depends on how the token is stored, which leads to F-01.

### 5.3 Control 3: JWT and token handling

| Check | Result | Evidence |
|---|---|---|
| Signing | HS256 using `SECRET_KEY` (SimpleJWT default; no `ALGORITHM` override in `base.py:435-444`) | source |
| Lifetimes | Access 10 min, refresh 30 min, `ROTATE_REFRESH_TOKENS=True` | `base.py:436-442` (config only; expiry not timed) |
| Logout revokes tokens on the server | ✅ Old access token → 403 "Invalid Token"; old refresh token → 403 "Invalid Token" | **SC-02**, `evidence/logout-revocation.json`; `auth_views.py:196-205`, `authentication.py:18-22` |
| Frontend clears tokens on logout | ✅ `localStorage.removeItem` for both keys | `care_fe/src/Providers/AuthUserProvider.tsx:297-299` |
| Token never placed in URLs | ✅ The ZAP "Sensitive Information in URL" alert was Vite's own token (see §5.4) | ZAP 10024 analysis |
| Storage location | ⚠ `localStorage` (`care_access_token`, `care_refresh_token`), readable by page JS, persists after reload | **SC-01**, `evidence/session-controls.json` → **F-01** |
| Status code for an invalid token | 403 instead of the usual 401, because `CustomJWTAuthentication.authenticate_header` returns `""` (`config/authentication.py:13-14`) | SC-02 (minor, informational) |

### 5.4 ZAP passive assessment

- **Setup.**
  - ZAP 2.17.0 ran as a headless daemon proxy. Only the passive scanner (62 rules) was used; no spider or active scan.
  - The unchanged Section 3 spec ran through it with `playwright.zap.config.ts`. That config adds `--proxy-bypass-list=<-loopback>`, because Chromium otherwise bypasses the proxy for localhost.
  - Both workflows passed under the proxy (`zap/reports/zap-run-console.log`).
- **Sites captured:** `http://localhost:4000` (frontend) and `http://localhost:9000` (backend). 9,252 messages; 59 distinct backend API requests with full response headers (`zap/reports/observed-response-headers.json`).
- **Reports:**
  - `zap/reports/zap-report.html`, `zap-report.json` (ZAP native)
  - `zap-alerts.json` (raw)
  - `zap-alerts-summary.json` (grouped)
  - `zap-analysis.md` / `.json` (classified, with header matrix)

| Risk / Conf. | Alert | Component | Inst. | Classification | Basis |
|---|---|---|---|---|---|
| Medium / Med | Cross-Domain Misconfiguration (10098) | backend | 78 | **Genuine (local config)** | `Access-Control-Allow-Origin: *` from `CORS_ORIGIN_ALLOW_ALL=True` (`settings/local.py:12`) → F-04 |
| Medium / High | CSP Header Not Set (10038) | frontend | 3 | Dev artifact; **production CSP not enforced** | Vite sends no CSP. Production nginx sends only `Content-Security-Policy-Report-Only` (`care_fe/nginx/nginx.conf:14`) → F-02 |
| Medium / High | CSP Header Not Set (10038) | backend | 39 | Informational | JSON and preflight responses are not rendered as documents |
| Medium / Med | Missing Anti-clickjacking (10020) | frontend | 3 | Dev artifact | Production nginx sets `X-Frame-Options SAMEORIGIN` (`nginx.conf:10`) |
| Low / High | Server version leak (10036) | backend | 78 | Dev artifact → F-06 | `Werkzeug/3.1.6 Python/3.13.18` from `runserver_plus` (`scripts/start-dev.sh`). Production uses gunicorn (`Procfile`, `scripts/start.sh:28`) |
| Low / Med | X-Content-Type-Options missing (10021) | frontend | 2,173 | Dev artifact | Production nginx sets `nosniff` (`nginx.conf:11`). Present on **all 59** backend responses |
| Low / Med | Private IP Disclosure (2) | frontend | 1 | **False positive** | `192.168.0.1` appears in a code comment (`care_fe/src/hooks/use-auto-space.ts:62`) |
| Low / Low | Timestamp Disclosure (10096) | frontend | 26 | **False positive** | Numeric constants in react-dom and libphonenumber |
| Info | Sensitive Information in URL (10024) | frontend | 1 | **False positive** | See below |
| Info | Suspicious Comments (10027) | frontend | 666 | Dev artifact | Un-minified dev modules. The production build is minified. |
| Info | Session Mgmt Response (10112) | backend / frontend | 1 / 1 | Info / **False positive** | The refresh response returns a new JWT (expected). `/locale/en.json` matched the translation key "token". |
| Info | Authentication Request / Modern Web App (10111, 10109) | — | 1 / 3 | Informational | Login POST identified; SPA detected |

**The `?token=` alert (10024) is not a CARE credential.**

- The URL was `GET http://localhost:4000/?token=…`.
- Vite 8.3.8's development client opens its hot-module-reload WebSocket as `new WebSocket(\`${socketProtocol}://${socketHost}?token=${wsToken}\`, "vite-hmr")` (`care_fe/node_modules/vite/dist/client/client.mjs:947`). The value is Vite's random dev-server WebSocket token.
- CARE's JWT is about 345 characters and has three dot-separated parts (SC-01). It is only ever sent as an `Authorization` header (`utils.ts:90`).
- A search of `care_fe/src` finds no `?token=` construction.
- The Vite client doesn't exist in a production build.

**Header review: development vs production**

| Header | Backend API (observed, 59 responses) | Frontend dev server (observed) | Frontend production (`care_fe/nginx/nginx.conf`, config only) |
|---|---|---|---|
| X-Frame-Options | `DENY` on all 30 GET/POST (absent on 29 CORS preflights) | absent | `SAMEORIGIN` (l.10) |
| X-Content-Type-Options | `nosniff` 59/59 | absent | `nosniff` (l.11) |
| Referrer-Policy | `same-origin` 59/59 | absent | `strict-origin-when-cross-origin` (l.12) |
| Cross-Origin-Opener-Policy | `same-origin` 59/59 | absent | — |
| Content-Security-Policy | absent (JSON API) | absent | **Report-Only** (l.14) → F-02 |
| Strict-Transport-Security | absent (HTTP locally); `SECURE_HSTS_SECONDS` in `deployment.py:36` | absent | present (l.9) |
| Access-Control-Allow-Origin | `*` 59/59 (local settings) → F-04 | — | allow-list in `deployment.py:48-49` |

Development-server results are **not** reported as production vulnerabilities. The production column was checked only by reading the configuration, not by deploying it.

---

## 6. Findings

### F-01 – Access and refresh tokens readable by page JavaScript (Medium)

- **Component:** `care_fe`: `src/Utils/request/utils.ts:90`, `src/common/constants.tsx:7-8`, `src/Providers/AuthUserProvider.tsx`
- **Evidence:** SC-01 (`evidence/session-controls.json`) shows:
  - `care_access_token` and `care_refresh_token` are in `localStorage` (JWT format, 345/347 characters).
  - `access_token_readable_by_page_javascript: true` and `token_persists_after_reload: true`.
  - There are 0 cookies.
- **Likely impact:** any XSS in the SPA, or a compromised third-party script, can read both tokens and send them elsewhere. That gives access to patient and encounter data with the victim's role. Refresh rotation means a stolen refresh token can keep being exchanged until it is revoked. Logout only revokes the token pair the client sends, not tokens the attacker has already rotated. This last point was not tested. Severity is Medium because exploiting it requires a separate XSS flaw, and none was found in this passive assessment.
- **Recommendation:** issue the refresh token as an `HttpOnly; Secure; SameSite=Strict` cookie scoped to the refresh endpoint, keep the access token in memory only, and enforce CSP (F-02).

### F-02 – Production Content-Security-Policy is report-only (Medium)

- **Component:** `care_fe/nginx/nginx.conf:14`
- **Evidence:**
  - The config uses `add_header Content-Security-Policy-Report-Only "default-src 'self'; …"`.
  - No enforcing `Content-Security-Policy` header exists in the repository's frontend configs.
  - ZAP 10038 on the dev server is consistent with this.
- **Likely impact:** the browser reports violations but blocks nothing. CSP therefore can't limit XSS, which is the attack path to F-01.
- **Recommendation:** after reviewing the collected reports, switch to an enforcing `Content-Security-Policy` that adds `script-src 'self'`, `frame-ancestors 'none'` and `connect-src` limited to the API origin.

### F-03 – Backend dependencies with published advisories (High)

- **Component:** backend Python environment (`care/Pipfile`), audited at the installed versions.
- **Evidence:** pip-audit 2.10.1, checking all 194 installed packages against the OSV and PyPI databases (`dependency-audit/`). Advisories are de-duplicated by alias, and severities come from the GHSA records.

| Package | Installed | Type | Unique adv. (C/H/M/L) | Relevance to W1/W2 | Fix (lowest covering all) |
|---|---|---|---|---|---|
| django | 6.0 | direct | 26 (0/6/6/14) | Serves every request. Includes 2 SQL-injection advisories (CVE-2026-1287, CVE-2026-1207) and request-size DoS. | 6.0.8 (or 6.1.1) |
| djangorestframework | 3.16.1 | direct | 5 (0/3/2/0) | Every encounter endpoint. Includes Accept-header CPU DoS and JSONParser codec issue. | 3.18.2 |
| pyjwt | 2.12.0 | direct | 16 (1/4/10/1) | Verifies every request's JWT. Most High/Critical items need mixed algorithm families or JWK-supplied keys. CARE uses fixed HS256 with `SECRET_KEY`, so reachability looks limited (source review only). | 2.15.0 |
| authlib | 1.6.12 | direct | 9 (1/3/4/1) | Used to **sign** outbound RSA JWTs (`care/utils/jwks/token_generator.py`). Not used to verify logins. | 1.9.1 |
| pillow | 12.2.0 | direct | 56 (5/34/17/0) | Image upload processing. Not exercised by W1/W2, but reachable wherever uploads are accepted. | 13.0.0 |
| urllib3 | 2.7.0 | direct | 3 (0/2/1/0) | Outbound HTTP only | 2.8.0 |
| cryptography | 48.0.1 | transitive | 3 (0/2/1/0) | Used by authlib and pyjwt | 50.0.0 |
| werkzeug | 3.1.6 | direct (dev) | 1 (0/0/1/0) | Local dev server only | 3.1.9 |

- **Overall:** 186 of 194 packages are clean. The full Critical and High list is in `dependency-audit/dependency-audit-summary.md`.
- **Likely impact:** Django and DRF are on the request path of both workflows, so their DoS and SQL-injection advisories apply to the deployed service. The SQL-injection advisories affect specific ORM features, and this assessment didn't confirm whether CARE uses them.
- **Recommendation:** upgrade the pinned versions in `care/Pipfile` to the fixed versions above, regenerate `Pipfile.lock`, and re-run the unit, integration and E2E suites. **The upgrades were not applied:** they change application dependencies and need team approval.

### F-04 – Permissive CORS and host settings in local configuration (Low)

- **Component:** `care/config/settings/local.py:12` (`CORS_ORIGIN_ALLOW_ALL = True`); `base.py:44` (`ALLOWED_HOSTS` default `["*"]`)
- **Evidence:** ZAP 10098 found `Access-Control-Allow-Origin: *` on 59/59 backend responses (also SC-01 `login_response_headers`).
- **Likely impact:** low. Authentication uses a bearer header rather than cookies, so a foreign site's browser requests carry no credentials. `ACAO: *` without credentials doesn't expose authenticated data. The risk is that these settings get copied into a deployment.
- **Recommendation:** keep `deployment.py`'s allow-lists (`CORS_ALLOWED_ORIGINS`, lines 48-49), and set `DJANGO_ALLOWED_HOSTS` explicitly in every non-local environment.

### F-05 – Frontend build-tooling advisories (Low)

- **Component:** `care_fe` devDependencies
- **Evidence:** npm audit found 9 moderate advisories from 3 root advisories:

| Root package | Advisory | Pulled in by |
|---|---|---|
| `glob` | GHSA-3g3m-2fjr-6pw4 | `vite-plugin-pwa` → `workbox-build/node_modules/glob@11.1.0` (transitive). npm labels it "direct" only because `care_fe` also declares `glob@^14.0.6`, and that installed copy (14.0.6) is outside the vulnerable range (≤14.0.1) per `package-lock.json`. |
| `minimatch` | GHSA-g3hv-75wg-m249 | `vite-plugin-pwa` |
| `postcss-selector-parser` | GHSA-rj75-hqrm-r3gf | `@tailwindcss/typography` |
| `ts-morph` chain | (same audit) | `shadcn` CLI |

  The two test-tooling projects (141 and 3 dependencies) have 0 advisories.
- **Likely impact:** these packages run at build time on developer and CI machines, not in the delivered bundle or for end users.
- **Recommendation:** `shadcn@4.23.1` is a non-breaking fix. The others need semver-major changes (npm suggests downgrades), so track the upstream fixes and avoid `npm audit fix --force`. Not applied.

### F-06 – Server banner on the local backend (Informational)

- **Evidence:** `Server: Werkzeug/3.1.6 Python/3.13.18` (ZAP 10036, 78 instances). It comes from `runserver_plus` in `scripts/start-dev.sh`.
- **Recommendation:** use gunicorn behind a reverse proxy in every shared environment, as `Procfile` and `start.sh` already do, and strip `Server` at the proxy.

---

## 7. Verified controls (with no findings)

| # | Control | How verified |
|---|---|---|
| C-01 | Encounter create, read, list and update limited to clinical roles | AC-01 to AC-07, AC-09, AC-10; `permissions/encounter.py`; `authorization/encounter.py` |
| C-02 | Unauthenticated API access rejected | AC-08; `DEFAULT_PERMISSION_CLASSES = [IsAuthenticated, CareAuthentication]` |
| C-03 | Authorization enforced on the server, not only in the UI | AC-10 (UI shows server 403); AC-02, AC-05, AC-06 at the API |
| C-04 | Denied writes leave data unchanged | AC-06 re-reads the encounter: status unchanged |
| C-05 | Logout revokes access and refresh tokens on the server | SC-02 |
| C-06 | Tokens never sent in URLs | ZAP 10024 analysis; `utils.ts:90` |
| C-07 | Backend security headers: `nosniff`, `Referrer-Policy`, `COOP` on 59/59 responses; `X-Frame-Options: DENY` on 30/30 GET/POST | ZAP header matrix; `base.py:316`, Django `SecurityMiddleware` (`base.py:226`) |
| C-08 | Cookie flags correctly configured for production, should session cookies be used | `base.py:312-314`, `deployment.py:30-32` (config only) |
| C-09 | Production frontend sets HSTS, X-Frame-Options, nosniff and Referrer-Policy | `care_fe/nginx/nginx.conf:9-12` (config only) |

---

## 8. Recommendations (in order)

| # | Recommendation | Fixes |
|---|---|---|
| R-1 | Upgrade Django to 6.0.8+, DRF to 3.18.2, PyJWT to 2.15.0, authlib to 1.9.1, Pillow to 13.0.0, urllib3 to 2.8.0 and cryptography to 50.0.0, then run all test suites (requires approval) | F-03 |
| R-2 | Move the refresh token to an HttpOnly, Secure, SameSite cookie and keep the access token in memory | F-01 |
| R-3 | Change nginx CSP from `Report-Only` to enforcing | F-02 |
| R-4 | Keep CORS and host allow-lists in all non-local settings | F-04 |
| R-5 | Upgrade `shadcn` to 4.23.1; track the other tooling advisories upstream | F-05 |
| R-6 | Add a test where a Volunteer *is* linked to the patient's organization, to confirm whether encounter read through `can_view_patient_obj` is intended (§5.1) | follow-up |

---

## 9. Tools, versions and commands

| Tool | Version | Use |
|---|---|---|
| Playwright (`@playwright/test`) | 1.65.1, Chromium | Role checks, session checks, ZAP-proxied workflows |
| OWASP ZAP | 2.17.0 (daemon, passive scanner, 62 rules) | Passive scan |
| pip-audit | 2.10.1 (OSV and PyPI services) | Backend dependency audit |
| npm audit | npm with Node v24.18.0 | Frontend and test-tooling audit |
| OSV API (`api.osv.dev`) | — | Severity lookup for GHSA aliases |
| Java | OpenJDK 21.0.12 | Runs ZAP |
| Target | Django 6.0 / Python 3.13.18 backend (Docker `care-backend-1`); Vite 8.3.8 / React 19.3.1 frontend | — |

The exact commands are in [README.md](README.md):

```powershell
cd testing\security
npx playwright test --config=playwright.security.config.ts     # 12 checks
$env:ZAP_HOME="<zap folder>"; node zap\run-zap-passive.js     # ZAP + W1/W2
node zap\analyze-zap.js                                         # classify alerts
node dependency-audit\summarize-audit.js                        # after pip-audit / npm audit
cd ..\e2e; npx playwright test --project=chromium               # Section 3 regression
```

### Test results (final run)

| Suite | Result | Evidence |
|---|---|---|
| Section 4 security suite (AC-01 to AC-10, SC-01, SC-02) | 12 passed | `evidence/security-suite-console.log`, `evidence/playwright-html/` |
| Section 3 E2E, original config | 2 passed | `evidence/section3-e2e-regression-console.log` |
| Section 3 E2E through ZAP | 2 passed | `zap/reports/zap-run-console.log`, `zap/reports/playwright-workflows-results.json` |

---

## 10. Limitations

- Two of the six fixture roles were tested (Doctor, Volunteer), as the assignment requires. Nurse, Staff, Administrator and Facility Admin weren't exercised.
- Production behaviour (nginx headers, gunicorn, `deployment.py`) was checked from configuration only. Only the local development stack was running.
- Dependency impact is judged from source review. No advisory was exploited, and no package was upgraded.
- ZAP saw browser traffic only. The fixture set-up calls in `testing/e2e/helpers.ts` run in Node and bypass the proxy. These are test set-up calls, not user workflow traffic.
- Token expiry timing and refresh-token rotation after theft weren't tested.
- Record counts (e.g. `count=323`) grow between runs because the Section 3 workflows create encounters.
- `evidence/superseded/access-matrix-results.json` was there before this work, can't be reproduced, and isn't used as evidence.
