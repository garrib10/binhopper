import { Link } from 'react-router-dom';
import { MINIMUM_AGE } from '../legal';

/** Under the sign-up and sign-in buttons: continuing (with Google too) accepts both pages. */
export function LegalNotice() {
  return <p className="auth-legal">By continuing, you confirm you're {MINIMUM_AGE} or older and agree to
    the <Link to="/terms">Terms of Use</Link> and <Link to="/privacy">Privacy Policy</Link>.</p>;
}
