# FumbleBot Deployment

**Production Server**: fumblebot@fumblebot.crit-fumble.com
**Process Manager**: systemd
**Deploy Strategy**: Build locally → Upload → Restart

---

## Quick Deploy

```bash
npm run deploy
```

This will:
1. Build the project locally
2. Create a tarball of dist + node_modules + prisma
3. Upload to production server
4. Extract and run `npx prisma generate`
5. Restart the fumblebot systemd service
6. Run a health check

**Build time**: ~30 seconds
**Upload time**: ~30 seconds (93MB package)
**Total time**: ~1-2 minutes

---

## Utility Commands

### View Logs
```bash
npm run deploy:logs
```
Tails the last 100 lines of systemd logs and follows in real-time.

### Check Status
```bash
npm run deploy:status
```
Shows systemd service status and health endpoint response.

### Restart Service
```bash
npm run deploy:restart
```
Restarts the fumblebot systemd service without deploying new code.

---

## Environment Variables

Override server/directory with environment variables:

```bash
FUMBLEBOT_SERVER=user@host npm run deploy
FUMBLEBOT_DIR=/custom/path npm run deploy
```

---

## Architecture

### Why Build Locally?

We build locally and upload the compiled code + dependencies because:

1. **Faster**: Avoids npm install on the small droplet (1GB RAM)
2. **Reliable**: Local build environment is consistent
3. **Safer**: No git credentials needed on production server
4. **Simpler**: No webhook setup or git-based deployment complexity

### What Gets Uploaded?

- `dist/` - Compiled TypeScript code
- `prisma/` - Database schema
- `node_modules/` - Production dependencies (excludes dev deps like TypeScript, Vitest)
- `package.json` & `package-lock.json` - For reference

**Excluded from upload** (via tar --exclude):
- `node_modules/.cache`
- `node_modules/@types/*`
- `node_modules/typescript`
- `node_modules/vitest`
- `node_modules/@vitest/*`
- `node_modules/husky`

---

## Production Setup

### Server Requirements

- **User**: fumblebot (non-root)
- **Directory**: /home/fumblebot/app
- **Service**: systemd (`fumblebot.service`)
- **Port**: 3000 (internal), proxied via nginx
- **Sudo**: fumblebot user needs passwordless sudo for systemctl

### SSH Key Setup

Ensure your SSH key is added to the server:

```bash
ssh-copy-id fumblebot@fumblebot.crit-fumble.com
```

### Passwordless Sudo

The fumblebot user needs to restart the systemd service without a password prompt:

```bash
# As root on the server:
echo "fumblebot ALL=(ALL) NOPASSWD: /bin/systemctl restart fumblebot" > /etc/sudoers.d/fumblebot
chmod 0440 /etc/sudoers.d/fumblebot
```

---

## Troubleshooting

### Deployment Fails at Upload
- Check SSH connectivity: `ssh fumblebot@fumblebot.crit-fumble.com`
- Verify server directory exists: `ssh fumblebot@fumblebot.crit-fumble.com "ls -la /home/fumblebot/app"`

### Service Won't Restart
- Check sudo permissions: `ssh fumblebot@fumblebot.crit-fumble.com "sudo -n systemctl status fumblebot"`
- View service logs: `npm run deploy:logs`

### Health Check Fails
- Service may still be starting (wait 5-10 seconds)
- Check logs: `npm run deploy:logs`
- Verify port: `ssh fumblebot@fumblebot.crit-fumble.com "netstat -tlnp | grep 3000"`

---

## Scripts Reference

| Script | File | Purpose |
|--------|------|---------|
| `npm run deploy` | [deploy.sh](deploy.sh) | Main deployment script |
| `npm run deploy:logs` | N/A | View systemd logs |
| `npm run deploy:status` | N/A | Check service status |
| `npm run deploy:restart` | N/A | Restart service only |

---

**Last Updated**: 2025-12-02
**Deploy Method**: Local build + upload
**Process Manager**: systemd
