#!/bin/bash

# Phish_ETL - Startup Script
# This script initializes the environment and brings up the Docker stack.

echo "🚀 Starting Phish_ETL Stack..."

# 1. Check for Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed. Please install it first."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "❌ Error: Docker Compose is not available. Please install the plugin."
    exit 1
fi

# 2. Check for .env file
if [ ! -f .env ]; then
    echo "⚠️  .env file not found! Creating a default one..."
    echo "ADMIN_PASSWORD=supersecret" > .env
    echo "VT_API_KEY=" >> .env
    echo "URLHAUS_API_KEY=" >> .env
    echo "THREATFOX_API_KEY=" >> .env
    echo "✅ Created default .env"
fi

# 3. Build and Start Containers
echo "🏗️  Building and starting containers in the background..."
docker compose up -d --build

if [ $? -eq 0 ]; then
    echo "✅ Containers started successfully."
else
    echo "❌ Failed to start containers. Please check Docker logs."
    exit 1
fi

# 4. Wait for API Health
echo "⏳ Waiting for API to become healthy..."
MAX_RETRIES=15
RETRY_COUNT=0
# uvicorn/fastapi might take a few seconds to boot
sleep 2 

until $(curl --output /dev/null --silent --fail http://localhost:8000/health); do
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo -e "\n❌ API failed to become healthy in time. Check 'docker compose logs api'."
        exit 1
    fi
    printf '.'
    sleep 2
    RETRY_COUNT=$((RETRY_COUNT+1))
done

echo -e "\n✅ API is healthy!"

echo "--------------------------------------------------"
echo "🌟 Phish_ETL is now running!"
echo "🔗 Frontend: http://localhost:5173"
echo "🔗 API Health: http://localhost:8000/health"
echo "--------------------------------------------------"
