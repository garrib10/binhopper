import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api';
import { fetchSightingForm, parsePrice, reportSighting, type SightingForm } from '../reports';

/**
 * "I saw it here" at a shop with no online inventory (Nearby stock rule 9, AC-18). The answer
 * becomes a normal stock card, so it asks for what a card shows: pressing, condition, price.
 */
export function SightingPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const albumId = Number(params.get('album'));
  const priceId = useId();
  const [form, setForm] = useState<SightingForm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pressing, setPressing] = useState<number | null>(null);
  const [condition, setCondition] = useState<'New' | 'Used' | null>(null);
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetchSightingForm(Number(id), albumId, controller.signal).then((data) => {
      setForm(data);
      if (data.pressings.length === 1) setPressing(data.pressings[0].id);
    }).catch((err) => {
      if (!controller.signal.aborted) setLoadError(err instanceof ApiError && err.status < 500 ? err.message : "Can't reach Binhopper right now.");
    });
    return () => controller.abort();
  }, [id, albumId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = parsePrice(price);
    if (pressing === null) { setError('Choose which pressing you saw'); return; }
    if (condition === null) { setError('Choose new or used'); return; }
    if (value === null) { setError('Enter the price on the sticker, like 24'); return; }
    setBusy(true); setError(null);
    try {
      await reportSighting(Number(id), { album_id: albumId, pressing_id: pressing, condition, price: value });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError && err.status < 500 ? err.message : "Couldn't send your report. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const back = `/albums/${albumId}/stores`;
  if (!form) return <main id="content" className="page"><h1 className="display">I saw it here</h1>
    {loadError ? <p role="alert">{loadError} <Link to={back}>Back to nearby stock</Link></p> : <p role="status">Loading…</p>}</main>;
  if (done) return <main id="content" className="page report-page">
    <h1 className="display">Thanks!</h1>
    <p role="status" className="notice notice--ok">{form.store.name} now shows {form.album.title} in nearby stock, verified for the next 24 hours.</p>
    <Link className="button button--primary button--block" to={back}>Back to nearby stock</Link>
  </main>;
  return <main id="content" className="page report-page">
    <Link className="back-link" to={back}>← Nearby stock</Link>
    <header><h1 className="display">I saw it here</h1>
      <p className="muted">{form.store.name}{form.store.area ? ` · ${form.store.area}` : ''}</p></header>
    <form className="report-form" onSubmit={submit} noValidate>
      <fieldset className="copy-form__group">
        <legend className="section-title">Which {form.album.title} did you see?</legend>
        <div className="pressing-choices">{form.pressings.map((p) =>
          <button key={p.id} type="button" className="pressing-choice" aria-pressed={pressing === p.id} onClick={() => setPressing(p.id)}>
            <span className="pressing-choice__dot" aria-hidden="true" />
            <span><strong>{p.note}</strong>{p.detail && <span className="muted">{p.detail}</span>}</span>
          </button>)}</div>
      </fieldset>
      <fieldset className="copy-form__group">
        <legend>New or used?</legend>
        <div className="report-answers">{(['New', 'Used'] as const).map((c) =>
          <button key={c} type="button" className="report-answer" aria-pressed={condition === c} onClick={() => setCondition(c)}>{c}</button>)}</div>
      </fieldset>
      <div className="text-field"><label htmlFor={priceId}>Price on the sticker ($)</label>
        <input id={priceId} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
      {error && <p role="alert" className="notice notice--danger">{error}</p>}
      <button type="submit" className="button button--primary button--block" disabled={busy}>Add to nearby stock</button>
    </form>
  </main>;
}
