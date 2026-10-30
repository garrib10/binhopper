import '../../styles/legal.css';
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CONTACT_EMAIL, LEGAL_UPDATED } from '../../legal';

/** Layout for the Privacy Policy and Terms of Use: readable while signed out (Google checks them). */
export function LegalPage({ title, other, children }: { title: string; other: { to: string; label: string }; children: ReactNode }) {
  useEffect(() => { window.scrollTo(0, 0); }, [title]);
  return <main id="content" className="page legal-page">
    <h1 className="display">{title}</h1>
    <p className="muted">Last updated {LEGAL_UPDATED} · <Link to={other.to}>{other.label}</Link></p>
    {children}
  </main>;
}

export function Contact() {
  return CONTACT_EMAIL
    ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
    : <>the contact address listed here before launch</>;
}
