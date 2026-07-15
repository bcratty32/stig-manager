# Demo Files for STIG Manager Upload Testing

> **Full local walkthrough:** see [DEMO-WALKTHROUGH.md](./DEMO-WALKTHROUGH.md) for
> step-by-step instructions to run STIG Manager locally, import real
> ComplianceAsCode data streams, scan a Docker image with OpenSCAP, and upload the
> results.

Two self-contained demo sets. In each set, upload the `1-baseline_*` file first
(it creates the benchmark in STIG Manager), then import the matching `2-results_*`
file(s) against an asset assigned to that benchmark.

File names are prefixed with the upload order: `1-baseline_` → `2-results_`.

---

## vpn-srg-demo/ — DISA STIG workflow (CKL / CKLB)

| Order | File | What it is |
|---|---|---|
| 1 | `1-baseline_VPN_SRG_V1R1_Manual-xccdf.xml` | DISA-format XCCDF benchmark (`VPN_SRG_TEST`, V1R1, 81 rules) |
| 2 | `2-results_VPN_SRG_V1R1.ckl` | STIG Viewer 2.x checklist with 3 reviews: NotAFinding / Open / Not_Applicable |
| 2 | `2-results_VPN_SRG_V1R1.cklb` | Same 3 reviews in STIG Viewer 3.x CKLB (JSON) format |

Steps:
1. STIG Library (or `POST /stigs?elevate=true`) → upload the baseline XCCDF.
2. Create a Collection and an Asset (the CKL/CKLB target host is `test-vpn-gateway`),
   assign the `VPN_SRG_TEST` STIG to the asset.
3. Import the `.ckl` or `.cklb` via Collection → Import Results.

The CKL and CKLB contain identical review content — use either one, or both to
compare format handling.

---

## ssg-rhel9-demo/ — SSG / OpenSCAP workflow (XCCDF results / ARF)

| Order | File | What it is |
|---|---|---|
| 1 | `1-baseline_SSG_RHEL9-xccdf.xml` | SSG-style standalone XCCDF benchmark (`xccdf_org.ssgproject.content_benchmark_RHEL-9`, version 0.1.71, 2 rules, 2 profiles: `stig`, `cis_l1_server`) |
| 1 | `1-baseline_SSG_RHEL9-datastream.xml` | Same benchmark wrapped in a SCAP 1.2 data stream (alternative baseline; different benchmarkId `...RHEL-9-DS`) |
| 2 | `2-results_SSG_RHEL9_oscap-xccdf-results.xml` | Real `oscap xccdf eval --results` output against the xccdf baseline: rule 1 **pass**, rule 2 **fail** |
| 2 | `2-results_SSG_RHEL9_oscap-arf.xml` | Real `oscap xccdf eval --results-arf` output from the same scan (SCAP 1.2 Asset Report Format) |

Steps:
1. Upload `1-baseline_SSG_RHEL9-xccdf.xml` via `POST /stigs?elevate=true`.
   - To list its profiles first: `POST /stigs/benchmark/profiles?elevate=true`.
   - To import only one profile's rules: add `&profileId=xccdf_org.ssgproject.content_profile_stig`.
2. Create an Asset and assign the benchmark.
3. Import `2-results_SSG_RHEL9_oscap-xccdf-results.xml` (or the ARF) as scan results.

Both results files were produced by actually running
`oscap xccdf eval --results ... --results-arf ...` (OpenSCAP 1.3.9) against the
baseline with a working OVAL evaluation — the pass/fail values are genuine scan
output, not hand-written.

The results files reference the **xccdf** baseline (`...content_benchmark_RHEL-9`),
not the datastream one (`...RHEL-9-DS`). The datastream baseline is included to
demo SCAP data stream import support.
