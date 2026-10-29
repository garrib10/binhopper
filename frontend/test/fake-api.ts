import type { Page } from './fixtures';

// A small, signed-in fake of the whole API with fictional data, so every screen can be
// opened in the mocked E2E suite (#74). Each test can still route an endpoint itself first.
const artist = { id: 1, name: 'Fleetwood Mac' };
const album = { id: 1, title: 'Rumours', artist, year: 1977, format: 'LP', cover_url: null, label: 'Warner Bros.',
  store_count: 2, lowest_price: 18, nearest_outside_mi: null, discogs_url: 'https://www.discogs.com/master/1',
  genres: ['Rock'], release_type: 'master', tracklist: [{ position: 'A1', title: 'Second Hand News' }, { position: 'B1', title: 'The Chain' }],
  pressings: [{ id: 11, label: 'Warner Bros.', format: 'LP', variant_note: 'Original press', exclusive_kind: null, exclusive_to: null },
    { id: 12, label: 'Warner Bros.', format: 'LP', variant_note: '180g reissue', exclusive_kind: 'retailer', exclusive_to: 'Shop' }] };
const store = (id: number, name: string, freshness: string, price: number, miles: number) => ({ listing_id: id, store_id: id, store_name: name,
  area: 'Chelsea', distance_mi: miles, lat: 40.74 + id / 100, lng: -74, phone: '+1 212 555 010' + id, pressing_id: 12,
  pressing_note: '180g reissue', price, condition: 'New', quantity: 1, freshness, last_updated_at: null, source: 'manual' });
const copy = { id: 5, album: { id: 1, title: 'Rumours', year: 1977, cover_url: null, artist }, copy_number: 1,
  pressing: { id: 12, note: '180g reissue', label: 'Warner Bros.', format: 'LP' }, media_grade: 'NM', sleeve_grade: 'VG+',
  price_paid: 26, bought_at: 'Spin Cycle Records', notes: null, added_at: '2026-10-22T12:00:00' };
export const settings = { username: 'crate_digger', email: 'collector@example.com', sign_in_methods: ['password'], home_zip: '10011',
  default_radius_mi: 25, theme: 'system', use_current_location: false, privacy_profile: 'private', privacy_collection: 'private',
  privacy_wishlist: 'private', favorite_genres: ['Rock'], genres: ['Rock', 'Jazz', 'Soul & Funk', 'Hip-Hop', 'Electronic', 'Folk',
    'Country', 'Reggae', 'Classical', 'Metal', 'Latin', 'Blues'] };

const ROUTES: [RegExp, unknown][] = [
  [/\/api\/auth\/me$/, { id: 1, username: 'crate_digger', email: 'collector@example.com', email_verified: true, sign_in_methods: ['password'] }],
  [/\/api\/auth\/providers$/, { google: true }],
  [/\/api\/me\/wishlist\/albums$/, { album_ids: [1] }],
  [/\/api\/me\/wishlist\?/, { items: [{ id: 7, album: copy.album, pressing_id: null, pressing_note: null, max_price: 35, min_condition: null,
    pressings: [{ id: 11, note: 'Original press' }], store_count: 2, nearest: { store_name: 'Spin Cycle Records', distance_mi: 0.4, price: 26 },
    cheapest: { store_name: 'Second Pressing', distance_mi: 5.4, price: 18 }, nearest_outside_mi: null }] }],
  [/\/api\/me\/collection\/owned/, { copies: { 12: 1 } }],
  [/\/api\/me\/collection\/\d+$/, { ...copy, pressings: [{ id: 11, note: 'Original press', detail: 'LP' }, { id: 12, note: '180g reissue', detail: 'LP' }] }],
  [/\/api\/me\/collection\?/, { items: [copy], stats: { records: 1, artists: 1, duplicates: 0, wishlist: 1 } }],
  [/\/api\/me\/settings$/, settings],
  [/\/api\/me\/import\/discogs$/, { configured: true, connected: true, username: 'crate_digger',
    job: { id: 1, status: 'done', added: 12, wishlisted: 3, skipped: 1, looking_up: 0, not_found: 0, error: null } }],
  [/\/api\/search\?/, { albums: [album], artists: [] }],
  [/\/api\/browse\?/, { albums: [album], artists: [] }],
  [/\/api\/artists\/\d+/, { ...artist, bio: 'British-American rock band formed in London in 1967.', origin: 'London', image_url: null,
    genres: ['Rock'], discogs_url: 'https://www.discogs.com/artist/1', discography: { Studio: [album], Live: [], Compilations: [] } }],
  [/\/api\/albums\/\d+\/online$/, { album_id: 1, album_title: 'Rumours', artist_name: 'Fleetwood Mac',
    sellers: [{ name: 'Discogs marketplace', url: 'https://www.discogs.com/sell/list?q=Rumours' }] }],
  [/\/api\/albums\/\d+\/stock\?/, { album_id: 1, zip: '10011', radius_mi: 25, center_lat: 40.74, center_lng: -74, nearest_outside_mi: null,
    stores: [store(1, 'Spin Cycle Records', 'verified', 26, 0.4), store(2, 'Groove Merchant', 'out_of_date', 28, 21.4)],
    other_shops: [{ store_id: 9, name: 'Side B Listening Room', area: 'Hoboken, NJ', distance_mi: 1.5, phone: '(201) 555-0142', lat: 40.744, lng: -74.03 }] }],
  [/\/api\/albums\/\d+(\?|$)/, album],
  [/\/api\/listings\/\d+$/, { listing_id: 1, album: { id: 1, title: 'Rumours', year: 1977, artist: 'Fleetwood Mac', cover_url: null },
    pressing: { id: 12, note: '180g reissue', label: 'Warner Bros.', format: 'LP' }, store: { id: 1, name: 'Spin Cycle Records', area: 'Chelsea',
      address: '1 Test St', phone: '(212) 555-0101', website: 'https://spin.example', lat: 40.75, lng: -74 },
    price: 26, condition: 'New', quantity: 1, freshness: 'verified', discogs_url: null }],
  [/\/api\/stock\/\d+$/, { listing_id: 1, store: { id: 1, name: 'Spin Cycle Records' }, album: { id: 1, title: 'Rumours' },
    pressing_note: '180g reissue', price: 26, condition: 'New', quantity: 1, source: 'manual', freshness: 'current', last_updated_at: null, reported_today: false }],
  [/\/api\/stores\/\d+\/sighting\?/, { store: { id: 9, name: 'Side B Listening Room', area: 'Hoboken, NJ' },
    album: { id: 1, title: 'Rumours', artist: 'Fleetwood Mac' }, pressings: [{ id: 11, note: 'Original press', detail: 'LP' }] }],
];

export async function fakeApi(page: Page, { signedIn = true } = {}) {
  await page.route('**/api/**', (route) => {
    const url = route.request().url();
    if (!signedIn && /\/api\/(auth\/me|me\/)/.test(url)) return route.fulfill({ status: 401, json: { detail: 'Not signed in' } });
    const match = ROUTES.find(([pattern]) => pattern.test(url));
    return match ? route.fulfill({ json: match[1] }) : route.fulfill({ status: 404, json: { detail: 'Not found' } });
  });
}
