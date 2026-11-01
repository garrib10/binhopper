import { Link } from 'react-router-dom';
import { MINIMUM_AGE } from '../../legal';
import { Contact, LegalPage } from './LegalPage';

/** Privacy Policy (SPEC › Privacy, security and compliance; #85). Describes what the code does:
 *  change this page in the same PR as any change to what's stored or shared. */
export function PrivacyPage() {
  return <LegalPage title="Privacy Policy" other={{ to: '/terms', label: 'Terms of Use' }}>
    <div className="legal-summary">
      <p><strong>The short version.</strong> Binhopper is an independent app made by a music lover. It keeps only what it
        needs to find records near you and track your collection. Everything you add starts private. We don't sell your
        data, show ads or track you across other sites, and you can download or delete everything at any time.</p>
    </div>
    <p>This policy explains what Binhopper ("we", "us": the person who runs it) collects, why, who helps run the
      app, and the choices you have. It applies to the Binhopper website and app.</p>

    <h2 className="section-title">What we collect</h2>
    <ul>
      <li><strong>Your account:</strong> email address, username, and a securely hashed password (we never store the
        password itself). If you sign in with Google, we receive your email address and Google's account ID for you.</li>
      <li><strong>Your settings:</strong> home ZIP code, search radius, appearance, favorite genres, and who can see your
        profile, collection and wishlist.</li>
      <li><strong>Your records:</strong> your wishlist (including any price cap or condition you set) and your collection,
        including the pressing, condition, price paid, where you bought it and your notes.</li>
      <li><strong>Stock reports</strong> you send about a shop's listing ("still there", "gone", a new price).</li>
      <li><strong>Discogs, if you connect it:</strong> your Discogs username, the access tokens Discogs gives us (encrypted),
        and which releases are in the collection and wantlist you choose to import. Your condition grades and notes on
        Discogs aren't copied.</li>
      <li><strong>Sign-in records:</strong> when each signed-in browser was created and last used, stored with a scrambled
        (hashed) version of your sign-in cookie.</li>
    </ul>

    <h2 className="section-title">What we don't collect</h2>
    <ul>
      <li><strong>Your precise location.</strong> If you tap "Use my location", your device's rounded position is sent once
        to find your nearest ZIP code and is not stored. We keep your ZIP code, not GPS history.</li>
      <li><strong>Payment details.</strong> Binhopper doesn't sell anything; you buy records from shops directly.</li>
      <li><strong>Advertising or cross-site tracking data.</strong> There are no ads, analytics trackers or tracking
        cookies.</li>
    </ul>

    <h2 className="section-title">How we use it</h2>
    <ul>
      <li>To run the app: show shops with stock near you, keep your wishlist and collection, and keep you signed in.</li>
      <li>To send emails you need: confirming your address and resetting your password. No marketing emails.</li>
      <li>To keep stock information accurate, using the reports people send.</li>
      <li>To protect the app: limiting how often sign-in, search and reports can be used, and fixing errors.</li>
    </ul>

    <h2 className="section-title">Who helps run Binhopper</h2>
    <p>We share information only with the services that run the app, only what each one needs, and never to sell it:</p>
    <ul>
      <li><strong>Railway</strong> hosts the server and database; <strong>Vercel</strong> hosts the website. Like any web
        host, both see the internet address your requests come from.</li>
      <li><strong>Resend</strong> sends our emails, so it receives your email address.</li>
      <li><strong>Google</strong> handles "Continue with Google" if you use it, and serves the app's fonts.</li>
      <li><strong>Discogs</strong> provides the record catalog and cover images (your browser loads covers from Discogs),
        and handles connecting your Discogs account if you choose to.</li>
      <li><strong>Better Stack</strong> receives the server's warning and error messages so we can fix problems. Request
        logs and visitors' internet addresses aren't sent.</li>
    </ul>
    <p>We may also share information if the law requires it, or to protect the app and its users from fraud or abuse.</p>

    <h2 className="section-title">Who can see your profile and records</h2>
    <p>Your profile, collection and wishlist start as "Only me". You can change each one in{' '}
      <Link to="/you/privacy">You › Privacy</Link>. What you paid, your exact location and your collection's value are
      never shown to anyone else. Stock reports are used without your name.</p>

    <h2 className="section-title">Cookies and browser storage</h2>
    <p>We use one cookie, to keep you signed in. Your browser also remembers your ZIP code, radius, appearance and
      recent shop visits on your device so the app opens where you left off. Because we don't track you across sites,
      there's nothing for a browser's "Do Not Track" signal to turn off.</p>

    <h2 className="section-title">Your choices and rights</h2>
    <ul>
      <li><strong>See and change</strong> your settings, wishlist and collection in the app at any time.</li>
      <li><strong>Download your data:</strong> your collection as a spreadsheet (CSV), or everything we store about you
        (JSON), from <Link to="/you/privacy">You › Privacy</Link>.</li>
      <li><strong>Disconnect Discogs</strong> to delete its tokens.</li>
      <li><strong>Delete your account</strong> from <Link to="/you/account">You › Account</Link>. Your account, settings,
        wishlist, collection and sign-ins are deleted at once. Stock reports stay, with your name removed, so listings stay
        accurate.</li>
    </ul>
    <p>Wherever you live in the US, you can also ask us to access, correct or delete your information by writing
      to <Contact />. We'll answer within 45 days.</p>

    <h2 className="section-title">How long we keep it</h2>
    <p>We keep your information while you have an account. Email links expire after 24 hours (1 hour for password
      resets), sign-ins end within 30 days of your last visit, and rate-limit counters are cleared after about a day. Server error messages are kept
      only as long as needed to fix problems. Deleted data can remain in database backups until those backups expire.</p>

    <h2 className="section-title">Security</h2>
    <p>Binhopper uses HTTPS everywhere, hashes passwords and sign-in cookies, and encrypts connected-account tokens. No
      system is perfectly secure; if something goes wrong that affects your information, we'll tell you as the law
      requires.</p>

    <h2 className="section-title">Adults only, in the United States</h2>
    <p>Binhopper is for people {MINIMUM_AGE} and older and is run from the United States. We don't knowingly collect
      information from anyone under {MINIMUM_AGE}; if you believe someone under {MINIMUM_AGE} has an account, contact us
      and we'll delete it.</p>

    <h2 className="section-title">Changes</h2>
    <p>If we change this policy, we'll update the date above. For a significant change, we'll also tell you in the app
      or by email before it takes effect.</p>

    <h2 className="section-title">Contact</h2>
    <p>Questions or requests: <Contact />.</p>
  </LegalPage>;
}
