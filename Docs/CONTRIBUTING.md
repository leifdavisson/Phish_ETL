```markdown
# Contributing to Phish_ETL

Thank you for your interest in contributing to Phish_ETL.

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL‑3.0)**.  
All contributions must be compatible with this license.

---

## Contribution Philosophy

Phish_ETL prioritizes:

- Security correctness over feature velocity
- Deterministic, explainable automation
- Analyst control over fully autonomous enforcement
- Simplicity over extensibility

Pull requests that add unnecessary complexity are unlikely to be accepted.

---

## License Agreement

By submitting a contribution, you agree that:

- Your contribution is licensed under AGPL‑3.0
- You have the right to submit the code
- You are not introducing proprietary or non‑redistributable code

Do **not** submit code copied from closed‑source tools, vendor SDKs, or restrictive licenses.

---

## How to Contribute

### 1. Fork and Clone

```bash
git fork
git clone https://github.com/yourname/Phish_ETL.git


2. Create a Feature Branch
Shellgit checkout -b feature/my-changeShow more lines

3. Make Changes
Best areas for contribution:

MIME parsing improvements
OSINT enrichment logic
Firewall integrations
Performance optimizations
Documentation improvements


4. Run Locally Before Submitting
Shelldocker compose up --buildShow more lines
Ensure:

Ingestion works
No duplicate IOCs are produced
TTL cleanup functions correctly


5. Submit a Pull Request
Include:

What problem your change solves
Why it is necessary
Any security considerations


Security Issues
Do not open public issues for security vulnerabilities.
Instead:

Email the maintainer
Provide minimal reproduction steps
Allow reasonable time for remediation


---