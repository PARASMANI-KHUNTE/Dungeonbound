import villageOutskirtsJson from '../../../../assets/maps/village_outskirts.json';
import { MapDefinition } from '@/game/world/MapDefinition';
import { parseTileMap, RawTiledMapData } from '@/game/world/TileMapParser';

export const VILLAGE_OUTSKIRTS_MAP: MapDefinition = parseTileMap(
  villageOutskirtsJson as RawTiledMapData,
  'village_outskirts'
);
