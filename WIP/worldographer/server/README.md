# @crit-fumble/worldographer-server

Server-side utilities for Worldographer map data (XML parsing, database API).

## Purpose

This package provides server-side utilities for working with Worldographer maps:

- **XML Parsing**: Parse Worldographer XML files
- **Validation**: Validate map data with Zod schemas
- **Database API**: CRUD operations for maps
- **Data Transformation**: Convert between XML and database formats
- **Import/Export**: Batch operations

## Features

### XML Parsing
- Parse Worldographer XML to TypeScript objects
- Support for hex and square grids
- Custom tile data extraction
- Layer parsing

### Data Validation
- Zod schemas for type safety
- Runtime validation
- Error reporting

### Database Operations
- Create, read, update, delete maps
- Tile-level queries
- Bulk operations
- Transactions

## Installation

```bash
cd src/packages/worldographer-server
npm install
npm run build
```

## Usage

### Parse XML

```typescript
import { parseWorldographerXML } from '@crit-fumble/worldographer-server';

const xmlString = `
<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0" type="hex" width="50" height="40">
  <settings>
    <grid type="hex" scale="5" unit="miles"/>
  </settings>
  <tiles>
    <tile x="10" y="15" terrain="forest" elevation="100">
      <label>Dark Forest</label>
    </tile>
  </tiles>
</map>
`;

const mapData = parseWorldographerXML(xmlString);

console.log(mapData);
// {
//   version: '1.0',
//   type: 'hex',
//   width: 50,
//   height: 40,
//   settings: {
//     grid: { type: 'hex', scale: 5, unit: 'miles' }
//   },
//   tiles: [
//     { x: 10, y: 15, terrain: 'forest', elevation: 100, label: 'Dark Forest' }
//   ]
// }
```

### Validate Map Data

```typescript
import { validateMapData, MapDataSchema } from '@crit-fumble/worldographer-server';

try {
  const validated = MapDataSchema.parse(mapData);
  console.log('Valid map data:', validated);
} catch (error) {
  console.error('Validation error:', error);
}
```

### Save to Database

```typescript
import { MapDatabase } from '@crit-fumble/worldographer-server';

const db = new MapDatabase(prisma);

// Create map
const map = await db.createMap({
  campaignId: 'campaign-123',
  name: 'World Map',
  type: 'hex',
  width: 50,
  height: 40,
  scale: 5,
  unit: 'miles',
  tiles: mapData.tiles
});

// Get map
const retrieved = await db.getMap(map.id);

// Update tiles
await db.updateTiles(map.id, [
  { x: 10, y: 15, terrain: 'mountain', elevation: 500 }
]);

// Delete map
await db.deleteMap(map.id);
```

### Export to XML

```typescript
import { exportToWorldographerXML } from '@crit-fumble/worldographer-server';

const map = await db.getMap('map-123');
const xml = exportToWorldographerXML(map);

// Write to file
await fs.writeFile('map.xml', xml);
```

### Bulk Import

```typescript
import { bulkImportMaps } from '@crit-fumble/worldographer-server';

const xmlFiles = [
  '/path/to/world-map.xml',
  '/path/to/region-map.xml',
  '/path/to/city-map.xml'
];

const results = await bulkImportMaps(campaignId, xmlFiles);

console.log(`Imported ${results.success} maps, ${results.failed} failed`);
```

## TypeScript Types

```typescript
// Map data structure
interface MapData {
  version: string;
  type: 'hex' | 'square';
  width: number;
  height: number;
  settings: {
    grid: {
      type: 'hex' | 'square';
      scale: number;
      unit: string;
      orientation?: 'pointy' | 'flat';
    };
    theme?: string;
  };
  tiles: Tile[];
  layers?: Layer[];
}

// Tile data
interface Tile {
  x: number;
  y: number;
  terrain?: string;
  elevation?: number;
  label?: string;
  data?: Record<string, any>;
}

// Layer data
interface Layer {
  id: string;
  name: string;
  visible: boolean;
  tiles: Tile[];
}
```

## Database Schema

```prisma
model Map {
  id          String   @id @default(cuid())
  campaignId  String
  name        String
  type        String   // 'hex' | 'square'
  width       Int
  height      Int
  scale       Float
  unit        String
  orientation String?  // 'pointy' | 'flat'
  theme       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tiles       Tile[]
  layers      Layer[]

  @@index([campaignId])
}

model Tile {
  id        String  @id @default(cuid())
  mapId     String
  map       Map     @relation(fields: [mapId], references: [id], onDelete: Cascade)
  x         Int
  y         Int
  terrain   String?
  elevation Float?
  label     String?
  data      Json?   // Custom data

  @@unique([mapId, x, y])
  @@index([mapId])
}

model Layer {
  id      String  @id @default(cuid())
  mapId   String
  map     Map     @relation(fields: [mapId], references: [id], onDelete: Cascade)
  name    String
  visible Boolean @default(true)
  order   Int     @default(0)

  @@index([mapId])
}
```

## API Routes

Example Next.js API routes:

```typescript
// pages/api/maps/[id].ts
import { MapDatabase } from '@crit-fumble/worldographer-server';

export async function GET(req, { params }) {
  const db = new MapDatabase(prisma);
  const map = await db.getMap(params.id);
  return Response.json(map);
}

export async function PUT(req, { params }) {
  const db = new MapDatabase(prisma);
  const updates = await req.json();
  const map = await db.updateMap(params.id, updates);
  return Response.json(map);
}

export async function DELETE(req, { params }) {
  const db = new MapDatabase(prisma);
  await db.deleteMap(params.id);
  return Response.json({ success: true });
}
```

```typescript
// pages/api/maps/import.ts
import { parseWorldographerXML, MapDatabase } from '@crit-fumble/worldographer-server';

export async function POST(req) {
  const formData = await req.formData();
  const file = formData.get('file');
  const xmlText = await file.text();

  const mapData = parseWorldographerXML(xmlText);
  const db = new MapDatabase(prisma);
  const map = await db.createMap({
    ...mapData,
    campaignId: req.query.campaignId
  });

  return Response.json(map);
}
```

## Utilities

### Coordinate Conversion

```typescript
import { hexToPixel, pixelToHex, squareToPixel } from '@crit-fumble/worldographer-server';

// Hex coordinates to pixel position
const pixel = hexToPixel({ x: 10, y: 15 }, 32); // 32 = hex size
console.log(pixel); // { x: 480, y: 360 }

// Pixel position to hex coordinates
const hex = pixelToHex({ x: 480, y: 360 }, 32);
console.log(hex); // { x: 10, y: 15 }
```

### Tile Queries

```typescript
import { getTilesInRadius, getTilesInRectangle } from '@crit-fumble/worldographer-server';

// Get all tiles within radius
const nearbyTiles = await getTilesInRadius(mapId, { x: 10, y: 15 }, 3);

// Get tiles in bounding box
const boxTiles = await getTilesInRectangle(mapId, { x: 5, y: 10, width: 20, height: 15 });
```

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
```

## License

MIT
