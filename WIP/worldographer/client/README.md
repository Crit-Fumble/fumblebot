# @crit-fumble/worldographer-client

Pixi.js-based map viewer and editor for Worldographer XML format.

## Purpose

This package provides React components and Pixi.js utilities for displaying and editing Worldographer maps in the browser:

- **Map Viewer**: Read-only map display for players
- **Map Editor**: Full editing capabilities for GMs
- **File I/O**: Load/save Worldographer XML files
- **Hex & Square Grids**: Support for both grid types
- **Tile Data**: Custom data storage per tile
- **Layers**: Multiple map layers (terrain, labels, etc.)

## Features

### Map Viewer (Players)
- ✅ Pan and zoom
- ✅ Hex and square grid rendering
- ✅ Terrain visualization
- ✅ Labels and markers
- ✅ Fog of war (optional)
- ✅ Responsive design

### Map Editor (GMs)
- ✅ All viewer features
- ✅ Terrain painting
- ✅ Tile selection
- ✅ Label editing
- ✅ Custom tile data
- ✅ Layer management
- ✅ Undo/redo
- ✅ Export to XML

## Installation

```bash
cd src/packages/worldographer-client
npm install
npm run build
```

## Usage

### Map Viewer Component

```tsx
import { WorldographerViewer } from '@crit-fumble/worldographer-client';

export function MapView({ mapId }: { mapId: string }) {
  return (
    <WorldographerViewer
      mapId={mapId}
      width={800}
      height={600}
      interactive={true}
      fogOfWar={true}
      onTileClick={(tile) => console.log('Clicked:', tile)}
    />
  );
}
```

### Map Editor Component

```tsx
import { WorldographerEditor } from '@crit-fumble/worldographer-client';

export function MapEditor({ mapId }: { mapId: string }) {
  const handleSave = async (mapData) => {
    // Save to database
    await fetch(`/api/maps/${mapId}`, {
      method: 'PUT',
      body: JSON.stringify(mapData)
    });
  };

  return (
    <WorldographerEditor
      mapId={mapId}
      width={1200}
      height={800}
      tools={['brush', 'eraser', 'fill', 'label']}
      onSave={handleSave}
    />
  );
}
```

### Loading from XML

```typescript
import { parseWorldographerXML } from '@crit-fumble/worldographer-client';

// Load XML file
const xmlText = await fetch('/maps/world-map.xml').then(r => r.text());

// Parse to map data
const mapData = parseWorldographerXML(xmlText);

console.log(mapData);
// {
//   width: 50,
//   height: 40,
//   gridType: 'hex',
//   scale: 5,
//   unit: 'miles',
//   tiles: [
//     { x: 10, y: 15, terrain: 'forest', elevation: 100, label: 'Dark Forest' },
//     ...
//   ]
// }
```

### Exporting to XML

```typescript
import { exportToWorldographerXML } from '@crit-fumble/worldographer-client';

const xml = exportToWorldographerXML(mapData);

// Download file
const blob = new Blob([xml], { type: 'application/xml' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'map.xml';
a.click();
```

## Components

### `WorldographerViewer`
Read-only map viewer with pan/zoom.

**Props**:
- `mapId: string` - Map ID to load
- `width: number` - Canvas width
- `height: number` - Canvas height
- `interactive?: boolean` - Enable interactions (default: true)
- `fogOfWar?: boolean` - Enable fog of war (default: false)
- `onTileClick?: (tile) => void` - Tile click handler
- `onTileHover?: (tile) => void` - Tile hover handler

### `WorldographerEditor`
Full map editor for GMs.

**Props**:
- `mapId: string` - Map ID to edit
- `width: number` - Canvas width
- `height: number` - Canvas height
- `tools?: string[]` - Available tools (default: all)
- `onSave?: (mapData) => void` - Save handler
- `onChange?: (mapData) => void` - Change handler

### `HexGrid`
Low-level hex grid renderer.

### `SquareGrid`
Low-level square grid renderer.

## Pixi.js Architecture

```
Pixi.Application
  └─ Stage (Container)
      ├─ Background Layer
      ├─ Terrain Layer
      │   └─ Tiles (Sprites)
      ├─ Features Layer
      │   └─ Icons, Markers
      ├─ Labels Layer
      │   └─ Text Labels
      └─ Fog of War Layer
          └─ Mask Graphics
```

## API Reference

See [API.md](./API.md) for complete API documentation.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Test
npm test

# Storybook (visual testing)
npm run storybook
```

## Performance

- **Rendering**: Uses Pixi.js WebGL renderer for high performance
- **Large Maps**: Tile culling for maps with 1000+ tiles
- **Memory**: Texture atlases for efficient sprite batching
- **Updates**: Delta updates for editing (only changed tiles re-render)

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile: ✅ Touch support

## License

MIT
