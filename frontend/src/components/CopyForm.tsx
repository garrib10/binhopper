import { useId, useState, type FormEvent, type ReactNode } from 'react';
import type { CopyDetails } from '../collection';
import { GRADE_NAMES, GRADES, type Grade } from '../grades';

export interface PressingChoice { id: number; note: string; detail?: string }

/** Which pressing, media + sleeve grade, price paid, where bought, notes (mockup Owned.dc.html). */
export function CopyForm({ pressings, initialPressing, initial, submitLabel, busy, onSubmit, children }: {
  pressings: PressingChoice[];
  initialPressing: number | null;
  initial?: Partial<CopyDetails>;
  submitLabel: string;
  busy?: boolean;
  onSubmit: (pressingId: number, details: CopyDetails) => void;
  children?: ReactNode;
}) {
  const id = useId();
  const [pressing, setPressing] = useState<number | null>(initialPressing ?? (pressings.length === 1 ? pressings[0].id : null));
  const [media, setMedia] = useState<Grade | null>(initial?.media_grade ?? null);
  const [sleeve, setSleeve] = useState<Grade | null>(initial?.sleeve_grade ?? null);
  const [paid, setPaid] = useState(initial?.price_paid != null ? String(initial.price_paid) : '');
  const [boughtAt, setBoughtAt] = useState(initial?.bought_at ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (pressing === null) { setError('Choose which pressing you have'); return; }
    const price = paid.trim().replace(/^\$/, '');
    if (price !== '' && !(Number(price) >= 0)) { setError('Enter what you paid as a number, like 32'); return; }
    setError(null);
    onSubmit(pressing, { media_grade: media, sleeve_grade: sleeve, price_paid: price === '' ? null : Number(price),
      bought_at: boughtAt.trim() || null, notes: notes.trim() || null });
  }

  return <form className="copy-form" onSubmit={submit} noValidate>
    <fieldset className="copy-form__group">
      <legend>Which pressing?</legend>
      {pressings.length === 0 && <p className="muted">No vinyl pressings listed for this album yet.</p>}
      <div className="pressing-choices">{pressings.map((p) =>
        <button key={p.id} type="button" className="pressing-choice" aria-pressed={pressing === p.id} onClick={() => setPressing(p.id)}>
          <span className="pressing-choice__dot" aria-hidden="true" />
          <span><strong>{p.note}</strong>{p.detail && <span className="muted">{p.detail}</span>}</span>
        </button>)}</div>
    </fieldset>
    <GradePicker legend="Media condition (the vinyl)" value={media} onChange={setMedia} />
    <GradePicker legend="Sleeve condition" value={sleeve} onChange={setSleeve} />
    <div className="copy-form__pair">
      <div className="text-field"><label htmlFor={`${id}-paid`}>Paid ($)</label>
        <input id={`${id}-paid`} inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} /></div>
      <div className="text-field"><label htmlFor={`${id}-bought`}>Bought at</label>
        <input id={`${id}-bought`} maxLength={255} value={boughtAt} onChange={(e) => setBoughtAt(e.target.value)} /></div>
    </div>
    <div className="text-field"><label htmlFor={`${id}-notes`}>Notes</label>
      <textarea id={`${id}-notes`} rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
    {error && <p role="alert" className="notice notice--danger">{error}</p>}
    {children}
    <button type="submit" className="button button--primary button--block" disabled={busy}>{submitLabel}</button>
  </form>;
}

/** Grade chips: the abbreviation shows; screen readers also hear the full name. Tap again to clear. */
function GradePicker({ legend, value, onChange }: { legend: string; value: Grade | null; onChange: (g: Grade | null) => void }) {
  return <fieldset className="copy-form__group">
    <legend>{legend}</legend>
    <div className="grade-chips">{GRADES.map((g) =>
      <button key={g} type="button" className="grade-chip" aria-pressed={value === g} onClick={() => onChange(value === g ? null : g)}>
        {g} <span className="sr-only">({GRADE_NAMES[g]})</span></button>)}</div>
  </fieldset>;
}
