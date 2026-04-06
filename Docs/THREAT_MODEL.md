# Phish_ETL — Threat Model & Security Assumptions

This document outlines the security posture, trust boundaries, and known assumptions of Phish_ETL.

---

## Threat Model Scope

Phish_ETL is designed to operate:

- On‑prem or self‑hosted
- Inside a trusted administrative network
- With firewalls accessing feeds over HTTP(S)

It is **not** designed as a multi‑tenant public SaaS.

---

## Trust Boundaries

### Trusted

- Host operating system
- Docker runtime
- PostgreSQL database
- Internal admin users

### Semi‑Trusted

- Firewall devices consuming EDLs
- OSINT providers (read‑only queries)

### Untrusted

- Uploaded email content
- All MIME payloads
- External URLs and IPs

---

## Key Threats Considered

### 1. Malicious Email Payloads

Mitigations:
- No execution of email content
- Strict parsing only
- No rendering of HTML emails

---

### 2. IOC Poisoning

Mitigations:
- Manual approval required before enforcement
- Undo and delete controls
- TTL expiration enforced

---

### 3. Firewall Memory Exhaustion

Mitigations:
- Indicator deduplication
- Automatic 30‑day expiration
- Stateless feeds

---

### 4. Credential Exposure

Mitigations:
- Admin password stored via environment variable
- JWT-based session handling
- No plaintext credential storage

---

### 5. OSINT Dependency Failure

Mitigations:
- OSINT enrichment is optional
- Platform functions without VirusTotal
- Fail‑closed scoring (no false confidence)

---

## Explicit Non‑Goals

Phish_ETL does NOT attempt to:

- Automatically block without human approval
- Perform sandbox execution
- Replace a full SIEM or SOAR
- Correlate across tenants or organizations

---

## Residual Risk Acceptance

Operators accept that:
- OSINT providers may return false positives
- Firewalls polling feeds reveal indicator patterns
- Admin misuse can cause overblocking

These risks are intentionally exposed to keep the system auditable and understandable.