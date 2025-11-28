# Worldographer Adapter - Quick Start

Get started with parsing and generating Worldographer maps in 5 minutes.

## Installation

```bash
cd src/packages/worldographer-adapter
npm install
npm run build
```

## Parse an Existing Map

```typescript
import { WorldographerParser } from '@crit-fumble/worldographer-adapter';
import fs from 'fs';

const parser = new WorldographerParser();
const buffer = fs.readFileSync('my-map.wxx');
const map = await parser.parseFile(buffer);

console.log(`Map: ${map.metadata.type}, ${map.metadata.width}x${map.metadata.height}`);
console.log(`Tiles: ${map.tiles.length}, Features: ${map.features.length}`);
```

## Generate a New Map

```typescript
import { WorldographerGenerator } from '@crit-fumble/worldographer-adapter';
import fs from 'fs';

const generator = new WorldographerGenerator();

// Create 50x40 hex world
const map = generator.createMap({
  type: 'WORLD',
  width: 50,
  height: 40,
  hexOrientation: 'COLUMNS',
  defaultTerrain: 'Ocean',
});

// Add a continent
const manipulator = new MapManipulator();
manipulator.fillCircle(map, 25, 20, 10, 'Grassland', 'WORLD');

// Add a castle
generator.addFeature(map, {
  featureType: 'Medieval-Castle',
  x: 25,
  y: 20,
  label: 'Capital City',
});

// Export to file
const buffer = await generator.exportToFile(map);
fs.writeFileSync('new-world.wxx', buffer);
```

## Manipulate Maps

```typescript
import { MapManipulator } from '@crit-fumble/worldographer-adapter';

const manipulator = new MapManipulator();

// Fill regions
manipulator.fillRect(map, { x: 10, y: 10, width: 20, height: 15 }, 'Forest', 'WORLD');

// Paint lines (roads, rivers)
manipulator.paintLine(map, 0, 0, 49, 39, 'Road', 1, 'WORLD');

// Flood fill
manipulator.floodFill(map, 5, 5, 'DeepOcean', 'WORLD');

// Procedural generation
manipulator.generateNoiseTerrain(
  map,
  { x: 0, y: 0, width: 50, height: 40 },
  [
    { threshold: 0.0, terrain: 'Ocean' },
    { threshold: 0.4, terrain: 'Grassland' },
    { threshold: 0.6, terrain: 'Forest' },
    { threshold: 0.8, terrain: 'Mountain' },
  ],
  'WORLD'
);

// Get statistics
const stats = manipulator.getStatistics(map, 'WORLD');
console.log(stats);
```

## Key Concepts

### File Format
- `.wxx` files are **gzipped XML** (UTF-16)
- Parser handles decompression automatically
- Generator creates properly formatted files

### Map Levels
Maps can have multiple zoom levels:
- **WORLD** - Continental scale
- **CONTINENT** - Regional scale
- **KINGDOM** - Country scale
- **PROVINCE** - Provincial scale
- **BATTLEMAT** - Tactical scale
- **SETTLEMENT** - City/town scale
- **COSMIC** - Space scale

### Coordinates
- Tiles use `col` (X) and `row` (Y) integer coordinates
- Features/Labels use floating-point coordinates
- Each tile is 1x1, features can be positioned at sub-tile precision (e.g., 10.5, 15.7)

### Terrain Types
Common terrain types (match Worldographer's defaults):
- `Ocean`, `DeepOcean`, `Coast`, `Beach`
- `Grassland`, `Plains`, `Desert`, `Tundra`
- `Forest`, `DenseForest`, `Jungle`
- `Hills`, `Mountain`, `SnowMountain`
- `Swamp`, `Volcanic`, `Road`, `River`

## Next Steps

- See [EXAMPLES.md](./EXAMPLES.md) for comprehensive examples
- See [README.md](./README.md) for full API reference
- See [WORLDOGRAPHER_DATABASE_SCHEMA.md](../../../WORLDOGRAPHER_DATABASE_SCHEMA.md) for database integration

## Common Tasks

### Load, modify, save
```typescript
const parser = new WorldographerParser();
const generator = new WorldographerGenerator();
const manipulator = new MapManipulator();

// Load
const buffer = fs.readFileSync('input.wxx');
const map = await parser.parseFile(buffer);

// Modify
manipulator.fillCircle(map, 30, 30, 5, 'Volcanic', 'WORLD');

// Save
const output = await generator.exportToFile(map);
fs.writeFileSync('output.wxx', output);
```

### Create from scratch
```typescript
const generator = new WorldographerGenerator();

const map = generator.createMap({
  type: 'WORLD',
  width: 100,
  height: 80,
  hexOrientation: 'COLUMNS',
});

// Add content...
generator.setTile(map, 50, 40, { terrainType: 'Grassland' });
generator.addFeature(map, { featureType: 'Medieval-Castle', x: 50, y: 40 });
generator.addLabel(map, { text: 'My Kingdom', x: 50, y: 35 });

const buffer = await generator.exportToFile(map);
fs.writeFileSync('my-world.wxx', buffer);
```

### Query and analyze
```typescript
const manipulator = new MapManipulator();

// Find all forest tiles
const forests = manipulator.findTilesByTerrain(map, 'Forest', 'WORLD');

// Find features near a point
const nearbyFeatures = manipulator.findFeaturesNear(map, 50, 40, 10, 'WORLD');

// Get map statistics
const stats = manipulator.getStatistics(map, 'WORLD');
console.log(`Land: ${stats.tiles['Grassland'] || 0} tiles`);
console.log(`Water: ${stats.tiles['Ocean'] || 0} tiles`);
```

---

**Ready to start?** Check out [EXAMPLES.md](./EXAMPLES.md) for more detailed examples!
