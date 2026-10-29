import { Link } from 'react-router-dom';
import type { NearbyStore, OtherShop } from '../api';

/** "2 hr ago", "9 days ago" (mockup StaleStock.dc.html); the API sends naive UTC times. */
export function age(iso: string | null | undefined, now = Date.now()): string | null {
  if (!iso) return null;
  const hours = Math.max(0, Math.floor((now - Date.parse(iso.endsWith('Z') ? iso : `${iso}Z`)) / 3_600_000));
  if (hours < 1) return 'just now';
  if (hours < 48) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

/** The freshness line on each card (SPEC › Nearby stock rules 5 and 6). */
function freshnessLine(store: NearbyStore, now: number): string {
  const when = age(store.last_updated_at, now);
  switch (store.freshness) {
    case 'verified': return `Verified on the shelf${when ? ` ${when}` : ''}`;
    case 'out_of_date': return `May be out of date: stock last updated ${when ?? 'over a week ago'}. It may have sold. Call before you make the trip.`;
    case 'reported_missing': {
      const n = store.missing_reports ?? 2;
      return `Reported missing today: ${n} ${n === 1 ? 'person' : 'people'} didn't find it`;
    }
    default: return 'Current stock';
  }
}

const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

interface Props {
  store: NearbyStore;
  index: number;
  now?: number;
}

/** Call and Directions, shared by stock cards and call-to-check cards. */
function ShopActions({ name, phone, lat, lng, callLabel }: {
  name: string; phone?: string | null; lat?: number; lng?: number; callLabel: string;
}) {
  const digits = phone?.replace(/[^+\d]/g, '');
  return (
    <div className="store-card__actions">
      {digits && <a className="button" href={`tel:${digits}`}>{callLabel}</a>}
      {Number.isFinite(lat) && Number.isFinite(lng) &&
        <a className="button" href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
          aria-label={`Directions to ${name}`}>Directions</a>}
    </div>
  );
}

export function StoreCard({ store, index, now = Date.now() }: Props) {
  const stale = store.freshness === 'out_of_date';
  return (
    <li className={`store-card store-card--${store.freshness}`}>
      <div className="store-card__row">
        <span className="store-card__pin" aria-hidden="true">
          {index + 1}
        </span>
        <div className="store-card__info">
          <h3 className="store-card__name">{store.store_name}</h3>
          <p className="store-card__meta">
            {store.distance_mi} mi{store.area ? ` · ${store.area}` : ''}
          </p>
          <div className="store-card__tags">
            <span className="tag tag--ok">{store.quantity} in stock</span>
            <span className="tag">
              {store.condition}
              {store.pressing_note ? ` · ${store.pressing_note}` : ''}
            </span>
          </div>
          <p className="store-card__freshness">{freshnessLine(store, now)}</p>
          {store.source === 'discogs' && store.discogs_url &&
            <a href={store.discogs_url}>Data provided by Discogs.</a>}
        </div>
        <span className="store-card__price">{price.format(store.price)}{stale && <>
          <span aria-hidden="true">?</span><span className="sr-only"> (price may have changed)</span></>}</span>
      </div>
      <ShopActions name={store.store_name} phone={store.phone} lat={store.lat} lng={store.lng}
        callLabel={store.freshness === 'out_of_date' ? 'Call to confirm' : 'Call shop'} />
      <div className="store-card__links">
        <Link className="store-card__report" to={`/records/${store.listing_id}`}
          aria-label={`Hold or buy: ${store.store_name}`}>Hold or buy</Link>
        {/* A stale listing asks the visitor who called or went to say what they found. */}
        <Link className="store-card__report" to={`/stock/${store.listing_id}/report`}
          aria-label={`${stale ? 'I checked it' : 'Report stock'}: ${store.store_name}`}>{stale ? 'I checked it' : 'Report stock'}</Link>
      </div>
    </li>
  );
}

/** No-inventory variant (Nearby stock rule 9): no price, stock or freshness, just call and go. */
export function OtherShopCard({ shop, albumId }: { shop: OtherShop; albumId: number }) {
  return (
    <li className="store-card store-card--no-inventory">
      <div className="store-card__info">
        <h3 className="store-card__name">{shop.name}</h3>
        <p className="store-card__meta">{shop.distance_mi} mi{shop.area ? ` · ${shop.area}` : ''}</p>
        <p className="store-card__freshness">No online inventory{shop.phone ? '' : ': stop by to check'}</p>
      </div>
      <ShopActions name={shop.name} phone={shop.phone} lat={shop.lat} lng={shop.lng} callLabel="Call to check" />
      <Link className="store-card__report" to={`/stores/${shop.store_id}/report?album=${albumId}`}
        aria-label={`I saw it here: ${shop.name}`}>I saw it here</Link>
    </li>
  );
}
