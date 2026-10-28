import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api';
import { ago, fetchListing, parsePrice, reportListing, type ReportableListing, type ReportResult } from '../reports';

const ANSWERS: [ReportResult, string][] = [['present', 'Yes, it’s there'], ['missing', 'Not on the shelf'], ['different_price', 'Different price']];
const THANKS: Record<ReportResult, string> = {
  present: 'Thanks! It’s marked verified for the next 24 hours.',
  missing: 'Thanks. If someone else says the same today, it’s marked “Reported missing.”',
  different_price: 'Thanks. We’ll show your price until the shop confirms.',
};
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** "I'm at the shop" (mockup Report.dc.html): one report per listing per day (AC-07). */
export function ReportPage() {
  const { id = '' } = useParams();
  const priceId = useId();
  const [listing, setListing] = useState<ReportableListing | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<ReportResult | null>(null);
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetchListing(Number(id), controller.signal).then((data) => {
      setListing(data);
      if (data.reported_today) setMessage({ tone: 'ok', text: 'You already reported this today. Thanks!' });
    }).catch((err) => {
      if (!controller.signal.aborted) setLoadError(err instanceof ApiError && err.status === 404 ? 'This listing is no longer shown.' : "Can't reach Binhopper right now.");
    });
    return () => controller.abort();
  }, [id]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!listing || !answer) { setMessage({ tone: 'error', text: 'Choose an answer first' }); return; }
    const reported = answer === 'different_price' ? parsePrice(price) : null;
    if (answer === 'different_price' && reported === null) { setMessage({ tone: 'error', text: 'Enter the price on the sticker, like 29' }); return; }
    setBusy(true);
    try {
      await reportListing(listing.listing_id, answer, reported);
      setDone(true);
      setMessage({ tone: 'ok', text: THANKS[answer] });
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof ApiError && err.status < 500 ? err.message : "Couldn't send your report. Try again." });
    } finally {
      setBusy(false);
    }
  }

  if (!listing) return <main id="content" className="page"><h1 className="display">I'm at the shop</h1>
    {loadError ? <p role="alert">{loadError}</p> : <p role="status">Loading…</p>}</main>;
  const closed = done || listing.reported_today;
  return <main id="content" className="page report-page">
    <Link className="back-link" to={`/albums/${listing.album.id}/stores`}>← {listing.store.name}</Link>
    <header><h1 className="display">I'm at the shop</h1>
      <p className="muted">Your reports keep stock honest for every digger nearby.</p></header>
    <form className="report-form" onSubmit={submit}>
      <fieldset className="copy-form__group" disabled={closed}>
        <legend className="section-title">Was {listing.album.title} on the shelf?</legend>
        <p className="muted">Listed: {listing.pressing_note} · {listing.condition} · {money.format(listing.price)} · {listing.quantity} in stock · {ago(listing.last_updated_at)}</p>
        <div className="report-answers">{ANSWERS.map(([key, label]) =>
          <button key={key} type="button" className="report-answer" aria-pressed={answer === key} onClick={() => setAnswer(key)}>{label}</button>)}</div>
        {answer === 'different_price' && <div className="text-field"><label htmlFor={priceId}>Price on the sticker ($)</label>
          <input id={priceId} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></div>}
      </fieldset>
      {message && <p className={`notice ${message.tone === 'ok' ? 'notice--ok' : 'notice--danger'}`} role={message.tone === 'ok' ? 'status' : 'alert'}>{message.text}</p>}
      {closed ? <Link className="button button--primary button--block" to={`/albums/${listing.album.id}/stores`}>Back to nearby stock</Link>
        : <button type="submit" className="button button--primary button--block" disabled={busy}>Submit</button>}
    </form>
  </main>;
}
