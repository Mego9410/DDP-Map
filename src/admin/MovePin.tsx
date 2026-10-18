import { updateLocation } from '../data/actions';
import { useUi } from '../store';

/** Bar shown while an admin drags a pin to the right building. */
export function MovePinBar() {
  const moving = useUi((s) => s.moving);
  const set = useUi((s) => s.set);
  if (!moving) return null;
  return (
    <div className="move-bar" role="region" aria-label="Move pin">
      <span>Drag the pin onto the counter.</span>
      <button type="button" className="btn btn--ghost" onClick={() => set({ moving: null })}>
        Cancel
      </button>
      <button
        type="button"
        className="btn btn--primary"
        onClick={async () => {
          const lng = Math.round(moving.lng * 1e6) / 1e6;
          const lat = Math.round(moving.lat * 1e6) / 1e6;
          await updateLocation(moving.id, { lng, lat, coord_source: 'manual' });
          set({ moving: null });
        }}
      >
        Save position
      </button>
    </div>
  );
}
