#!/bin/bash
# Setup GitHub webhook for automatic deployments
# Run this LOCALLY - it will SSH to the server and configure everything

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DROPLET_HOST="159.203.126.144"
DROPLET_USER="root"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}     FumbleBot Webhook Setup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Generate a webhook secret
WEBHOOK_SECRET=$(openssl rand -hex 20)

echo -e "${YELLOW}Generated webhook secret:${NC}"
echo "$WEBHOOK_SECRET"
echo ""
echo -e "${YELLOW}Save this secret! You'll need it for GitHub.${NC}"
echo ""
read -p "Press Enter to continue with server setup..."

echo ""
echo -e "${YELLOW}Installing webhook tool on server...${NC}"

ssh ${DROPLET_USER}@${DROPLET_HOST} << ENDSSH
    set -e

    # Install webhook if not present
    if ! command -v webhook &> /dev/null; then
        echo "Installing webhook..."
        apt-get update
        apt-get install -y webhook
    else
        echo "webhook already installed"
    fi

    # Create webhook config directory
    mkdir -p /etc/webhook

    # Create webhook config
    cat > /etc/webhook/hooks.json << 'EOF'
[
  {
    "id": "fumblebot-deploy",
    "execute-command": "/root/fumblebot/scripts/server-deploy.sh",
    "command-working-directory": "/root/fumblebot",
    "pass-arguments-to-command": [],
    "trigger-rule": {
      "and": [
        {
          "match": {
            "type": "payload-hmac-sha256",
            "secret": "${WEBHOOK_SECRET}",
            "parameter": {
              "source": "header",
              "name": "X-Hub-Signature-256"
            }
          }
        },
        {
          "match": {
            "type": "value",
            "value": "refs/heads/main",
            "parameter": {
              "source": "payload",
              "name": "ref"
            }
          }
        }
      ]
    }
  }
]
EOF

    # Replace the placeholder with actual secret
    sed -i "s/\\\${WEBHOOK_SECRET}/${WEBHOOK_SECRET}/" /etc/webhook/hooks.json

    # Create systemd service for webhook
    cat > /etc/systemd/system/fumblebot-webhook.service << 'EOF'
[Unit]
Description=FumbleBot GitHub Webhook
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/webhook -hooks /etc/webhook/hooks.json -port 9000 -verbose
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    # Enable and start webhook service
    systemctl daemon-reload
    systemctl enable fumblebot-webhook
    systemctl restart fumblebot-webhook

    echo ""
    echo "Webhook service status:"
    systemctl status fumblebot-webhook --no-pager | head -10
ENDSSH

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}     Webhook Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""
echo "1. Go to your GitHub repo: https://github.com/crit-fumble/fumblebot"
echo "2. Settings -> Webhooks -> Add webhook"
echo "3. Configure:"
echo "   Payload URL: http://${DROPLET_HOST}:9000/hooks/fumblebot-deploy"
echo "   Content type: application/json"
echo "   Secret: ${WEBHOOK_SECRET}"
echo "   Events: Just the push event"
echo ""
echo -e "${YELLOW}Note: You may need to open port 9000 in your firewall:${NC}"
echo "   ufw allow 9000/tcp"
echo ""
