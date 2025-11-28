CFG Tile Rendering for 5e-compatible (and other ttrpg) play
---------------------
For each scale, we will use the appropriately sized source image, or the original source image resolution, whichever is closer to the scale we need. Not that all views will have zoom controlls, there are the base "100%" values. When zooming in, a higher resolution image can be loaded as available. We want to support all of these resolutions, and make sure we retain the original file and resolution as well, so we can choose a source tile or tileset dynamically depending on the zoom level and screen size.


milli = x1/1,000
centi = x1/100
deci = x1/10
kilo = x1,000
mega = x1,000,000
giga = x1,000,000,000

1 milli-inch = 1/1000 inch (di)
1 centi-inch = 1/100 inch (di)
1 deci-inch = 1/10 inch (di)

1 deci-mile = 528 deca-feet (Dm)
1 kilo-foot = 1,000 feet (Kft)

1 hexa-mile = 6 miles (Hm)
1 decahexa-mile = 60 miles (DHm)
1 centahexa-mile = 600 miles (CHm)
1 kilo-mile = 1000 miles (Km)
1 kilohexa-mile = 6000 miles (KHm)


For reference, Earth's diameter is about 7,926 miles, or just under 8 kilo-miles.
Earth's Circumference is 24,901.461 miles, or about 25 Km

Interaction Scale Voxel Scale
-----------------
Square Tile Dimensions = gridless, 600 x 600 pixels, where each pixel is 0.1 inches (10 pixels per inch) OR 6000 x 6000 pixels, where each pixel is 0.01 inches (100 pixels per inch)


Arena Square, Hex, or Voxel Scale
------------
Square Tile Dimensions = 5ft squares, 60 x 60 x 3 pixels, where each pixel is 1 inch


Exploration Square, Hex, or Voxel Scales
------------------
Building -> Square Tile Dimensions (Inside Buildings, Dungeons, Adventure Locations, Encounters, Small Paths) = 10 ft squares, 30 x 30 x 3 pixels, where each pixel is 4 inches


Exploration Hex Scales
----------------------
Settlement/Wilderness -> Hex Tile Dimensions (Settlement / Natural Feature / Wilderness / Small River / Large Path) = 30 ft hexes, 34 x 30 x 5 pixels, where each pixel is 1ft square (may contain interiors/buildings/dungeons, wilderness, and smaller settlements)



Travel / Minimap Scale
------------
Hex Tile Dimensions (County / Wilderness / Small Lake / Large River) = 0.1 mile hex, 610 x 528 pixels, where each pixel is 1 ft Square (may contain Adventure Locations, Encounters, Settlements, Wilderness, and smaller counties)
Hex Tile Dimensions (Province/Small Sea/ Large Lake) = 1 mile hex, 610 x 528 pixels, where each pixel is 10 ft Square (may contain counties, wilderness, and smaller provinces)
Hex Tile Dimensions (Kingdom/Gulf/Large Sea) = 6 mile hex, 610 x 528 pixels, where each pixel is 60 ft Square (may contain provinces, wilderness, and smaller kingdoms)
Hex Tile Dimensions (Continent/Ocean) = 60 mile hex, 610 x 528 pixels, where each pixel is 600 ft Square (may contain kingdoms, seas, islands (various smaller scales), and wilderness)



Voxel Space Scales 
------------
Hex tiles unite to form many-sided near-spherical objects anchored on voxels.


Planetary Region Scale
-------------
Hex Tile Dimensions (Realm) = 100 mile voxel, where each pixel is 0.1 mile (contains oceans/continents)
Hex Tile Dimensions (Planet/Plane) = 1,000 mile voxel, where each pixel is 1 mile (contains realms)
Hex Tile Dimensions (Orbital Space) = 6,000 mile voxel, where each pixel is 6 miles (contains worlds/planes + moons + alternate dimensions)
Hex Tile Dimensions (Star System) = 60,000 mile voxel, where each pixel is 60 miles (contains orbital spaces)




------------------------------------------------------------
Astronomical Scale (AU-based)
-------------
Voxel Tile Dimensions (Inner System) = 0.1 AU voxel, where each AU-pixel represents 0.001 AU (contains inner planets, habitable zone)
Voxel Tile Dimensions (Planetary System) = 1 AU voxel, where each AU-pixel represents 0.01 AU (contains inner/mid planets, main asteroid belt)
Voxel Tile Dimensions (Outer System) = 6 AU voxel, where each AU-pixel represents 0.06 AU (contains outer planets, Kuiper belt)
Voxel Tile Dimensions (Extended System) = 60 AU voxel, where each AU-pixel represents 0.6 AU (contains scattered disc, inner Oort cloud)


Inter-Stellar Scale (Light Year-based)
--------------------
Voxel Tile Dimensions (Local Binary) = 0.1 LY voxel, where each LY-pixel represents 0.001 LY (contains nearest neighboring stars, binary systems)
Voxel Tile Dimensions (Stellar Neighborhood) = 1 LY voxel, where each LY-pixel represents 0.01 LY (contains local star cluster)
Voxel Tile Dimensions (Stellar Region) = 6 LY voxel, where each LY-pixel represents 0.06 LY (contains multiple neighborhoods)
Voxel Tile Dimensions (Sector) = 60 LY voxel, where each LY-pixel represents 0.6 LY (contains star-forming regions, nebulae)

Galactic Scale (Kilolight Year-based)
--------------------
Voxel Tile Dimensions (Regional Sector) = 0.1 KLY (100 LY) voxel, where each KLY-pixel represents 0.001 KLY (1 LY) (contains multiple sectors)
Voxel Tile Dimensions (Galactic Arm Segment) = 1 KLY (1,000 LY) voxel, where each KLY-pixel represents 0.01 KLY (10 LY) (contains arm sections)
Voxel Tile Dimensions (Galactic Arm) = 6 KLY (6,000 LY) voxel, where each KLY-pixel represents 0.06 KLY (60 LY) (contains major spiral arms)
Voxel Tile Dimensions (Galaxy) = 60 KLY (60,000 LY) voxel, where each KLY-pixel represents 0.6 KLY (600 LY) (contains entire galaxies)

Universal Scale (Megalight Year-based)
--------------------
Voxel Tile Dimensions (Local Group) = 0.1 MLY (100 KLY) voxel, where each MLY-pixel represents 0.001 MLY (1 KLY) (contains nearby galaxies)
Voxel Tile Dimensions (Galactic Cluster) = 1 MLY (1,000 KLY) voxel, where each MLY-pixel represents 0.01 MLY (10 KLY) (contains galaxy clusters)
Voxel Tile Dimensions (Supercluster) = 6 MLY (6,000 KLY) voxel, where each MLY-pixel represents 0.06 MLY (60 KLY) (contains superclusters)
Voxel Tile Dimensions (Universe) = 60 MLY (60,000 KLY) voxel, where each MLY-pixel represents 0.6 MLY (600 KLY) (contains observable universe sections)

Multiverse = Not a table, just the conceptual collection of all universes