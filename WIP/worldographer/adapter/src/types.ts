/**
 * TypeScript types for Worldographer map data
 * Based on official file format: https://worldographer.com/instructions/file-format/
 */

export type ViewLevel =
  | 'WORLD'
  | 'CONTINENT'
  | 'KINGDOM'
  | 'PROVINCE'
  | 'BATTLEMAT'
  | 'SETTLEMENT'
  | 'COSMIC';

export type HexOrientation = 'COLUMNS' | 'ROWS'; // Pointy-top | Flat-top
export type MapProjection = 'FLAT' | 'ICOSAHEDRAL';
export type ShapeType = 'POLYGON' | 'CURVE' | 'LINE';
export type StrokeStyle = 'SOLID' | 'DASHED' | 'DOTTED';
export type NoteCategory = 'NATION' | 'RELIGION' | 'TIMELINE' | 'CUSTOM';

/**
 * Complete Worldographer file structure
 */
export interface WorldographerFile {
  metadata: WorldographerMetadata;
  tiles: WorldographerTileData[];
  features: WorldographerFeatureData[];
  labels: WorldographerLabelData[];
  shapes: WorldographerShapeData[];
  notes: WorldographerNoteData[];
  layers: WorldographerLayerData[];
  terrainDefs: WorldographerTerrainDefData[];
}

/**
 * Map metadata (root <map> element attributes)
 */
export interface WorldographerMetadata {
  type: ViewLevel;
  version: string;
  schemaVersion: string;
  width: number;  // Number of hexes/squares
  height: number; // Number of hexes/squares
  hexWidth: number;  // In pixels (300 = standard)
  hexHeight: number; // In pixels (300 = standard)
  hexOrientation: HexOrientation;
  mapProjection: MapProjection;
  maskColor?: string; // Hex color for fog of war
}

/**
 * Tile data (individual hex/square)
 */
export interface WorldographerTileData {
  col: number; // X coordinate
  row: number; // Y coordinate
  viewLevel: ViewLevel;
  layerId?: string;
  terrainType: string;
  elevation: number;
  icy: boolean;
  gmOnly: boolean;
  resources: {
    animals: number; // 0-7 scale
    brick: number;
    crops: number;
    gems: number;
    lumber: number;
    metals: number;
    rock: number;
  };
  customData?: Record<string, any>;
}

/**
 * Feature data (buildings, icons, POIs)
 */
export interface WorldographerFeatureData {
  featureType: string; // e.g., "Medieval-Castle", "Elf-City-A"
  label?: string;
  positions: {
    worldX?: number;
    worldY?: number;
    continentX?: number;
    continentY?: number;
    kingdomX?: number;
    kingdomY?: number;
    provinceX?: number;
    provinceY?: number;
    battlematX?: number;
    battlematY?: number;
    settlementX?: number;
    settlementY?: number;
    cosmicX?: number;
    cosmicY?: number;
  };
  rotation: number;   // Degrees
  scale: number;      // Multiplier
  opacity: number;    // 0-1
  visibility: {
    visibleWorld: boolean;
    visibleContinent: boolean;
    visibleKingdom: boolean;
    visibleProvince: boolean;
    visibleBattlemat: boolean;
    visibleSettlement: boolean;
    visibleCosmic: boolean;
  };
  gmOnly: boolean;
}

/**
 * Label data (text overlays)
 */
export interface WorldographerLabelData {
  text: string;
  positions: {
    worldX?: number;
    worldY?: number;
    continentX?: number;
    continentY?: number;
    kingdomX?: number;
    kingdomY?: number;
    provinceX?: number;
    provinceY?: number;
    battlematX?: number;
    battlematY?: number;
    settlementX?: number;
    settlementY?: number;
    cosmicX?: number;
    cosmicY?: number;
  };
  font: {
    family: string;
    size: number;
    color: string; // Hex color
    bold: boolean;
    italic: boolean;
  };
  outline: {
    color?: string;
    width: number;
  };
  background: {
    color?: string;
    opacity: number;
  };
  visibility: {
    visibleWorld: boolean;
    visibleContinent: boolean;
    visibleKingdom: boolean;
    visibleProvince: boolean;
    visibleBattlemat: boolean;
    visibleSettlement: boolean;
    visibleCosmic: boolean;
  };
  gmOnly: boolean;
}

/**
 * Shape data (polygons, borders, regions)
 */
export interface WorldographerShapeData {
  name?: string;
  shapeType: ShapeType;
  points: Array<{ x: number; y: number }>;
  viewLevel: ViewLevel;
  stroke: {
    color: string;
    width: number;
    style: StrokeStyle;
  };
  fill: {
    color?: string;
    opacity: number;
    texture?: string;
  };
  shadow: {
    enabled: boolean;
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
  gmOnly: boolean;
}

/**
 * Note data (GM notes, world lore)
 */
export interface WorldographerNoteData {
  uuid: string;
  title: string;
  category?: NoteCategory;
  content: string; // Can contain HTML (CDATA)
  position?: {
    viewLevel: ViewLevel;
    x: number;
    y: number;
  };
  gmOnly: boolean;
}

/**
 * Layer data (multi-layer support)
 */
export interface WorldographerLayerData {
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  order: number; // Z-index
}

/**
 * Terrain definition (custom terrain types)
 */
export interface WorldographerTerrainDefData {
  name: string;
  displayName: string;
  color: string; // Hex color
  texture?: string;
  movementCost: number;
  defenseBonus: number;
  description?: string;
}

/**
 * Map generation options
 */
export interface MapGenerationOptions {
  type: ViewLevel;
  width: number;
  height: number;
  hexOrientation?: HexOrientation;
  hexWidth?: number;
  hexHeight?: number;
  mapProjection?: MapProjection;
  defaultTerrain?: string;
}

/**
 * Tile update options
 */
export interface TileUpdateOptions {
  terrainType?: string;
  elevation?: number;
  icy?: boolean;
  gmOnly?: boolean;
  resources?: Partial<WorldographerTileData['resources']>;
}

/**
 * Feature creation options
 */
export interface FeatureCreationOptions {
  featureType: string;
  label?: string;
  x: number;
  y: number;
  viewLevel?: ViewLevel;
  rotation?: number;
  scale?: number;
  opacity?: number;
  gmOnly?: boolean;
}

/**
 * Label creation options
 */
export interface LabelCreationOptions {
  text: string;
  x: number;
  y: number;
  viewLevel?: ViewLevel;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  fontBold?: boolean;
  fontItalic?: boolean;
  outlineColor?: string;
  outlineWidth?: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
  gmOnly?: boolean;
}

/**
 * Shape creation options
 */
export interface ShapeCreationOptions {
  shapeType: ShapeType;
  points: Array<{ x: number; y: number }>;
  viewLevel: ViewLevel;
  name?: string;
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: StrokeStyle;
  fillColor?: string;
  fillOpacity?: number;
  fillTexture?: string;
  gmOnly?: boolean;
}

/**
 * Point in 2D space
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Rectangle bounds
 */
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Hex coordinate (axial coordinates)
 */
export interface HexCoordinate {
  q: number; // Column
  r: number; // Row
}

/**
 * Export options
 */
export interface ExportOptions {
  includeRawXml?: boolean;
  compress?: boolean;
  schemaVersion?: string;
}
