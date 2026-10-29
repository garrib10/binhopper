import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api';

export const UNREACHABLE = "Can't reach Binhopper right now.";

export interface LoadProblem { message: string; canRetry: boolean }

/**
 * What a failed load tells the user (SPEC › Empty and error states): "not found" is said
 * plainly with a way back, our own 4xx messages are shown as they are, and network or
 * server failures offer Try again. Raw error text never reaches the screen.
 */
export function describeLoadError(err: unknown, notFound: string): LoadProblem {
  if (err instanceof ApiError && err.status === 404) return { message: notFound, canRetry: false };
  if (err instanceof ApiError && err.status >= 400 && err.status < 500) return { message: err.message, canRetry: false };
  return { message: UNREACHABLE, canRetry: true };
}

export function LoadError({ problem, onRetry, back }: { problem: LoadProblem; onRetry: () => void; back?: { to: string; label: string } }): ReactNode {
  return <div className="error-state">
    <p role="alert" className="notice notice--danger">{problem.message}</p>
    <div className="error-state__actions">
      {problem.canRetry && <button type="button" className="button button--primary" onClick={onRetry}>Try again</button>}
      {back && <Link className="button button--secondary" to={back.to}>{back.label}</Link>}
    </div>
  </div>;
}
