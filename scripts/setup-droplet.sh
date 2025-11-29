#!/bin/bash
# FumbleBot Droplet Setup Script
# Run this on a fresh Ubuntu droplet to set up FumbleBot from scratch
#
# Usage (as root on new droplet):
#   curl -sL https://raw.githubusercontent.com/Crit-Fumble/fumblebot/main/scripts/setup-droplet.sh | bash
#
# Or copy this script to the server and run:
#   bash setup-droplet.sh
#
# Prerequisites:
#   - Fresh Ubuntu 22.04+ droplet
#   - Root SSH access
#   - .env file ready to copy after setup

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DEPLOY_USER="fumblebot"
APP_DIR="/home/$DEPLOY_USER/app"
NODE_VERSION="20"
REPO_URL="https://github.com/Crit-Fumble/fumblebot.git"

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
    exit 1
}

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}     FumbleBot Droplet Setup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "This script must be run as root"
fi

# ===========================================
# Step 1: System Updates
# ===========================================
log "Step 1/8: Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
success "System updated"

# ===========================================
# Step 2: Install Dependencies
# ===========================================
log "Step 2/8: Installing system dependencies..."
apt-get install -y -qq \
    curl \
    git \
    build-essential \
    python3 \
    ffmpeg \
    libtool \
    autoconf \
    automake \
    libopus-dev \
    libsodium-dev \
    pkg-config \
    ufw \
    fail2ban

success "Dependencies installed"

# ===========================================
# Step 3: Install Node.js
# ===========================================
log "Step 3/8: Installing Node.js ${NODE_VERSION}..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y -qq nodejs
fi
success "Node.js $(node -v) installed"

# ===========================================
# Step 4: Create Deploy User
# ===========================================
log "Step 4/8: Creating deploy user '${DEPLOY_USER}'..."
if id "$DEPLOY_USER" &>/dev/null; then
    warn "User $DEPLOY_USER already exists"
else
    useradd -m -s /bin/bash "$DEPLOY_USER"
    success "User $DEPLOY_USER created"
fi

# Set up SSH for deploy user (copy root's authorized_keys)
mkdir -p /home/$DEPLOY_USER/.ssh
if [ -f /root/.ssh/authorized_keys ]; then
    cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/
    chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
    chmod 700 /home/$DEPLOY_USER/.ssh
    chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
    success "SSH keys copied to $DEPLOY_USER"
else
    warn "No SSH keys found in /root/.ssh/authorized_keys"
fi

# Add deploy user to sudo group (limited sudo for pm2)
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart fumblebot, /usr/bin/systemctl status fumblebot" > /etc/sudoers.d/$DEPLOY_USER
chmod 440 /etc/sudoers.d/$DEPLOY_USER
success "Sudo permissions configured"

# ===========================================
# Step 5: Install PM2 Globally
# ===========================================
log "Step 5/8: Installing PM2..."
npm install -g pm2
pm2 startup systemd -u $DEPLOY_USER --hp /home/$DEPLOY_USER
success "PM2 installed and configured"

# ===========================================
# Step 6: Configure Firewall
# ===========================================
log "Step 6/8: Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp  # FumbleBot API (for health checks)
echo "y" | ufw enable
success "Firewall configured"

# ===========================================
# Step 7: Configure Fail2Ban
# ===========================================
log "Step 7/8: Configuring fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban
success "Fail2ban enabled"

# ===========================================
# Step 8: Clone Repository & Initial Setup
# ===========================================
log "Step 8/8: Setting up application directory..."
mkdir -p "$APP_DIR"
chown $DEPLOY_USER:$DEPLOY_USER "$APP_DIR"

# Clone repo as deploy user
su - $DEPLOY_USER -c "git clone $REPO_URL $APP_DIR" 2>/dev/null || {
    warn "Repository already exists or clone failed"
    su - $DEPLOY_USER -c "cd $APP_DIR && git pull origin main" 2>/dev/null || true
}

# Install dependencies
su - $DEPLOY_USER -c "cd $APP_DIR && npm ci --production"
success "Application set up"

# ===========================================
# Create systemd service (optional, PM2 preferred)
# ===========================================
cat > /etc/systemd/system/fumblebot.service << EOF
[Unit]
Description=FumbleBot Discord Bot
After=network.target

[Service]
Type=simple
User=$DEPLOY_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=10
StandardOutput=append:/home/$DEPLOY_USER/fumblebot.log
StandardError=append:/home/$DEPLOY_USER/fumblebot.log
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
success "Systemd service created"

# ===========================================
# Summary
# ===========================================
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}     Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Deploy User:${NC}     $DEPLOY_USER"
echo -e "${BLUE}App Directory:${NC}  $APP_DIR"
echo -e "${BLUE}Node Version:${NC}   $(node -v)"
echo -e "${BLUE}PM2 Version:${NC}    $(pm2 -v)"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Copy your .env file to $APP_DIR/.env"
echo "  2. Run: su - $DEPLOY_USER -c 'cd $APP_DIR && npm run build'"
echo "  3. Run: su - $DEPLOY_USER -c 'cd $APP_DIR && pm2 start dist/server.js --name fumblebot'"
echo "  4. Run: su - $DEPLOY_USER -c 'pm2 save'"
echo ""
echo -e "${YELLOW}SSH Access:${NC}"
echo "  ssh $DEPLOY_USER@$(hostname -I | awk '{print $1}')"
echo ""
echo -e "${YELLOW}Deploy Command (from local):${NC}"
echo "  FUMBLEBOT_SERVER=$DEPLOY_USER@fumblebot.crit-fumble.com npm run deploy"
echo ""
