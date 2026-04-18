#!/bin/bash

# Phish_ETL - Shutdown Script
# This script gracefully stops and removes the Docker stack containers.

echo "🛑 Shutting down Phish_ETL Stack..."

# Detect Docker Compose command
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

# 1. Stop Containers
echo "📉 Stopping containers..."
$COMPOSE_CMD down

if [ $? -eq 0 ]; then
    echo "✅ Containers stopped and removed successfully."
else
    echo "❌ Failed to stop containers."
    exit 1
fi

echo "--------------------------------------------------"
echo "💤 Phish_ETL has been powered down."
echo "--------------------------------------------------"
