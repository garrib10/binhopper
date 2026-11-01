import { useId, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api';
import { describeLoadError, LoadError, type LoadProblem } from '../components/LoadError';
import { forgetPageData, usePageData } from '../pageData';
import { ago, fetchListing, parsePrice, reportListing, type ReportableListing, type ReportResult } from '../reports';
import { PagePlaceholder } from '../components/PagePlaceholder';

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
  const [attempt, setAttempt] = useState(0);
  // Usually already fetched from the Nearby card, so the form draws complete at once.
  const { data: listing, error: failed } = usePageData<ReportableListing>(`stock:${id}`, () => fetchListing(Number(id)), attempt);
  const loadError: LoadProblem | null = failed ? describeLoadError(failed, 'This listing is no longer shown. It may have sold.') : null;
  const [answer, setAnswer] = useState<ReportResult | null>(null);
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

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
      forgetPageData(`stock:${listing.listing_id}`);  // the next visit shows today's report
      forgetPageData(`listing:${listing.listing_id}`);
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof ApiError && err.status < 500 ? err.message : "Couldn't send your report. Try again." });
    } finally {
      setBusy(false);
    }
  }

  if (!listing) return <main id="content" className="page"><h1 className="display">I'm at the shop</h1>
    {loadError ? <LoadError problem={loadError} onRetry={() => setAttempt((n) => n + 1)} back={{ to: '/search', label: 'Back to search' }} />
      : <PagePlaceholder label="Loading this listing…" />}</main>;
  const closed = done || listing.reported_today;
  const shown = message ?? (listing.reported_today ? { tone: 'ok' as const, text: 'You already reported this today. Thanks!' } : null);
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
      {shown && <p className={`notice ${shown.tone === 'ok' ? 'notice--ok' : 'notice--danger'}`} role={shown.tone === 'ok' ? 'status' : 'alert'}>{shown.text}</p>}
      {closed ? <Link className="button button--primary button--block" to={`/albums/${listing.album.id}/stores`}>Back to nearby stock</Link>
        : <button type="submit" className="button button--primary button--block" disabled={busy}>Submit</button>}
    </form>
  </main>;
}
