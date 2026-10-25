import type { Freshness, NearbyStore } from '../api';

const FRESHNESS_LABEL: Record<Freshness, string | null> = {
  verified: 'Verified on the shelf',
  current: 'Current stock',
  out_of_date: 'May be out of date: call to confirm',
  reported_missing: 'Reported missing today',
};

const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

interface Props {
  store: NearbyStore;
  index: number;
}

export function StoreCard({ store, index }: Props) {
  const label = FRESHNESS_LABEL[store.freshness];
  const phone = store.phone?.replace(/[^+\d]/g, '');
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
          {label && <p className={`store-card__freshness`}>{label}</p>}
          {store.source === 'discogs' && store.discogs_url &&
            <a href={store.discogs_url}>Data provided by Discogs.</a>}
        </div>
        <span className="store-card__price">{price.format(store.price)}</span>
      </div>
      <div className="store-card__actions">
        {phone && <a className="button" href={`tel:${phone}`}>
          {store.freshness === 'out_of_date' ? 'Call to confirm' : 'Call shop'}</a>}
        {Number.isFinite(store.lat) && Number.isFinite(store.lng) &&
          <a className="button" href={`https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`}
            aria-label={`Directions to ${store.store_name}`}>Directions</a>}
      </div>
    </li>
  );
}
