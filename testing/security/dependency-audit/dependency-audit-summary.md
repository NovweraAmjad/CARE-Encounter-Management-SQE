# Dependency audit summary

Generated: 2026-11-27T20:29:36.281Z

## Backend (pip-audit 2.10.1, OSV database)

Checked **194** installed packages (exact versions from `pip freeze` in `care-backend-1`; list in backend-installed-packages.txt).

Advisory IDs are de-duplicated by alias (one PYSEC/GHSA/CVE group = one advisory). Raw pip-audit counts before de-duplication: see backend-pip-audit-*.json.

| Package | Installed | Dependency type | Unique advisories | Critical | High | Moderate | Low | Unrated | Lowest fixed versions | Use in this project |
|---|---|---|---|---|---|---|---|---|---|---|
| authlib | 1.6.12 | direct (Pipfile [packages]) | 9 | 1 | 3 | 4 | 1 | 0 | 1.8.0, 1.9.0, 1.9.1 | JWKS/JOSE handling in config/settings (token signing keys). |
| cryptography | 48.0.1 | transitive | 3 | 0 | 2 | 1 | 0 | 0 | 49.0.0, 50.0.0 | Crypto primitives used by authlib/pyjwt. |
| django | 6.0 | direct (Pipfile [packages]) | 26 | 0 | 6 | 6 | 14 | 0 | 4.2.28, 4.2.29, 4.2.30, 5.2.11, 5.2.12, 5.2.13, 5.2.14, 5.2.15, 5.2.16, 5.2.17, 6.0.2, 6.0.3, 6.0.4, 6.0.5, 6.0.6, 6.0.7, 6.0.8, 6.1.1 | Core web framework; serves every API request in both workflows. |
| djangorestframework | 3.16.1 | direct (Pipfile [packages]) | 5 | 0 | 3 | 2 | 0 | 0 | 3.17.2, 3.18.2 | API layer for /api/v1/encounter/ and all workflow endpoints. |
| pillow | 12.2.0 | direct (Pipfile [packages]) | 56 | 5 | 34 | 17 | 0 | 0 | 12.3.0, 13.0.0 | Image processing for uploads; not exercised by the encounter workflows. |
| pyjwt | 2.12.0 | direct (Pipfile [packages]) | 16 | 1 | 4 | 10 | 1 | 0 | 2.12.1, 2.13.0, 2.14.0, 2.15.0 | Signs/verifies the JWT access tokens used by both roles (via djangorestframework-simplejwt). |
| urllib3 | 2.7.0 | direct (Pipfile [packages]) | 3 | 0 | 2 | 1 | 0 | 0 | 2.8.0 | Outbound HTTP client (via requests); not on the encounter request path. |
| werkzeug | 3.1.6 | direct (Pipfile [dev-packages]) | 1 | 0 | 0 | 1 | 0 | 0 | 3.1.9 | [dev-packages] only; serves the LOCAL backend via runserver_plus (scripts/start-dev.sh). |
| **Total** | | | **119** | 7 | 54 | 42 | 16 | 0 | | |

186 of 194 backend packages had no known advisory.

### Critical and High advisories

| Package | Severity | IDs | Summary | Fixed in |
|---|---|---|---|---|
| authlib 1.6.12 | CRITICAL | CVE-2026-96760, GHSA-6v38-4h7w-rj9h | Authlib: empty signatures validation in JWS JSON deserialization | 1.9.0 |
| authlib 1.6.12 | HIGH | CVE-2026-114615, GHSA-7vr2-2fgp-9w7p | Authlib incomplete algorithm-confusion fix permits HMAC forgery with prefixed public keys | 1.9.0 |
| authlib 1.6.12 | HIGH | CVE-2026-114616, GHSA-8m4g-j4wp-wgcg | Authlib accepts an empty HMAC key, allowing JWS/JWT signature forgery (HS256/HS384/HS512) | 1.9.1 |
| authlib 1.6.12 | HIGH | CVE-2026-116672, GHSA-c73q-w75p-j82v | Authlib RFC 7592 examples omit registration-access-token client binding | 1.9.1 |
| cryptography 48.0.1 | HIGH | CVE-2026-69247, GHSA-g6cj-pr64-35w5 | cryptography: PKCS#7 EnvelopedData decryption exposes a Bleichenbacher oracle through distinguishable errors and timing | 50.0.0 |
| cryptography 48.0.1 | HIGH | CVE-2026-69249, GHSA-jwv3-5hgf-82ww | python-cryptography: Duplicate self-signed intermediates can cause exponential path-building | 49.0.0 |
| django 6.0 | HIGH | CVE-2026-25673, GHSA-8p8v-wh79-9r56 | Django vulnerable to Uncontrolled Resource Consumption | 4.2.29, 5.2.12, 6.0.3 |
| django 6.0 | HIGH | CVE-2026-33034, GHSA-933h-hp56-hf7m | Django: SGI requests with a missing or understated `Content-Length` header could bypass the `DATA_UPLOAD_MAX_MEMORY_SIZE` limit | 4.2.30, 5.2.13, 6.0.4 |
| django 6.0 | HIGH | CVE-2026-1287, GHSA-gvg8-93h5-g6qq | Django has an SQL Injection issue | 4.2.28, 5.2.11, 6.0.2 |
| django 6.0 | HIGH | CVE-2026-3902, GHSA-mvfq-ggxm-9mc5 | Django vulnerable to ASGI header spoofing via underscore/hyphen conflation | 4.2.30, 5.2.13, 6.0.4 |
| django 6.0 | HIGH | CVE-2026-1207, GHSA-mwm9-4648-f68q | Django has an SQL Injection issue | 4.2.28, 5.2.11, 6.0.2 |
| django 6.0 | HIGH | CVE-2026-15307, GHSA-wvqv-fj8w-qmhm | Django GeoDjango spatial lookups allow file writes and outbound requests through GDAL raster parsing | 5.2.17, 6.0.8 |
| djangorestframework 3.16.1 | HIGH | CVE-2026-114138, GHSA-33wh-fxxf-88vv | Django REST framework: Accept header with many large quoted parameters burns ~19s of CPU per request in content negotiation | 3.18.2 |
| djangorestframework 3.16.1 | HIGH | CVE-2026-114136, GHSA-3547-9m27-7rxg | Django REST framework: JSONParser applies an attacker-named codec to the request stream | 3.18.2 |
| djangorestframework 3.16.1 | HIGH | CVE-2026-114137, GHSA-xw6w-gcfp-cf8m | Django REST framework: TokenProxy.delete() reports success and revokes nothing | 3.18.2 |
| pillow 12.2.0 | CRITICAL | CVE-2026-112398, GHSA-5x8w-8jj5-q52h | Pillow: Heap buffer overflow in FlashPix (FPX) JPEG decoding leads to code execution | 13.0.0 |
| pillow 12.2.0 | CRITICAL | CVE-2026-112403, GHSA-8g5g-8vmr-9782 | Pillow: Heap buffer overflow in ImagingJpegDecode | 13.0.0 |
| pillow 12.2.0 | CRITICAL | CVE-2026-96639, GHSA-v9pv-5gc8-w2m6 | Pillow multi-frame loaders can reuse stale native image storage after mode transitions | 13.0.0 |
| pillow 12.2.0 | CRITICAL | CVE-2026-112393, GHSA-332p-7hrc-92wf | Pillow: Heap buffer overflow in _tiffWriteProc when saving TIFF to BytesIO | 13.0.0 |
| pillow 12.2.0 | CRITICAL | CVE-2026-112900, GHSA-w889-685w-c8fh | Pillow: Argument Injection in Ghostscript call, potentially leading into RCE | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-112392, GHSA-27h8-gf7j-v5hc | Pillow: NULL dereference in ImagingExpand via rank filters on zero-size images | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-96642, GHSA-3j72-p6qg-6xp7 | Pillow: TarIO negative size field causes infinite CPU-spin loop | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-55379, GHSA-45hq-cxwh-f6vc | Pillow `BdfFontFile`: `Image.new()` called without `_decompression_bomb_check()` — bomb protection bypass via font loading | 12.3.0 |
| pillow 12.2.0 | HIGH | CVE-2026-112397, GHSA-58r4-6rv3-gfh8 | Pillow: Out-of-bounds access in _imagingmorph on a zero-width image | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-54060, GHSA-5x94-69rx-g8h2 | Pillow: `FontFile.compile()`: `Image.new()` called without `_decompression_bomb_check()` | 12.3.0 |
| pillow 12.2.0 | HIGH | CVE-2026-54058, GHSA-62p4-gmf7-7g93 | Pillow: Out-of-bounds read via attacker-controlled row stride on Pillow's mmap path (McIdas AREA files) | 12.3.0 |
| pillow 12.2.0 | HIGH | CVE-2026-59199, GHSA-6r8x-57c9-28j4 | Pillow: Heap out-of-bounds write `Image.paste()` / `Image.crop()` via signed coordinate overflow | 12.3.0 |
| pillow 12.2.0 | HIGH | CVE-2026-112402, GHSA-7mwm-ghpf-9vrm | Pillow: Double free in ImagingScaleAffine on calloc failure via Image.transform | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-54059, GHSA-8v84-f9pq-wr9x | Pillow `PcfFontFile._load_bitmaps()`: `Image.frombytes()` called without `_decompression_bomb_check()` — bomb protection bypass via PCF font loading | 12.3.0 |
| pillow 12.2.0 | HIGH | CVE-2026-59205, GHSA-9hw9-ch79-4vh6 | Pillow: Controlled heap out-of-bounds write in Pillow `ImageCmsTransform.apply()` via output mode mismatch | 12.3.0 |
| pillow 12.2.0 | HIGH | CVE-2026-96644, GHSA-9v9v-9qvf-h2hj | Pillow: Heap over-read in WMF/EMF rendering via 16-bit dimension truncation (Windows builds) | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-112405, GHSA-cp9v-662q-vvx9 | Pillow: NULL pointer dereference in Image.merge via an unvalidated band 0 | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-96643, GHSA-g4qv-2jxx-769h | Pillow: PNG eXIf chunk makes EXIF parsing run in quadratic time | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-96637, GHSA-g842-9rc4-69pw | Pillow: Decompression bomb check bypass in SpiderImagePlugin.seek() leads to unbounded allocation DoS | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-59200, GHSA-jjj6-mw9f-p565 | Pillow: Decompression Bomb DoS via PdfParser.PdfStream.decode() | 12.3.0 |
| pillow 12.2.0 | HIGH | CVE-2026-112896, GHSA-pchr-8j38-3x4p | Pillow: TIFF encoder ColorMap plane-size mismatch causes a heap out-of-bounds read | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-55380, GHSA-phj9-mv4w-65pm | Pillow `GdImageFile._open()`: image dimensions accepted without `_decompression_bomb_check()` | 12.3.0 |
| pillow 12.2.0 | HIGH | CVE-2026-59204, GHSA-vjc4-5qp5-m44j | Pillow JPEG2000 tiled decode retains a growing scratch buffer and can be used for denial of service | 12.3.0 |
| pillow 12.2.0 | HIGH | CVE-2026-59197, GHSA-xj96-63gp-2gmr | Pillow: Heap out-of-bounds write in `ImageFilter.RankFilter` via integer overflow in `ImagingExpand` | 12.3.0 |
| pillow 12.2.0 | HIGH | CVE-2026-112902, GHSA-xvh5-g6gv-559v |  Pillow: Memory disclosure and segfault in libtiff encoder via crafted TIFF tags | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-112390, GHSA-22hg-r758-rrw9 | Pillow: Infinite loop in MIC n_frames when the embedded TIFF | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-112399, GHSA-5xm2-6676-qcp9 | Pillow: APNG background disposal allocates full canvas before decompression bomb check | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-112400, GHSA-65qm-jvmh-6pqg | Pillow: GIF seek keeps rejected size after DecompressionBombError, allowing DoS | 13.0.0 |
| pillow 12.2.0 | HIGH | GHSA-78g4-xqwv-q3g8 | Pillow: Bundled libopenjp2 2.5.4 in all wheels since 11.1.0 carries OSV-2025-219 heap-buffer-overflow write reachable from Image.open().load() | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-112404, GHSA-c6hw-5grf-ff96 | Pillow: OOB read in TiffDecode.c tile and RGBA paths leaks heap memory into pixels | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-112406, GHSA-f2g6-542v-9j58 | Pillow: Infinite loop in PdfParser.rewrite_pages on page tree Parent cycle | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-96778, GHSA-g7cr-3p24-7wf7 | Pillow: Heap buffer overflow writing JPEG comment after ICC profile fills buffer | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-112892, GHSA-gg2r-wvfm-q9rx | Pillow: MSP RLE decoder expands a tiny file into unbounded memory | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-112893, GHSA-j4m9-6w36-pw47 | Pillow: Invalid free in FreeType glyph rendering when a stroker is active | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-112894, GHSA-jg86-v3jv-hrpm | Pillow: Quadratic-time DoS in PDF save_all (PdfParser.next_object_id) | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-96640, GHSA-mrfp-p49p-3hf2 | Pillow PDF append accepts malformed shared page-tree DAG causing resource exhaustion | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-112895, GHSA-p4wg-p73j-c528 | Pillow: Unbounded recursion parsing a PDF page tree or trailer chain (incomplete fix for CVE-2026-42310) | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-112897, GHSA-q45j-58j2-45rg | Pillow: TiffDecode returns uninitialized memory as pixels for short JPEG strips | 13.0.0 |
| pillow 12.2.0 | HIGH | CVE-2026-128067, GHSA-xcvg-w56q-r89m | Pillow: Heap buffer overflow saving TIFF with libtiff when tags override image size | 13.0.0 |
| pyjwt 2.12.0 | CRITICAL | CVE-2026-102268, GHSA-ffc3-869f-jxw9 | PyJWT: Asymmetric-PEM detection bypass: whitespace/line-ending-mutated public keys skip the HS/asymmetric confusion guard | 2.14.0 |
| pyjwt 2.12.0 | HIGH | CVE-2026-102267, GHSA-9v7f-9g4p-ffgj | PyJWT: PyJWKClient follows redirects when fetching JWKS | 2.14.0 |
| pyjwt 2.12.0 | HIGH | CVE-2026-102271, GHSA-p4g4-x82p-q773 | PyJWT: Public keys in DER form are accepted as HMAC secrets, bypassing the CVE-2022-29217 guard | 2.14.0 |
| pyjwt 2.12.0 | HIGH | CVE-2026-48526, GHSA-xgmm-8j9v-c9wx | PyJWT: Public-key JWK accepted as HMAC secret enables forged HS256 tokens when mixed families are allowed | 2.13.0 |
| pyjwt 2.12.0 | HIGH | GHSA-pxh4-856f-4h89 | PyJWT: HS256/384/512 verify accepts empty HMAC key via oct JWK (PyJWK/PyJWKClient) enabling token forgery | 2.14.0 |
| urllib3 2.7.0 | HIGH | CVE-2026-97687, GHSA-8988-9cw3-xx77 | urllib3: HTTPS proxy TLS configuration may be ignored or overridden | 2.8.0 |
| urllib3 2.7.0 | HIGH | CVE-2026-97689, GHSA-vxq7-64xx-v4gw | urllib3: HTTPResponse.stream()/read_chunked() buffers an unbounded chunk-size line into memory | 2.8.0 |

## Node projects (npm audit)

### care_fe

Dependencies checked: 1352. Totals: {"info":0,"low":0,"moderate":9,"high":0,"critical":0,"total":9}

| Root package | Vulnerable range | Severity | Advisory | Title |
|---|---|---|---|---|
| glob | >=9.0.0 <=14.0.1 | MODERATE | https://github.com/advisories/GHSA-3g3m-2fjr-6pw4 | Glob: AbortSignal cancellation bypass allows post-timeout filesystem traversal |
| minimatch | >=7.0.0 <11.0.1 | MODERATE | https://github.com/advisories/GHSA-g3hv-75wg-m249 | minimatch has potential denial of service via globparts amplification |
| postcss-selector-parser | <6.1.5 | MODERATE | https://github.com/advisories/GHSA-rj75-hqrm-r3gf | PostCSS: Quadratic complexity in flat selector parsing allows CPU exhaustion |

| Affected package | Dependency type | Severity | Fix offered by npm |
|---|---|---|---|
| @tailwindcss/typography | direct (devDependencies) | MODERATE | @tailwindcss/typography@0.5.4 (semver-major) |
| @ts-morph/common | transitive | MODERATE | shadcn@4.23.1 |
| glob | direct (devDependencies) | MODERATE | vite-plugin-pwa@1.1.0 (semver-major) |
| minimatch | transitive | MODERATE | vite-plugin-pwa@1.1.0 (semver-major) |
| postcss-selector-parser | transitive | MODERATE | @tailwindcss/typography@0.5.4 (semver-major) |
| shadcn | direct (devDependencies) | MODERATE | shadcn@4.23.1 |
| ts-morph | transitive | MODERATE | shadcn@4.23.1 |
| vite-plugin-pwa | direct (devDependencies) | MODERATE | vite-plugin-pwa@1.1.0 (semver-major) |
| workbox-build | transitive | MODERATE | vite-plugin-pwa@1.1.0 (semver-major) |

Note: `glob` is labelled direct because care_fe declares `glob@^14.0.6`; that installed copy (14.0.6) is outside the vulnerable range. The vulnerable copy is `workbox-build/node_modules/glob@11.1.0` (transitive via vite-plugin-pwa), per package-lock.json.

### testing-e2e

Dependencies checked: 141. Totals: {"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}

### testing-security

Dependencies checked: 3. Totals: {"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}

