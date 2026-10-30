import '../styles/placeholder.css';
/** Grey shapes where a list is about to appear, so the page keeps its layout while it loads.
 *  Screen readers hear the label once; the shapes themselves are hidden from them. */
export function ListPlaceholder({ label, layout }: { label: string; layout: 'grid' | 'list' | 'cards' }) {
  const count = layout === 'grid' ? 6 : 3;
  return <>
    <p role="status" className="sr-only">{label}</p>
    <ul className={`list-placeholder list-placeholder--${layout}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <li key={i} className="list-placeholder__item">
        <span className="list-placeholder__cover" />
        <span className="list-placeholder__lines"><span /><span /></span>
      </li>)}
    </ul>
  </>;
}
