//=============================================================================
// RPG Maker MZ - FightFarmCore
//=============================================================================

/*:
 * @target MZ
 * @plugindesc Core Systems for Fight Farm
 * @author Hob Daytrain
 *
 * @help FightFarmCore.js
 *
 * This plugin implements core systems for FightFarm.
 * 
 * Plugin Order:
 * - Core
 * - Time
 * - Battle
 * - Map
 *
 */

// TODO: make configurable
var DaytrainDev = DaytrainDev ?? {};

  //=============================================================================
  // Core Init
  //=============================================================================
(() => {
  const pluginName = "FightFarmCore";
  DaytrainDev.FightFarmCore = DaytrainDev.FightFarmCore ?? {};
  DaytrainDev.FightFarmCore.parameters = PluginManager.parameters(pluginName);

  // Game Objects  // js\rmmz_objects.js

  //////////////////////////////////////////////////
  // Temp Overrides // $gameTemp = new Game_Temp();
  // const _Game_Temp_initialize = Game_Temp.prototype.initialize;
  // Game_Temp.prototype.initialize = function() {
  //   _Game_Temp_initialize.call(this);
  //   // TODO: additional temp data here
  // }

  //////////////////////////////////////////////////
  // System Overrides // $gameSystem = new Game_System();
  // const _Game_System_initialize = Game_System.prototype.initialize;
  // Game_System.prototype.initialize = function() {
  //   _Game_System_initialize.call(this);
  //   // TODO: additional system init here
  // }

  // Game_Interpreter

  //////////////////////////////////////////////////
  // Screen Overrides // $gameScreen = new Game_Screen();
  // const _Game_Screen_initialize = Game_Screen.prototype.initialize;
  // Game_Screen.prototype.initialize = function() {
  //   _Game_Screen_initialize.call(this);
  //   // TODO: additional screen init here
  // }
  
  //////////////////////////////////////////////////
  // Message Overrides // $gameMessage = new Game_Message();
  // const _Game_Message_initialize = Game_Message.prototype.initialize;
  // Game_Message.prototype.initialize = function() {
  //   _Game_Message_initialize.call(this);
  //   // TODO: additional message init here
  // }

  //////////////////////////////////////////////////
  // Game_Item // The game object class for handling skills, items, weapons, and armor. It is required because 
  //           // save data should not include the database object itself.
  // const _Game_Item_initialize = Game_Item.prototype.initialize;
  // Game_Item.prototype.initialize = function() {
  //   _Game_Item_initialize.call(this);
  //   // TODO: additional item init here
  // }

  //////////////////////////////////////////////////
  // Switches Overrides // $gameSwitches = new Game_Switches();
  // const _Game_Switches_initialize = Game_Switches.prototype.initialize;
  // Game_Switches.prototype.initialize = function() {
  //   _Game_Switches_initialize.call(this);
  //   // TODO: additional switches init here
  // }

  //////////////////////////////////////////////////
  // Variables Overrides // $gameVariables = new Game_Variables();
  // const _Game_Variables_initialize = Game_Variables.prototype.initialize;
  // Game_Variables.prototype.initialize = function() {
  //   _Game_Variables_initialize.call(this);
  //   // TODO: additional variables init here
  // }


  //////////////////////////////////////////////////
  // Self Switches Overrides // $gameSelfSwitches = new Game_SelfSwitches();
  // const _Game_SelfSwitches_initialize = Game_SelfSwitches.prototype.initialize;
  // Game_SelfSwitches.prototype.initialize = function() {
  //   _Game_SelfSwitches_initialize.call(this);
  //   // TODO: additional SelfSwitches init here
  // }


  //=============================================================================
  // PluginManager
  //=============================================================================
  // PluginManager.registerCommand(pluginName, "Enter Map", (mapId) => {
  //   // TODO: enter map id
  // });
})()
