/**
 * Map manipulation utilities
 * Advanced operations for modifying Worldographer maps
 */

import {
  WorldographerFile,
  WorldographerTileData,
  WorldographerFeatureData,
  ViewLevel,
  Point,
  Rectangle,
  HexCoordinate,
} from './types';

export class MapManipulator {
  /**
   * Fill a rectangular region with terrain
   */
  fillRect(
    map: WorldographerFile,
    rect: Rectangle,
    terrainType: string,
    viewLevel: ViewLevel = 'WORLD'
  ): void {
    for (let row = rect.y; row < rect.y + rect.height; row++) {
      for (let col = rect.x; col < rect.x + rect.width; col++) {
        this.setTile(map, col, row, terrainType, viewLevel);
      }
    }
  }

  /**
   * Fill a circular region with terrain
   */
  fillCircle(
    map: WorldographerFile,
    centerX: number,
    centerY: number,
    radius: number,
    terrainType: string,
    viewLevel: ViewLevel = 'WORLD'
  ): void {
    const radiusSq = radius * radius;

    for (let row = Math.floor(centerY - radius); row <= Math.ceil(centerY + radius); row++) {
      for (let col = Math.floor(centerX - radius); col <= Math.ceil(centerX + radius); col++) {
        const dx = col - centerX;
        const dy = row - centerY;

        if (dx * dx + dy * dy <= radiusSq) {
          this.setTile(map, col, row, terrainType, viewLevel);
        }
      }
    }
  }

  /**
   * Paint a line of terrain
   */
  paintLine(
    map: WorldographerFile,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    terrainType: string,
    width: number = 1,
    viewLevel: ViewLevel = 'WORLD'
  ): void {
    const points = this.bresenhamLine(x1, y1, x2, y2);

    points.forEach((p) => {
      if (width === 1) {
        this.setTile(map, p.x, p.y, terrainType, viewLevel);
      } else {
        this.fillCircle(map, p.x, p.y, width / 2, terrainType, viewLevel);
      }
    });
  }

  /**
   * Flood fill terrain (like paint bucket)
   */
  floodFill(
    map: WorldographerFile,
    startX: number,
    startY: number,
    newTerrain: string,
    viewLevel: ViewLevel = 'WORLD'
  ): void {
    const startTile = this.getTile(map, startX, startY, viewLevel);
    if (!startTile || startTile.terrainType === newTerrain) return;

    const oldTerrain = startTile.terrainType;
    const visited = new Set<string>();
    const queue: Point[] = [{ x: startX, y: startY }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.x},${current.y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      const tile = this.getTile(map, current.x, current.y, viewLevel);
      if (!tile || tile.terrainType !== oldTerrain) continue;

      // Set new terrain
      this.setTile(map, current.x, current.y, newTerrain, viewLevel);

      // Add neighbors
      const neighbors = this.getNeighbors(current.x, current.y, map.metadata);
      queue.push(...neighbors);
    }
  }

  /**
   * Clone a region of the map
   */
  cloneRegion(
    map: WorldographerFile,
    sourceRect: Rectangle,
    destX: number,
    destY: number,
    viewLevel: ViewLevel = 'WORLD'
  ): void {
    const sourceTiles = this.getTilesInRect(map, sourceRect, viewLevel);

    sourceTiles.forEach((tile) => {
      const offsetX = tile.col - sourceRect.x;
      const offsetY = tile.row - sourceRect.y;

      const newCol = destX + offsetX;
      const newRow = destY + offsetY;

      // Clone tile
      const newTile: WorldographerTileData = {
        ...tile,
        col: newCol,
        row: newRow,
      };

      this.replaceTile(map, newTile);
    });
  }

  /**
   * Mirror a region horizontally or vertically
   */
  mirrorRegion(
    map: WorldographerFile,
    rect: Rectangle,
    direction: 'horizontal' | 'vertical',
    viewLevel: ViewLevel = 'WORLD'
  ): void {
    const tiles = this.getTilesInRect(map, rect, viewLevel);

    tiles.forEach((tile) => {
      let newCol = tile.col;
      let newRow = tile.row;

      if (direction === 'horizontal') {
        newCol = rect.x + (rect.x + rect.width - 1 - tile.col);
      } else {
        newRow = rect.y + (rect.y + rect.height - 1 - tile.row);
      }

      const mirrorTile: WorldographerTileData = {
        ...tile,
        col: newCol,
        row: newRow,
      };

      this.replaceTile(map, mirrorTile);
    });
  }

  /**
   * Rotate a region 90 degrees clockwise
   */
  rotateRegion(
    map: WorldographerFile,
    rect: Rectangle,
    viewLevel: ViewLevel = 'WORLD'
  ): void {
    const tiles = this.getTilesInRect(map, rect, viewLevel);
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;

    tiles.forEach((tile) => {
      // Translate to origin
      const x = tile.col - centerX;
      const y = tile.row - centerY;

      // Rotate 90 degrees clockwise
      const newX = -y;
      const newY = x;

      // Translate back
      const newCol = Math.round(newX + centerX);
      const newRow = Math.round(newY + centerY);

      const rotatedTile: WorldographerTileData = {
        ...tile,
        col: newCol,
        row: newRow,
      };

      this.replaceTile(map, rotatedTile);
    });
  }

  /**
   * Generate noise-based terrain
   */
  generateNoiseTerrain(
    map: WorldographerFile,
    rect: Rectangle,
    terrainMap: Array<{ threshold: number; terrain: string }>,
    viewLevel: ViewLevel = 'WORLD',
    seed: number = Date.now()
  ): void {
    // Simple noise function (can be replaced with Perlin/Simplex noise)
    const noise = (x: number, y: number): number => {
      const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
      return n - Math.floor(n);
    };

    for (let row = rect.y; row < rect.y + rect.height; row++) {
      for (let col = rect.x; col < rect.x + rect.width; col++) {
        const value = noise(col / 10, row / 10);

        // Find terrain type based on threshold
        let terrainType = terrainMap[0].terrain;
        for (const { threshold, terrain } of terrainMap) {
          if (value >= threshold) {
            terrainType = terrain;
          }
        }

        this.setTile(map, col, row, terrainType, viewLevel);
      }
    }
  }

  /**
   * Find all tiles of a specific terrain type
   */
  findTilesByTerrain(
    map: WorldographerFile,
    terrainType: string,
    viewLevel: ViewLevel = 'WORLD'
  ): WorldographerTileData[] {
    return map.tiles.filter(
      (t) => t.viewLevel === viewLevel && t.terrainType === terrainType
    );
  }

  /**
   * Replace all occurrences of terrain type
   */
  replaceTerrain(
    map: WorldographerFile,
    oldTerrain: string,
    newTerrain: string,
    viewLevel: ViewLevel = 'WORLD'
  ): number {
    let count = 0;

    map.tiles.forEach((tile) => {
      if (tile.viewLevel === viewLevel && tile.terrainType === oldTerrain) {
        tile.terrainType = newTerrain;
        count++;
      }
    });

    return count;
  }

  /**
   * Remove all features of a specific type
   */
  removeFeaturesByType(map: WorldographerFile, featureType: string): number {
    const initialLength = map.features.length;
    map.features = map.features.filter((f) => f.featureType !== featureType);
    return initialLength - map.features.length;
  }

  /**
   * Find features near a point
   */
  findFeaturesNear(
    map: WorldographerFile,
    x: number,
    y: number,
    radius: number,
    viewLevel: ViewLevel = 'WORLD'
  ): WorldographerFeatureData[] {
    const posKeyX = `${viewLevel.toLowerCase()}X`;
    const posKeyY = `${viewLevel.toLowerCase()}Y`;

    return map.features.filter((f) => {
      const fx = (f.positions as any)[posKeyX];
      const fy = (f.positions as any)[posKeyY];

      if (fx === undefined || fy === undefined) return false;

      const dx = fx - x;
      const dy = fy - y;

      return Math.sqrt(dx * dx + dy * dy) <= radius;
    });
  }

  /**
   * Get map statistics
   */
  getStatistics(map: WorldographerFile, viewLevel: ViewLevel = 'WORLD'): {
    tiles: { [terrain: string]: number };
    features: { [type: string]: number };
    totalTiles: number;
    totalFeatures: number;
  } {
    const tiles: { [terrain: string]: number } = {};
    const features: { [type: string]: number } = {};

    // Count tiles
    map.tiles.forEach((t) => {
      if (t.viewLevel === viewLevel) {
        tiles[t.terrainType] = (tiles[t.terrainType] || 0) + 1;
      }
    });

    // Count features
    map.features.forEach((f) => {
      features[f.featureType] = (features[f.featureType] || 0) + 1;
    });

    return {
      tiles,
      features,
      totalTiles: Object.values(tiles).reduce((sum, count) => sum + count, 0),
      totalFeatures: Object.values(features).reduce((sum, count) => sum + count, 0),
    };
  }

  // ============================================================================
  // Private utility methods
  // ============================================================================

  private setTile(
    map: WorldographerFile,
    col: number,
    row: number,
    terrainType: string,
    viewLevel: ViewLevel
  ): void {
    const existingIndex = map.tiles.findIndex(
      (t) => t.col === col && t.row === row && t.viewLevel === viewLevel
    );

    if (existingIndex !== -1) {
      map.tiles[existingIndex].terrainType = terrainType;
    } else {
      map.tiles.push({
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
      });
    }
  }

  private getTile(
    map: WorldographerFile,
    col: number,
    row: number,
    viewLevel: ViewLevel
  ): WorldographerTileData | undefined {
    return map.tiles.find((t) => t.col === col && t.row === row && t.viewLevel === viewLevel);
  }

  private replaceTile(map: WorldographerFile, tile: WorldographerTileData): void {
    const index = map.tiles.findIndex(
      (t) => t.col === tile.col && t.row === tile.row && t.viewLevel === tile.viewLevel
    );

    if (index !== -1) {
      map.tiles[index] = tile;
    } else {
      map.tiles.push(tile);
    }
  }

  private getTilesInRect(
    map: WorldographerFile,
    rect: Rectangle,
    viewLevel: ViewLevel
  ): WorldographerTileData[] {
    return map.tiles.filter(
      (t) =>
        t.viewLevel === viewLevel &&
        t.col >= rect.x &&
        t.col < rect.x + rect.width &&
        t.row >= rect.y &&
        t.row < rect.y + rect.height
    );
  }

  private getNeighbors(x: number, y: number, metadata: any): Point[] {
    // Return 4 cardinal neighbors (N, S, E, W)
    return [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ];
  }

  /**
   * Bresenham's line algorithm
   */
  private bresenhamLine(x0: number, y0: number, x1: number, y1: number): Point[] {
    const points: Point[] = [];

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;

    let err = dx - dy;
    let x = x0;
    let y = y0;

    while (true) {
      points.push({ x, y });

      if (x === x1 && y === y1) break;

      const e2 = 2 * err;

      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }

      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return points;
  }
}
