/**
 * TypeScript types for Worldographer map data
 * Based on Worldographer XML export format
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export enum GridType {
  Hex = 'hex',
  Square = 'square',
}

export enum HexOrientation {
  Pointy = 'pointy',  // Pointy-top hexes
  Flat = 'flat',      // Flat-top hexes
}

export enum TerrainType {
  Ocean = 'ocean',
  DeepOcean = 'deep_ocean',
  Coast = 'coast',
  Plains = 'plains',
  Grassland = 'grassland',
  Forest = 'forest',
  DenseForest = 'dense_forest',
  Hills = 'hills',
  Mountain = 'mountain',
  HighMountain = 'high_mountain',
  Desert = 'desert',
  Tundra = 'tundra',
  Ice = 'ice',
  Swamp = 'swamp',
  Jungle = 'jungle',
  Volcanic = 'volcanic',
}

// ============================================================================
// Zod Schemas (Runtime Validation)
// ============================================================================

export const CoordinateSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});

export const GridSettingsSchema = z.object({
  type: z.nativeEnum(GridType),
  scale: z.number().positive(),
  unit: z.string().default('miles'),
  orientation: z.nativeEnum(HexOrientation).optional(),
  width: z.number().positive().optional(),  // Grid line width
  color: z.string().optional(),              // Grid line color
  visible: z.boolean().default(true),
});

export const TileDataSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  terrain: z.string().optional(),
  elevation: z.number().optional(),
  label: z.string().optional(),
  icon: z.string().optional(),              // Icon/marker name
  color: z.string().optional(),             // Tile highlight color
  data: z.record(z.any()).optional(),       // Custom key-value pairs
});

export const LayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  opacity: z.number().min(0).max(1).default(1),
  order: z.number().int().default(0),
});

export const MapSettingsSchema = z.object({
  grid: GridSettingsSchema,
  theme: z.string().optional(),
  backgroundColor: z.string().optional(),
  showGrid: z.boolean().default(true),
  showCoordinates: z.boolean().default(false),
  showLabels: z.boolean().default(true),
});

export const MapDataSchema = z.object({
  version: z.string().default('1.0'),
  type: z.nativeEnum(GridType),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  settings: MapSettingsSchema,
  tiles: z.array(TileDataSchema),
  layers: z.array(LayerSchema).optional(),
  metadata: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    author: z.string().optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
  }).optional(),
});

// ============================================================================
// TypeScript Types (from Zod schemas)
// ============================================================================

export type Coordinate = z.infer<typeof CoordinateSchema>;
export type GridSettings = z.infer<typeof GridSettingsSchema>;
export type TileData = z.infer<typeof TileDataSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type MapSettings = z.infer<typeof MapSettingsSchema>;
export type MapData = z.infer<typeof MapDataSchema>;

// ============================================================================
// Database Types (for Prisma integration)
// ============================================================================

export interface MapRecord {
  id: string;
  campaignId: string;
  name: string;
  type: GridType;
  width: number;
  height: number;
  scale: number;
  unit: string;
  orientation: HexOrientation | null;
  theme: string | null;
  settings: MapSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface TileRecord {
  id: string;
  mapId: string;
  x: number;
  y: number;
  terrain: string | null;
  elevation: number | null;
  label: string | null;
  icon: string | null;
  color: string | null;
  data: Record<string, any> | null;
}

export interface LayerRecord {
  id: string;
  mapId: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  order: number;
}

// ============================================================================
// XML Parsing Types
// ============================================================================

export interface XMLMapElement {
  '@_version': string;
  '@_type': string;
  '@_width': string;
  '@_height': string;
  settings: XMLSettingsElement;
  tiles: XMLTilesElement;
  layers?: XMLLayersElement;
}

export interface XMLSettingsElement {
  grid: {
    '@_type': string;
    '@_scale': string;
    '@_unit': string;
    '@_orientation'?: string;
  };
  theme?: {
    '@_name': string;
  };
}

export interface XMLTilesElement {
  tile: XMLTileElement | XMLTileElement[];
}

export interface XMLTileElement {
  '@_x': string;
  '@_y': string;
  '@_terrain'?: string;
  '@_elevation'?: string;
  label?: string | { '#text': string };
  icon?: string;
  data?: {
    entry: XMLDataEntry | XMLDataEntry[];
  };
}

export interface XMLDataEntry {
  '@_key': string;
  '@_value': string;
}

export interface XMLLayersElement {
  layer: XMLLayerElement | XMLLayerElement[];
}

export interface XMLLayerElement {
  '@_id': string;
  '@_name': string;
  '@_visible'?: string;
  '@_locked'?: string;
  '@_opacity'?: string;
  '@_order'?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelCoordinate {
  x: number;
  y: number;
}

export interface HexCoordinate extends Coordinate {
  // Cube coordinates for hex calculations
  q?: number;  // Column
  r?: number;  // Row
  s?: number;  // Diagonal (q + r + s = 0)
}

export interface TileUpdate {
  x: number;
  y: number;
  terrain?: string | null;
  elevation?: number | null;
  label?: string | null;
  icon?: string | null;
  color?: string | null;
  data?: Record<string, any> | null;
}

export interface MapQuery {
  campaignId?: string;
  type?: GridType;
  name?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface TileQuery {
  mapId: string;
  bounds?: BoundingBox;
  terrain?: string | string[];
  hasLabel?: boolean;
  hasIcon?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

export const HEX_SQRT3 = Math.sqrt(3);

export const DEFAULT_HEX_SIZE = 32;  // pixels
export const DEFAULT_SQUARE_SIZE = 32;  // pixels

export const DEFAULT_MAP_WIDTH = 50;
export const DEFAULT_MAP_HEIGHT = 40;

export const TERRAIN_COLORS: Record<string, string> = {
  ocean: '#1e3a8a',
  deep_ocean: '#0c2952',
  coast: '#3b82f6',
  plains: '#86efac',
  grassland: '#22c55e',
  forest: '#166534',
  dense_forest: '#0f3d1f',
  hills: '#a16207',
  mountain: '#78716c',
  high_mountain: '#57534e',
  desert: '#fbbf24',
  tundra: '#e0e7ff',
  ice: '#f0f9ff',
  swamp: '#475569',
  jungle: '#14532d',
  volcanic: '#991b1b',
};

// ============================================================================
// Error Types
// ============================================================================

export class MapParseError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'MapParseError';
  }
}

export class MapValidationError extends Error {
  constructor(message: string, public errors: z.ZodError) {
    super(message);
    this.name = 'MapValidationError';
  }
}

export class MapNotFoundError extends Error {
  constructor(mapId: string) {
    super(`Map not found: ${mapId}`);
    this.name = 'MapNotFoundError';
  }
}

export class TileNotFoundError extends Error {
  constructor(mapId: string, x: number, y: number) {
    super(`Tile not found: ${mapId} at (${x}, ${y})`);
    this.name = 'TileNotFoundError';
  }
}
