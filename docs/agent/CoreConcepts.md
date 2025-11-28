# CFG Core Concepts

A Tabletop Role-Playing Game Can be broken down into some basic concepts. These will be included in the "foundry-core-concepts" plugin to make FoundryVTT more adaptable to playing on the CFG platform, as well as baked into our data schemas.

- tabletop (surface where all gameplay takes place, may be virtual, physical or anywhere in between)
- sheets/hands (in most games, for tracking resources, keeping score, and storing info from "cards", "books", and other sources)
- attributes (things to track, such as name or experience points)
- types (things like class, creature type, or other complex items; may be filled by a "card")
- dice (in most games)
- tables (in most games)
- books (contain rules, cards, tables, systems, modes, and other data)
- cards (things like permanent stat blocks for NPCs, Spell, and Item Descriptions; can define a "type" and "properties")
- deck (a set of cards)
- boards (maps, the battlegrid if a grid exists, represents the play area, can hold several location "sheets", with "wilderness" or "path" tiles between them; gridless boards are measured in voxels instead of pixels; pixels represent units going down to 0.1 of an inch at the lowest scale; can be 2d or 3d)
- tokens (represents the position and space occupied by a creature or object on a board or within a location)
- tiles (a single space on the board, usually square, hex, block, etc; a "tile" depends on the scale and dimensions of the board/map)
- voxels (volumetric zones representing abstract distance rather than precise position; used for positioning tokens/creatures on boards; voxel size matches tile scale but supports narrative-first movement systems; enables theater-of-the-mind gameplay with optional visual aids)
- sessions (entire game or portion of full game)
- campaigns (keeps track of multiple sessions if needed for longer games and ongoing ttrpg campaigns)
- events (usually several, knight takes rook)
- spectators (people watching the game ut not actively playing)
- players (defined by the game system, everyone playing the game, including the GM)
- teams (defined by the game system, such as an adventuring party or team of collaborating GMs)
- roles (defined for each campaign; GM or Player, or in some campaigns, Players and GMs may have more specific roles)



complex core concepts
---------------------
- rules (usually at least one)
- modes (usually at least one, Character Creation, Combat, Exploration, Social Interaction, Travel, Downtime, etc are examples of implemented systems; "downtime" is a flag that means a mode is available outside of FoundryVTT via the "Core Concepts" API schema)
- subsystems (usually at least one; assembles rules into mechanics used by modes)



core card & sheet concepts
-------------------
- creatures (including player characters)
- locations (at least one, can be as small as a single pixel/voxel)
- objects (things which are not creatures which exist within the worldspace; usually at least one)
- activities (things players can do to trigger events through modes, like moving a chess piece in a game of chess; downtime flag means it can be triggered asynchronously, outside of the FoundryVTT platform via the "Core Concepts" API schema)
- goals (take the opponent's king, save the princess, etc)



API Support
-----------
- "downtime" activities and modes for interacting with game subsystems without being logged into the FoundryVTT instance





---------------------------------------------------------
DEV NOTES:

Foundry tables are okay because Foundry is a core integration for us

duplicates should be removed and "Rpg" or "Crit" prefixes should be applied; "Rpg" for core concepts, and "Crit" for cfg expansions and website tables

I want "RpgSheets", to be universal for storing campaign-specific data, including locations. Any creature, object, location, game system, or anything else can have a "sheet". "hand" of cards can be a sheet internally as well, just like a creature or a location, since those are related to players. I will update the docs to mention that a sheet and a hand can be the same thing.

"RpgSystems", "RpgModes", "RpgSubSystems" ("RpgSystems" are top level systems", these are "systems" in our core concepts), "RpgRules" are important core concept tables for relating different rule elements and systems together

"RpgCreature", "RpgLocation", and "RpgObject" some sheets will include these things. We can store data about them here that does not belong on their character sheet. We will use this mainly for using internal systems to drive things like npcs and randomized loot. 

"RpgAttributes", "RpgTypes", "RpgDice", "RpgTables", "RpgBooks", "RpgCards", "RpgDeck", these are needed to define compendiums, rules, adventure content, etc. A Card can be a stat-block, or linked to an in-game "object" which is also a card

"RpgBoard", "RpgTiles", "RpgVoxels", - used to put a map together from tile data; contains tile image paths for various scales and dimensions; voxels are useful for calculating movement for non-grid games, and can be used for 3D enhancements int he future

"RpgEvents", "RpgActivities" (includes "downtime" bool), "RpgGoals", "RpgSessions", "RpgCampaigns", "RpgWorld" - these will be tied heavily into the web side of things to allow players to view and interact with their world while it is offline.

