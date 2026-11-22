import { parseTileMap } from '@/game/world/TileMapParser';

describe('TileMapParser', () => {
  it('parses valid map data correctly', () => {
    const raw = {
      id: 'test_map',
      name: 'Test Map',
      width: 4,
      height: 3,
      tilewidth: 32,
      tileheight: 32,
      spawnPoint: { x: 64, y: 32 },
      layers: [
        {
          name: 'Ground',
          data: [1, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1],
        },
      ],
    };

    const map = parseTileMap(raw);
    expect(map.id).toBe('test_map');
    expect(map.widthInTiles).toBe(4);
    expect(map.heightInTiles).toBe(3);
    expect(map.tileSize).toBe(32);
    expect(map.layers.length).toBe(1);
    expect(map.layers[0].data.length).toBe(12);
    expect(map.spawnPoint).toEqual({ x: 64, y: 32 });
  });

  it('throws when layer data length does not match width * height', () => {
    const invalidRaw = {
      width: 3,
      height: 3,
      tilewidth: 16,
      tileheight: 16,
      layers: [
        {
          name: 'BrokenLayer',
          data: [1, 2, 3], // Expected 9
        },
      ],
    };

    expect(() => parseTileMap(invalidRaw)).toThrow(/does not match map dimensions/);
  });

  it('throws when map dimensions are zero or negative', () => {
    expect(() =>
      parseTileMap({
        width: 0,
        height: 5,
        tilewidth: 16,
        tileheight: 16,
        layers: [],
      })
    ).toThrow(/Invalid map dimensions/);
  });
});
