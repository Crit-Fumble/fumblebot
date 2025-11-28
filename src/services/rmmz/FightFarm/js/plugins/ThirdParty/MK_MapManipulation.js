/*:
 * @target MZ
 * @author Aerosys
 * @plugindesc [Tier 1] [Version 1.0.1] [MV & MZ]
 * 
 * 
 * @help
 * 
 * ----------------------------------------------------------------------------
 * Rules
 * ----------------------------------------------------------------------------
 * 
 * 1. This is a trial version that is freely available to try it out.
 *    Add "MK_MapManipulation_Unlocker" to unlock the full version.
 * 
 * 2. You may not redistribute this Plugin or claim it as your own.
 *    
 *    a) Exception: You may redistribute this plugin as part of your game when
 *       releasing it.
 *    b) Exception: You may send this plugin to another person when you hire
 *       them for personal modifications.
 * 
 * 3. You may modify this plugin's source code for your needs but cannot
 *    redistribute your modifications.
 * 
 * 4. You may create plugins based on this (e.g. addon or extension) for your
 *    needs but you cannot redistribute them.
 * 
 * 5. When multiple people work on the project, purchasing a license for every
 *    team member is not required.
 * 
 * 
 * NEED SUPPORT?
 * Contact me: mail<at>aerosys.blog
 * 
 * 
 * @endofhelp
 * 
 * 
 * @command modifyMap
 * @text Modify Map
 * 
 * @arg sourceMapName
 * @text Source Map Name
 * @default REQUIRED
 * 
 * @arg regionId
 * @text Region ID
 * @default 1
 * 
 * @arg destination
 * @text Destination
 * 
 * @arg xTarget
 * @parent destination
 * @text X
 * @type variable
 * 
 * @arg yTarget
 * @parent destination
 * @text Y
 * @type variable
 * 
 * 
 * @command restoreMap
 * @text Restore Map
 * 
 * @arg x
 * @type variable
 * 
 * @arg y
 * @type variable
 * 
 * @arg width
 * @text Width
 * @type variable
 * @desc When not given, "1" is used
 * 
 * @arg height
 * @text Height
 * @type variable
 * @desc when not given, "1" is used
 * 
 * 
 * @command restoreEntireMap
 * @text Restore entire Map
 * 
 * 
 * @command checkAreaMatches
 * @text Area match?
 * 
 * @arg area
 * @text Area
 * 
 * @arg x
 * @parent area
 * @type variable
 * 
 * @arg y
 * @parent area
 * @type variable
 * 
 * @arg looksLike
 * @text looks like...
 * 
 * @arg sourceMapName
 * @parent looksLike
 * @text Source Map Name
 * @default REQUIRED
 * 
 * @arg regionId
 * @parent looksLike
 * @text Region ID
 * @type number
 * @default 1
 * 
 * @arg switchId
 * @text Result Switch
 * @type switch
 * @default 1
 * 
 */


var MK = MK || { };
MK.MapManipulation = { };

(function() {


const PLUGIN_NAME = 'MK_TerrainManipulation';

const times = (a, b) => {
    const l = typeof b !== 'undefined' ? a : 0;
    const r = typeof b !== 'undefined' ? b : a;
    const list = [ ];
    for (let i = l; i < r; i++) { list.push(i) }
    return list;
}
const checkEvery        = (x, y, w, h, f) => times(x, x + w).every(x1 => times(y, y + h).every(y1 => f(x1, y1)));
const getIndex          = (x, y, z, width, height) => (z * height + y) * width + x;
const getTile           = (dataMap, x, y, z) => dataMap.data[getIndex(x, y, z, dataMap.width, dataMap.height)];
const getTileStack      = (dataMap, x, y) => times(6).map(z => getTile(dataMap, x, y, z));
const putTile           = (dataMap, x, y, z, tile) => dataMap.data[getIndex(x, y, z, dataMap.width, dataMap.height)] = tile;
const getRegion         = (dataMap, x, y) => getTile(dataMap, x, y, 5);
const isTileStackEmpty  = (dataMap, x, y) => getTileStack(dataMap, x, y).every(tileId => tileId == 0);
const isAreaEmpty       = (dataMap, x, y, w, h) => checkEvery(x, y, w, h, (x, y) => isTileStackEmpty(dataMap, x, y));

const _files            = { };
const sourceMaps        = { };
const sourceMapInfos    = { };


MK.MapManipulation.getSourceMap = function(sourceMapName) {
    const mapName = sourceMapName.replace('$', '').replace('!', '').trim().toLowerCase();
    return sourceMaps[mapName];
}


function shouldLoadThisMap (info, mapId) {
    return info.name.startsWith('$') || (info.name.startsWith('!') && info.parentId == mapId);
}

const alias_SceneMap_create = Scene_Map.prototype.create;
Scene_Map.prototype.create = function() {
    alias_SceneMap_create.call(this);

    const mapId = $gamePlayer.isTransferring()
        ? $gamePlayer.newMapId()
        : $gameMap.mapId();
    
    $dataMapInfos
        .filter(info => info && shouldLoadThisMap(info, mapId))
        .forEach(info => loadSourceMap(info.id, info.name));
}

function loadSourceMap(mapId, mapName) {
    const trimmedMapName    = mapName.replace('$', '').replace('!', '').trim().toLowerCase();
    const source            = 'Map%1'.format(mapId.padZero(3));
    const url               = 'data/Map%1.json'.format(mapId.padZero(3));

    sourceMaps[trimmedMapName] = null;

    loadFile(mapName, source, url, data => {
        sourceMaps[trimmedMapName] = data;
        readSourceMap(data, trimmedMapName);
    });
}

function loadFile(name, source, url, onLoad) {
    _files[url]
        ? onLoad(_files[url])
        : loadFileXhr(name, source, url, data => onLoad(_files[url] = data));
}

function loadFileXhr(name, source, url, onLoad) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.overrideMimeType('application/json');
    xhr.onload = () => onLoad(JSON.parse(xhr.responseText));
    xhr.onerror = () => DataManager.onXhrError(name, source, url);
    xhr.send();
}

function readSourceMap(dataMap, mapName) {
    sourceMapInfos[mapName] = { };
    const firstColumn = times(dataMap.height).map(y => getRegion(dataMap, 0, y));
    
    times(1, 256)
        .filter(regionId => firstColumn.includes(regionId))
        .map(regionId => {
            const y         = firstColumn.indexOf(regionId);
            const width     = times(dataMap.width).findIndex(i => getRegion(dataMap, i, y) == 0);
            const height    = times(dataMap.height).findIndex(i => getRegion(dataMap, 0, i + y) != regionId);
            const iBlank    = times(2, dataMap.width / width).find(i => isAreaEmpty(
                dataMap,
                i * width,
                y,
                width,
                height,
            ));
            const xMatcher  = width;
            const yMatcher  = y;
            const nMatcher  = iBlank - 1;
            const x         = (iBlank + 1) * width;
            const n         = 1;

            return { sourceMapName: mapName, regionId, x, y, width, height, n, xMatcher, yMatcher, nMatcher };
        })
        .filter(info => info && info.regionId > 0 && info.x >= 0 && info.y >= 0 && info.width > 0 && info.height > 0)
        .forEach(info => sourceMapInfos[mapName][info.regionId] = info);
}

const alias_SceneMap_start = Scene_Map.prototype.start;
Scene_Map.prototype.start = function() {
    alias_SceneMap_start.call(this);

    $gameMap._originalMapData = {
        width: $dataMap.width,
        height: $dataMap.height,
        data: $dataMap.data.slice(),
    };

    Object
        .entries($gameMap.getModifications())
        .filter(([_, tile]) => tile !== undefined)
        .forEach(([index, tile]) => $dataMap.data[index] = tile);
}


function fixAutotile(dataMap, x, y, z) {
    const fixedAutoTile = getFixedAutotile(dataMap, x, y, z);
    putTile(dataMap, x, y, z, fixedAutoTile);
}

function getFixedAutotile(dataMap, x, y, z) {
    const standardTable     = [[-1, 0], [0, -1], [1, 0], [0, 1]];
    const waterfallTable    = [[-1, 0], [1, 0]];
    const wallTable         = [[-1, 0], [0, -1], [1, 0], [0, 1]];
    const currentTile       = getTile(dataMap, x, y, z);

    if (![0, 1, 2, 3].includes(z)) {
        return currentTile;
    }

    const determineBottom = (x, y) => {
        const currentTile = getTile(dataMap, x, y, z);
        for (let y1 = y; y1 < dataMap.height; y1++) {
            if (!Tilemap.isSameKindTile(currentTile, getTile(dataMap, x, y1, z))) {
                return y1;
            }
        }
        return dataMap.height - 1;
    }

    const isSame = (dx, dy) => {
        const x2 = $gameMap.roundX(x + dx);
        const y2 = $gameMap.roundY(y + dy);
        const otherTile = getTile(dataMap, x2, y2, z);

        if (!$gameMap.isValid(x2, y2)) return false;

        if ((Tilemap.isTileA3(currentTile) || Tilemap.isWallSideTile(currentTile)) &&
            Tilemap.isSameKindTile(currentTile, otherTile) &&
            determineBottom(x, y) > determineBottom(x + dx, y)
        ) {
            return false;
        }

        return (
            Tilemap.isSameKindTile(currentTile, otherTile) ||
            Tilemap.isWaterfallTile(currentTile) && Tilemap.isWaterfallTile(otherTile) ||
            (dy != 0 && Tilemap.isWaterfallTile(currentTile) && Tilemap.isWaterTile(otherTile)) ||
            (dy != 0 && Tilemap.isWaterTile(currentTile) && Tilemap.isWaterfallTile(otherTile)) ||
            (dy == 0 && dx != 0 && Tilemap.isWallSideTile(currentTile) && 
                (Tilemap.isWallTopTile(otherTile) || Tilemap.isWaterfallTile(otherTile))
            ) ||
            (dy >= 0 &&
                (Tilemap.isTileA3(currentTile) || Tilemap.isWallSideTile(currentTile)) &&
                Tilemap.isShadowingTile(otherTile)
            ) ||
            (dy == 0 && Tilemap.isWallSideTile(currentTile) && (Tilemap.isRoofTile(otherTile) || Tilemap.isWallTopTile(otherTile)))
        );
    }
    
    const getStandardAutotile = () => {
        const baseIdentifier = standardTable
            .map(([dx, dy]) => isSame(dx, dy))
            .reduce((previous, current, index) => (current ? 0 : 1) * (2 ** index) + previous, 0);
        
        const base = [
            0,      // 0
            16,     // 0001 1
            20,     // 0010 2
            34,     // 0011 3
            24,     // 0100 4
            32,     // 0101 5
            36,     // 0110 6
            42,     // 0111 7
            28,     // 1000 8
            40,     // 1001 9
            33,     // 1010 10
            43,     // 1011 11
            38,     // 1100 12
            44,     // 1101 13
            45,     // 1110 14
            46,     // 1111 15
        ][baseIdentifier];

        const smallNumber = [
                [ [-1, -1], [1, -1], [1, 1], [-1, 1] ],
                [ [1, -1], [1, 1] ],
                [ [1, 1], [-1, 1] ],
                [ [1, 1] ],
                [ [-1, 1], [-1, -1] ],
                [ ],
                [ [-1, 1] ],
                [ ],
                [ [-1, -1], [1, -1] ],
                [ [1, -1] ],
                [ ],
                [ ],
                [ [-1, -1] ],
                [ ],
                [ ],
                [ ],
            ][baseIdentifier]
            .map(([dx, dy]) => isSame(dx, dy))
            .reduce((previous, current, index) => (current ? 0 : 1) * (2 ** index) + previous, 0);
        
        return currentTile - Tilemap.getAutotileShape(currentTile) + base + smallNumber;
    }

    const getAutotile = (array) => {
        const baseIdentifier = array
            .map(([dx, dy]) => isSame(dx, dy))
            .reduce((previous, current, index) => (current ? 0 : 1) * (2 ** index) + previous, 0);
        return currentTile - Tilemap.getAutotileShape(currentTile) + baseIdentifier;
    }
    
    if (Tilemap.isWaterfallTile(currentTile)) {
        return getAutotile(waterfallTable);
    }
    if (Tilemap.isTileA3(currentTile) || Tilemap.isWallSideTile(currentTile)) {
        return getAutotile(wallTable);
    }
    if (Tilemap.isAutotile(currentTile)) {
        return getStandardAutotile();
    }
    return currentTile;
}


// =====================================================================================
// Game Map
// =====================================================================================

Game_Map.prototype.checkAreaMatches = function(x, y, mapName, regionId) {
    mapName = mapName.replace('$', '').replace('!', '').trim().toLowerCase();
    const sourceMap = sourceMaps[mapName];
    const info = MK.MapManipulation.getAssetInfo(mapName, regionId);
    
    if (!sourceMap || !info) return false;

    const isAnyEventHere = this.events().find(event =>
        x <= event.x &&
        event.x < x + info.width &&
        y <= event.y &&
        event.y < y + info.height
    )
    if (isAnyEventHere) return false;

    return checkEvery(0, 0, info.width, info.height, (x1, y1) => times(info.nMatcher).some(i => {
        const x2 = this.roundX(x + x1);
        const y2 = this.roundY(y + y1);

        if (!this.isValid(x2, y2)) return false;
        
        const stack1 = getTileStack($dataMap, x2, y2);
        const stack2 = getTileStack(sourceMap, i * info.width + info.xMatcher, y1 + info.yMatcher);

        return (
            stack2.every(tile => tile == 0) || (
                Tilemap.isSameKindTile(stack1[0], stack2[0]) &&
                Tilemap.isSameKindTile(stack1[1], stack2[1]) &&
                Tilemap.isSameKindTile(stack1[2], stack2[2]) &&
                Tilemap.isSameKindTile(stack1[3], stack2[3]) &&
                stack1[5] == stack2[5]
            )
        );
    }));
}

Game_Map.prototype.modifyByRegionId = function(mapName, regionId, xTarget, yTarget, layers) {
    mapName = mapName.replace('$', '').replace('!', '').trim().toLowerCase();
    const info = MK.MapManipulation.getAssetInfo(mapName, regionId);

    if (info) {
        this.modifyByRectangle(xTarget, yTarget, mapName, info.width, info.height, info.x, info.y, layers);
    }
}

Game_Map.prototype.modifyByRectangle = function(xTarget, yTarget, sourceMapName, width, height, xSource, ySource, layers) {
    xSource = xSource || 0;
    ySource = ySource || 0;
    layers  = layers || [0, 1, 2, 3, 4, 5];
    const sourceMap = sourceMaps[sourceMapName.replace('$', '').replace('!', '').trim().toLowerCase()];

    if (!sourceMap) {
        throw Error('Map "%1" does not exist'.format(sourceMapName));
    }
    
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            const x2 = this.roundX(x + xTarget);
            const y2 = this.roundY(y + yTarget);

            if (!this.isValid(x2, y2)) continue;

            for (let z of layers) {
                const tile = getTile(sourceMap, x + xSource, y + ySource, z);
                const tile1 = getTile(sourceMap, x + xSource, y + ySource, 0);
                const tile2 = getTile(sourceMap, x + xSource, y + ySource, 1);
                
                if (tile || tile1 || tile2) {
                    putTile($dataMap, x2, y2, z, tile);
                    this.saveModifiedTile(x2, y2, z, tile);
                }
            }
        }
    }
    this.fixAutotiles(xTarget - 1, yTarget - 1, width + 2, height + 2);
    this.fixShadows(xTarget - 1, yTarget - 1, width + 2, height + 2);
    $gameMap.mk_requestMapDataRefresh();
}

Game_Map.prototype.restoreByRectangle = function(x, y, width, height) {
    for (let x1 = 0; x1 < width; x1++) {
        for (let y1 = 0; y1 < height; y1++) {
            const x2 = this.roundX(x + x1);
            const y2 = this.roundY(y + y1);

            if (!this.isValid(x2, y2)) continue;

            for (let z = 0; z < 6; z++) {
                const tile = this.getOriginalTile(x2, y2, z);

                if (tile != getTile($dataMap, x2, y2, z)) {
                    putTile($dataMap, x2, y2, z, tile);
                    this.removeModifiedTile(x2, y2, z);
                }
            }
        }
    }
    this.fixAutotiles(x - 1, y - 1, width + 2, height + 2);
    this.fixShadows(x - 1, y - 1, width + 2, height + 2);
    this.mk_requestMapDataRefresh();
}

Game_Map.prototype.restoreEntireMap = function() {
    for (let x = 0; x < this.width(); x++) {
        for (let y = 0; y < this.height(); y++) {
            for (let z = 0; z < 6; z++) {
                const tile = this.getOriginalTile(x, y, z);
                putTile($dataMap, x, y, z, tile);
                this.removeModifiedTile(x, y, z);
            }
        }
    }
    this.mk_requestMapDataRefresh();
}

Game_Map.prototype.getOriginalTile = function(x, y, z) {
    return getTile(this._originalMapData, x, y, z);
}

Game_Map.prototype.fixAutotiles = function(xTarget, yTarget, width, height) {
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            for (let z = 0; z < 4; z++) {
                const x2 = this.roundX(x + xTarget);
                const y2 = this.roundY(y + yTarget);

                if (!this.isValid(x2, y2)) continue;

                const currentTile = getTile($dataMap, x2, y2, z);
                const originalTile = getTile(this._originalMapData, x2, y2, z);
                fixAutotile($dataMap, x2, y2, z);
                const fixedAutoTile = getTile($dataMap, x2, y2, z);

                if (originalTile == fixedAutoTile) {
                    this.removeModifiedTile(x2, y2, z);
                }
                else if (currentTile != fixedAutoTile) {
                    this.saveModifiedTile(x2, y2, z, fixedAutoTile);
                }
            }
        }
    }
}

Game_Map.prototype.fixShadows = function(xTarget, yTarget, width, height) {
    xTarget = xTarget || 0;
    yTarget = yTarget || 0;
    width   = width || this.width();
    height  = height || this.height();
    
    const isShadowingTile = (x, y) => this.isValid(x, y) &&
        times(4).some(z => Tilemap.isShadowingTile(getTile($dataMap, x, y, z)));
    
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            const x2 = this.roundX(x + xTarget);
            const y2 = this.roundY(y + yTarget);

            if (!this.isValid(x2, y2)) continue;

            const b = (
                this.isValid(x2 - 1, y2) &&
                this.isValid(x2 - 1, y2 - 1) &&
                !isShadowingTile(x2, y2) &&
                isShadowingTile(x2 - 1, y2) &&
                isShadowingTile(x2 - 1, y2 - 1)
            );
            putTile($dataMap, x2, y2, 4, b ? 5 : 0);
            this.saveModifiedTile(x2, y2, 4, b ? 5 : 0);
        }
    }
    this.mk_requestMapDataRefresh();
}

Game_Map.prototype.getModifications = function() {
    return { };
}

Game_Map.prototype.saveModifiedTile = function(x, y, z, tile) {
    //
}

Game_Map.prototype.removeModifiedTile = function(x, y, z) {
    //
}


// test only
Game_Map.prototype.fixAllAutotiles = function() {
    for (let x = 0; x < this.width(); x++) {
        for (let y = 0; y < this.height(); y++) {
            for (let z = 0; z < 4; z++) {
                fixAutotile($dataMap, x, y, z);
            }
        }
    }
}

Game_Map.prototype.mk_requestMapDataRefresh = function() {
    this._mk_requestMapDataRefresh = true;
}

const alias_SpritesetMap_updateTilemap = Spriteset_Map.prototype.updateTilemap;
Spriteset_Map.prototype.updateTilemap = function() {
    alias_SpritesetMap_updateTilemap.call(this);

    if ($gameMap._mk_requestMapDataRefresh) {
        this._tilemap.setData($gameMap.width(), $gameMap.height(), $gameMap.data());
        this._tilemap.refresh();

        $gameMap._mk_requestMapDataRefresh = false;
    }
}


// =====================================================================================
// MK
// =====================================================================================

MK.MapManipulation.getAssetInfo = function(mapName, regionId) {
    const map = sourceMapInfos[mapName.replace('$', '').replace('!', '').trim().toLowerCase()];
    return map && map[regionId];
}

MK.MapManipulation.getRegionIds = function(mapName) {
    const map = sourceMapInfos[mapName.replace('$', '').replace('!', '').trim().toLowerCase()];
    return map ? Objects.values(map).filter(Boolean) : [ ];
}


if (PluginManager.registerCommand) {

    PluginManager.registerCommand(PLUGIN_NAME, 'modifyMap', args => {
        $gameMap.modifyByRegionId(
            args.sourceMapName,
            Number(args.regionId),
            $gameVariables.value(Number(args.xTarget)),
            $gameVariables.value(Number(args.yTarget)),
        );
    });

    PluginManager.registerCommand(PLUGIN_NAME, 'restoreMap', args => {
        $gameMap.restoreByRectangle(
            $gameVariables.value(Number(args.x)),
            $gameVariables.value(Number(args.y)),
            $gameVariables.value(Number(args.width)),
            $gameVariables.value(Number(args.height)),
        );
    });

    PluginManager.registerCommand(PLUGIN_NAME, 'restoreEntireMap', () => {
        $gameMap.restoreEntireMap();
    });

    PluginManager.registerCommand(PLUGIN_NAME, 'checkAreaMatches', args => {
        const b = $gameMap.checkAreaMatches(
            $gameVariables.value(Number(args.x)),
            $gameVariables.value(Number(args.y)),
            args.sourceMapName,
            Number(args.regionId),
        );
        $gameSwitches.setValue(Number(args.switchId), b);
    });
}


})();