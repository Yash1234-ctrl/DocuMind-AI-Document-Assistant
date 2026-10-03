#!/usr/bin/env bash
set -euo pipefail

sudo apt-get update
sudo apt-get install -y ca-certificates curl git gnupg lsb-release unzip

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"

sudo systemctl enable docker
sudo systemctl start docker

mkdir -p /opt/rag-app
chown -R "$USER:$USER" /opt/rag-app

cat <<'EOF'
Docker and Compose are installed.
Next steps:
1. Copy your project into /opt/rag-app
2. Create /opt/rag-app/backend/.env from backend/.env.example
3. Run: docker compose -f /opt/rag-app/docker-compose.yml up --build -d
4. Check health: curl http://localhost:8080/health
EOF
