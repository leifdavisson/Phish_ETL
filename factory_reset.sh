#!/bin/bash

# Phish_ETL - Factory Reset & Git Prep Script
# Use this script to clear sensitive data and temporary files before pushing to GitHub.

echo "🚨 Starting Factory Reset..."

# 1. Clear Postgres Database Tables
echo "🧹 Clearing database tables (indicators, submissions, logs, settings)..."
docker compose exec -T db psql -U postgres -d phish_etl -c "TRUNCATE TABLE indicators, email_submissions, feed_access_logs, settings RESTART IDENTITY CASCADE;"

if [ $? -eq 0 ]; then
    echo "✅ Database cleared successfully."
else
    echo "❌ Error clearing database. Is Docker running?"
    exit 1
fi

# 2. Clear API Keys from .env
echo "🗝️  Clearing API keys from .env file..."
sed -i 's/^VT_API_KEY=.*/VT_API_KEY=/' .env
sed -i 's/^URLHAUS_API_KEY=.*/URLHAUS_API_KEY=/' .env
sed -i 's/^THREATFOX_API_KEY=.*/THREATFOX_API_KEY=/' .env
echo "✅ .env cleared (keys removed, variables kept)."

# 3. Remove Temporary Files
echo "🗑️ Removing temporary test and log files..."
rm -f /tmp/test.eml /tmp/api.log /tmp/docker_ps.txt /tmp/npm.log
echo "✅ Temp files removed."

# 3. Final Security Check
echo "🔍 Checking for sensitive files..."
if [ -f .env ]; then
    echo "⚠️  Found .env file (Ignored by Git, as it should be)."
fi

# 4. Git Readiness
echo "📝 Current Git Status:"
git status

echo "--------------------------------------------------"
echo "🚀 Factory Reset Complete. You are ready to commit and push!"
