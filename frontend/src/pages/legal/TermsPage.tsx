import { Link } from 'react-router-dom';
import { MINIMUM_AGE } from '../../legal';
import { Contact, LegalPage } from './LegalPage';

/** Terms of Use (SPEC › Privacy, security and compliance; #85). */
export function TermsPage() {
  return <LegalPage title="Terms of Use" other={{ to: '/privacy', label: 'Privacy Policy' }}>
    <div className="legal-summary">
      <p><strong>The short version.</strong> Binhopper helps you find vinyl in shops near you and keep track of your
        records. It's free. Stock information comes from shops and other users and can be out of date, so check with the
        shop before you go. Be honest in what you report, and don't misuse the app.</p>
    </div>
    <p>These terms are an agreement between you and the person who runs Binhopper ("we", "us"). By creating an account
      or using Binhopper, you agree to them and to the <Link to="/privacy">Privacy Policy</Link>. If you don't agree,
      please don't use the app.</p>

    <h2 className="section-title">Who can use Binhopper</h2>
    <p>You must be {MINIMUM_AGE} or older. Binhopper is meant for use in the United States.</p>

    <h2 className="section-title">Your account</h2>
    <p>Give a real email address you can access, keep your password to yourself, and tell us if you think someone else
      is using your account. You're responsible for what happens in your account. One person per account.</p>

    <h2 className="section-title">What Binhopper is, and isn't</h2>
    <ul>
      <li><strong>A guide, not a guarantee.</strong> Stock, prices and shop details come from shops, Discogs listings and
        other users, and can be wrong or out of date. Binhopper shows how fresh each listing is, but always confirm with the
        shop.</li>
      <li><strong>Not a store.</strong> Binhopper doesn't sell records, take payments or hold items. "Hold or buy" sends you
        to the shop, and any purchase is between you and the shop.</li>
      <li><strong>Not affiliated</strong> with the shops, Discogs, Spotify or Apple Music. Links to other sites are for
        convenience; their own terms apply there.</li>
    </ul>

    <h2 className="section-title">What you add</h2>
    <p>Your wishlist, collection, notes and settings stay yours. You give us permission to store and show them as the
      app needs to (to you, and to others only if you choose). Stock reports are different: by sending one, you let us use
      it, without your name, to keep listings accurate for everyone, including after you delete your account.</p>

    <h2 className="section-title">Use it fairly</h2>
    <p>Don't:</p>
    <ul>
      <li>send stock reports you know are false, or try to manipulate listings;</li>
      <li>scrape, copy or resell Binhopper's data, or access it by automated means other than the app;</li>
      <li>try to get around rate limits or security, or into other people's accounts;</li>
      <li>use Binhopper for anything illegal or to harass anyone.</li>
    </ul>
    <p>We may limit, suspend or close accounts that break these rules.</p>

    <h2 className="section-title">Record data</h2>
    <p>Catalog information and cover images are provided by Discogs. This application uses Discogs' API but is not
      affiliated with, sponsored or endorsed by Discogs. 'Discogs' is a trademark of Zink Media, LLC. Shop locations
      include data © OpenStreetMap contributors.</p>

    <h2 className="section-title">Changes and availability</h2>
    <p>Binhopper is free. We may change, pause or stop features, or the whole app, at any time. If we shut it down, we'll
      give you notice and a chance to download your data where we reasonably can.</p>

    <h2 className="section-title">Ending your account</h2>
    <p>You can delete your account anytime in <Link to="/you/account">You › Account</Link>. We may close an account that
      breaks these terms. The sections on what you add, disclaimers, liability and governing law continue after an
      account ends.</p>

    <h2 className="section-title">Disclaimers</h2>
    <p>Binhopper is provided "as is" and "as available", without warranties of any kind, including that it will be
      accurate, uninterrupted or error-free, to the fullest extent the law allows.</p>

    <h2 className="section-title">Limitation of liability</h2>
    <p>To the fullest extent the law allows, we aren't liable for indirect or consequential losses, or for anything
      arising from a shop, a purchase or a trip based on information in the app. Our total liability for any claim about
      Binhopper is limited to $50. Some states don't allow these limits, so they may not all apply to you.</p>

    <h2 className="section-title">Governing law</h2>
    <p>These terms are governed by the laws of the State of Connecticut and applicable US federal law. Any dispute will be
      handled in the state or federal courts located in Connecticut, unless the law where you live gives you the right to
      bring it elsewhere.</p>

    <h2 className="section-title">Changes to these terms</h2>
    <p>If we change these terms, we'll update the date above. For a significant change, we'll tell you in the app or by
      email before it takes effect. Using Binhopper after that means you accept the new terms.</p>

    <h2 className="section-title">Contact</h2>
    <p>Questions about these terms: <Contact />.</p>
  </LegalPage>;
}
