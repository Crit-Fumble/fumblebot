# Core Concepts - Foundry VTT Module

This directory contains the manifest for the Core Concepts Foundry VTT module.

## About Core Concepts

Core Concepts is an **open-source, system-agnostic** framework for standardizing RPG terminology and attributes across different game systems in Foundry VTT.

- **License**: MIT (code) + CC BY 4.0 (content)
- **Repository**: https://github.com/Crit-Fumble/foundry-core-concepts

## Architecture

### Module Features
- Universal attribute mapping system
- Configurable API endpoint (self-hostable)
- Optional real-time sync with API
- Data-driven system mappings (no system-specific code needed)

### Configuration
The module supports configurable settings:
- `apiEndpoint` - URL of the Core Concepts API (default: `https://api.crit-fumble.com`)
- `enableSync` - Enable/disable real-time API sync (default: `true`)

Users can point to their own API instance if running a self-hosted setup.

## How System Mappings Work

1. **Owner defines system** in the Crit-Fumble platform (or their own API)
2. **Owner configures mappings** - which Foundry fields map to which Core Concepts
3. **Module fetches mappings** on load for the active game system
4. **No system-specific modules needed** - all configuration is data-driven

## URLs

| Type | URL |
|------|-----|
| Manifest | `https://www.crit-fumble.com/foundry/modules/crit-fumble-core-concepts/module.json` |
| Source | `https://github.com/Crit-Fumble/foundry-core-concepts` |
| Releases | `https://github.com/Crit-Fumble/foundry-core-concepts/releases` |

## No Proprietary Content

This module contains **no Crit-Fumble proprietary assets**. It is purely the open-source framework. All branded CFG content (tiles, assets, etc.) is delivered separately through the Crit-Fumble platform.
