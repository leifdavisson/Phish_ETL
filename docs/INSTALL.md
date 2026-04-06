# Phish_ETL — Installation Guide

This document describes how to install, configure, and run the Phish_ETL platform.

---

## System Requirements

- Docker Engine (20.x or newer)
- Docker Compose v2
- Linux, macOS, or Windows with WSL2
- Minimum 2 GB RAM (4 GB recommended)

No external SaaS dependencies are required for core operation.

---

## Quick Start (Recommended)

1. Clone the repository

```bash
git clone https://github.com/leifdavisson/Phish_ETL.git
cd Phish_ETL
```

2. Create the environment file

In the project root create a file named `.env` and set at minimum:

```env
ADMIN_PASSWORD=your_strong_admin_password
```

Note: `ADMIN_PASSWORD` protects administrative actions (use a strong password).

3. Build and launch

Start the services with Docker Compose:

```bash
docker compose up -d --build
```

What this does:

- Builds backend and frontend images
- Initializes PostgreSQL
- Applies database migrations
- Starts the API and web UI

4. Access the platform

- Web UI: http://localhost:5173
- Feed endpoints :
	- http://localhost:8000/api/feeds/edl/url
	- http://localhost:8000/api/feeds/edl/ip

Use the Admin Login in the web UI and authenticate with the `ADMIN_PASSWORD` from your `.env` file.

Updating the platform

To pull the latest changes and rebuild:

```bash
git pull
docker compose down
docker compose up -d --build
```

PostgreSQL data persists across restarts unless you remove volumes explicitly.

Removing the platform

To stop services:

```bash
docker compose down
```

To stop services and remove volumes (destructive):

```bash
docker compose down -v
```

Firewall connectivity requirements

Firewalls or systems that consume EDLs must be able to:

- Perform HTTP GET requests to port `8000`
- Resolve the Phish_ETL hostname or IP

No additional firewall credentials or tokens are required for the EDL endpoints.

---