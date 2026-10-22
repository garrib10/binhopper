import type { ThemePreference } from '../theme';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Match system' },
];

interface Props {
  value: ThemePreference;
  onChange: (pref: ThemePreference) => void;
}

export function ThemePicker({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="Appearance" className="segmented segmented--compact">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          className="segmented__option"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
