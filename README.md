# Phish_ETL

Minimal MVP scaffold for phishing email IOC extraction and vendor feed exports.

## MVP Goals
- Ingest suspicious emails (.eml/.msg/.mbox/.zip or raw RFC822 paste)
- Extract IOCs (URLs, domains, IPs, emails, attachment hashes)
- Maintain golden indicator lists with TTL + scope (global vs school-only)
- Publish vendor feeds:
  - PAN-OS EDL (domains/urls/ips)
  - FortiGate threat feeds (domains/urls/ips)

## Local Dev (Scaffold Stage)
1) Start Postgres:
   docker compose up -d
2) Backend and frontend will be added in next commits.
