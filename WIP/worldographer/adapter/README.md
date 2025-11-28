# @crit-fumble/worldographer-adapter

Parse, generate, and manipulate Worldographer `.wxx` map files.

## Features

- ✅ **Parse** `.wxx` files (gzipped XML) into TypeScript objects
- ✅ **Generate** `.wxx` files from scratch
- ✅ **Manipulate** existing maps (add/remove tiles, features, labels)
- ✅ **Database** Import/export to PostgreSQL via Prisma
- ✅ **Validation** Runtime validation with Zod schemas
- ✅ **Multi-level** Support for all 7 map levels (World → Cosmic)

## Installation

```bash
cd src/packages/worldographer-adapter
npm install
npm run build
```

## Usage

### Parse a .wxx file

```typescript
import { WorldographerParser } from '@crit-fumble/worldographer-adapter';
import fs from 'fs';

const parser = new WorldographerParser();
const buffer = fs.readFileSync('my-map.wxx');
const mapData = await parser.parseFile(buffer);

console.log(mapData.metadata);
console.log(`Map has ${mapData.tiles.length} tiles`);
```

### Generate a new map

```typescript
import { WorldographerGenerator } from '@crit-fumble/worldographer-adapter';

const generator = new WorldographerGenerator();

// Create a new 50x40 hex map
const map = generator.createMap({
  type: 'WORLD',
  width: 50,
  height: 40,
  hexOrientation: 'COLUMNS',
});

// Add terrain
generator.setTile(map, 10, 15, {
  terrainType: 'Forest',
  elevation: 100,
});

// Add a feature
generator.addFeature(map, {
  featureType: 'Medieval-Castle',
  worldX: 10.5,
  worldY: 15.5,
  label: 'Castle Blackstone',
});

// Export to .wxx
const buffer = await generator.exportToFile(map);
fs.writeFileSync('new-map.wxx', buffer);
```

### Import to database

```typescript
import { WorldographerDatabase } from '@crit-fumble/worldographer-adapter';
import { prisma } from '@/lib/prisma';

const db = new WorldographerDatabase(prisma);

const map = await db.importMap(
  mapData,
  'user-id',
  'campaign-id',
  'my-map.wxx'
);

console.log(`Imported map: ${map.id}`);
```

### Export from database

```typescript
const mapData = await db.exportMap('map-id');
const buffer = await generator.exportToFile(mapData);
fs.writeFileSync('exported.wxx', buffer);
```

## API Reference

See [API.md](./docs/API.md) for complete documentation.

## License

MIT
