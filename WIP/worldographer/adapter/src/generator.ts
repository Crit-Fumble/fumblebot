/**
 * Worldographer map generator and exporter
 * Creates new maps and exports to .wxx format
 */

import { gzipSync } from 'zlib';
import { XMLBuilder } from 'fast-xml-parser';
import {
  WorldographerFile,
  WorldographerMetadata,
  WorldographerTileData,
  WorldographerFeatureData,
  WorldographerLabelData,
  WorldographerShapeData,
  WorldographerNoteData,
  WorldographerLayerData,
  WorldographerTerrainDefData,
  MapGenerationOptions,
  TileUpdateOptions,
  FeatureCreationOptions,
  LabelCreationOptions,
  ShapeCreationOptions,
  ExportOptions,
  ViewLevel,
} from './types';

export class WorldographerGenerator {
  private xmlBuilder: XMLBuilder;

  constructor() {
    this.xmlBuilder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      cdataPropName: '__cdata',
      format: true,
      indentBy: '  ',
      suppressEmptyNode: true,
    });
  }

  /**
   * Create a new empty map
   */
  createMap(options: MapGenerationOptions): WorldographerFile {
    const metadata: WorldographerMetadata = {
      type: options.type,
      version: '2025-Beta-1.10',
      schemaVersion: '1.0',
      width: options.width,
      height: options.height,
      hexWidth: options.hexWidth || 300,
      hexHeight: options.hexHeight || 300,
      hexOrientation: options.hexOrientation || 'COLUMNS',
      mapProjection: options.mapProjection || 'FLAT',
    };

    // Create empty tiles if defaultTerrain specified
    const tiles: WorldographerTileData[] = [];
    if (options.defaultTerrain) {
      for (let row = 0; row < options.height; row++) {
        for (let col = 0; col < options.width; col++) {
          tiles.push(this.createDefaultTile(col, row, options.type, options.defaultTerrain));
        }
      }
    }

    return {
      metadata,
      tiles,
      features: [],
      labels: [],
      shapes: [],
      notes: [],
      layers: [],
      terrainDefs: [],
    };
  }

  /**
   * Create a default tile
   */
  private createDefaultTile(
    col: number,
    row: number,
    viewLevel: ViewLevel,
    terrainType: string
  ): WorldographerTileData {
    return {
      col,
      row,
      viewLevel,
      terrainType,
      elevation: 0,
      icy: false,
      gmOnly: false,
      resources: {
        animals: 0,
        brick: 0,
        crops: 0,
        gems: 0,
        lumber: 0,
        metals: 0,
        rock: 0,
      },
    };
  }

  /**
   * Set or update a tile
   */
  setTile(
    map: WorldographerFile,
    col: number,
    row: number,
    options: TileUpdateOptions,
    viewLevel: ViewLevel = 'WORLD'
  ): void {
    // Find existing tile
    const existingIndex = map.tiles.findIndex(
      (t) => t.col === col && t.row === row && t.viewLevel === viewLevel
    );

    if (existingIndex !== -1) {
      // Update existing tile
      const tile = map.tiles[existingIndex];
      if (options.terrainType !== undefined) tile.terrainType = options.terrainType;
      if (options.elevation !== undefined) tile.elevation = options.elevation;
      if (options.icy !== undefined) tile.icy = options.icy;
      if (options.gmOnly !== undefined) tile.gmOnly = options.gmOnly;
      if (options.resources) {
        tile.resources = { ...tile.resources, ...options.resources };
      }
    } else {
      // Create new tile
      map.tiles.push({
        col,
        row,
        viewLevel,
        terrainType: options.terrainType || 'Ocean',
        elevation: options.elevation || 0,
        icy: options.icy || false,
        gmOnly: options.gmOnly || false,
        resources: {
          animals: 0,
          brick: 0,
          crops: 0,
          gems: 0,
          lumber: 0,
          metals: 0,
          rock: 0,
          ...options.resources,
        },
      });
    }
  }

  /**
   * Add a feature to the map
   */
  addFeature(map: WorldographerFile, options: FeatureCreationOptions): void {
    const viewLevel = options.viewLevel || 'WORLD';

    const feature: WorldographerFeatureData = {
      featureType: options.featureType,
      label: options.label,
      positions: {
        [`${viewLevel.toLowerCase()}X`]: options.x,
        [`${viewLevel.toLowerCase()}Y`]: options.y,
      },
      rotation: options.rotation || 0,
      scale: options.scale || 1.0,
      opacity: options.opacity || 1.0,
      visibility: {
        visibleWorld: true,
        visibleContinent: true,
        visibleKingdom: true,
        visibleProvince: true,
        visibleBattlemat: true,
        visibleSettlement: true,
        visibleCosmic: true,
      },
      gmOnly: options.gmOnly || false,
    };

    map.features.push(feature);
  }

  /**
   * Add a label to the map
   */
  addLabel(map: WorldographerFile, options: LabelCreationOptions): void {
    const viewLevel = options.viewLevel || 'WORLD';

    const label: WorldographerLabelData = {
      text: options.text,
      positions: {
        [`${viewLevel.toLowerCase()}X`]: options.x,
        [`${viewLevel.toLowerCase()}Y`]: options.y,
      },
      font: {
        family: options.fontFamily || 'Arial',
        size: options.fontSize || 12,
        color: options.fontColor || '#000000',
        bold: options.fontBold || false,
        italic: options.fontItalic || false,
      },
      outline: {
        color: options.outlineColor,
        width: options.outlineWidth || 0,
      },
      background: {
        color: options.backgroundColor,
        opacity: options.backgroundOpacity || 0,
      },
      visibility: {
        visibleWorld: true,
        visibleContinent: true,
        visibleKingdom: true,
        visibleProvince: true,
        visibleBattlemat: true,
        visibleSettlement: true,
        visibleCosmic: true,
      },
      gmOnly: options.gmOnly || false,
    };

    map.labels.push(label);
  }

  /**
   * Add a shape to the map
   */
  addShape(map: WorldographerFile, options: ShapeCreationOptions): void {
    const shape: WorldographerShapeData = {
      name: options.name,
      shapeType: options.shapeType,
      points: options.points,
      viewLevel: options.viewLevel,
      stroke: {
        color: options.strokeColor || '#000000',
        width: options.strokeWidth || 1,
        style: options.strokeStyle || 'SOLID',
      },
      fill: {
        color: options.fillColor,
        opacity: options.fillOpacity || 0,
        texture: options.fillTexture,
      },
      shadow: {
        enabled: false,
        color: '#000000',
        blur: 0,
        offsetX: 0,
        offsetY: 0,
      },
      gmOnly: options.gmOnly || false,
    };

    map.shapes.push(shape);
  }

  /**
   * Export map to .wxx file buffer
   */
  async exportToFile(
    map: WorldographerFile,
    options: ExportOptions = {}
  ): Promise<Buffer> {
    // Build XML structure
    const xmlObj = this.buildXMLObject(map);

    // Convert to XML string
    let xmlString = '<?xml version="1.0" encoding="utf-16"?>\n';
    xmlString += this.xmlBuilder.build(xmlObj);

    // Convert to UTF-16 buffer
    const xmlBuffer = Buffer.from(xmlString, 'utf16le');

    // Compress with gzip (unless disabled)
    if (options.compress !== false) {
      return gzipSync(xmlBuffer);
    }

    return xmlBuffer;
  }

  /**
   * Build XML object from WorldographerFile
   */
  private buildXMLObject(map: WorldographerFile): any {
    const root: any = {
      '@_type': map.metadata.type,
      '@_version': map.metadata.version,
      '@_schemaVersion': map.metadata.schemaVersion,
      '@_width': map.metadata.width,
      '@_height': map.metadata.height,
      '@_hexWidth': map.metadata.hexWidth,
      '@_hexHeight': map.metadata.hexHeight,
      '@_hexOrientation': map.metadata.hexOrientation,
      '@_mapProjection': map.metadata.mapProjection,
    };

    if (map.metadata.maskColor) {
      root['@_maskColor'] = map.metadata.maskColor;
    }

    // Add tiles
    if (map.tiles.length > 0) {
      root.tiles = this.buildTilesSection(map.tiles, map.metadata.width, map.metadata.height);
    }

    // Add features
    if (map.features.length > 0) {
      root.features = this.buildFeaturesSection(map.features);
    }

    // Add labels
    if (map.labels.length > 0) {
      root.labels = this.buildLabelsSection(map.labels);
    }

    // Add shapes
    if (map.shapes.length > 0) {
      root.shapes = this.buildShapesSection(map.shapes);
    }

    // Add notes
    if (map.notes.length > 0) {
      root.information = this.buildNotesSection(map.notes);
    }

    // Add layers
    if (map.layers.length > 0) {
      root.layers = this.buildLayersSection(map.layers);
    }

    // Add terrain definitions
    if (map.terrainDefs.length > 0) {
      root.terrainDefs = this.buildTerrainDefsSection(map.terrainDefs);
    }

    return { map: root };
  }

  /**
   * Build tiles section (row-based format)
   */
  private buildTilesSection(tiles: WorldographerTileData[], width: number, height: number): any {
    // Group tiles by view level and row
    const tilesByLevel = new Map<ViewLevel, Map<number, WorldographerTileData[]>>();

    tiles.forEach((tile) => {
      if (!tilesByLevel.has(tile.viewLevel)) {
        tilesByLevel.set(tile.viewLevel, new Map());
      }
      const levelMap = tilesByLevel.get(tile.viewLevel)!;

      if (!levelMap.has(tile.row)) {
        levelMap.set(tile.row, []);
      }
      levelMap.get(tile.row)!.push(tile);
    });

    const rows: any[] = [];

    // Build rows for each level
    tilesByLevel.forEach((levelMap, viewLevel) => {
      for (let row = 0; row < height; row++) {
        const rowTiles = levelMap.get(row) || [];

        // Sort by column
        rowTiles.sort((a, b) => a.col - b.col);

        // Build tab-delimited string
        const columns: string[] = [];
        for (let col = 0; col < width; col++) {
          const tile = rowTiles.find((t) => t.col === col);
          if (tile) {
            columns.push(this.tileToString(tile));
          } else {
            // Empty tile (Ocean by default)
            columns.push('Ocean\t0\tfalse\tfalse\t0\t0\t0\t0\t0\t0\t0');
          }
        }

        rows.push({
          '@_level': viewLevel,
          '#text': columns.join('\n'),
        });
      }
    });

    return { row: rows };
  }

  /**
   * Convert tile to tab-delimited string
   */
  private tileToString(tile: WorldographerTileData): string {
    return [
      tile.terrainType,
      tile.elevation,
      tile.icy,
      tile.gmOnly,
      tile.resources.animals,
      tile.resources.brick,
      tile.resources.crops,
      tile.resources.gems,
      tile.resources.lumber,
      tile.resources.metals,
      tile.resources.rock,
    ].join('\t');
  }

  /**
   * Build features section
   */
  private buildFeaturesSection(features: WorldographerFeatureData[]): any {
    const featureList = features.map((f) => {
      const attrs: any = {
        '@_type': f.featureType,
        '@_rotation': f.rotation,
        '@_scale': f.scale,
        '@_opacity': f.opacity,
        '@_gmOnly': f.gmOnly,
      };

      if (f.label) attrs['@_label'] = f.label;

      // Add positions
      Object.entries(f.positions).forEach(([key, value]) => {
        if (value !== undefined) {
          attrs[`@_${key}`] = value;
        }
      });

      // Add visibility
      Object.entries(f.visibility).forEach(([key, value]) => {
        attrs[`@_${key}`] = value;
      });

      return attrs;
    });

    return { feature: featureList };
  }

  /**
   * Build labels section
   */
  private buildLabelsSection(labels: WorldographerLabelData[]): any {
    const labelList = labels.map((l) => {
      const attrs: any = {
        '@_text': l.text,
        '@_fontFamily': l.font.family,
        '@_fontSize': l.font.size,
        '@_fontColor': l.font.color,
        '@_fontBold': l.font.bold,
        '@_fontItalic': l.font.italic,
        '@_outlineWidth': l.outline.width,
        '@_backgroundOpacity': l.background.opacity,
        '@_gmOnly': l.gmOnly,
      };

      if (l.outline.color) attrs['@_outlineColor'] = l.outline.color;
      if (l.background.color) attrs['@_backgroundColor'] = l.background.color;

      // Add positions
      Object.entries(l.positions).forEach(([key, value]) => {
        if (value !== undefined) {
          attrs[`@_${key}`] = value;
        }
      });

      // Add visibility
      Object.entries(l.visibility).forEach(([key, value]) => {
        attrs[`@_${key}`] = value;
      });

      return attrs;
    });

    return { label: labelList };
  }

  /**
   * Build shapes section
   */
  private buildShapesSection(shapes: WorldographerShapeData[]): any {
    const shapeList = shapes.map((s) => {
      // Convert points to string format: "x1,y1;x2,y2;x3,y3"
      const pointsStr = s.points.map((p) => `${p.x},${p.y}`).join(';');

      const attrs: any = {
        '@_type': s.shapeType,
        '@_viewLevel': s.viewLevel,
        '@_points': pointsStr,
        '@_strokeColor': s.stroke.color,
        '@_strokeWidth': s.stroke.width,
        '@_strokeStyle': s.stroke.style,
        '@_fillOpacity': s.fill.opacity,
        '@_shadowEnabled': s.shadow.enabled,
        '@_gmOnly': s.gmOnly,
      };

      if (s.name) attrs['@_name'] = s.name;
      if (s.fill.color) attrs['@_fillColor'] = s.fill.color;
      if (s.fill.texture) attrs['@_fillTexture'] = s.fill.texture;

      if (s.shadow.enabled) {
        attrs['@_shadowColor'] = s.shadow.color;
        attrs['@_shadowBlur'] = s.shadow.blur;
        attrs['@_shadowOffsetX'] = s.shadow.offsetX;
        attrs['@_shadowOffsetY'] = s.shadow.offsetY;
      }

      return attrs;
    });

    return { shape: shapeList };
  }

  /**
   * Build notes section
   */
  private buildNotesSection(notes: WorldographerNoteData[]): any {
    const noteList = notes.map((n) => {
      const attrs: any = {
        '@_uuid': n.uuid,
        '@_title': n.title,
        '@_gmOnly': n.gmOnly,
        '__cdata': n.content,
      };

      if (n.category) attrs['@_category'] = n.category;

      if (n.position) {
        attrs['@_viewLevel'] = n.position.viewLevel;
        attrs['@_x'] = n.position.x;
        attrs['@_y'] = n.position.y;
      }

      return attrs;
    });

    return { note: noteList };
  }

  /**
   * Build layers section
   */
  private buildLayersSection(layers: WorldographerLayerData[]): any {
    const layerList = layers.map((l) => ({
      '@_name': l.name,
      '@_visible': l.visible,
      '@_locked': l.locked,
      '@_opacity': l.opacity,
      '@_order': l.order,
    }));

    return { layer: layerList };
  }

  /**
   * Build terrain definitions section
   */
  private buildTerrainDefsSection(terrainDefs: WorldographerTerrainDefData[]): any {
    const terrainList = terrainDefs.map((t) => {
      const attrs: any = {
        '@_name': t.name,
        '@_displayName': t.displayName,
        '@_color': t.color,
        '@_movementCost': t.movementCost,
        '@_defenseBonus': t.defenseBonus,
      };

      if (t.texture) attrs['@_texture'] = t.texture;
      if (t.description) attrs['@_description'] = t.description;

      return attrs;
    });

    return { terrain: terrainList };
  }
}
