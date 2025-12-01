# @crit-fumble/fumblebot-browser-companion

Browser companion components for FumbleBot - connect TTRPG virtual tabletops to the Crit-Fumble platform.

## Overview

This package provides:
- **React components** for building VTT integration UIs
- **Type definitions** for VTT platform adapters (Roll20, D&D Beyond, etc.)
- **Shared utilities** for browser extension development

## Installation

```bash
npm install @crit-fumble/fumblebot-browser-companion
```

## Usage

### In Core Activities

```tsx
import { VTTStatusPanel } from '@crit-fumble/fumblebot-browser-companion';

function MyActivity() {
  return <VTTStatusPanel />;
}
```

### As Browser Extension

The package can also be used to build standalone browser extensions for VTT platforms.

## Peer Dependencies

- `react` ^19.0.0
- `react-dom` ^19.0.0

## Related Packages

- [`@crit-fumble/react`](https://www.npmjs.com/package/@crit-fumble/react) - Shared React component library
- [`@crit-fumble/core`](https://www.npmjs.com/package/@crit-fumble/core) - Core types and utilities

## License

Apache-2.0
