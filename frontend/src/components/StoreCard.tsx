import { Link } from 'react-router-dom';
import type { Freshness, NearbyStore, OtherShop } from '../api';

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

export function StoreCard({ store, index }: Props) {
  const label = FRESHNESS_LABEL[store.freshness];
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
      <ShopActions name={store.store_name} phone={store.phone} lat={store.lat} lng={store.lng}
        callLabel={store.freshness === 'out_of_date' ? 'Call to confirm' : 'Call shop'} />
      <div className="store-card__links">
        <Link className="store-card__report" to={`/records/${store.listing_id}`}
          aria-label={`Hold or buy: ${store.store_name}`}>Hold or buy</Link>
        <Link className="store-card__report" to={`/stock/${store.listing_id}/report`}
          aria-label={`Report stock: ${store.store_name}`}>Report stock</Link>
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
