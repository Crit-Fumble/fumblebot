#!/bin/bash
# GitHub Webhook Deploy Handler
# Simple webhook server that listens for GitHub push events and triggers deployment
# Run this as a separate service on the droplet

set -e

WEBHOOK_PORT="${WEBHOOK_PORT:-9000}"
WEBHOOK_SECRET="${GITHUB_WEBHOOK_SECRET:-}"
APP_DIR="/root/fumblebot"
LOG_FILE="/root/fumblebot/webhook.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Simple webhook handler using netcat + bash
# For production, consider using a proper webhook server like webhook (https://github.com/adnanh/webhook)

log "Starting webhook server on port $WEBHOOK_PORT"

while true; do
    # Listen for HTTP requests
    {
        read -r request_line

        # Read headers
        content_length=0
        signature=""
        while read -r header; do
            header="${header%%$'\r'}"
            [ -z "$header" ] && break

            if [[ "$header" == Content-Length:* ]]; then
                content_length="${header#Content-Length: }"
            fi
            if [[ "$header" == X-Hub-Signature-256:* ]]; then
                signature="${header#X-Hub-Signature-256: }"
            fi
        done

        # Read body if present
        body=""
        if [ "$content_length" -gt 0 ] 2>/dev/null; then
            read -r -n "$content_length" body
        fi

        # Check if this is a POST to /webhook
        if [[ "$request_line" == *"POST /webhook"* ]] || [[ "$request_line" == *"POST /deploy"* ]]; then
            log "Received webhook request"

            # Verify signature if secret is configured
            if [ -n "$WEBHOOK_SECRET" ] && [ -n "$signature" ]; then
                expected_sig="sha256=$(echo -n "$body" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | cut -d' ' -f2)"
                if [ "$signature" != "$expected_sig" ]; then
                    log "Invalid webhook signature"
                    echo -e "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\n\r\n{\"error\":\"Invalid signature\"}"
                    continue
                fi
            fi

            # Check if this is a push to main branch
            if echo "$body" | grep -q '"ref":"refs/heads/main"'; then
                log "Push to main branch detected - triggering deployment"

                # Run deployment in background
                (
                    cd "$APP_DIR"
                    bash scripts/server-deploy.sh >> "$LOG_FILE" 2>&1
                ) &

                echo -e "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"status\":\"deploying\"}"
            else
                log "Push was not to main branch - ignoring"
                echo -e "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"status\":\"ignored\",\"reason\":\"not main branch\"}"
            fi
        elif [[ "$request_line" == *"GET /health"* ]]; then
            echo -e "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"status\":\"ok\"}"
        else
            echo -e "HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\n\r\n{\"error\":\"Not found\"}"
        fi

    } < <(nc -l -p "$WEBHOOK_PORT" -q 1)
done
