//=============================================================================
// RPG Maker MZ - FightFarmBattle
//=============================================================================

/*:
 * @target MZ
 * @plugindesc Battle Systems for Fight Farm
 * @author Hob Daytrain
 *
 * @help FightFarmBattle.js
 *
 * This plugin implements Battle systems for FightFarm.
 * 
 * 
 * 
 */

  //=============================================================================
  // Battle Init
  //=============================================================================
  (() => {
    const pluginName = "FightFarmBattle";
    DaytrainDev.FightFarmBattle = DaytrainDev.FightFarmBattle ?? {};
    DaytrainDev.FightFarmBattle.parameters = PluginManager.parameters(pluginName);

    //////////////////////////////////////////////////
    // Game_Battler // superclass for Game_Actor and Game_Enemy
    // see also:
    //   - Game_Action
    // 
    // Actor Overrides // $gameActors = new Game_Actors();
  
    //////////////////////////////////////////////////
    // Game_Unit // superclass for Game_Party and Game_Troop

    //////////////////////////////////////////////////
    // Party Overrides // $gameParty = new Game_Party();

    //////////////////////////////////////////////////
    // Troop Overrides // $gameTroop = new Game_Troop();

    // TODO: allow for parties of other players?

  })()
  