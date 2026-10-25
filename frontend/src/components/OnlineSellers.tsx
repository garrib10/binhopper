export interface OnlineResult {
  album_id: number; album_title: string; artist_name: string;
  sellers: { name: string; url: string }[];
}
export function OnlineSellers({ data }: { data: OnlineResult | null }) {
  if (!data?.sellers?.length) return null;
  return <section className="online-sellers" id="online-sellers" aria-labelledby="online-heading">
    <h2 className="section-title" id="online-heading">Can't make it? Buy online</h2>
    <p className="muted">Search the seller’s site for this album. Availability and prices are on their site.</p>
    <ul>{data.sellers.map((seller) => <li key={seller.name}>
      <a href={seller.url}>{seller.name}<span aria-hidden="true"> ↗</span></a>
    </li>)}</ul>
  </section>;
}
