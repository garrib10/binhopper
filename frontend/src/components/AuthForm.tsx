import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { getProviders } from '../auth';

/** Shared frame for the sign-in screens (no mockups: built from Onboarding's form pattern). */
export function AuthLayout({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return <main id="content" className="page auth-page">
    <h1 className="display">{title}</h1>
    {intro && <p className="muted">{intro}</p>}
    {children}
  </main>;
}

type FieldProps = { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>;

/** Label above input, optional hint below, tied together for screen readers. */
export function TextField({ label, hint, id, ...input }: FieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return <div className="text-field">
    <label htmlFor={inputId}>{label}</label>
    <input id={inputId} aria-describedby={hint ? `${inputId}-hint` : undefined} {...input} />
    {hint && <p id={`${inputId}-hint`} className="text-field__hint">{hint}</p>}
  </div>;
}

/** A password input with a Show/Hide toggle. */
export function PasswordField(props: FieldProps) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();
  return <div className="text-field">
    <label htmlFor={inputId}>{props.label}</label>
    <div className="text-field__row">
      <input {...props} id={inputId} type={visible ? 'text' : 'password'}
        aria-describedby={props.hint ? `${inputId}-hint` : undefined} />
      <button type="button" className="text-button" aria-pressed={visible}
        aria-label={visible ? 'Hide password' : 'Show password'}
        onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</button>
    </div>
    {props.hint && <p id={`${inputId}-hint`} className="text-field__hint">{props.hint}</p>}
  </div>;
}

/** Errors and confirmations, announced when they appear. */
export function FormMessage({ tone, children }: { tone: 'error' | 'ok'; children: ReactNode }) {
  return <p className={`notice ${tone === 'error' ? 'notice--danger' : 'notice--ok'}`}
    role={tone === 'error' ? 'alert' : 'status'}>{children}</p>;
}

/** "Continue with Google", shown only when the API has Google sign-in set up. */
export function GoogleButton({ returnTo }: { returnTo: string }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    getProviders().then((p) => { if (active) setEnabled(p.google); }).catch(() => {});
    return () => { active = false; };
  }, []);
  if (!enabled) return null;
  // A real link: the API redirects to Google and back (it's not a fetch).
  return <>
    <a className="button button--secondary button--block" href={`/api/auth/google/start?return_to=${encodeURIComponent(returnTo)}`}>
      Continue with Google</a>
    <p className="auth-divider"><span>or use email</span></p>
  </>;
}
