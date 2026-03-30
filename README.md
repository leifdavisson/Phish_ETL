# Phish_ETL Platform

Fully automated Phishing Analysis & Triage platform designed to generate high-fidelity, Next-Gen Firewall (NGFW) External Dynamic Lists (EDLs).

## MVP Architecture
Built natively with **FastAPI** (Backend), **PostgreSQL** (Database), and **React** (Frontend) encapsulated within a single orchestration layer.

- **Automated Ingestion**: Upload raw `.eml`, `.msg`, or `.mbox` files. The Python parser surgically extracts URLs and IPs from deeply nested MIME payloads while rejecting duplicates utilizing strict `Message-ID` hashing.
- **OSINT Enrichment**: Extracted Indicators of Compromise (IOCs) are quietly dumped into a background ASGI queue where they are scored automatically against URLhaus, ThreatFox, and VirusTotal to generate an actionable 0-99 Confidence Rating.
- **Golden Indicator Governance**: Analysts maintain complete control bridging the Threat Database. They can easily `Undo Verdicts`, completely obliterate indicators from disk (`Delete`), and effortlessly cycle indicators into production.
- **Firewall Integration (Zero Maintenance)**: 
  - Generates completely decoupled list feeds: `/api/feeds/edl/url` and `/api/feeds/edl/ip`.
  - Ensures exactly *0 duplicate rows* via Python casting models.
  - Features an **Automated 30-Day Garbage Collection Rule (TTL)**. Blocklists inherently expire 30 days after the email was analyzed to prevent catastrophic Network Memory leakage on the firewalls. 

## Administration & Security
The entire platform is protected out-of-the-box using strict Single-Admin JWT authentication logic. 

**Setup Requirements:**
Inside the project root, create a `.env` file explicitly holding your master password and your commercial API keys.
```bash
ADMIN_PASSWORD=your_super_secret_password
VT_API_KEY=optional_virustotal_key
```

## Running the Platform
1) Execute the build container suite:
```bash
docker compose up -d --build
```
2) Access the public portal: `http://localhost:5173`. 
*(Note: To query the API or review indicators, you must click Admin Login and provide the password mapped in your `.env` file).*
