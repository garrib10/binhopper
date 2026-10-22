import { RADII, type Radius } from '../api';

interface Props {
  value: Radius;
  onChange: (radius: Radius) => void;
}

/** Segmented 10 / 25 / 50 / 100 mi control (mockup: Stores.dc.html). */
export function RadiusPicker({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="Search radius" className="segmented">
      {RADII.map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={r === value}
          className="segmented__option"
          onClick={() => onChange(r)}
        >
          {r} mi
        </button>
      ))}
    </div>
  );
}
