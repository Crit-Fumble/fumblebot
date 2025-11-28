//=============================================================================
// RPG Maker MZ - FightFarmTimer
//=============================================================================

/*:
 * @target MZ
 * @plugindesc Timer Systems for Fight Farm
 * @author Hob Daytrain
 *
 * @help FightFarmTimer.js
 *
 * This plugin implements timer systems for FightFarm.
 * 
 * 
 * 
 */

const FRAMES_IN_SECOND = 60;
const SECONDS_IN_ROUND = 6;
const SECONDS_IN_MINUTE = 60;
const ROUNDS_IN_MINUTE = 10;
const MINUTES_IN_HOUR = 60;
const HOURS_IN_DAY = 24;
const DAYS_IN_SEASON = 90;
const SEASONS_IN_YEAR = 4;

  //=============================================================================
  // Time Init
  //=============================================================================
(() => {
  const pluginName = "FightFarmTime";
  DaytrainDev.FightFarmTime = DaytrainDev.FightFarmTime ?? {};
  DaytrainDev.FightFarmTime.parameters = PluginManager.parameters(pluginName);

  // Game Objects  // js\rmmz_objects.js
  //////////////////////////////////////////////////
  // Timer Overrides 
  const _Game_Timer_initialize = Game_Timer.prototype.initialize;
  Game_Timer.prototype.initialize = function() {

    // TODO: make these plugin params
    this.time = {
      frame: 0,
      second: 0,
      round: 1,
      minute: 0,
      hour: 7,
      day: 1,
      season: 1,
      year: 800,
    }
    
    _Game_Timer_initialize.call(this);
  };

  Game_Timer.prototype.runYear = function() {
    // console.log('Run Year Logic');
    
  };

  Game_Timer.prototype.runSeason = function() {
    // console.log('-Run Season Logic');

  };

  Game_Timer.prototype.runDay = function() {
    // console.log('--Run Day Logic');
    // Realm Update

  };

  Game_Timer.prototype.runHour = function() {
    // console.log('---Run Hour Logic');
    // Zone Update

  };

  Game_Timer.prototype.runMinute = function() {
    // console.log('----Run Minute Logic');
    // Region Update

  };

  Game_Timer.prototype.runRound = function() {
    // console.log('-----Run Round Logic');
    // Battle Update

  };

  Game_Timer.prototype.runSecond = function() {
    // console.log('------Run Second Logic');
    // Battle Update

  };

  Game_Timer.prototype.runFrame = function() {

  };
  
  Game_Timer.prototype.tick = function() {
    ++this.time.frame;
    this.runFrame();
    if (this.time.frame >= FRAMES_IN_SECOND) {
      this.time.frame -= FRAMES_IN_SECOND;
      ++this.time.second
      this.runSecond();
      if (this.time.second >= SECONDS_IN_ROUND) {
        this.time.second -= SECONDS_IN_ROUND;
        ++this.time.round;
        this.runRound();
        if (this.time.round > ROUNDS_IN_MINUTE) {
          this.time.round -= ROUNDS_IN_MINUTE;
          ++this.time.minute;
          this.runMinute();
          if (this.time.minute >= MINUTES_IN_HOUR) {
            this.time.minute -= MINUTES_IN_HOUR;
            ++this.time.hour;
            this.runHour();
            if (this.time.hour >= HOURS_IN_DAY) {
              this.time.hour -= HOURS_IN_DAY;
              ++this.time.day
              this.runDay();
              if (this.time.day >= DAYS_IN_SEASON) {
                this.time.day -= DAYS_IN_SEASON;
                if (++this.time.season >= SEASONS_IN_YEAR) {
                  this.time.season -= SEASONS_IN_YEAR;
                  ++this.time.year;
                  this.runYear();
                };
              };
            };
          };
        }
      };
    };
  }

  const _Game_Timer_update = Game_Timer.prototype.update;
  Game_Timer.prototype.update = function() {
    this.tick();
    _Game_Timer_update.call(this);
  }

  
  Game_Timer.prototype.getTimeText = function() {
    // TODO?: AM/PM
    return `${this.time.hour.padZero(2)}:${this.time.minute.padZero(2)} ${this.time.day}/${this.time.season}/${this.time.year}`;
  };
})()