#!/bin/bash

# Security Check Script
echo "Starting Security Audit for Phish_ETL..."

# 1. Static Analysis with Bandit
echo "[*] Running Static Analysis (Bandit)..."
if command -v bandit &> /dev/null; then
    bandit -r backend/ -ll
else
    echo "[!] Bandit not found. Please install with 'pip install bandit'."
fi

# 2. Security Tests with Pytest
echo "[*] Running Security Tests (Pytest)..."
cd backend
export PYTHONPATH=$PYTHONPATH:.
pytest tests/security_test.py

echo "[+] Security Audit Complete."
