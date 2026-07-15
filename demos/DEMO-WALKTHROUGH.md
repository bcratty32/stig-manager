# STIG Manager Local Demo & Testing Walkthrough

End-to-end walkthroughs for testing this branch locally: importing DISA STIG and
SSG/ComplianceAsCode baselines, scanning a target (including a Docker image) with
OpenSCAP, and getting the results into STIG Manager.

Everything in this guide was executed and verified against a running API built from
this branch, using the real ComplianceAsCode `ssg-ubuntu2204-ds.xml` data stream
(SSG 0.1.71, 12 MB, 651 rules, 5 profiles).

---

## Contents

1. [Prerequisites](#1-prerequisites)
2. [Start STIG Manager locally](#2-start-stig-manager-locally)
3. [Get an admin token for curl](#3-get-an-admin-token-for-curl)
4. [Walkthrough 1 — DISA STIG + CKL/CKLB checklist import](#4-walkthrough-1--disa-stig--cklcklb-checklist-import)
5. [Walkthrough 2 — ComplianceAsCode data stream + profile filtering](#5-walkthrough-2--complianceascode-data-stream--profile-filtering)
6. [Walkthrough 3 — Scan a Docker image with OpenSCAP and upload the results](#6-walkthrough-3--scan-a-docker-image-with-openscap-and-upload-the-results)
7. [The SCAP benchmark map](#7-the-scap-benchmark-map)
8. [Demo file reference](#8-demo-file-reference)

---

## 1. Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 18+ | to run the API from source |
| MySQL 8.0.24+ | native install or `docker run mysql:8` |
| Python 3 | serves the mock authentication server used for local testing |
| curl | for the API examples |
| Docker | only needed for Walkthrough 3 (scanning an image) |
| OpenSCAP (`oscap`) | `apt install openscap-scanner` / `dnf install openscap-scanner` |
| ComplianceAsCode content | see Walkthrough 2 for where to get data streams |

> **Why from source?** This branch adds SSG/ComplianceAsCode support (profile
> preflight, `profileId` import filtering, the DB-backed SCAP map) that is not in
> the published `nuwcdivnpt/stig-manager` images. For a stock demo of released
> features you can instead use the official
> [Docker Hub quick start](https://hub.docker.com/r/nuwcdivnpt/stig-manager)
> (API + client + Keycloak + MySQL, demo login `stigmanadmin`/`stigmanadmin`).

## 2. Start STIG Manager locally

From the repository root, in three terminals (or backgrounded):

**Terminal 1 — MySQL** (skip if you have a local MySQL 8):

```bash
docker run -d --name stigman-db -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=rootpw \
  -e MYSQL_DATABASE=stigman \
  -e MYSQL_USER=stigman \
  -e MYSQL_PASSWORD=stigman \
  mysql:8
```

**Terminal 2 — mock authentication server** (serves pre-built JWKS so the test
tokens below validate; for a real deployment use Keycloak):

```bash
cd test/api/mock-keycloak
python3 -m http.server 8080
```

**Terminal 3 — the API**:

```bash
cd api/source
npm ci
STIGMAN_API_PORT=64001 \
STIGMAN_DB_HOST=localhost \
STIGMAN_DB_PORT=3306 \
STIGMAN_DB_PASSWORD=stigman \
STIGMAN_API_AUTHORITY=http://127.0.0.1:8080/auth/realms/stigman \
STIGMAN_SWAGGER_ENABLED=true \
STIGMAN_DEV_ALLOW_INSECURE_TOKENS=true \
node index.js
```

Startup is healthy when the log shows `"type":"listening"` and either
`All migrations performed successfully` or `MySQL schema is up to date`.

- API base URL: `http://localhost:64001/api`
- Web client: `http://localhost:64001/`
- Swagger UI: `http://localhost:64001/api-docs`

## 3. Get an admin token for curl

The test fixtures include a long-lived `stigmanadmin` JWT that the mock auth
server's JWKS validates:

```bash
export TOKEN=$(node -e "import('./test/api/mocha/iterations.js').then(m => console.log(m.iterations[0].token))")
export B=http://localhost:64001/api
```

(Run from the repo root. All curl examples below assume `$TOKEN` and `$B` are set.)

## 4. Walkthrough 1 — DISA STIG + CKL/CKLB checklist import

Uses `demos/vpn-srg-demo/`. Order: baseline first, then results.

**Step 1 — import the DISA-format benchmark:**

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -F "importFile=@demos/vpn-srg-demo/1-baseline_VPN_SRG_V1R1_Manual-xccdf.xml;type=text/xml" \
  "$B/stigs?elevate=true&clobber=true"
# → {"benchmarkId":"VPN_SRG_TEST","revisionStr":"V1R1", ...}
```

**Step 2 — create a collection and an asset.** The asset name must match the
checklist's target (`test-vpn-gateway` in the demo CKL/CKLB):

```bash
CID=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"VPN Demo","description":"","grants":[{"userId":"1","roleId":4}]}' \
  "$B/collections?elevate=true" | python3 -c "import json,sys; print(json.load(sys.stdin)['collectionId'])")

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"test-vpn-gateway\",\"collectionId\":\"$CID\",\"description\":\"\",\"ip\":\"10.0.0.1\",\"noncomputing\":false,\"metadata\":{},\"stigs\":[\"VPN_SRG_TEST\"]}" \
  "$B/assets"
```

**Step 3 — import the checklist.** CKL/CKLB parsing happens in the **web client**
(the `stig-manager-client-modules` package), not the API:

1. Open `http://localhost:64001/`, enter the collection.
2. Collection ▸ **Import Results**, drop
   `demos/vpn-srg-demo/2-results_VPN_SRG_V1R1.ckl` (or the `.cklb`).
3. The import grid matches the checklist host to the `test-vpn-gateway` asset and
   shows the three reviews (`NotAFinding` / `Open` / `Not_Applicable`).

For API-only pipelines, POST parsed reviews directly (this is what the client and
the watcher do after parsing):

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '[{"ruleId":"SV-106179r1_rule","result":"pass","detail":"Verified via CKL demo","comment":"demo"}]' \
  "$B/collections/$CID/reviews/<assetId>"
```

## 5. Walkthrough 2 — ComplianceAsCode data stream + profile filtering

This works with **real ComplianceAsCode-built data streams** — the same
`ssg-<product>-ds.xml` files you scan with. Get them from any of:

- your distro: `apt install ssg-base ssg-debderived` (Debian/Ubuntu products) or
  `dnf install scap-security-guide` (RHEL/Fedora products) →
  `/usr/share/xml/scap/ssg/content/ssg-*-ds.xml`
- [ComplianceAsCode/content releases](https://github.com/ComplianceAsCode/content/releases)
  (`scap-security-guide-<version>.zip`)
- a container you're scanning (they ship in the `scap-security-guide` package)

The examples below use `ssg-ubuntu2204-ds.xml`; substitute `ssg-rhel9-ds.xml` etc.
freely — the flow is identical.

**Step 1 — preflight: list the profiles in the data stream** (new endpoint):

```bash
DS=/usr/share/xml/scap/ssg/content/ssg-ubuntu2204-ds.xml

curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -F "importFile=@$DS;type=text/xml" \
  "$B/stigs/benchmark/profiles?elevate=true"
```

Verified output for SSG 0.1.71:

```json
{
  "benchmarkId": "xccdf_org.ssgproject.content_benchmark_UBUNTU_22-04",
  "title": "Guide to the Secure Configuration of Ubuntu 22.04",
  "profiles": [
    {"profileId": "xccdf_org.ssgproject.content_profile_cis_level1_server",      "selectedRuleCount": 291},
    {"profileId": "xccdf_org.ssgproject.content_profile_cis_level1_workstation", "selectedRuleCount": 285},
    {"profileId": "xccdf_org.ssgproject.content_profile_cis_level2_server",      "selectedRuleCount": 387},
    {"profileId": "xccdf_org.ssgproject.content_profile_cis_level2_workstation", "selectedRuleCount": 385},
    {"profileId": "xccdf_org.ssgproject.content_profile_standard",               "selectedRuleCount": 45}
  ]
}
```

**Step 2 — import, filtered to one profile** (only that profile's rules become the
revision; the profile short-name is appended to the release):

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -F "importFile=@$DS;type=text/xml" \
  "$B/stigs?elevate=true&clobber=true&profileId=xccdf_org.ssgproject.content_profile_cis_level1_server"
# → {"benchmarkId":"xccdf_org.ssgproject.content_benchmark_UBUNTU_22-04",
#    "revisionStr":"V0.1.71R1-cis_level1_server","action":"inserted"}
```

Omit `profileId` to import every rule in the benchmark (`V0.1.71R1`, 651 rules for
Ubuntu 22.04).

**Step 3 — assign to an asset and review**, exactly like a DISA STIG:

```bash
BID=xccdf_org.ssgproject.content_benchmark_UBUNTU_22-04

CID=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"CaC Demo","description":"","grants":[{"userId":"1","roleId":4}]}' \
  "$B/collections?elevate=true" | python3 -c "import json,sys; print(json.load(sys.stdin)['collectionId'])")

AID=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"ubuntu-target\",\"collectionId\":\"$CID\",\"description\":\"\",\"ip\":\"\",\"noncomputing\":false,\"metadata\":{},\"stigs\":[\"$BID\"]}" \
  "$B/assets" | python3 -c "import json,sys; print(json.load(sys.stdin)['assetId'])")

# post a review against an SSG rule
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '[{"ruleId":"xccdf_org.ssgproject.content_rule_chronyd_run_as_chrony_user","result":"fail","detail":"OpenSCAP scan reported fail","comment":"demo"}]' \
  "$B/collections/$CID/reviews/$AID"
# → {"rejected":[],"affected":{"updated":0,"inserted":1}}
```

Offline fixtures: `demos/ssg-rhel9-demo/1-baseline_SSG_RHEL9-xccdf.xml` (standalone
XCCDF) and `1-baseline_SSG_RHEL9-datastream.xml` (SCAP data stream) are small
self-contained versions of the same shapes.

## 6. Walkthrough 3 — Scan a Docker image with OpenSCAP and upload the results

The scenario: you have a Docker image (say `ubuntu:22.04` or a UBI9 image), you want
to scan it against ComplianceAsCode content and see the results in STIG Manager.

**Step 1 — run the scan inside a container of the image.** The container installs
the scanner and its own distro's CaC content, evaluates, and writes results to a
bind-mounted directory:

```bash
mkdir -p scan

# Ubuntu 22.04 image
docker run --rm -v "$PWD/scan:/scan" ubuntu:22.04 bash -c '
  apt-get update -qq && apt-get install -y -qq openscap-scanner ssg-base ssg-debderived
  oscap xccdf eval \
    --profile xccdf_org.ssgproject.content_profile_cis_level1_server \
    --results /scan/results.xml \
    --results-arf /scan/arf.xml \
    --report /scan/report.html \
    /usr/share/xml/scap/ssg/content/ssg-ubuntu2204-ds.xml
'

# RHEL-compatible (UBI9) image — same idea, dnf + scap-security-guide, rhel9 DS,
# and the DISA STIG profile:
docker run --rm -v "$PWD/scan:/scan" registry.access.redhat.com/ubi9/ubi bash -c '
  dnf install -y -q openscap-scanner scap-security-guide
  oscap xccdf eval \
    --profile xccdf_org.ssgproject.content_profile_stig \
    --stig-viewer /scan/stig-viewer.xml \
    --results /scan/results.xml \
    --results-arf /scan/arf.xml \
    --report /scan/report.html \
    /usr/share/xml/scap/ssg/content/ssg-rhel9-ds.xml
'
```

Notes (observed on a verified 651-rule run):

- `oscap` exits **2** when any rule fails — that is a normal scan outcome, not an
  error. Exit 1 means the scan itself broke.
- The CPE platform check must match: scanning `ubuntu:22.04` content against a
  non-22.04 host marks rules `notapplicable`. Scan the DS that matches the image.
- `--report report.html` is a human-readable summary — open it first to sanity-check.

**Step 2 — decide which output to import, and against which baseline:**

| Output | Rule IDs inside | Import against |
|---|---|---|
| `results.xml` (`--results`) | SSG rule IDs (`xccdf_org.ssgproject.content_rule_*`) | the **SSG benchmark you imported in Walkthrough 2** (same data stream → IDs match natively) |
| `stig-viewer.xml` (`--stig-viewer`) | DISA SV rule IDs, but the file carries the **SSG benchmark ID** | the **DISA STIG** (e.g. `RHEL_9_STIG`) — the [SCAP map](#7-the-scap-benchmark-map) translates the benchmark ID |
| `arf.xml` (`--results-arf`) | full SCAP result envelope | same as `results.xml`; useful for tools that require ARF |

**Step 3 — upload.**

- **Web client:** Collection ▸ **Import Results** ▸ drop the results file. The
  client fetches `GET /stigs/scap-maps` automatically and uses it to map the
  benchmark ID; the asset is matched by the `<target>` element, so name your STIG
  Manager asset the same as the scan target host name (for containers, pass
  `--hostname` to `docker run` or rename the asset accordingly).
- **Automated (stigman-watcher):** point the watcher at the `scan/` output
  directory. Watcher support for SSG benchmark IDs is tracked in
  [stigman-watcher#229](https://github.com/NUWCDIVNPT/stigman-watcher/issues/229)
  and consumes this branch's `/stigs/scap-maps` endpoint.
- **API-only:** parse the results and POST reviews as shown in Walkthrough 2 Step 3
  (result values: `pass`, `fail`, `notapplicable`, `notchecked`, ...).

Canned scan outputs for offline demos:
`demos/ssg-rhel9-demo/2-results_SSG_RHEL9_oscap-xccdf-results.xml` and
`2-results_SSG_RHEL9_oscap-arf.xml` were produced by a real
`oscap xccdf eval` run against the demo baseline (rule 1 pass, rule 2 fail).

## 7. The SCAP benchmark map

`GET /stigs/scap-maps` returns the SCAP/SSG → DISA benchmark ID mapping (DB-backed,
seeded with common products):

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$B/stigs/scap-maps"
# includes, among others:
#   {"scapBenchmarkId":"xccdf_org.ssgproject.content_benchmark_RHEL-9","benchmarkId":"RHEL_9_STIG"}
#   {"scapBenchmarkId":"xccdf_org.ssgproject.content_benchmark_UBUNTU_22-04","benchmarkId":"CAN_Ubuntu_22-04_LTS_STIG"}
```

Admins can replace the map (wholesale PUT) to add any product without a code change:

```bash
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '[{"scapBenchmarkId":"xccdf_org.ssgproject.content_benchmark_RHEL-10","benchmarkId":"RHEL_10_STIG"}]' \
  "$B/stigs/scap-maps?elevate=true"
```

(To *extend* rather than replace: GET the current map, append your entries, PUT the
combined array back.)

## 8. Demo file reference

| File | What it is |
|---|---|
| `vpn-srg-demo/1-baseline_VPN_SRG_V1R1_Manual-xccdf.xml` | DISA-format XCCDF benchmark (81 rules) |
| `vpn-srg-demo/2-results_VPN_SRG_V1R1.ckl` | STIG Viewer 2.x checklist (3 reviews) |
| `vpn-srg-demo/2-results_VPN_SRG_V1R1.cklb` | Same reviews, STIG Viewer 3.x JSON |
| `ssg-rhel9-demo/1-baseline_SSG_RHEL9-xccdf.xml` | Small SSG-style standalone XCCDF (2 rules, 2 profiles) |
| `ssg-rhel9-demo/1-baseline_SSG_RHEL9-datastream.xml` | Same content as a SCAP 1.2 data stream |
| `ssg-rhel9-demo/2-results_SSG_RHEL9_oscap-xccdf-results.xml` | Real `oscap --results` output (pass/fail) |
| `ssg-rhel9-demo/2-results_SSG_RHEL9_oscap-arf.xml` | Real `oscap --results-arf` output |

For real-content testing use any `ssg-<product>-ds.xml` from the sources in
Walkthrough 2 — this branch was verified against `ssg-ubuntu2204-ds.xml` (SSG
0.1.71): profile preflight, filtered import (291 rules), full import (651 rules),
asset assignment, and review round-trip.
