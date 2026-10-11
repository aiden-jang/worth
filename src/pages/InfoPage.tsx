import { useEffect } from 'react';
import { Link } from 'react-router';
import { ProductLinks } from '../components/ProductLinks';
const contact = 'aidenwsj@gmail.com';
export function InfoPage({ kind }: { kind: 'privacy' | 'terms' | 'help' | 'missing' }) {
  const title =
    kind === 'privacy'
      ? 'Privacy.'
      : kind === 'terms'
        ? 'Terms.'
        : kind === 'help'
          ? 'A little help.'
          : 'Page not found.';
  useEffect(() => {
    document.title = `${title.replace(/\.$/, '')} · Worth`;
    return () => {
      document.title = 'Worth — Good finds. Mixed feelings.';
    };
  }, [title]);
  return (
    <main className="info-page">
      <header className="info-header">
        <Link className="product-wordmark" to="/">
          worth
        </Link>
        <Link to="/">Back to Worth →</Link>
      </header>
      <article className="info-content">
        <p className="overline">
          {kind === 'help'
            ? 'HELP & CONTACT'
            : kind === 'missing'
              ? '404'
              : 'WORTH / UPDATED OCTOBER 10, 2026'}
        </p>
        <h1>{title}</h1>
        {kind === 'missing' ? (
          <>
            <p>This address doesn’t lead to a Worth page.</p>
            <Link className="button button-accent" to="/">
              Go to Worth
            </Link>
          </>
        ) : kind === 'privacy' ? (
          <>
            <p>
              This page explains how Worth, operated by Aiden Jang, handles your data. The{' '}
              <a href="https://accounts.aidenjang.com/privacy">shared account privacy policy</a> covers
              sign-in. Worth needs an account to save your archive; its signed-out example stays in your
              browser and is not saved.
            </p>
            <section>
              <h2>What Worth stores</h2>
              <p>
                Your collections, activity entries, notes, dates, rankings, optional Favorite / Meh / Not
                again calls, revisit queue, exercise measurements, routines, workout visits, and uploaded
                photos or collection covers. Records are associated with your shared account ID. Worth
                receives your account identity to check access and display your name; passwords are handled by
                the account service.
              </p>
            </section>
            <section>
              <h2>Private records and shared links</h2>
              <p>
                Your archive and photos require your account. Creating a share link publishes only a snapshot
                of ranked titles and types with the collection name. Anyone with that link can read it until
                it expires after seven days or you revoke it. Notes, photos, dates and history aren’t in that
                snapshot. Revocation cannot erase copies someone has already made.
              </p>
            </section>
            <section>
              <h2>On this device</h2>
              <p>
                Worth uses browser storage for unfinished text and photo drafts, retry identifiers, rest
                timers and your last capture choice. Drafts and saved restore retry identifiers older than
                seven days are removed when you next open Worth while signed in. Saving or discarding a draft
                removes it; Settings lets you clear this account’s device drafts and timers. Clearing one
                device does not clear another. Shared login uses an essential session cookie.
              </p>
            </section>
            <section>
              <h2>Hosting and service logs</h2>
              <p>
                Cloudflare hosts Worth and stores its records and photos in D1. Cloudflare processes requests
                and operational information such as IP addresses, timestamps and errors to run and protect the
                service. Server-side save/restore retry metadata prevents duplicate requests and is cleared
                when you delete all Worth data. Request counters limit excessive saves; old counter windows
                are cleaned up on subsequent saves. Worker logging is enabled; saved record contents are not
                intentionally written to application error logs. Worth’s application code has no advertising,
                tracking SDK or AI processing of your records. The shared account service uses its own
                providers, as described in its policy.
              </p>
            </section>
            <section>
              <h2>Keeping, copying and deleting</h2>
              <p>
                Saved records remain until you delete them. You can delete individual records or collections,
                or remove all Worth data in Settings, including photos, routines and share snapshots. Download
                records as JSON, or choose a backup with photos. Records-only files exclude photos. Restore
                creates new private lists and does not recreate share links.
              </p>
              <p>
                Deletion removes data from the active Worth database; provider recovery copies and operational
                logs may remain under Cloudflare’s retention practices. Deleting Worth data does not delete
                your shared login. For shared account deletion or privacy requests, contact us so Worth data
                can also be removed; do not assume an account-service deletion automatically clears Worth.
              </p>
            </section>
            <section>
              <h2>Contact and changes</h2>
              <p>
                Questions, access requests and deletion requests: <a href={`mailto:${contact}`}>{contact}</a>.
                Worth follows the shared service’s minimum age of 13. Contact us if a child’s information has
                been submitted. We update the date above when this notice changes.
              </p>
            </section>
          </>
        ) : kind === 'terms' ? (
          <>
            <p>
              These terms cover Worth, a personal archive operated by Aiden Jang. The{' '}
              <a href="https://accounts.aidenjang.com/terms">shared account terms</a> cover the login service.
              Contact: <a href={`mailto:${contact}`}>{contact}</a>.
            </p>
            <section>
              <h2>Your content stays yours</h2>
              <p>
                You keep ownership of your records and photos. You give us permission to store and process
                them to provide Worth, show them back to you, and publish the limited snapshots you explicitly
                share. Only upload content you have the right to use.
              </p>
            </section>
            <section>
              <h2>Your account and use</h2>
              <p>
                You must be at least 13 and keep your account secure. Don’t impersonate others, upload their
                private information without permission, harass people, break the law, or attack or abuse the
                service. We may restrict access for misuse or retire the service.
              </p>
            </section>
            <section>
              <h2>Keeping a copy</h2>
              <p>
                Worth is provided as-is and may change or be unavailable. We do not promise uninterrupted
                service. Keep a backup of anything you cannot afford to lose. Records-only export excludes
                photos; photo backups have size limits shown in Settings. Exercise records are personal logs,
                not medical advice or a training prescription.
              </p>
            </section>
            <section>
              <h2>Sharing and leaving</h2>
              <p>
                Anyone with a public share link can copy its snapshot. You can revoke a link or delete Worth
                data in Settings. That does not delete your shared account or other apps’ data. Contact us for
                account deletion or questions. Nothing here removes rights you have under applicable law.
              </p>
            </section>
          </>
        ) : (
          <>
            <p>A few useful answers.</p>
            <section>
              <h2>Collections or activity?</h2>
              <p>
                Use a collection for things you revisit or rank. Add a name first; notes, photos and calls are
                optional. Use activity for dated entries. Exercise mode stores each set’s reps and optional
                weight separately.
              </p>
            </section>
            <section>
              <h2>Rankings, calls and the queue</h2>
              <p>
                Rank compares items inside one collection. Favorite, Meh and Not again are separate opinions;
                select the same call again to clear it. The revisit queue keeps things you want to try again
                without changing their rank or call.
              </p>
            </section>
            <section>
              <h2>Workouts and routines</h2>
              <p>
                A routine is an exercise lineup. Start it to create a visit with blank measurements. Resume a
                visit to continue logging; swap, reorder or skip names for that visit without changing the
                routine. Finish shows a recap of saved entries. Rest timers are optional.
              </p>
            </section>
            <section>
              <h2>Drafts and interruptions</h2>
              <p>
                Unfinished records and photo drafts can recover on the same device for seven days. Browser
                storage can be cleared or unavailable, so read the draft status before leaving. Saving to the
                archive needs a connection. A local draft is not a saved record or a cross-device backup.
              </p>
            </section>
            <section>
              <h2>Copies, privacy and deletion</h2>
              <p>
                <Link to="/settings">Settings & data</Link> has records export, photo-inclusive backup,
                restore, device cleanup and Worth data deletion. Restore adds new lists; it does not replace
                your archive. Share links reveal ranked names and types only. See{' '}
                <Link to="/privacy">Privacy</Link> for details.
              </p>
            </section>
            <section>
              <h2>Something went sideways?</h2>
              <p>
                <a href={`mailto:${contact}?subject=${encodeURIComponent('Worth support')}`}>Email support</a>{' '}
                or{' '}
                <a href={`mailto:${contact}?subject=${encodeURIComponent('Worth bug report')}`}>
                  report a bug
                </a>
                . Include what you were doing, the error text, and your device/browser. Leave out passwords,
                share tokens and private records unless you choose to share them. Sending is your choice;
                Worth does not attach your data automatically.
              </p>
              <p>
                <a href="https://accounts.aidenjang.com/account">Shared account settings</a> handles your
                login. Contact us to request shared account deletion and removal of Worth data.
              </p>
            </section>
          </>
        )}
      </article>
      <footer className="info-footer">
        <ProductLinks />
        <a href="https://www.aidenjang.com">Made by Aiden Jang</a>
      </footer>
    </main>
  );
}
