/**
 * Worldographer .wxx file parser
 * Decompresses gzipped XML and parses into TypeScript objects
 */

import { gunzipSync } from 'zlib';
import { XMLParser } from 'fast-xml-parser';
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
  ViewLevel,
} from './types';

export class WorldographerParser {
  private xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      trimValues: true,
      cdataPropName: '__cdata',
    });
  }

  /**
   * Parse .wxx file buffer into WorldographerFile object
   */
  async parseFile(buffer: Buffer): Promise<WorldographerFile> {
    // Step 1: Decompress gzip
    const xmlBuffer = gunzipSync(buffer);

    // Step 2: Decode UTF-16
    const xmlString = xmlBuffer.toString('utf16le');

    // Step 3: Parse XML
    const parsed = this.xmlParser.parse(xmlString);

    // Step 4: Extract root element (case-insensitive)
    const root = parsed.map || parsed.Map || parsed.MAP;

    if (!root) {
      throw new Error('Invalid Worldographer file: missing <map> root element');
    }

    // Step 5: Parse all sections
    return {
      metadata: this.parseMetadata(root),
      tiles: this.parseTiles(root),
      features: this.parseFeatures(root),
      labels: this.parseLabels(root),
      shapes: this.parseShapes(root),
      notes: this.parseNotes(root),
      layers: this.parseLayers(root),
      terrainDefs: this.parseTerrainDefs(root),
    };
  }

  /**
   * Parse metadata from <map> attributes
   */
  private parseMetadata(root: any): WorldographerMetadata {
    return {
      type: (root['@_type'] || 'WORLD') as ViewLevel,
      version: root['@_version'] || '1.0',
      schemaVersion: root['@_schemaVersion'] || '1.0',
      width: parseInt(root['@_width']) || 100,
      height: parseInt(root['@_height']) || 80,
      hexWidth: parseFloat(root['@_hexWidth']) || 300,
      hexHeight: parseFloat(root['@_hexHeight']) || 300,
      hexOrientation: (root['@_hexOrientation'] || 'COLUMNS') as any,
      mapProjection: (root['@_mapProjection'] || 'FLAT') as any,
      maskColor: root['@_maskColor'],
    };
  }

  /**
   * Parse tiles from <tiles> section
   *
   * Worldographer stores tiles in row-based format:
   * <tiles>
   *   <row level="WORLD">terrainType\televation\ticy\tgmOnly\tanimals\tbrick\tcrops\tgems\tlumber\tmetals\trock</row>
   * </tiles>
   */
  private parseTiles(root: any): WorldographerTileData[] {
    const tiles: WorldographerTileData[] = [];
    const tilesSection = root.tiles || root.Tiles;

    if (!tilesSection) return tiles;

    // Get rows (can be single object or array)
    const rows = this.ensureArray(tilesSection.row);

    rows.forEach((row: any, rowIndex: number) => {
      if (!row) return;

      const viewLevel = (row['@_level'] || 'WORLD') as ViewLevel;
      const layerId = row['@_layerId'];

      // Parse row text (tab-delimited columns)
      const rowText = row['#text'] || '';
      const columns = rowText.split('\n').filter((line: string) => line.trim());

      columns.forEach((columnData: string, colIndex: number) => {
        const parts = columnData.split('\t');
        if (parts.length < 4) return; // Skip invalid rows

        tiles.push({
          col: colIndex,
          row: rowIndex,
          viewLevel,
          layerId,
          terrainType: parts[0] || 'Ocean',
          elevation: parseInt(parts[1]) || 0,
          icy: parts[2] === 'true',
          gmOnly: parts[3] === 'true',
          resources: {
            animals: parseInt(parts[4]) || 0,
            brick: parseInt(parts[5]) || 0,
            crops: parseInt(parts[6]) || 0,
            gems: parseInt(parts[7]) || 0,
            lumber: parseInt(parts[8]) || 0,
            metals: parseInt(parts[9]) || 0,
            rock: parseInt(parts[10]) || 0,
          },
        });
      });
    });

    return tiles;
  }

  /**
   * Parse features from <features> section
   */
  private parseFeatures(root: any): WorldographerFeatureData[] {
    const features: WorldographerFeatureData[] = [];
    const featuresSection = root.features || root.Features;

    if (!featuresSection?.feature) return features;

    const featureList = this.ensureArray(featuresSection.feature);

    featureList.forEach((f: any) => {
      features.push({
        featureType: f['@_type'] || 'Unknown',
        label: f['@_label'],
        positions: {
          worldX: this.parseFloat(f['@_worldX']),
          worldY: this.parseFloat(f['@_worldY']),
          continentX: this.parseFloat(f['@_continentX']),
          continentY: this.parseFloat(f['@_continentY']),
          kingdomX: this.parseFloat(f['@_kingdomX']),
          kingdomY: this.parseFloat(f['@_kingdomY']),
          provinceX: this.parseFloat(f['@_provinceX']),
          provinceY: this.parseFloat(f['@_provinceY']),
          battlematX: this.parseFloat(f['@_battlematX']),
          battlematY: this.parseFloat(f['@_battlematY']),
          settlementX: this.parseFloat(f['@_settlementX']),
          settlementY: this.parseFloat(f['@_settlementY']),
          cosmicX: this.parseFloat(f['@_cosmicX']),
          cosmicY: this.parseFloat(f['@_cosmicY']),
        },
        rotation: parseFloat(f['@_rotation']) || 0,
        scale: parseFloat(f['@_scale']) || 1.0,
        opacity: parseFloat(f['@_opacity']) || 1.0,
        visibility: {
          visibleWorld: f['@_visibleWorld'] !== 'false',
          visibleContinent: f['@_visibleContinent'] !== 'false',
          visibleKingdom: f['@_visibleKingdom'] !== 'false',
          visibleProvince: f['@_visibleProvince'] !== 'false',
          visibleBattlemat: f['@_visibleBattlemat'] !== 'false',
          visibleSettlement: f['@_visibleSettlement'] !== 'false',
          visibleCosmic: f['@_visibleCosmic'] !== 'false',
        },
        gmOnly: f['@_gmOnly'] === 'true',
      });
    });

    return features;
  }

  /**
   * Parse labels from <labels> section
   */
  private parseLabels(root: any): WorldographerLabelData[] {
    const labels: WorldographerLabelData[] = [];
    const labelsSection = root.labels || root.Labels;

    if (!labelsSection?.label) return labels;

    const labelList = this.ensureArray(labelsSection.label);

    labelList.forEach((l: any) => {
      labels.push({
        text: l['@_text'] || l['#text'] || '',
        positions: {
          worldX: this.parseFloat(l['@_worldX']),
          worldY: this.parseFloat(l['@_worldY']),
          continentX: this.parseFloat(l['@_continentX']),
          continentY: this.parseFloat(l['@_continentY']),
          kingdomX: this.parseFloat(l['@_kingdomX']),
          kingdomY: this.parseFloat(l['@_kingdomY']),
          provinceX: this.parseFloat(l['@_provinceX']),
          provinceY: this.parseFloat(l['@_provinceY']),
          battlematX: this.parseFloat(l['@_battlematX']),
          battlematY: this.parseFloat(l['@_battlematY']),
          settlementX: this.parseFloat(l['@_settlementX']),
          settlementY: this.parseFloat(l['@_settlementY']),
          cosmicX: this.parseFloat(l['@_cosmicX']),
          cosmicY: this.parseFloat(l['@_cosmicY']),
        },
        font: {
          family: l['@_fontFamily'] || 'Arial',
          size: parseInt(l['@_fontSize']) || 12,
          color: l['@_fontColor'] || '#000000',
          bold: l['@_fontBold'] === 'true',
          italic: l['@_fontItalic'] === 'true',
        },
        outline: {
          color: l['@_outlineColor'],
          width: parseFloat(l['@_outlineWidth']) || 0,
        },
        background: {
          color: l['@_backgroundColor'],
          opacity: parseFloat(l['@_backgroundOpacity']) || 0,
        },
        visibility: {
          visibleWorld: l['@_visibleWorld'] !== 'false',
          visibleContinent: l['@_visibleContinent'] !== 'false',
          visibleKingdom: l['@_visibleKingdom'] !== 'false',
          visibleProvince: l['@_visibleProvince'] !== 'false',
          visibleBattlemat: l['@_visibleBattlemat'] !== 'false',
          visibleSettlement: l['@_visibleSettlement'] !== 'false',
          visibleCosmic: l['@_visibleCosmic'] !== 'false',
        },
        gmOnly: l['@_gmOnly'] === 'true',
      });
    });

    return labels;
  }

  /**
   * Parse shapes from <shapes> section
   */
  private parseShapes(root: any): WorldographerShapeData[] {
    const shapes: WorldographerShapeData[] = [];
    const shapesSection = root.shapes || root.Shapes;

    if (!shapesSection?.shape) return shapes;

    const shapeList = this.ensureArray(shapesSection.shape);

    shapeList.forEach((s: any) => {
      // Parse points from string format: "x1,y1;x2,y2;x3,y3"
      const pointsStr = s['@_points'] || '';
      const points = pointsStr
        .split(';')
        .filter((p: string) => p.trim())
        .map((p: string) => {
          const [x, y] = p.split(',').map(parseFloat);
          return { x, y };
        });

      shapes.push({
        name: s['@_name'],
        shapeType: (s['@_type'] || 'POLYGON') as any,
        points,
        viewLevel: (s['@_viewLevel'] || 'WORLD') as ViewLevel,
        stroke: {
          color: s['@_strokeColor'] || '#000000',
          width: parseFloat(s['@_strokeWidth']) || 1,
          style: (s['@_strokeStyle'] || 'SOLID') as any,
        },
        fill: {
          color: s['@_fillColor'],
          opacity: parseFloat(s['@_fillOpacity']) || 0,
          texture: s['@_fillTexture'],
        },
        shadow: {
          enabled: s['@_shadowEnabled'] === 'true',
          color: s['@_shadowColor'] || '#000000',
          blur: parseFloat(s['@_shadowBlur']) || 0,
          offsetX: parseFloat(s['@_shadowOffsetX']) || 0,
          offsetY: parseFloat(s['@_shadowOffsetY']) || 0,
        },
        gmOnly: s['@_gmOnly'] === 'true',
      });
    });

    return shapes;
  }

  /**
   * Parse notes from <information> section
   */
  private parseNotes(root: any): WorldographerNoteData[] {
    const notes: WorldographerNoteData[] = [];
    const infoSection = root.information || root.Information;

    if (!infoSection?.note) return notes;

    const noteList = this.ensureArray(infoSection.note);

    noteList.forEach((n: any) => {
      const content = n['__cdata'] || n['#text'] || '';

      notes.push({
        uuid: n['@_uuid'] || crypto.randomUUID(),
        title: n['@_title'] || 'Untitled Note',
        category: n['@_category'] as any,
        content,
        position: n['@_viewLevel']
          ? {
              viewLevel: n['@_viewLevel'] as ViewLevel,
              x: parseFloat(n['@_x']) || 0,
              y: parseFloat(n['@_y']) || 0,
            }
          : undefined,
        gmOnly: n['@_gmOnly'] !== 'false', // Notes are GM-only by default
      });
    });

    return notes;
  }

  /**
   * Parse layers from <layers> section
   */
  private parseLayers(root: any): WorldographerLayerData[] {
    const layers: WorldographerLayerData[] = [];
    const layersSection = root.layers || root.Layers;

    if (!layersSection?.layer) return layers;

    const layerList = this.ensureArray(layersSection.layer);

    layerList.forEach((l: any) => {
      layers.push({
        name: l['@_name'] || 'Unnamed Layer',
        visible: l['@_visible'] !== 'false',
        locked: l['@_locked'] === 'true',
        opacity: parseFloat(l['@_opacity']) || 1.0,
        order: parseInt(l['@_order']) || 0,
      });
    });

    return layers;
  }

  /**
   * Parse terrain definitions from <terrainDefs> section
   */
  private parseTerrainDefs(root: any): WorldographerTerrainDefData[] {
    const terrainDefs: WorldographerTerrainDefData[] = [];
    const terrainDefsSection = root.terrainDefs || root.TerrainDefs;

    if (!terrainDefsSection?.terrain) return terrainDefs;

    const terrainList = this.ensureArray(terrainDefsSection.terrain);

    terrainList.forEach((t: any) => {
      terrainDefs.push({
        name: t['@_name'] || 'Unknown',
        displayName: t['@_displayName'] || t['@_name'] || 'Unknown',
        color: t['@_color'] || '#FFFFFF',
        texture: t['@_texture'],
        movementCost: parseInt(t['@_movementCost']) || 1,
        defenseBonus: parseInt(t['@_defenseBonus']) || 0,
        description: t['@_description'],
      });
    });

    return terrainDefs;
  }

  /**
   * Utility: Ensure value is an array (handles single objects)
   */
  private ensureArray<T>(value: T | T[] | undefined): T[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  /**
   * Utility: Parse float with undefined support
   */
  private parseFloat(value: any): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  }
}
