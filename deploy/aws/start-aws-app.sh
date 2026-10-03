#!/usr/bin/env bash
set -euo pipefail

cd /opt/rag-app

docker compose up --build -d

echo "AWS app stack started."
echo "Frontend: http://<EC2_PUBLIC_IP>:8080"
echo "API: http://<EC2_PUBLIC_IP>:8000/health"
