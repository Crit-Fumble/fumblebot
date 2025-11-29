#!/bin/bash
# Set up deploy user on existing FumbleBot droplet
# Run this as root on the server to create the fumblebot deploy user
#
# Usage: bash scripts/setup-deploy-user.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DEPLOY_USER="fumblebot"
OLD_APP_DIR="/root/fumblebot"
NEW_APP_DIR="/home/$DEPLOY_USER/app"

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}     Setup Deploy User${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then
    error "This script must be run as root"
fi

# Step 1: Create user
log "Creating user '$DEPLOY_USER'..."
if id "$DEPLOY_USER" &>/dev/null; then
    warn "User $DEPLOY_USER already exists"
else
    useradd -m -s /bin/bash "$DEPLOY_USER"
    success "User created"
fi

# Step 2: Set up SSH keys
log "Setting up SSH keys..."
mkdir -p /home/$DEPLOY_USER/.ssh
if [ -f /root/.ssh/authorized_keys ]; then
    cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/
    chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
    chmod 700 /home/$DEPLOY_USER/.ssh
    chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
    success "SSH keys configured"
else
    warn "No SSH keys found - you'll need to add them manually"
fi

# Step 3: Create app directory
log "Setting up app directory..."
mkdir -p "$NEW_APP_DIR"
chown $DEPLOY_USER:$DEPLOY_USER "$NEW_APP_DIR"

# Step 4: Migrate existing app if present
if [ -d "$OLD_APP_DIR" ]; then
    log "Migrating existing app from $OLD_APP_DIR..."

    # Copy everything except node_modules (we'll reinstall)
    rsync -av --exclude='node_modules' --exclude='.git' "$OLD_APP_DIR/" "$NEW_APP_DIR/"

    # Copy .env if exists
    if [ -f "$OLD_APP_DIR/.env" ]; then
        cp "$OLD_APP_DIR/.env" "$NEW_APP_DIR/.env"
        success ".env file copied"
    fi

    chown -R $DEPLOY_USER:$DEPLOY_USER "$NEW_APP_DIR"
    success "App migrated to $NEW_APP_DIR"
fi

# Step 5: Install dependencies as deploy user
log "Installing dependencies..."
su - $DEPLOY_USER -c "cd $NEW_APP_DIR && npm ci --production 2>/dev/null || npm install --production"
success "Dependencies installed"

# Step 6: Generate Prisma client
log "Generating Prisma client..."
su - $DEPLOY_USER -c "cd $NEW_APP_DIR && npx prisma generate" || warn "Prisma generate failed - may need .env"
success "Prisma client generated"

# Step 7: Set up PM2 for deploy user
log "Setting up PM2..."
pm2 kill 2>/dev/null || true  # Kill root's PM2
su - $DEPLOY_USER -c "pm2 startup" || true

# Transfer PM2 process to new user
if pm2 list | grep -q fumblebot; then
    log "Stopping old PM2 process..."
    pm2 delete fumblebot 2>/dev/null || true
fi

# Start as new user
log "Starting FumbleBot as $DEPLOY_USER..."
su - $DEPLOY_USER -c "cd $NEW_APP_DIR && pm2 start dist/server.js --name fumblebot"
su - $DEPLOY_USER -c "pm2 save"

# Set up PM2 startup for new user
pm2 startup systemd -u $DEPLOY_USER --hp /home/$DEPLOY_USER
success "PM2 configured for $DEPLOY_USER"

# Step 8: Update systemd service
log "Updating systemd service..."
cat > /etc/systemd/system/fumblebot.service << EOF
[Unit]
Description=FumbleBot Discord Bot
After=network.target

[Service]
Type=simple
User=$DEPLOY_USER
WorkingDirectory=$NEW_APP_DIR
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
success "Systemd service updated"

# Step 9: Summary
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}     Deploy User Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Deploy User:${NC}     $DEPLOY_USER"
echo -e "${BLUE}App Directory:${NC}  $NEW_APP_DIR"
echo ""
echo -e "${YELLOW}Test SSH Access:${NC}"
echo "  ssh $DEPLOY_USER@fumblebot.crit-fumble.com"
echo ""
echo -e "${YELLOW}Update your local deploy config:${NC}"
echo "  In scripts/quick-deploy.sh, change:"
echo "    SERVER=\"\${FUMBLEBOT_SERVER:-$DEPLOY_USER@fumblebot.crit-fumble.com}\""
echo "    REMOTE_DIR=\"\${FUMBLEBOT_DIR:-$NEW_APP_DIR}\""
echo ""
echo -e "${YELLOW}Check status:${NC}"
echo "  ssh $DEPLOY_USER@fumblebot.crit-fumble.com 'pm2 status'"
echo ""

# Verify
log "Verifying setup..."
sleep 3
su - $DEPLOY_USER -c "pm2 status fumblebot"
echo ""
su - $DEPLOY_USER -c "curl -s http://localhost:3000/health" || warn "Health check failed - check logs"
echo ""
