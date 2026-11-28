# ZAP passive scan analysis

- ZAP 2.17.0, passive only (no spider, no active scan)
- Sites observed: http://localhost:9000, http://localhost:4000
- Messages recorded: 9252; distinct backend API requests captured (method + path): 59 (360 ZAP site-tree placeholder nodes with no response excluded)
- Set-Cookie headers observed in all traffic: **0**
- Playwright workflows exit code under proxy: 0

## Alerts by risk, component and classification

| Risk | Confidence | Alert (plugin) | Component | Instances | Sample endpoints | Sample evidence | Classification | Basis |
|---|---|---|---|---|---|---|---|---|
| Medium | High | Content Security Policy (CSP) Header Not Set (10038) | backend API (Django :9000) | 39 | OPTIONS localhost:9000/api/v1/plug_config/<br>OPTIONS localhost:9000/api/v1/auth/login/<br>OPTIONS localhost:9000/api/v1/users/getcurrentuser/<br>OPTIONS localhost:9000/api/v1/organization/accessible_role_organizations/ | — | **Informational** | JSON API responses (Content-Type application/json) are not rendered as HTML; CSP matters for the HTML document served by the frontend. |
| Medium | High | Content Security Policy (CSP) Header Not Set (10038) | frontend (Vite dev server :4000) | 3 | GET localhost:4000/login<br>GET localhost:4000/facility/{uuid}/patient/{uuid}<br>GET localhost:4000/facility/{uuid}/patient/{uuid}/encounter/{uuid}/updates | — | **Development-server artifact** | Vite dev server sends no security headers. Production nginx (care_fe/nginx/nginx.conf:14) sends only Content-Security-Policy-Report-Only, which is NOT enforced -> reported as finding F-02. |
| Medium | Medium | Cross-Domain Misconfiguration (10098) | backend API (Django :9000) | 78 | OPTIONS localhost:9000/api/v1/plug_config/<br>GET localhost:9000/api/v1/plug_config/<br>OPTIONS localhost:9000/api/v1/auth/login/<br>OPTIONS localhost:9000/api/v1/users/getcurrentuser/ | access-control-allow-origin: * | **Genuine observation** | Access-Control-Allow-Origin: * comes from CORS_ORIGIN_ALLOW_ALL=True in care/config/settings/local.py:12 (local settings only; deployment.py uses an allow-list) -> finding F-04. |
| Medium | Medium | Missing Anti-clickjacking Header (10020) | frontend (Vite dev server :4000) | 3 | GET localhost:4000/login<br>GET localhost:4000/facility/{uuid}/patient/{uuid}<br>GET localhost:4000/facility/{uuid}/patient/{uuid}/encounter/{uuid}/updates | x-frame-options | **Development-server artifact** | Production nginx sets X-Frame-Options SAMEORIGIN (care_fe/nginx/nginx.conf:10). Not present on the dev server only. |
| Low | Medium | Private IP Disclosure (2) | frontend (Vite dev server :4000) | 1 | GET localhost:4000/src/hooks/use-auto-space.ts | 192.168.0.1 | **False positive** | '192.168.0.1' is inside a code comment in care_fe/src/hooks/use-auto-space.ts:62 (example of a dotted number), not a disclosed host. |
| Low | High | Server Leaks Version Information via "Server" HTTP Response Header Field (10036) | backend API (Django :9000) | 78 | OPTIONS localhost:9000/api/v1/plug_config/<br>GET localhost:9000/api/v1/plug_config/<br>OPTIONS localhost:9000/api/v1/auth/login/<br>OPTIONS localhost:9000/api/v1/users/getcurrentuser/ | Werkzeug/3.1.6 Python/3.13.18 | **Development-server artifact** | 'Werkzeug/3.1.6 Python/3.13.18' comes from runserver_plus used by care/scripts/start-dev.sh (docker-compose.local.yaml). Production runs gunicorn (care/Procfile, care/scripts/start.sh:28). Hide Server banner at the reverse proxy in production. |
| Low | Low | Timestamp Disclosure - Unix (10096) | frontend (Vite dev server :4000) | 26 | GET localhost:4000/node_modules/.vite/deps/react-dom_client.js<br>GET localhost:4000/node_modules/.vite/deps/libphonenumber-js_mobile_examples.js<br>GET localhost:4000/node_modules/.vite/deps/formatErrorMessage-DrL8LrEv.js<br>GET localhost:4000/node_modules/.vite/deps/context-Cl922TQb-CAA9NpOf.js | 2080374784<br>1812345678<br>1921234567 | **False positive** | Large integers inside third-party library code (react-dom, libphonenumber examples), not server timestamps. |
| Low | Medium | X-Content-Type-Options Header Missing (10021) | frontend (Vite dev server :4000) | 2173 | GET localhost:4000/runtime-env.js<br>GET localhost:4000/src/lib/zod.ts<br>GET localhost:4000/node_modules/.vite/deps/react.js<br>GET localhost:4000/node_modules/vite/dist/client/env.mjs | x-content-type-options | **Development-server artifact** | Production nginx sets X-Content-Type-Options nosniff (nginx.conf:11). Vite dev server does not. |
| Informational | High | Authentication Request Identified (10111) | backend API (Django :9000) | 1 | POST localhost:9000/api/v1/auth/login/ | username: password | **Informational** | Authentication request identified (POST /api/v1/auth/login/). |
| Informational | Medium | Information Disclosure - Sensitive Information in URL (10024) | frontend (Vite dev server :4000) | 1 | GET localhost:4000/ | token: token | **False positive** | ?token= is Vite's HMR WebSocket token (care_fe/node_modules/vite/dist/client/client.mjs:947, `new WebSocket(...?token=${wsToken}, 'vite-hmr')`). CARE never puts its JWT in a URL; it sends it only as an Authorization header (src/Utils/request/utils.ts:90). |
| Informational | Medium | Information Disclosure - Suspicious Comments (10027) | frontend (Vite dev server :4000) | 666 | GET localhost:4000/login<br>GET localhost:4000/src/lib/zod.ts<br>GET localhost:4000/src/index.tsx<br>GET localhost:4000/src/i18n.ts | pt injected by Vite from environment variabl<br>zod error messages (from zod v3 to v4)<br>// overrides from runtime-env.js. Che | **Development-server artifact** | Dev server serves un-minified source and vendor bundles with comments. Production build is minified. |
| Informational | Medium | Modern Web Application (10109) | frontend (Vite dev server :4000) | 3 | GET localhost:4000/login<br>GET localhost:4000/facility/{uuid}/patient/{uuid}<br>GET localhost:4000/facility/{uuid}/patient/{uuid}/encounter/{uuid}/updates | <script type="module">import { injectIntoGlobalHook } from "/@react-re | **Informational** | Identifies a single-page application; no vulnerability. |
| Informational | High | Session Management Response Identified (10112) | backend API (Django :9000) | 1 | POST localhost:9000/api/v1/auth/token/refresh/ | access: access | **Informational** | Token refresh response body returns a new JWT access token (expected for the bearer-token design; storage reviewed in F-01). |
| Informational | High | Session Management Response Identified (10112) | frontend (Vite dev server :4000) | 1 | GET localhost:4000/locale/en.json | token: token | **False positive** | Matched a translation key named 'token' in /locale/en.json, not a session token. |

## Response headers observed (backend API + frontend HTML)

| Request | Status | x-frame-options | x-content-type-options | referrer-policy | cross-origin-opener-policy | content-security-policy | content-security-policy-report-only | strict-transport-security | access-control-allow-origin | cache-control | vary |
|---|---|---|---|---|---|---|---|---|---|---|---|
| OPTIONS http://localhost:9000/api/v1/plug_config/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| GET http://localhost:9000/api/v1/plug_config/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| OPTIONS http://localhost:9000/api/v1/auth/login/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| POST http://localhost:9000/api/v1/auth/login/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| OPTIONS http://localhost:9000/api/v1/users/getcurrentuser/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| GET http://localhost:9000/api/v1/users/getcurrentuser/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| OPTIONS http://localhost:9000/api/v1/organization/accessible_role_organizations/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| OPTIONS http://localhost:9000/api/v1/auth/token/refresh/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| POST http://localhost:9000/api/v1/auth/token/refresh/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| GET http://localhost:9000/api/v1/organization/accessible_role_organizations/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| OPTIONS http://localhost:9000/api/v1/facility/{uuid}/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| OPTIONS http://localhost:9000/api/v1/patient/{uuid}/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| GET http://localhost:9000/api/v1/facility/{uuid}/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| GET http://localhost:9000/api/v1/patient/{uuid}/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| OPTIONS http://localhost:9000/api/v1/extensions/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| GET http://localhost:9000/api/v1/extensions/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| OPTIONS http://localhost:9000/api/v1/patient/search_retrieve/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| POST http://localhost:9000/api/v1/patient/search_retrieve/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| OPTIONS http://localhost:9000/api/v1/patient/{uuid}/get_appointments/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| OPTIONS http://localhost:9000/api/v1/encounter/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| OPTIONS http://localhost:9000/api/v1/patient/{uuid}/get_tokens/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| GET http://localhost:9000/api/v1/patient/{uuid}/get_appointments/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| GET http://localhost:9000/api/v1/patient/{uuid}/get_tokens/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| OPTIONS http://localhost:9000/api/v1/facility/{uuid}/organizations/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| OPTIONS http://localhost:9000/api/v1/facility/{uuid}/organizations/mine/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| GET http://localhost:9000/api/v1/encounter/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| GET http://localhost:9000/api/v1/facility/{uuid}/organizations/mine/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| GET http://localhost:9000/api/v1/facility/{uuid}/organizations/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| POST http://localhost:9000/api/v1/encounter/ | 400 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| OPTIONS http://localhost:9000/api/v1/encounter/{uuid}/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| GET http://localhost:9000/api/v1/encounter/{uuid}/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| OPTIONS http://localhost:9000/api/v1/workspace/get_user_default_attributes/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| OPTIONS http://localhost:9000/api/v1/workspace/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| OPTIONS http://localhost:9000/api/v1/facility/{uuid}/account/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| GET http://localhost:9000/api/v1/workspace/get_user_default_attributes/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| GET http://localhost:9000/api/v1/facility/{uuid}/account/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| GET http://localhost:9000/api/v1/workspace/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| OPTIONS http://localhost:9000/api/v1/questionnaire/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| OPTIONS http://localhost:9000/api/v1/facility/{uuid}/account/default_account/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| OPTIONS http://localhost:9000/api/v1/form_submission/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| OPTIONS http://localhost:9000/api/v1/referral/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| OPTIONS http://localhost:9000/api/v1/patient/{uuid}/symptom/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| OPTIONS http://localhost:9000/api/v1/patient/{uuid}/allergy_intolerance/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| OPTIONS http://localhost:9000/api/v1/patient/{uuid}/diagnosis/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| OPTIONS http://localhost:9000/api/v1/patient/{uuid}/procedure/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| OPTIONS http://localhost:9000/api/v1/patient/{uuid}/questionnaire_response/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| OPTIONS http://localhost:9000/api/v1/patient/{uuid}/observation/analyse/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| GET http://localhost:9000/api/v1/questionnaire/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| GET http://localhost:9000/api/v1/form_submission/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| POST http://localhost:9000/api/v1/facility/{uuid}/account/default_account/ | 400 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| GET http://localhost:9000/api/v1/referral/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| GET http://localhost:9000/api/v1/patient/{uuid}/allergy_intolerance/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| GET http://localhost:9000/api/v1/patient/{uuid}/diagnosis/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| GET http://localhost:9000/api/v1/patient/{uuid}/symptom/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| OPTIONS http://localhost:9000/api/v1/batch_requests/ | 200 | — | nosniff | same-origin | same-origin | — | — | — | * | — | origin |
| GET http://localhost:9000/api/v1/patient/{uuid}/procedure/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| GET http://localhost:9000/api/v1/patient/{uuid}/questionnaire_response/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| POST http://localhost:9000/api/v1/patient/{uuid}/observation/analyse/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| POST http://localhost:9000/api/v1/batch_requests/ | 200 | DENY | nosniff | same-origin | same-origin | — | — | — | * | — | Accept-Language, origin |
| GET http://localhost:4000/login | 200 | — | — | — | — | — | — | — | — | no-cache | Sec-Fetch-Dest |
| GET http://localhost:4000/facility/{uuid}/patient/{uuid} | 200 | — | — | — | — | — | — | — | — | no-cache | Sec-Fetch-Dest |
| GET http://localhost:4000/facility/{uuid}/patient/{uuid}/encounter/{uuid}/updates | 200 | — | — | — | — | — | — | — | — | no-cache | Sec-Fetch-Dest |
