## ✅ `ARCHITECTURE.md` (with Diagram)

```markdown
# Phish_ETL — Architecture Overview

This document describes the internal architecture of Phish_ETL and how data flows through the system.

---

## High‑Level Architecture

```mermaid
flowchart LR
    User[End User<br>Email Upload]
    UI[React Frontend]
    API[FastAPI Backend]
    DB[(PostgreSQL)]
    OSINT[OSINT Providers<br>URLhaus / ThreatFox / VT]
    FW[Firewalls<br>NGFW EDLs]

    User --> UI
    UI --> API
    API --> DB
    API --> OSINT
    DB --> API
    API --> FW
    