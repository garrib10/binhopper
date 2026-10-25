import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { NearbyStockResponse } from '../api';

/** Attribution accepts text and HTTPS links; discard all other markup/attributes. */
function safeAttribution(value: string) {
  const template = document.createElement('template');
  template.innerHTML = value;
  const output = document.createElement('span');
  for (const node of template.content.childNodes) {
    if (node instanceof HTMLAnchorElement && node.protocol === 'https:') {
      const link = document.createElement('a');
      link.href = node.href; link.textContent = node.textContent; output.append(link);
    } else output.append(document.createTextNode(node.textContent ?? ''));
  }
  return output.innerHTML;
}

export function StockMap({ data }: { data: NearbyStockResponse }) {
  const container = useRef<HTMLDivElement>(null);
  const tileUrl = import.meta.env.VITE_MAP_TILE_URL || (import.meta.env.DEV ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' : '');
  const attribution = import.meta.env.VITE_MAP_ATTRIBUTION || (import.meta.env.DEV ? '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' : '');
  const configured = Boolean(tileUrl && attribution);
  const coordinates = Number.isFinite(data.center_lat) && Number.isFinite(data.center_lng);
  useEffect(() => {
    if (!container.current || !configured || !coordinates) return;
    const center: L.LatLngTuple = [data.center_lat!, data.center_lng!];
    const map = L.map(container.current, { scrollWheelZoom: false, fadeAnimation: false, zoomAnimation: false }).setView(center, 10);
    L.tileLayer(tileUrl, { attribution: safeAttribution(attribution), maxZoom: 18 }).addTo(map);
    L.circleMarker(center, { radius: 6, className: 'zip-center', interactive: false }).addTo(map);
    const radius = L.circle(center, { radius: data.radius_mi * 1609.344,
      className: 'search-radius', interactive: false }).addTo(map);
    data.stores.forEach((store, index) => {
      if (!Number.isFinite(store.lat) || !Number.isFinite(store.lng)) return;
      const popup = document.createElement('span');
      popup.textContent = `${store.store_name} · ${store.distance_mi} mi`;
      L.marker([store.lat!, store.lng!], {
        icon: L.divIcon({ className: 'shop-marker', html: String(index + 1), iconSize: [44, 44] }),
        title: `${index + 1}. ${store.store_name}`, alt: store.store_name,
      }).addTo(map).bindPopup(popup);
    });
    map.fitBounds(radius.getBounds(), { padding: [12, 12], animate: false });
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); map.remove(); };
  }, [data, tileUrl, attribution, configured, coordinates]);
  return <section className="stock-map-panel" aria-label={`Map of shops within ${data.radius_mi} miles of ZIP ${data.zip}`}>
    {configured && coordinates ? <div className="stock-map" ref={container} /> :
      <div className="stock-map stock-map--unavailable"><p>Map unavailable. Use the shop list below.</p></div>}
    <p className="map-caption">{data.radius_mi} mi radius · Centered on ZIP {data.zip}, not your precise location.</p>
  </section>;
}
