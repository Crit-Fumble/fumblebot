# Worldographer Adapter - Usage Examples

Complete examples for parsing, generating, and manipulating Worldographer maps.

## Table of Contents

1. [Parsing Existing Maps](#parsing-existing-maps)
2. [Generating New Maps](#generating-new-maps)
3. [Map Manipulation](#map-manipulation)
4. [Advanced Techniques](#advanced-techniques)
5. [Database Integration](#database-integration)

---

## Parsing Existing Maps

### Basic Parsing

```typescript
import { WorldographerParser } from '@crit-fumble/worldographer-adapter';
import fs from 'fs';

const parser = new WorldographerParser();

// Read .wxx file
const buffer = fs.readFileSync('my-world.wxx');

// Parse it
const map = await parser.parseFile(buffer);

console.log(`Map Type: ${map.metadata.type}`);
console.log(`Dimensions: ${map.metadata.width}x${map.metadata.height}`);
console.log(`Tiles: ${map.tiles.length}`);
console.log(`Features: ${map.features.length}`);
console.log(`Labels: ${map.labels.length}`);
```

### Analyzing Terrain

```typescript
// Count terrain types
const terrainCounts: { [key: string]: number } = {};

map.tiles.forEach((tile) => {
  if (tile.viewLevel === 'WORLD') {
    terrainCounts[tile.terrainType] = (terrainCounts[tile.terrainType] || 0) + 1;
  }
});

console.log('Terrain Distribution:');
Object.entries(terrainCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([terrain, count]) => {
    console.log(`  ${terrain}: ${count} hexes`);
  });
```

### Finding Features

```typescript
// Find all castles
const castles = map.features.filter((f) => f.featureType.includes('Castle'));

console.log(`Found ${castles.length} castles:`);
castles.forEach((castle) => {
  console.log(`  - ${castle.label || 'Unnamed'} at (${castle.positions.worldX}, ${castle.positions.worldY})`);
});
```

---

## Generating New Maps

### Create a Simple World Map

```typescript
import { WorldographerGenerator } from '@crit-fumble/worldographer-adapter';
import fs from 'fs';

const generator = new WorldographerGenerator();

// Create 100x80 hex world map
const map = generator.createMap({
  type: 'WORLD',
  width: 100,
  height: 80,
  hexOrientation: 'COLUMNS',
  defaultTerrain: 'Ocean', // Fill with ocean
});

// Export to file
const buffer = await generator.exportToFile(map);
fs.writeFileSync('new-world.wxx', buffer);

console.log('Created new world map!');
```

### Add Continents

```typescript
// Create a simple continent using fillCircle
const manipulator = new MapManipulator();

// Central continent
manipulator.fillCircle(map, 50, 40, 15, 'Grassland', 'WORLD');

// Add mountains
manipulator.fillCircle(map, 50, 40, 5, 'Mountain', 'WORLD');

// Add forests
manipulator.fillCircle(map, 55, 42, 3, 'Forest', 'WORLD');
manipulator.fillCircle(map, 45, 38, 3, 'Forest', 'WORLD');

// Add a river (using line)
manipulator.paintLine(map, 50, 35, 50, 45, 'River', 1, 'WORLD');
```

### Add Cities and Features

```typescript
// Add capital city
generator.addFeature(map, {
  featureType: 'Medieval-Castle',
  x: 50,
  y: 40,
  viewLevel: 'WORLD',
  label: 'Capital City',
  scale: 1.5,
});

// Add smaller towns
generator.addFeature(map, {
  featureType: 'Medieval-Town',
  x: 55,
  y: 42,
  label: 'Port Town',
});

generator.addFeature(map, {
  featureType: 'Medieval-Village',
  x: 45,
  y: 38,
  label: 'Forest Village',
});
```

### Add Labels

```typescript
// Add continent name
generator.addLabel(map, {
  text: 'The Great Continent',
  x: 50,
  y: 35,
  viewLevel: 'WORLD',
  fontSize: 24,
  fontColor: '#8B4513',
  fontBold: true,
  outlineColor: '#FFFFFF',
  outlineWidth: 2,
});

// Add region labels
generator.addLabel(map, {
  text: 'Northern Mountains',
  x: 50,
  y: 37,
  fontSize: 14,
  fontColor: '#666666',
});

generator.addLabel(map, {
  text: 'Southern Plains',
  x: 50,
  y: 43,
  fontSize: 14,
  fontColor: '#666666',
});
```

---

## Map Manipulation

### Procedural Terrain Generation

```typescript
import { MapManipulator } from '@crit-fumble/worldographer-adapter';

const manipulator = new MapManipulator();

// Generate noise-based terrain
manipulator.generateNoiseTerrain(
  map,
  { x: 0, y: 0, width: 100, height: 80 },
  [
    { threshold: 0.0, terrain: 'DeepOcean' },
    { threshold: 0.3, terrain: 'Ocean' },
    { threshold: 0.4, terrain: 'Beach' },
    { threshold: 0.45, terrain: 'Grassland' },
    { threshold: 0.6, terrain: 'Forest' },
    { threshold: 0.75, terrain: 'Hills' },
    { threshold: 0.85, terrain: 'Mountain' },
    { threshold: 0.95, terrain: 'SnowMountain' },
  ],
  'WORLD',
  12345 // Seed for reproducibility
);
```

### Flood Fill

```typescript
// Replace ocean with different water types
manipulator.floodFill(map, 10, 10, 'DeepOcean', 'WORLD');
```

### Clone and Mirror Regions

```typescript
// Clone a 20x20 region
manipulator.cloneRegion(
  map,
  { x: 40, y: 30, width: 20, height: 20 }, // Source
  60, // Dest X
  30, // Dest Y
  'WORLD'
);

// Mirror the cloned region
manipulator.mirrorRegion(
  map,
  { x: 60, y: 30, width: 20, height: 20 },
  'horizontal',
  'WORLD'
);
```

### Replace Terrain Types

```typescript
// Replace all grassland with plains
const count = manipulator.replaceTerrain(map, 'Grassland', 'Plains', 'WORLD');
console.log(`Replaced ${count} tiles`);
```

### Statistics

```typescript
const stats = manipulator.getStatistics(map, 'WORLD');

console.log(`Total Tiles: ${stats.totalTiles}`);
console.log(`Total Features: ${stats.totalFeatures}`);

console.log('\nTerrain Distribution:');
Object.entries(stats.tiles).forEach(([terrain, count]) => {
  const percentage = ((count / stats.totalTiles) * 100).toFixed(1);
  console.log(`  ${terrain}: ${count} (${percentage}%)`);
});
```

---

## Advanced Techniques

### Creating a Complete Fantasy World

```typescript
import {
  WorldographerGenerator,
  MapManipulator,
} from '@crit-fumble/worldographer-adapter';
import fs from 'fs';

const generator = new WorldographerGenerator();
const manipulator = new MapManipulator();

// Create base map
const world = generator.createMap({
  type: 'WORLD',
  width: 150,
  height: 120,
  hexOrientation: 'COLUMNS',
});

// Generate base terrain with noise
manipulator.generateNoiseTerrain(
  world,
  { x: 0, y: 0, width: 150, height: 120 },
  [
    { threshold: 0.0, terrain: 'DeepOcean' },
    { threshold: 0.35, terrain: 'Ocean' },
    { threshold: 0.4, terrain: 'Coast' },
    { threshold: 0.42, terrain: 'Beach' },
    { threshold: 0.45, terrain: 'Grassland' },
    { threshold: 0.55, terrain: 'Plains' },
    { threshold: 0.65, terrain: 'Forest' },
    { threshold: 0.75, terrain: 'Hills' },
    { threshold: 0.85, terrain: 'Mountain' },
    { threshold: 0.95, terrain: 'SnowMountain' },
  ],
  'WORLD',
  Date.now()
);

// Add major features
const kingdoms = [
  { name: 'Kingdom of Valor', x: 50, y: 50, type: 'Medieval-Castle' },
  { name: 'Empire of the East', x: 100, y: 60, type: 'EAsian-Castle-A' },
  { name: 'Elven Realm', x: 70, y: 30, type: 'Elf-Palace-A' },
  { name: 'Dwarven Stronghold', x: 30, y: 70, type: 'Dwarf-City-A' },
];

kingdoms.forEach((kingdom) => {
  generator.addFeature(world, {
    featureType: kingdom.type,
    x: kingdom.x,
    y: kingdom.y,
    label: kingdom.name,
    scale: 2.0,
  });

  generator.addLabel(world, {
    text: kingdom.name,
    x: kingdom.x,
    y: kingdom.y - 3,
    fontSize: 18,
    fontBold: true,
    fontColor: '#000000',
    outlineColor: '#FFFFFF',
    outlineWidth: 2,
  });
});

// Add borders between kingdoms
generator.addShape(world, {
  shapeType: 'POLYGON',
  points: [
    { x: 40, y: 40 },
    { x: 60, y: 40 },
    { x: 60, y: 60 },
    { x: 40, y: 60 },
  ],
  viewLevel: 'WORLD',
  name: 'Kingdom of Valor Border',
  strokeColor: '#FF0000',
  strokeWidth: 3,
  strokeStyle: 'DASHED',
});

// Add trade routes
manipulator.paintLine(world, 50, 50, 100, 60, 'Road', 1, 'WORLD');
manipulator.paintLine(world, 50, 50, 70, 30, 'Road', 1, 'WORLD');
manipulator.paintLine(world, 50, 50, 30, 70, 'Road', 1, 'WORLD');

// Export
const buffer = await generator.exportToFile(world);
fs.writeFileSync('fantasy-world.wxx', buffer);

console.log('Fantasy world created!');
```

### Multi-Level Map

```typescript
// Create a map with multiple zoom levels

// World level (100x80)
const map = generator.createMap({
  type: 'WORLD',
  width: 100,
  height: 80,
  hexOrientation: 'COLUMNS',
});

// Add world-level terrain
manipulator.fillRect(map, { x: 0, y: 0, width: 100, height: 80 }, 'Ocean', 'WORLD');
manipulator.fillCircle(map, 50, 40, 20, 'Grassland', 'WORLD');

// Add continent-level details (same file, different view level)
// Each world hex = 4x4 continent hexes
for (let worldRow = 40; worldRow < 60; worldRow++) {
  for (let worldCol = 40; worldCol < 60; worldCol++) {
    // Map to continent coordinates (4x scale)
    const continentStartX = worldCol * 4;
    const continentStartY = worldRow * 4;

    // Add detailed terrain at continent level
    manipulator.fillRect(
      map,
      { x: continentStartX, y: continentStartY, width: 4, height: 4 },
      'Plains',
      'CONTINENT'
    );
  }
}

// Add features at both levels
generator.addFeature(map, {
  featureType: 'Medieval-Capital',
  x: 50,
  y: 40,
  viewLevel: 'WORLD',
  label: 'Capital',
});

// Same feature at continent zoom (coordinates scaled)
generator.addFeature(map, {
  featureType: 'Medieval-Castle',
  x: 50 * 4 + 2,
  y: 40 * 4 + 2,
  viewLevel: 'CONTINENT',
  label: 'Capital Castle',
});
```

---

## Database Integration

### Import Map to Database

```typescript
import { WorldographerParser } from '@crit-fumble/worldographer-adapter';
import { WorldographerDatabase } from '@crit-fumble/worldographer-adapter/database';
import { prisma } from '@/lib/prisma';
import fs from 'fs';

const parser = new WorldographerParser();
const db = new WorldographerDatabase(prisma);

// Parse file
const buffer = fs.readFileSync('my-world.wxx');
const mapData = await parser.parseFile(buffer);

// Import to database
const map = await db.importMap(
  mapData,
  'user-id-123',
  'campaign-id-456',
  'my-world.wxx'
);

console.log(`Imported map: ${map.id}`);
console.log(`  - ${map.tiles.length} tiles stored`);
console.log(`  - ${map.features.length} features stored`);
```

### Export from Database

```typescript
import { WorldographerGenerator } from '@crit-fumble/worldographer-adapter';
import { WorldographerDatabase } from '@crit-fumble/worldographer-adapter/database';
import { prisma } from '@/lib/prisma';
import fs from 'fs';

const db = new WorldographerDatabase(prisma);
const generator = new WorldographerGenerator();

// Get map from database
const mapData = await db.exportMap('map-id-789');

// Export to .wxx file
const buffer = await generator.exportToFile(mapData);
fs.writeFileSync('exported-world.wxx', buffer);

console.log('Map exported successfully!');
```

### Query Map Data

```typescript
// Get all maps for a campaign
const maps = await prisma.worldographerMap.findMany({
  where: { campaignId: 'campaign-id-456' },
  include: {
    _count: {
      select: {
        tiles: true,
        features: true,
        labels: true,
      },
    },
  },
});

maps.forEach((map) => {
  console.log(`${map.name}:`);
  console.log(`  Type: ${map.type}`);
  console.log(`  Size: ${map.width}x${map.height}`);
  console.log(`  Tiles: ${map._count.tiles}`);
  console.log(`  Features: ${map._count.features}`);
});
```

### Modify Map in Database

```typescript
// Get map data
const mapData = await db.exportMap('map-id-789');

// Modify using manipulator
const manipulator = new MapManipulator();
manipulator.fillCircle(mapData, 50, 50, 10, 'Volcanic', 'WORLD');

// Save back to database
await db.updateMap('map-id-789', mapData);

console.log('Map updated!');
```

---

## Complete Example: Procedural World Generator

```typescript
import {
  WorldographerGenerator,
  MapManipulator,
} from '@crit-fumble/worldographer-adapter';
import fs from 'fs';

class WorldGenerator {
  private generator = new WorldographerGenerator();
  private manipulator = new MapManipulator();

  generate(seed: number = Date.now()) {
    console.log('Generating world...');

    // Create base map
    const world = this.generator.createMap({
      type: 'WORLD',
      width: 200,
      height: 160,
      hexOrientation: 'COLUMNS',
    });

    // Generate terrain
    console.log('  - Generating terrain...');
    this.manipulator.generateNoiseTerrain(
      world,
      { x: 0, y: 0, width: 200, height: 160 },
      [
        { threshold: 0.0, terrain: 'DeepOcean' },
        { threshold: 0.35, terrain: 'Ocean' },
        { threshold: 0.4, terrain: 'Coast' },
        { threshold: 0.42, terrain: 'Beach' },
        { threshold: 0.45, terrain: 'Grassland' },
        { threshold: 0.55, terrain: 'Plains' },
        { threshold: 0.65, terrain: 'Forest' },
        { threshold: 0.75, terrain: 'Hills' },
        { threshold: 0.85, terrain: 'Mountain' },
      ],
      'WORLD',
      seed
    );

    // Place settlements
    console.log('  - Placing settlements...');
    const grasslandTiles = this.manipulator.findTilesByTerrain(world, 'Grassland', 'WORLD');

    // Place 20 random settlements
    for (let i = 0; i < 20; i++) {
      const randomTile = grasslandTiles[Math.floor(Math.random() * grasslandTiles.length)];

      const types = ['Medieval-Village', 'Medieval-Town', 'Medieval-Castle'];
      const type = types[Math.floor(Math.random() * types.length)];

      this.generator.addFeature(world, {
        featureType: type,
        x: randomTile.col + 0.5,
        y: randomTile.row + 0.5,
        label: `Settlement ${i + 1}`,
      });
    }

    // Get statistics
    const stats = this.manipulator.getStatistics(world, 'WORLD');
    console.log('\nWorld Statistics:');
    console.log(`  Total Hexes: ${stats.totalTiles}`);
    console.log(`  Total Features: ${stats.totalFeatures}`);
    console.log(`  Land Percentage: ${
      (((stats.tiles['Grassland'] || 0) + (stats.tiles['Plains'] || 0) +
        (stats.tiles['Forest'] || 0)) / stats.totalTiles * 100).toFixed(1)
    }%`);

    return world;
  }

  async save(world: any, filename: string) {
    const buffer = await this.generator.exportToFile(world);
    fs.writeFileSync(filename, buffer);
    console.log(`\nSaved to ${filename}`);
  }
}

// Use it
const worldGen = new WorldGenerator();
const world = worldGen.generate();
await worldGen.save(world, 'generated-world.wxx');
```

---

## Tips and Best Practices

1. **Always validate coordinates** - Check that x/y are within map bounds
2. **Use view levels appropriately** - World for continental, Continent for regional, etc.
3. **Batch operations** - Modify tiles in batches for better performance
4. **Keep backups** - Export maps before major manipulations
5. **Use consistent terrain names** - Match Worldographer's default terrain types
6. **Test with Worldographer** - Always verify generated files open correctly

---

For more information, see the [API documentation](./docs/API.md).
