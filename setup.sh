#!/bin/bash

# Phish_ETL Setup Wizard
# Designed for ease-of-use by new administrators

set -e

echo "================================================"
echo "      🎣 Phish_ETL Interactive Setup Wizard     "
echo "================================================"
echo ""

# 1. Check for Git Updates
echo "[*] Checking for updates on GitHub..."
git remote update > /dev/null 2>&1
UPSTREAM=${1:-'@{u}'}
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse "$UPSTREAM")

if [ $LOCAL != $REMOTE ]; then
    echo "[!] A newer version of Phish_ETL is available on GitHub."
    read -p "    Would you like to pull the latest version? (y/n): " pull_latest
    if [[ $pull_latest =~ ^[Yy]$ ]]; then
        git pull
        echo "[+] Successfully updated. Please restart the setup script if needed."
    fi
else
    echo "[+] You are running the latest version."
fi

echo ""

# 2. Check for Docker
if ! command -v docker &> /dev/null; then
    echo "[!] Docker not found. Docker is required to run Phish_ETL."
    read -p "    Would you like to attempt to install Docker automatically? (y/n): " install_docker
    if [[ $install_docker =~ ^[Yy]$ ]]; then
        echo "[*] Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        rm get-docker.sh
        echo "[+] Docker installed successfully."
    else
        echo "[!] Please install Docker manually and run this script again."
        exit 1
    fi
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "[!] Docker Compose not found."
    read -p "    Would you like to attempt to install Docker Compose? (y/n): " install_dc
    if [[ $install_dc =~ ^[Yy]$ ]]; then
        sudo apt-get update && sudo apt-get install -y docker-compose-plugin
        echo "[+] Docker Compose installed."
    fi
fi

echo ""

# 3. Environment Configuration
echo "[*] Configuring Phish_ETL Environment..."

# Detect Docker Compose command for later recommendation
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

# Admin Password
read -s -p "    Set Admin Portal Password: " admin_pass
echo ""

# API Keys
read -p "    VirusTotal API Key (leave blank for Env default): " vt_key
read -p "    URLhaus API Key (optional): " urlhaus_key
read -p "    ThreatFox API Key (optional): " threatfox_key

# TTL
read -p "    Indicator Lifespan in Days (Default 30): " ttl_days
ttl_days=${ttl_days:-30}

# HTTPS
echo ""
echo "[*] HTTPS Configuration (Automatic Let's Encrypt)"
read -p "    Domain Name (e.g. phish.mycorp.com, leave blank for HTTP only): " domain_name
read -p "    Admin Email (for Let's Encrypt notifications): " admin_email

# Create .env file
cat <<EOF > .env
ADMIN_PASSWORD=$admin_pass
VT_API_KEY=$vt_key
URLHAUS_API_KEY=$urlhaus_key
THREATFOX_API_KEY=$threatfox_key
INDICATOR_TTL_DAYS=$ttl_days
DOMAIN_NAME=$domain_name
LETSENCRYPT_EMAIL=$admin_email
DATABASE_URL=postgresql://postgres:postgres@db:5432/phish_etl
EOF

echo "[+] .env file generated."

# Generate Caddyfile
if [ -n "$domain_name" ]; then
    cat <<EOF > Caddyfile
$domain_name {
    reverse_proxy frontend:5173
    
    handle_path /api/* {
        reverse_proxy api:8000
    }
}
EOF
    echo "[+] Caddyfile generated for $domain_name."
else
    cat <<EOF > Caddyfile
:80 {
    reverse_proxy frontend:5173
    
    handle /api/* {
        reverse_proxy api:8000
    }
}
EOF
    echo "[+] Caddyfile generated for local HTTP access."
fi

echo ""
echo "================================================"
echo "      Setup Complete! Ready for Launch.         "
echo "================================================"
echo ""
echo "Run: $COMPOSE_CMD up -d --build"
echo ""
