/*:
 * @target MZ
 * @author Aerosys
 * @plugindesc [Tier 1] [Version 1.3.5] [MV & MZ]
 * 
 * @help
 * 
 * ----------------------------------------------------------------------------
 * Rules
 * ----------------------------------------------------------------------------
 * 
 * 1. This Plugin is free of charge and can be used in any kind of game.
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
 * 
 * NEED SUPPORT?
 * Contact me: mail<at>aerosys.blog
 * 
 * ----------------------------------------------------------------------------
 * Notetags
 * ----------------------------------------------------------------------------
 * 
 * - the following Notetags can be applied on Maps
 * 
 * <Minimap>
 * - shows the Minimap on this Map
 * 
 * <No Minimap>
 * - hides the Minimap on this Map
 * 
 * 
 * @command changeVisibility
 * @text Change Visibility
 * @desc "Hide" forcefully hides the Minimap. "Show" depends on the player's Options. Remains until the next Map Transfer.
 * 
 * @arg mode
 * @text Mode
 * @type select
 * @option Show
 * @option Hide
 * @option Toggle
 * @default Show
 * 
 * 
 * @command changeVisibilityOption
 * @text Change Visibility in the Options Menu
 * @desc Changes the player's setting in the Options Menu. Works both with and without Visustella Options Core.
 * 
 * @arg mode
 * @text Mode
 * @type select
 * @option Show
 * @option Hide
 * @option Toggle
 * @default Toggle
 * 
 * 
 * @command forceShow
 * @text Force Show
 * @desc Shows the Minimap regardless of player's setting in the Options Menu. Useful for cutscenes.
 * 
 * @arg mode
 * @text Mode
 * @type boolean
 * @default true
 * 
 * 
 * @param common
 * @text Common
 * 
 * @param isVisible
 * @parent common
 * @text Visible by default?
 * @type boolean
 * @default true
 * @desc You can situationally override through Notetags/Plugin Commands. "Show" depends on player's choice in Options.
 * 
 * @param map
 * @parent common
 * @text Map Position & Appearance
 * @type struct<Map>
 * @default {"position":"top right","xEval":"\"const position = arguments[0];\\nconst width = arguments[1];\\n\\nreturn position == 'top left' || position == 'bottom left'\\n    ? (Graphics.width - Graphics.boxWidth) / 2\\n    : Graphics.width - ((Graphics.width - Graphics.boxWidth) / 2) - width\"","yEval":"\"const position = arguments[0];\\nconst height = arguments[1];\\n\\nlet result = position == 'top left' || position == 'top right'\\n    ? (Graphics.height - Graphics.boxHeight) / 2\\n    : Graphics.boxHeight + ((Graphics.height - Graphics.boxHeight) / 2) - height;\\n\\nif (position == 'top right' && this.buttonAreaHeight) {\\n    result = result + this.buttonAreaHeight();\\n}\\nreturn result;\"","widthEval":"Graphics.boxWidth * 0.3","heightEval":"Graphics.boxHeight * 0.3","opacity":"192","design":"Window"}
 * 
 * 
 * @param a
 * @text _
 * 
 * 
 * @param performance
 * @text Performance
 * 
 * @param getDownscaleFactorEval
 * @parent performance
 * @text Mipmapping: get factor
 * @type note
 * @default "if (!$gameMap) return 1; // Escape Route\n\nconst y = Math.max(\n  $gameMap.width() * $gameMap.tileWidth() / 1000,\n  $gameMap.height() * $gameMap.tileHeight() / 1000,\n);\n\nreturn [1, 2, 4, 8, 12].find(value => y < value) || 12;"
 * 
 * @param shouldDisplayDownscaleFactor
 * @parent getDownscaleFactorEval
 * @text Display? (Testplay)
 * @type boolean
 * @default true
 * @desc Displays the factor for analysis - Testplay only
 * 
 * @param updateEventsInterval
 * @parent performance
 * @text Update Events Interval
 * @type number
 * @default 1
 * @desc Update each Event every x-th frame. 1 = update every frame, 2 = update every 2nd frame, ...
 * 
 * @param listenForMapChanges
 * @parent performance
 * @text Listen for Map Changes?
 * @type boolean
 * @default true
 * @desc Minimap will react on Map modifications (Shaz TileChanger, Random Maps, ...). Disabling may save performance.
 * 
 * 
 * @param b
 * @text _
 * 
 * 
 * @param misc
 * @text Miscellaneous
 * 
 * @param addToOptions
 * @parent misc
 * @text Add to Options?
 * @type boolean
 * @default true
 * @desc Add Setting to the Options Menu
 * 
 * @param hotkeys
 * @parent misc
 * @text Hotkeys
 * @type struct<Hotkeys>
 * @desc All Hotkeys may be empty. You can get the Key Code from e.g. http://keyjs.dev.
 * @default {"showHide":"77"}
 * 
 * @param vocabulary
 * @parent misc
 * @text Vocabulary
 * @type struct<Vocabulary>
 * @default {"optionsMenuText":"Show Minimap"}
 * 
 */

/*~struct~Map:
 *
 * @param position
 * @text Position
 * @type select
 * @option top left
 * @option top right
 * @option bottom left
 * @option bottom right
 * @default top right
 * 
 * @param xEval
 * @text X Position
 * @type note
 * @default "const position = arguments[0];\nconst width = arguments[1];\n\nreturn position == 'top left' || position == 'bottom left'\n    ? (Graphics.width - Graphics.boxWidth) / 2\n    : Graphics.boxWidth - width + ((Graphics.width - Graphics.boxWidth) / 2);"
 * 
 * @param yEval
 * @text Y Position
 * @type note
 * @default "const position = arguments[0];\nconst height = arguments[1];\n\nlet result = position == 'top left' || position == 'top right'\n    ? (Graphics.height - Graphics.boxHeight) / 2\n    : Graphics.boxHeight + ((Graphics.height - Graphics.boxHeight) / 2) - height;\n\nif (position == 'top right' && this.buttonAreaHeight) {\n    result = result + this.buttonAreaHeight();\n}\nreturn result;"
 *
 * @param widthEval
 * @text Width
 * @desc You may use JavaScript
 * @default Graphics.boxWidth * 0.3
 * 
 * @param heightEval
 * @text Height
 * @desc You may use JavaScript
 * @default Graphics.boxHeight * 0.3
 * 
 * @param opacity
 * @text Opacity
 * @type number
 * @default 192
 * 
 * @param design
 * @text Background Design
 * @type select
 * @option Window
 * @option No Background
 * @default Window
 * 
 */


/*~struct~Hotkeys:
 *
 * @param keyboard
 * @text Keyboard
 * 
 * @param showHide
 * @parent keyboard
 * @text Show/Hide
 * @type number
 * @default 77
 * @desc May be empty. You can get the Key Code from e.g. http://keyjs.dev. Default is 77 which is the letter M.
 * 
 * @param gamepad
 * @text Gamepad
 * 
 * @param showHide2
 * @parent gamepad
 * @text Show/Hide
 * @type number
 * @desc May be empty. E.g. 6 is LR2 on a PS5 controller.
 */


/*~struct~Vocabulary:
 *
 * @param optionsMenuText
 * @text Options Menu: enable Minimap?
 * @default Show Minimap
 * 
 */


var MK = MK || { };
MK.Minimap = { };


// Spriteset Minimap
function Spriteset_Minimap() {
    this.initialize(...arguments);
}

if (typeof Sprite_Clickable !== 'undefined') {
    Spriteset_Minimap.prototype = Object.create(Sprite_Clickable.prototype);
    Spriteset_Minimap.prototype.constructor = Sprite_Clickable;
} else {
    Spriteset_Minimap.prototype = Object.create(Sprite.prototype);
    Spriteset_Minimap.prototype.constructor = Sprite;
}

// Sprite Minimap
function Sprite_Minimap() {
    this.initialize(...arguments);
}

Sprite_Minimap.prototype = Object.create(Sprite.prototype);
Sprite_Minimap.prototype.constructor = Sprite;


// Sprite Minimap Character
function Sprite_Minimap_Character() {
    this.initialize(...arguments);
}

Sprite_Minimap_Character.prototype = Object.create(Sprite.prototype);
Sprite_Minimap_Character.prototype.constructor = Sprite;


// Sprite Minimap Event
function Sprite_Minimap_Event() {
    this.initialize(...arguments);
}

Sprite_Minimap_Event.prototype = Object.create(Sprite_Minimap_Character.prototype);
Sprite_Minimap_Event.prototype.constructor = Sprite_Minimap_Character;


// Sprite Minimap Player
function Sprite_Minimap_Player() {
    this.initialize(...arguments);
}

Sprite_Minimap_Player.prototype = Object.create(Sprite_Minimap_Character.prototype);
Sprite_Minimap_Player.prototype.constructor = Sprite_Minimap_Character;


// Sprite Minimap Vehicle
function Sprite_Minimap_Vehicle() {
    this.initialize(...arguments);
}

Sprite_Minimap_Vehicle.prototype = Object.create(Sprite_Minimap_Character.prototype);
Sprite_Minimap_Vehicle.prototype.constructor = Sprite_Minimap_Character;


(function() {

const PLUGIN_NAME = 'MK_Minimap_Lite';

const reject = (reason) => {
    const message = (
        "An Error has occurred in the Plugin %1: %2 " +
        "If the problem persists, contact the Plugin Creator."
    ).format(PLUGIN_NAME, reason);
    throw Error(message);
}

if (!PluginManager._parameters[PLUGIN_NAME.toLowerCase()]) {
    reject((
        "Please check that this plugin's filename is \"%1.js\". " +
        "Subdirectories (e.g.: js/plugins/xy/thisPlugin.js) are not allowed."
    ).format(PLUGIN_NAME));
}

const structure = (serialized, parameterName) => {
    if (!serialized) {
        reject((
            "The Plugin Parameter \"%1\" is missing. " +
            "Please check it in the Plugin Manager. It may help to re-install this Plugin (i.e.: remove, re-add)."
        ).format(parameterName));
    }
    try {
        return JSON.parse(serialized);
    
    } catch (e) {
        reject((
            "The Plugin Parameter \"%1\" is corrupted. " +
            "Please check it in the Plugin Manager. It may help to re-install this Plugin (i.e.: remove, re-add)."
        ).format(parameterName));
    }
}

const customFunction = (body, parameterName) => {
    if (!body) {
        reject((
            "The Plugin Parameter \"%1\" is missing. " +
            "Please check it in the Plugin Manager. It may help to re-install this Plugin (i.e.: remove, re-add)."
        ).format(parameterName));
    }
    try {
        return new Function(JSON.parse(body));
    
    } catch (e) {
        reject((
            "The Plugin Parameter \"%1\" contains an error and could not be interpreted. " +
            "Please check it in the Plugin Manager. It may also help to re-install this Plugin (i.e.: remove, re-add). " +
            "Cause: %2"
        ).format(parameterName, e));
    }
}

const params = PluginManager.parameters(PLUGIN_NAME);

const mapParams                         = structure(params.map, 'Map');
MK.Minimap.map                          = { }
MK.Minimap.isVisibleDefault             = 'true' == params.isVisible;
MK.Minimap.map.position                 = mapParams.position;
MK.Minimap.map.xEval                    = customFunction(mapParams.xEval, 'X Eval');
MK.Minimap.map.yEval                    = customFunction(mapParams.yEval, 'Y Eval');
MK.Minimap.map.widthEval                = mapParams.widthEval;
MK.Minimap.map.heightEval               = mapParams.heightEval;
MK.Minimap.map.opacity                  = Number(mapParams.opacity);
MK.Minimap.map.design                   = mapParams.design || 'Window';

// performance
MK.Minimap.getDownscaleFactorEval       = customFunction(params.getDownscaleFactorEval, 'Mipmapping, get Factor');
MK.Minimap.shouldDisplayDownscaleFactor = 'true' == params.shouldDisplayDownscaleFactor;
MK.Minimap.updateEventsInterval         = Number(params.updateEventsInterval) || 1;
MK.Minimap.listenForMapChanges          = 'true' == params.listenForMapChanges;

// misc
MK.Minimap.addToOptions                 = 'true' == params.addToOptions;

const hotkeyParams                      = structure(params.hotkeys, 'Hotkeys');
MK.Minimap.hotkeys                      = { };
MK.Minimap.hotkeys.showHide             = Number(hotkeyParams.showHide);
MK.Minimap.gamepadKeys                  = { };
MK.Minimap.gamepadKeys.showHide         = Number(hotkeyParams.showHide2);

const vocabularyParams                  = structure(params.vocabulary, 'Vocabulary');
MK.Minimap.vocabulary                   = { };
MK.Minimap.vocabulary.optionsMenuText   = vocabularyParams.optionsMenuText;


// =====================================================================================
// Image Manager
// =====================================================================================

// console.log(
//     (
//         "%1: Error messages such as \"File not found\" may appear. " +
//         "They are only relevant when using RPG Maker MV AND you are planning to publish your game as a browser game. " +
//         "In this case, you must ensure that all ressources are available when uploading your game. " +
//         "Otherwise, you can safely ignore the messages. " +
//         "For more info, please visit: https://aerosys.blog/Minimap"
//     ).format(PLUGIN_NAME)
// );

function MK_ImageManager() {
    throw new Error("This is a static class");
}

MK_ImageManager._imageCache = { };

// may return null
MK_ImageManager.safelyRequestBitmap = function(folder, name) {
    const key = this.makeKey(folder, name);

    if (this._imageCache[key]) {
        return this._imageCache[key];
    }

    if (this.shouldLoadBitmap(folder, name)) {
        const url = this.makeUrl(folder, name);
        const bitmap = Bitmap.load(url);
        bitmap._callLoadListenersWhenError = true; // custom mod
        this._imageCache[key] = bitmap;

        return bitmap;
    } else {
        return null;
    }
}

MK_ImageManager.shouldLoadBitmap = function(folder, name) {
    return (
        'MZ' == Utils.RPGMAKER_NAME ||
        this.isWeb() ||
        this.existsFileSync(folder, name)
    );
}

MK_ImageManager.isWeb = function() {
    return !StorageManager.isLocalMode();
}

// MV only
MK_ImageManager.existsFileSync = function(folder, name) {
    if (!Utils.isNwjs()) {
        return false; // escape route
    }
    const fs = require('fs');
    const path = require('path');
    const filepath1 = path.dirname(process.mainModule.filename) + '/' + folder + name + '.png';
    const filepath2 = path.dirname(process.mainModule.filename) + '/' + folder + name + '.rpgmvp';
    return fs.existsSync(filepath1) || fs.existsSync(filepath2);
}

MK_ImageManager.isReady = function() {
    return Object
        .values(this._imageCache)
        .filter(Boolean)
        .every(bitmap => bitmap.isReady() || bitmap.isError());
}

MK_ImageManager.addBitmapToCache = function(folder, name, bitmap) {
    const key = this.makeKey(folder, name);
    this._imageCache[key] = bitmap;
}

MK_ImageManager.makeKey = function(folder, name) {
    return folder + name;
}

MK_ImageManager.makeUrl = function(folder, name) {
    return folder + this.encode(name) + ".png";
}

MK_ImageManager.encode = function(name) {
    return 'MZ' == Utils.RPGMAKER_NAME
        ? Utils.encodeURI(name)
        : encodeURIComponent(name);
}


// =====================================================================================
// Custom Bitmap
// =====================================================================================

const alias_Bitmap_onError = Bitmap.prototype._onError;
Bitmap.prototype._onError = function() {
    alias_Bitmap_onError.call(this);
    
    if (this._callLoadListenersWhenError) {
        this._callLoadListeners();
    }
}


// =====================================================================================
// Scene Boot
// =====================================================================================

const alias_SceneBoot_start = Scene_Boot.prototype.start;
Scene_Boot.prototype.start = function() {
    alias_SceneBoot_start.call(this);

    const reject = (message) => { throw Error(message); }

    const extractTier = (pluginDescription) => {
        const match = /\[Tier\s+\d+\]/g.exec(pluginDescription);
        if (match && match[0]) {
            const number = /\d+/.exec(match[0])[0];
            return Number(number);
        }
        return null;
    }

    const isListSorted = (list) => {
        if (list && list.length > 1) {
            for (let i = 1; i < list.length; i++) {
                if (list[i] < list[i - 1]) {
                    return false;
                }
            }
        }
        return true;
    }

    const mkTiers = $plugins
        .filter(plugin => plugin && plugin.status && plugin.name.startsWith('MK_'))
        .map(plugin => extractTier(plugin.description))
        .filter(tier => tier === 0 || tier > 0);
    
    if (!isListSorted(mkTiers)) {
        reject("MK Plugins are not in correct order. "
            + "Please go into the Plugin Manager and sort all the Plugins starting with \"MK\" "
            + "according to their tiers (Tier 0, Tier 1, ...)"
        );
    }

    // Hot Keys
    if (MK.Minimap.hotkeys.showHide || MK.Minimap.hotkeys.showHide === 0) {
        Input.keyMapper[MK.Minimap.hotkeys.showHide] = 'showHideMinimap';
    }
    if (MK.Minimap.gamepadKeys.showHide || MK.Minimap.gamepadKeys.showHide === 0) {
        Input.gamepadMapper[MK.Minimap.gamepadKeys.showHide] = 'showHideMinimap';
    }
}


// =====================================================================================
// Spriteset Minimap
// =====================================================================================

Spriteset_Minimap.prototype.initialize = function(width, height) {
    if (typeof Sprite_Clickable !== 'undefined') {
        Sprite_Clickable.prototype.initialize.call(this);
    } else {
        Sprite.prototype.initialize.call(this);
    }

    this.width = width;
    this.height = height;

    MK.Minimap.updateDownscaleFactor();
    
    this.createBackground();
    this.createMap();
    this.createEvents();
    this.createDownscaleFactorWindow();
    this.update();
}

Spriteset_Minimap.prototype.createMap = function() {
    this.mapSprite = new Sprite_Minimap(
        ($gameMap.width() * $gameMap.tileWidth()) / MK.Minimap.downscaleFactor(),
        ($gameMap.height() * $gameMap.tileHeight()) / MK.Minimap.downscaleFactor(),
    );
    this.addChild(this.mapSprite);
}

Spriteset_Minimap.prototype.createEvents = function() {
    $gameMap.events()
        .map(event => new Sprite_Minimap_Event(event))
        .forEach(sprite => this.mapSprite.addChild(sprite));
    
    const boatSprite    = new Sprite_Minimap_Vehicle($gameMap.boat(), 'boat');
    const shipSprite    = new Sprite_Minimap_Vehicle($gameMap.ship(), 'ship');
    const airshipSprite = new Sprite_Minimap_Vehicle($gameMap.airship(), 'airship');
    const playerSprite  = new Sprite_Minimap_Player();
    
    this.mapSprite.addChild(boatSprite);
    this.mapSprite.addChild(shipSprite);
    this.mapSprite.addChild(airshipSprite);
    this.mapSprite.addChild(playerSprite);
}

Spriteset_Minimap.prototype.createBackground = function() {
    if ('MZ' == Utils.RPGMAKER_NAME) {
        const rectangle = new Rectangle(0, 0, this.width, this.height);
        this.background = new Window_Base(rectangle);
    } else {
        this.background = new Window_Base(0, 0, this.width, this.height);
    }
    this.background.visible = 'Window' == MK.Minimap.map.design;
    this.addChild(this.background);
}

Spriteset_Minimap.prototype.createDownscaleFactorWindow = function() {
    if (!MK.Minimap.shouldDisplayDownscaleFactor) return;
    if (!$gameTemp.isPlaytest()) return;

    if ('MZ' == Utils.RPGMAKER_NAME) {
        const rectangle = new Rectangle(0, 0, this.width, this.height);
        const window = new Window_DownscaleFactor(rectangle);
        this.addChild(window);
    }
    if ('MV' == Utils.RPGMAKER_NAME) {
        const window = new Window_DownscaleFactor(0, 0, this.width, this.height);
        this.addChild(window);
    }
}

Spriteset_Minimap.prototype.update = function() {
    this.updateMain();
    this.updateMapScaleAndPosition();
    this.updateEvents();
    
    if (typeof Sprite_Clickable !== 'undefined') {
        Sprite_Clickable.prototype.update.call(this);
    } else {
        Sprite.prototype.update.call(this);
    }
}

Spriteset_Minimap.prototype.updateMain = function() {
    const scene = SceneManager._scene;
    const targetWidth = eval(MK.Minimap.map.widthEval);
    const targetHeight = eval(MK.Minimap.map.heightEval);
    
    if (isNaN(targetWidth)) rejectParameterValue('Minimap width', targetWidth);
    if (isNaN(targetHeight)) rejectParameterValue('Minimap height', targetHeight);

    const x = MK.Minimap.map.xEval.call(scene, MK.Minimap.map.position, targetWidth);
    const y = MK.Minimap.map.yEval.call(scene, MK.Minimap.map.position, targetHeight);

    if (isNaN(x)) rejectParameterValue('Minimap x', x);
    if (isNaN(y)) rejectParameterValue('Minimap y', y);
    
    this.move(x, y);
    this.width = targetWidth;
    this.height = targetHeight;
    this.opacity = MK.Minimap.map.opacity;
    this.visible = MK.Minimap.isVisible();
}

Spriteset_Minimap.prototype.updateMapScaleAndPosition = function() {
    const scale = Math.min(
        (this.width - (2 * this.padding())) / ($gameMap.width() * $gameMap.tileWidth()),
        (this.height - (2 * this.padding())) / ($gameMap.height() * $gameMap.tileHeight()),
    ) * MK.Minimap.downscaleFactor();

    this.mapSprite.scale.x = scale;
    this.mapSprite.scale.y = scale;

    const x = Math.floor(((this.width - (2 * this.padding()))
                - (this.mapSprite.width * this.mapSprite.scale.x)) / 2)
                + this.padding();
    const y = Math.floor(((this.height - (2 * this.padding()))
                - (this.mapSprite.height * this.mapSprite.scale.y)) / 2)
                + this.padding();
    this.mapSprite.move(x, y);
}

Spriteset_Minimap.prototype.updateEvents = function() {
    const gameEventIds = $gameMap.events().map(event => event.eventId());
    const spriteEventIds = this.mapSprite.children
        .filter(sprite => sprite && sprite.event && sprite.event.eventId)
        .map(sprite => sprite.event.eventId());
    
    // add new Events
    $gameMap.events()
        .filter(event => !spriteEventIds.includes(event.eventId()))
        .map(event => new Sprite_Minimap_Event(event))
        .forEach(sprite => this.mapSprite.addChild(sprite));
    
    // remove expired Events
    this.mapSprite.children
        .filter(sprite => sprite && sprite.event && sprite.event.eventId)
        .filter(sprite => !gameEventIds.includes(sprite.event.eventId()))
        .forEach(sprite => this.mapSprite.removeChild(sprite));
}

Spriteset_Minimap.prototype.padding = function() {
    return 'MZ' == Utils.RPGMAKER_NAME
        ? $gameSystem.windowPadding()
        : Window_Base.prototype.standardPadding.call(this);
}


// =====================================================================================
// Sprite Minimap
// =====================================================================================

const hash = (values, updateInterval, size) => {
    const a = Math.floor(values.length / size) * updateInterval;
    const b = Math.floor(values.length / size) * (updateInterval + 1);
    return values.slice(a, b).reduce((total, v) => (31 * total + v) % 2347, 1);
}

Sprite_Minimap.prototype.initialize = function(width, height) {
    if (MK.Minimap._cachedBitmap && !this.requiresRedraw()) {
        Sprite.prototype.initialize.call(this, MK.Minimap._cachedBitmap);
        this._isReady = true;
    } else {
        MK.Minimap._cachedBitmap = new Bitmap(width, height);
        Sprite.prototype.initialize.call(this, MK.Minimap._cachedBitmap);
        this._isReady = false;
        this._requiresRefresh = true;
    }
    this.loadSourceBitmaps();
}

Sprite_Minimap.prototype.loadSourceBitmaps = function() {
    const factor                    = MK.Minimap.downscaleFactor();
    const tilesetData               = $dataTilesets[$gameMap.tilesetId()];
    const tilesetNames              = tilesetData && tilesetData.tilesetNames
                                        ? tilesetData.tilesetNames.filter(Boolean)
                                        : [ ];
    const bitmapsToLoad             = [ ];
    this._sourceBitmapsOrganized    = false;

    tilesetNames.forEach(name => {
        const bitmap1 = MK_ImageManager.safelyRequestBitmap('img/tilesets/', name);
        bitmapsToLoad.push(bitmap1);
        
        // Skip this to avoid the console error
        // if (factor > 1) {
        //     const bitmap2 = MK_ImageManager.safelyRequestBitmap('img/tilesets_%1x/'.format(factor), name);
        //     bitmapsToLoad.push(bitmap2);
        // }
    });
    bitmapsToLoad
        .filter(Boolean)
        .forEach(bitmap => bitmap.addLoadListener(this.onTilesetBitmapLoaded.bind(this)));

    if (!bitmapsToLoad.length) {
        this.onTilesetBitmapLoaded();
    }
}

Sprite_Minimap.prototype.onTilesetBitmapLoaded = function() {
    if (MK_ImageManager.isReady() && !this._sourceBitmapsOrganized) {
        this._sourceBitmapsOrganized = true;
        this.organizeSourceBitmaps();
    }
}

Sprite_Minimap.prototype.organizeSourceBitmaps = function() {
    const factor            = MK.Minimap.downscaleFactor();
    const tilesetData       = $dataTilesets[$gameMap.tilesetId()];
    const tilesetNames      = tilesetData ? tilesetData.tilesetNames : [ ];
    this.tilesetBitmaps     = tilesetNames.map(() => null);
    
    tilesetNames.forEach((name, index) => {

        if (name) {
            if (factor > 1) {
                const folder1 = 'img/tilesets/';
                const folder2 = 'img/tilesets_%1x/'.format(factor);
                const bitmap1 = MK_ImageManager.safelyRequestBitmap(folder1, name);
                // const bitmap2 = MK_ImageManager.safelyRequestBitmap(folder2, name);

                // Skip this to avoid the console error
                // if (bitmap2 && bitmap2.isReady() && !bitmap2.isError()) {
                //     this.tilesetBitmaps[index] = bitmap2;
                // } else {
                    this.tilesetBitmaps[index] = this.downscaleBitmap(bitmap1, factor);
                    MK_ImageManager.addBitmapToCache(folder2, name, this.tilesetBitmaps[index]);
                // }
            } else {
                this.tilesetBitmaps[index] = MK_ImageManager.safelyRequestBitmap('img/tilesets/', name);
            }
        } else {
            this.tilesetBitmaps[index] = null;
        }
    });
    this._isReady = true;
}

Sprite_Minimap.prototype.downscaleBitmap = function(bitmap, factor) {
    if (factor == 1) return bitmap;

    const source = bitmap._canvas || bitmap._image;
    const toReturn = new Bitmap(bitmap.width / factor, bitmap.height / factor);

    toReturn.clearRect(0, 0, toReturn.width, toReturn.height);
    toReturn.context.globalCompositeOperation = 'source-over';

    toReturn.context.drawImage(
        source,
        0,
        0,
        bitmap.width,
        bitmap.height,
        0,
        0,
        bitmap.width / factor,
        bitmap.height / factor,
    );
    return toReturn;
}

Sprite_Minimap.prototype.update = function() {
    Sprite.prototype.update.call(this);

    if (this.isReady() && this.requiresRedraw()) {
        this._requiresRefresh = false;
        MK.Minimap._cachedMapId = $gameMap.mapId();
        MK.Minimap._cachedTilesetId = $gameMap.tilesetId();
        
        this._hashes = [ ];
        for (let i = 0; MK.Minimap.listenForMapChanges && i < 50; i++) {
            this._hashes[i] = hash($gameMap.data(), i, 50);
        }
        
        if (MK.Minimap._cachedTilesetId != $gameMap.tilesetId()) {
            this.loadSourceBitmaps();
        }
        this.performDraw();
    }
}

Sprite_Minimap.prototype.requiresRedraw = function() {
    return (
        this._requiresRefresh ||
        MK.Minimap._cachedMapId != $gameMap.mapId() ||
        MK.Minimap._cachedTilesetId != $gameMap.tilesetId() ||
        (MK.Minimap.listenForMapChanges && this.hasMapBeenManipulated())
    );
}

Sprite_Minimap.prototype.hasMapBeenManipulated = function() {
    this._updateInterval = ((this._updateInterval || 0) + 1).mod(50);

    return (
        !this._hashes ||
        this._hashes[this._updateInterval] != hash($gameMap.data(), this._updateInterval, 50)
    );
}

Sprite_Minimap.prototype.performDraw = function() {
    this.bitmap.clear();
    
    for (let x = 0; x < $gameMap.width(); x++) {
        for (let y = 0; y < $gameMap.height(); y++) {
            this.drawSpot(x, y);
        }
    }
}

Sprite_Minimap.prototype.drawSpot = function(x, y) {
    const f = MK.Minimap.downscaleFactor();
    
    this.bitmap.clearRect(
        x * $gameMap.tileWidth() / f,
        y * $gameMap.tileHeight() / f,
        $gameMap.tileWidth() / f,
        $gameMap.tileHeight() / f,
    );
    for (let z = 0; z < 4; z++) {
        const tileId = $gameMap.tileId(x, y, z);

        if      (Tilemap.isTileA5(tileId))      this.drawTileA5(tileId, x, y);
        else if (Tilemap.isAutotile(tileId))    this.drawAutotile(tileId, x, y);
        else if (tileId)                        this.drawBTile(tileId, x, y);
    }
}

Sprite_Minimap.prototype.drawAutotile = function(tileId, x, y) {
    const w = $gameMap.tileWidth();
    const h = $gameMap.tileHeight();
    const w1 = w / 2;
    const h1 = h / 2;
    const kind = Tilemap.getAutotileKind(tileId);
    const shape = Tilemap.getAutotileShape(tileId);
    const tx = kind % 8;
    const ty = Math.floor(kind / 8);
    let autotileTable = Tilemap.FLOOR_AUTOTILE_TABLE;
    let tilesetNumber, bx, by;

    if (Tilemap.isTileA1(tileId)) {
        tilesetNumber = 0;

        if (kind == 0) {
            bx = 0;
            by = 0;
        }
        else if (kind == 1) {
            bx = 0;
            by = 3;
        }
        else if (kind == 2) {
            bx = 6;
            by = 0;
        }
        else if (kind == 3) {
            bx = 6;
            by = 3;
        }
        else {
            bx = Math.floor(tx / 4) * 8;
            by = ty * 6 + (Math.floor(tx / 2) % 2) * 3;

            if (kind % 2 != 0) {
                bx += 6;
                autotileTable = Tilemap.WATERFALL_AUTOTILE_TABLE;
            }
        }
    }
    if (Tilemap.isTileA2(tileId)) {
        tilesetNumber = 1;
        bx = tx * 2;
        by = (ty - 2) * 3;
    }
    if (Tilemap.isTileA3(tileId)) {
        tilesetNumber = 2;
        bx = tx * 2;
        by = (ty - 6) * 2;
        autotileTable = Tilemap.WALL_AUTOTILE_TABLE;
    }
    if (Tilemap.isTileA4(tileId)) {
        tilesetNumber = 3;
        bx = tx * 2;
        by = Math.floor((ty - 10) * 2.5 + (ty % 2 === 1 ? 0.5 : 0));
        if (ty % 2 === 1) {
            autotileTable = Tilemap.WALL_AUTOTILE_TABLE;
        }
    }
    
    for (let i = 0; i < 4; i++) {
        const qsx = autotileTable[shape][i][0];
        const qsy = autotileTable[shape][i][1];
        const sx  = (bx * 2 + qsx) * w1;
        const sy  = (by * 2 + qsy) * h1;
        const dx  = (i % 2) * w1 + (w * x);
        const dy  = Math.floor(i / 2) * h1 + (h * y);
        
        this.blt(
            tilesetNumber,
            sx,
            sy,
            w1,
            h1,
            dx,
            dy,
        );
    }
}

Sprite_Minimap.prototype.drawTileA5 = function(tileId, x, y) {
    this.drawNormalTile(4, tileId, x, y);
}

Sprite_Minimap.prototype.drawBTile = function(tileId, x, y) {
    const tilesetNumber = Math.floor(tileId / 256) + 5;
    this.drawNormalTile(tilesetNumber, tileId, x, y);
}

Sprite_Minimap.prototype.drawNormalTile = function(tilesetNumber, tileId, x, y) {
    const w = $gameMap.tileWidth();
    const h = $gameMap.tileHeight();
    const sx = ((Math.floor(tileId / 128) % 2) * 8 + (tileId % 8)) * w;
    const sy = (Math.floor((tileId % 256) / 8) % 16) * h;
    
    this.blt(
        tilesetNumber,
        sx,
        sy,
        w,
        h,
        w * x,
        h * y,
    );
}

Sprite_Minimap.prototype.blt = function(tilesetNumber, sx, sy, w, h, dx, dy) {
    const f = MK.Minimap.downscaleFactor();
    const tilesetBitmap = this.tilesetBitmaps[tilesetNumber];
    
    if (tilesetBitmap) {
        this.bitmap.blt(
            tilesetBitmap,
            sx / f,
            sy / f,
            w / f,
            h / f,
            dx / f,
            dy / f,
        );
    }
    else {
        this.bitmap.clearRect(
            dx / f,
            dy / f,
            w / f,
            h / f,
        );
    }
}

Sprite_Minimap.prototype.isReady = function() {
    return this._isReady;
}

const findLastIndex = (list, f) => {
    if (list.length == 0) return -1;
    
    for (let i = list.length - 1; i >= 0; i--) {
        if (f.call(this, list[i])) {
            return i + 1;
        }
    }
    return -1;
}

Sprite_Minimap.prototype.addChild = function(sprite) {
    sprite.z = sprite.z || 0;
    const index = findLastIndex(this.children, _sprite => _sprite.z <= sprite.z)
    
    this.addChildAt(sprite, index != -1 ? index : 0);
}

// VS Compatibility
Sprite_Minimap.prototype.destroyCoreEngineMarkedBitmaps = function() { }


// =====================================================================================
// Sprite Character
// =====================================================================================

Sprite_Minimap_Character.prototype.initialize = function(event) {
    this.event = event;
    Sprite.prototype.initialize.call(this, new Bitmap());

    this.anchor.x = 0.5;
    this.anchor.y = 1.0;
}

Sprite_Minimap_Character.prototype.update = function() {
    this.visible = this.isVisible();
    this._updateCounter = ((this._updateCounter || 0) + 1).mod(MK.Minimap.updateEventsInterval);

    if (this._updateCounter == 0 && this.isVisible) {
        Sprite.prototype.update.call(this);

        this.updateModeIfRequired();
        this.updateFrame();
        this.updatePosition();
        
        this.z = this.getZ();
        this.scale.x = this.getScale();
        this.scale.y = this.getScale();
        this.opacity = this.getOpacity();
    }
}

Sprite_Minimap_Character.prototype.updateModeIfRequired = function() {
    if (this.requiresRefresh()) {
        this.tilesetId      = $gameMap.tilesetId();
        this.tileId         = this.event.tileId();
        this.characterName  = this.event.characterName();
        this.characterIndex = this.event.characterIndex();
        
        this.updateBitmap();
    }
}

Sprite_Minimap_Character.prototype.requiresRefresh = function() {
    return this.tilesetId != $gameMap.tilesetId()
        || this.tileId != this.event.tileId()
        || this.characterName != this.event.characterName()
        || this.characterIndex != this.event.characterIndex();
}

Sprite_Minimap_Character.prototype.updateBitmap = function() {
    if (this.characterName) {
        this.bitmap = ImageManager.loadCharacter(this.characterName);
        this.isBigCharacter = ImageManager.isBigCharacter(this.characterName);
    }
    else if (this.tileId) {
        const tileset       = $gameMap.tileset();
        const setNumber     = Math.floor(this.tileId / 256) + 5;
        const tilesetName   = tileset.tilesetNames[setNumber];
        this.bitmap         = ImageManager.loadTileset(tilesetName);
    }
    else {
        this.bitmap = new Bitmap();
    }
}

Sprite_Minimap_Character.prototype.updateFrame = function() {
    if (this.tileId) {
        const pw = $gameMap.tileWidth();
        const ph = $gameMap.tileHeight();
        const sx = ((Math.floor(this.tileId / 128) % 2) * 8 + (this.tileId % 8)) * pw;
        const sy = (Math.floor((this.tileId % 256) / 8) % 16) * ph;
        this.setFrame(sx, sy, pw, ph);
    }
    else if (this.characterName) {
        const pw = this.patternWidth();
        const ph = this.patternHeight();
        const sx = (this.characterBlockX() + this.characterPatternX()) * pw;
        const sy = (this.characterBlockY() + this.characterPatternY()) * ph;
        this.setFrame(sx, sy, pw, ph);
    }
}

Sprite_Minimap_Character.prototype.updatePosition = function() {
    const x = (this.event._realX + 0.5) * $gameMap.tileWidth() / MK.Minimap.downscaleFactor();
    const y = ((this.event._realY + this.anchor.y) * $gameMap.tileHeight() - this.event.shiftY()) / MK.Minimap.downscaleFactor();
    
    this.move(x, y);
}

Sprite_Minimap_Character.prototype.patternWidth = function() {
    return this.bitmap.width / (this.isBigCharacter ? 3 : 12);
}

Sprite_Minimap_Character.prototype.patternHeight = function() {
    return this.bitmap.height / (this.isBigCharacter ? 4 : 8);
}

Sprite_Minimap_Character.prototype.characterPatternX = function() {
    return this.showStepAnimation() ? this.event.pattern() : 1;
}

Sprite_Minimap_Character.prototype.showStepAnimation = function() {
    return true;
}

Sprite_Minimap_Character.prototype.characterPatternY = function() {
    return (this.event.direction() - 2) / 2;
}

Sprite_Minimap_Character.prototype.characterBlockX = function() {
    return this.isBigCharacter
        ? 0
        : Math.floor(this.event.characterIndex() % 4) * 3;
}

Sprite_Minimap_Character.prototype.characterBlockY = function() {
    return this.isBigCharacter
        ? 0
        : Math.floor(this.event.characterIndex() / 4) * 4;
}

Sprite_Minimap_Character.prototype.getScale = function() {
    return 1 / MK.Minimap.downscaleFactor();
}

Sprite_Minimap_Character.prototype.getOpacity = function() {
    return 255;
}

Sprite_Minimap_Character.prototype.isVisible = function() {
    return true;
}

Sprite_Minimap_Character.prototype.getZ = function() {
    return 0;
}


// =====================================================================================
// Sprite Event
// =====================================================================================

Sprite_Minimap_Event.prototype.update = function() {
    Sprite_Minimap_Character.prototype.update.call(this);

    this.pageIndex = this.event._pageIndex;
}

Sprite_Minimap_Event.prototype.requiresRefresh = function() {
    return (
           Sprite_Minimap_Character.prototype.requiresRefresh.call(this)
        || this.pageIndex !== this.event._pageIndex
    );
}

Sprite_Minimap_Event.prototype.isVisible = function() {
    return (
        Sprite_Minimap_Character.prototype.isVisible.call(this) &&
        !(this.event.isTransparent && this.event.isTransparent()) &&
        !this.event._erased
    );
}


// =====================================================================================
// Sprite Player
// =====================================================================================

Sprite_Minimap_Player.prototype.initialize = function() {
    Sprite_Minimap_Character.prototype.initialize.call(
        this,
        $gamePlayer,
    );
}

Sprite_Minimap_Player.prototype.isVisible = function() {
    return (
           Sprite_Minimap_Character.prototype.isVisible.call(this)
        && !$gamePlayer.vehicle()
    )
}


// =====================================================================================
// Sprite Vehicle
// =====================================================================================

Sprite_Minimap_Vehicle.prototype.initialize = function(vehicle, type) {
    this.type = type;
    
    Sprite_Minimap_Character.prototype.initialize.call(
        this,
        vehicle,
    );
}

Sprite_Minimap_Vehicle.prototype.isVisible = function() {
    return (
           Sprite_Minimap_Character.prototype.isVisible.call(this)
        && this.event._mapId == $gameMap.mapId()
    );
}


// =====================================================================================
// Window Downscale Factor Window
// =====================================================================================

function Window_DownscaleFactor() {
    this.initialize(...arguments);
}

Window_DownscaleFactor.prototype = Object.create(Window_Base.prototype);
Window_DownscaleFactor.prototype.constructor = Window_DownscaleFactor;

Window_DownscaleFactor.prototype.initialize = function(/* arguments */) {
    Window_Base.prototype.initialize.apply(this, arguments);

    this.setBackgroundType(2);
    this.updatePadding(2);
    this.makeFontSmaller();
    this.drawText(
        'Downscale Factor: %1x'.format(MK.Minimap.downscaleFactor()),
        0,
        -10,
        this.width,
        this.height,
    );
}


// =====================================================================================
// Scene Map
// =====================================================================================

const rejectParameterValue = (param, value) => {
    const message = "MK Minimap: The parameter '%1' did not return a valid value, but %2".format(param, value);
    throw Error(message);
}


const alias_SceneMap_createDisplayObjects = Scene_Map.prototype.createDisplayObjects;
Scene_Map.prototype.createDisplayObjects = function() {
    alias_SceneMap_createDisplayObjects.call(this);
    
    this.createMinimap();
}

Scene_Map.prototype.createMinimap = function() {
    const targetWidth = eval(MK.Minimap.map.widthEval);
    const targetHeight = eval(MK.Minimap.map.heightEval);
    if (isNaN(targetWidth)) rejectParameterValue('Minimap width', targetWidth);
    if (isNaN(targetHeight)) rejectParameterValue('Minimap height', targetHeight);
    
    this._minimapSprite = new Spriteset_Minimap(targetWidth, targetHeight);
    this.addChild(this._minimapSprite);
}

const alias_SceneMap_update = Scene_Map.prototype.update;
Scene_Map.prototype.update = function() {
    alias_SceneMap_update.call(this);
    
    if (!$gameMap.isEventRunning()) {
        this.updateMinimapHotkeys();
    }
}

Scene_Map.prototype.updateMinimapHotkeys = function() {
    if (MK.Minimap.hotkeys.showHide && Input.isTriggered('showHideMinimap') && !$gameSystem.forceShowMinimap) {
        ConfigManager.showMinimap = !ConfigManager.showMinimap;
    }
}


// =====================================================================================
// MK
// =====================================================================================

MK.Minimap.isVisible = function() {
    if (!$dataMap) return false;
    
    return $gameSystem.forceShowMinimap || (
        $gameSystem.showMinimap && ConfigManager.showMinimap
    );
}

MK.Minimap.show = function() {
    $gameSystem.showMinimap = true;
}

MK.Minimap.hide = function() {
    $gameSystem.showMinimap = false;
}

MK.Minimap.toggle = function() {
    $gameSystem.showMinimap = !$gameSystem.showMinimap;
}

MK.Minimap.forceShow = function(b) {
    $gameSystem.forceShowMinimap = b;
}

MK.Minimap.refresh = function() {
    if (SceneManager._scene._minimapSprite) {
        SceneManager._scene._minimapSprite.mapSprite._requiresRefresh = true;
    }
}

const alias_GamePlayer_performTransfer = Game_Player.prototype.performTransfer;
Game_Player.prototype.performTransfer = function() {

    if ($dataMap && $dataMap.meta) {
        $gameSystem.showMinimap = $dataMap.meta['Minimap'] || (!$dataMap.meta['No Minimap'] && MK.Minimap.isVisibleDefault)
    } else {
        // fallback
        $gameSystem.showMinimap = MK.Minimap.isVisibleDefault;
    }
    alias_GamePlayer_performTransfer.call(this);
}


// =====================================================================================
// Downscale Factor
// =====================================================================================

MK.Minimap.downscaleFactor = function() {
    return MK.Minimap._downscaleFactor;
}

MK.Minimap.updateDownscaleFactor = function() {
    if (!$dataMap || !$gameMap) {
        MK.Minimap._downscaleFactor = 1;
    } else {
        MK.Minimap._downscaleFactor = MK.Minimap.getDownscaleFactorEval.call(this) || 1;
    }
}


// =====================================================================================
// Config Manager
// =====================================================================================

ConfigManager.showMinimap = true;

if (MK.Minimap.addToOptions) {
    
    const alias_ConfigManager_makeData = ConfigManager.makeData;
    ConfigManager.makeData = function() {
        const config = alias_ConfigManager_makeData.call(this);
        config.showMinimap = this.showMinimap;
        return config;
    }

    const alias_ConfigManager_applyData = ConfigManager.applyData;
    ConfigManager.applyData = function(config) {
        alias_ConfigManager_applyData.call(this, config);
        
        this.showMinimap = config.showMinimap || !('showMinimap' in config);
    }

    const alias_WindowOptions_addGeneralOptions = Window_Options.prototype.addGeneralOptions;
    Window_Options.prototype.addGeneralOptions = function() {
        alias_WindowOptions_addGeneralOptions.call(this);

        this.addCommand(MK.Minimap.vocabulary.optionsMenuText, 'showMinimap');
    }

    const alias_SceneOptions_maxCommands = Scene_Options.prototype.maxCommands;
    Scene_Options.prototype.maxCommands = function() {
        return alias_SceneOptions_maxCommands.call(this) + 1;
    }
}


// =====================================================================================
// Plugin Manager
// =====================================================================================

if (PluginManager && PluginManager.registerCommand) {

    PluginManager.registerCommand(PLUGIN_NAME, 'changeVisibility', args => {
        if ('Show' == args.mode)    MK.Minimap.show();
        if ('Hide' == args.mode)    MK.Minimap.hide();
        if ('Toggle' == args.mode)  MK.Minimap.toggle();
    });

    PluginManager.registerCommand(PLUGIN_NAME, 'forceShow', args => {
        MK.Minimap.forceShow('true' == args.mode);
    });
}


})();