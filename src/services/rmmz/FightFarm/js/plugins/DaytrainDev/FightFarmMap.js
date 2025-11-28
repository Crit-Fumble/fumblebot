




  //=============================================================================
// RPG Maker MZ - FightFarmMap
//=============================================================================

/*:
 * @target MZ
 * @plugindesc Map Systems for Fight Farm
 * @author Hob Daytrain
 *
 * @help FightFarmMap.js
 *
 * This plugin implements map systems for FightFarm.
 * 
 */

const EDGE_THRESHOLD = 0;

  //=============================================================================
  // Map Init
  //=============================================================================
(() => {
  const pluginName = "FightFarmMap";
  DaytrainDev.FightFarmMap = DaytrainDev.FightFarmMap ?? {};
  DaytrainDev.FightFarmMap.parameters = PluginManager.parameters(pluginName);

  //////////////////////////////////////////////////
  // Map Overrides // $gameMap = new Game_Map();
  const _Game_Map_initialize = Game_Map.prototype.initialize
  Game_Map.prototype.initialize = function() {
    _Game_Map_initialize.call(this);

    // edge transition maps
    // this._southMap = 0;
    // this._westMap = 0;
    // this._eastMap = 0;
    // this._northMap = 0;

    // other transition maps
    // this._inMap = 0;
    // this._outMap = 0;
    // this._upMap = 0;
    // this._downMap = 0;

    // exit transition
    // Realm <- Zone <- Region <- Location
    // this._exitMap = 0;
    // this._exitMapX = 0;
    // this._exitMapY = 0;

    // enter transition
    // this._enterMap = 0;
    // this._enterMapX = 0;
    // this._enterMapY = 0;
  };

  // Game_CharacterBase
  // const _Game_CharacterBase_initialize = Game_CharacterBase.prototype.initialize
  // Game_CharacterBase.prototype.initialize = function() {
  //   _Game_CharacterBase_initialize.call(this);
  // };

  // Game_Character
  // const _Game_Character_initialize = Game_Character.prototype.initialize
  // Game_Character.prototype.initialize = function() {
  //   _Game_Character_initialize.call(this);
  // };

  //////////////////////////////////////////////////
  // Player Overrides 
  const _Game_Player_initialize = Game_Player.prototype.initialize;
  Game_Player.prototype.initialize = function() {
    _Game_Player_initialize.call(this);
  };

  const _Game_Player_update = Game_Player.prototype.update;
  Game_Player.prototype.update = function(sceneActive) {
    _Game_Player_update.call(this, sceneActive);

    this.mapEdgeTransferUpdate();
  };
 
  Game_Player.prototype.mapEdgeTransferUpdate = function() {
    // Screen Edge Transition Logic Adapted from:
    // https://forums.rpgmakerweb.com/index.php?threads/map-edge-transfer.47775/
    if (this.x === EDGE_THRESHOLD && $dataMap?.meta?.west?.[0]) {
      this.mapEdgeTransfer($dataMap.meta.west[0]);
    }
    if (this.x === $dataMap.width - EDGE_THRESHOLD - 1 && $dataMap?.meta?.east?.[0]) {
      this.mapEdgeTransfer($dataMap.meta.east[0]);
    }
    if (this.y === EDGE_THRESHOLD && $dataMap?.meta?.north?.[0]) {
      this.mapEdgeTransfer();
    }
    if (this.y === $dataMap.height - EDGE_THRESHOLD - 1 && $dataMap?.meta?.south?.[0]) {
      this.mapEdgeTransfer();
    }
  };

  Game_Player.prototype.mapEdgeTransfer = function(map) {
    if (map === 0) return;

    // let map = 0;
    let destX = this.x;
    let destY = this.y;
    const dir = this.direction();
    const no_fade = 2;

    switch (dir) {
      case DIRECTION.DOWN: 
        // map = $dataMap.meta.south[0];
        destY -= $dataMap.height - EDGE_THRESHOLD * 2;
        break;
      case DIRECTION.LEFT: 
        // map = $dataMap.meta.west[0];
        destX += $dataMap.width - EDGE_THRESHOLD * 2;
        break;
      case DIRECTION.RIGHT: 
        // map = $dataMap.meta.east[0];
        destX -= $dataMap.width - EDGE_THRESHOLD * 2;
        break;
      case DIRECTION.UP: 
        // map = $dataMap.meta.north[0];
        destY += $dataMap.height - EDGE_THRESHOLD * 2;
        break;
    }

    this.reserveTransfer(map, destX, destY, dir, no_fade);
    $gameTemp.clearDestination();
  };

  // Game_Follower
  
  // Game_Followers

  // Game_Vehicle

  // Game_Event  
  // The game object class for an event. It contains functionality for event page
  // switching and running parallel process events.
  // 

})()
