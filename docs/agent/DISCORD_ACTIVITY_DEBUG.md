# Discord Activity White Screen - Debugging Guide

**Issue**: Activity loads with white screen
**Root Cause**: Asset path mismatch when loaded via Discord proxy

---

## Problem Analysis

### HTML Output from Core:
```html
<script type="module" crossorigin src="/activity/assets/index-C6UJdVhl.js"></script>
<link rel="stylesheet" crossorigin href="/activity/assets/index-BM97skX8.css">
```

### What Discord Loads:
- User opens activity in Discord
- Discord iframe loads: `https://fumblebot.crit-fumble.com/.proxy/activity/`
- HTML is returned with assets pointing to `/activity/assets/*`
- Browser tries to load: `https://fumblebot.crit-fumble.com/activity/assets/index-C6UJdVhl.js`
- **This bypasses the proxy and fails!**

### Expected Behavior:
Assets should load from: `https://fumblebot.crit-fumble.com/.proxy/activity/assets/*`

---

## Solutions (Pick One)

### Solution 1: Use Relative Asset Paths (Recommended)

In Core's Vite config, set `base` to relative path:

```ts
// vite.config.ts
export default defineConfig({
  base: './', // Relative paths instead of '/activity/'
  build: {
    outDir: 'dist/activity',
  },
})
```

**Result**: HTML will have:
```html
<script src="./assets/index-C6UJdVhl.js"></script>
```

**Pros**: Works regardless of proxy path
**Cons**: None

---

### Solution 2: Set base to '/.proxy/activity/'

```ts
// vite.config.ts
export default defineConfig({
  base: process.env.NODE_ENV === 'production'
    ? '/.proxy/activity/'
    : '/activity/',
})
```

**Result**: HTML will have:
```html
<script src="/.proxy/activity/assets/index-C6UJdVhl.js"></script>
```

**Pros**: Explicit proxy path
**Cons**: Core needs to know about FumbleBot's proxy structure

---

### Solution 3: FumbleBot Proxies Both Paths (Less Ideal)

Add `/activity/*` proxy in addition to `/.proxy/activity/*`:

**FumbleBot Change**:
```ts
// src/middleware.ts
setupCoreServerProxy(app); // Already proxies /activity/*
```

**Check if this is already enabled** - it might be! The Core proxy config already includes `/activity/` in the proxy paths.

Let me verify...

---

## Quick Debugging Steps

### 1. Check Browser Console
Open Discord, launch activity, press F12:
- Look for 404 errors on asset loads
- Check which URLs are failing
- Verify CSP isn't blocking scripts

### 2. Test Asset Loading Directly

```bash
# Should return JavaScript (200 OK):
curl -I https://fumblebot.crit-fumble.com/.proxy/activity/assets/index-C6UJdVhl.js

# Currently fails (404):
curl -I https://fumblebot.crit-fumble.com/activity/assets/index-C6UJdVhl.js
```

### 3. Check Vite Build Output

On Core server:
```bash
cd /path/to/core
cat dist/activity/index.html | grep -E 'src=|href='
```

Look for asset paths - are they:
- ✅ Relative: `./assets/...`
- ✅ Proxy-aware: `/.proxy/activity/assets/...`
- ❌ Absolute: `/activity/assets/...` (BREAKS!)

---

## Recommended Fix (Core Side)

**File**: `packages/core/vite.config.ts` (or wherever activity Vite config is)

```diff
export default defineConfig({
- base: '/activity/',
+ base: './',
  build: {
    outDir: 'dist/activity',
    rollupOptions: {
      input: './src/activity/index.html'
    }
  }
})
```

**Then rebuild**:
```bash
npm run build:activity
# or
npm run build
```

---

## Testing After Fix

1. **Verify Build Output**:
```bash
# On Core server
cat dist/activity/index.html | grep src=
# Should show: src="./assets/..." or src="assets/..."
```

2. **Test Through Proxy**:
```bash
curl https://fumblebot.crit-fumble.com/.proxy/activity/ | grep src=
# Should match build output
```

3. **Test in Discord**:
- Open Discord
- Launch Crit-Fumble Activity
- Should see React app instead of white screen
- Check console for any remaining errors

---

## CSP Headers (Already Correct)

FumbleBot is already setting correct CSP headers:
```
Content-Security-Policy:
  frame-ancestors 'self' https://discord.com https://1443525084256931880.discordsays.com;
  script-src 'self';
  style-src 'self';
```

This allows scripts/styles from same origin (fumblebot.crit-fumble.com).

---

## FumbleBot Proxy Status (2025-12-02 Verified)

✅ **Activity Proxy**: `/.proxy/activity/*` → Core `/activity/*` (**Works for assets**)
✅ **Core Proxy**: `/api/core/*` → Core `/api/core/*`
❌ **Direct Activity Proxy**: `/activity/*` → Core `/activity/*` (**Does NOT work for assets**)

**Verified Behavior**:
```bash
# ✅ Works (through .proxy path)
curl -I https://fumblebot.crit-fumble.com/.proxy/activity/assets/index-C6UJdVhl.js
# Returns: 200 OK (212KB JavaScript)

# ❌ Fails (direct path)
curl -I https://fumblebot.crit-fumble.com/activity/assets/index-C6UJdVhl.js
# Returns: 404 Not Found
```

**Conclusion**: The `/activity` proxy is configured in FumbleBot but doesn't properly handle asset subpaths. The white screen is **NOT fixable from FumbleBot side** - Core must use relative asset paths.

---

## Additional Debugging

### Discord SDK Initialization

Check if Discord SDK is loading:
```js
// In activity code
console.log('Discord SDK:', discordSdk);
discordSdk.ready().then(() => {
  console.log('Discord SDK ready!');
});
```

### Check CSP Violations

In browser console, look for:
```
Refused to load the script ... because it violates the following Content Security Policy directive
```

If you see this, the CSP headers need adjustment.

---

## Expected Working Flow

```
1. Discord loads: /.proxy/activity/
   → FumbleBot proxy → Core /activity/
   → Returns HTML with relative paths

2. Browser loads: /.proxy/activity/assets/index-C6UJdVhl.js
   → FumbleBot proxy → Core /activity/assets/index-C6UJdVhl.js
   → Returns JavaScript

3. React initializes
   → Discord SDK loads
   → Activity renders
```

---

## Summary

**Issue**: Vite is building with `base: '/activity/'` which creates absolute asset paths.

**Fix**: Change Core's Vite config to use `base: './'` for relative paths.

**Result**: Assets will load correctly through FumbleBot's `/.proxy/activity/*` proxy.

---

**Created**: 2025-12-02
**FumbleBot Proxy**: ✅ Working
**Core Server**: ✅ Running
**Missing**: Relative asset paths in Vite build
