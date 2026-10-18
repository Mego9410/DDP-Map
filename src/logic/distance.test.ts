import { describe, expect, it } from 'vitest';
import { formatWalk, haversine, nearest, walkMinutes } from './distance';

describe('distance', () => {
  it('haversine is zero for the same point', () => {
    expect(haversine({ lng: -81.58, lat: 28.41 }, { lng: -81.58, lat: 28.41 })).toBe(0);
  });

  it('one thousandth of a degree of latitude is about 111 m', () => {
    const d = haversine({ lng: -81.58, lat: 28.41 }, { lng: -81.58, lat: 28.411 });
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });

  it('Cinderella Castle to Spaceship Earth is roughly 5.4 km', () => {
    const d = haversine({ lng: -81.5812, lat: 28.4192 }, { lng: -81.5494, lat: 28.3752 });
    expect(d).toBeGreaterThan(5500);
    expect(d).toBeLessThan(6000);
  });

  it('walking minutes at 80 m/min, minimum 1', () => {
    expect(walkMinutes(0)).toBe(1);
    expect(walkMinutes(400)).toBe(5);
    expect(formatWalk(800)).toBe('10 min walk');
    expect(formatWalk(12000)).toBe('12 km away');
  });

  it('nearest skips items without coordinates', () => {
    const r = nearest({ lng: 0, lat: 0 }, [
      { id: 'a', lng: null, lat: null },
      { id: 'b', lng: 0.01, lat: 0 },
      { id: 'c', lng: 0.001, lat: 0 },
    ]);
    expect(r?.item.id).toBe('c');
    expect(nearest({ lng: 0, lat: 0 }, [])).toBeNull();
  });
});
