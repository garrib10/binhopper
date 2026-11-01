import '../styles/placeholder.css';

/** Grey shapes for a detail page (cover, title, a few rows) when its data isn't here yet, so
 *  the real page fills the same space instead of pushing everything down. */
export function PagePlaceholder({ label }: { label: string }) {
  return <>
    <p role="status" className="sr-only">{label}</p>
    <div className="page-placeholder" aria-hidden="true">
      <div className="page-placeholder__header">
        <span className="list-placeholder__cover" />
        <span className="list-placeholder__lines"><span /><span /></span>
      </div>
      {[0, 1, 2].map((i) => <span key={i} className="page-placeholder__block" />)}
    </div>
  </>;
}
