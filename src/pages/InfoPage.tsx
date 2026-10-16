import { useEffect } from 'react';
import { Link } from 'react-router';
import { ProductLinks } from '../components/ProductLinks';
const contact = 'support@aidenjang.com';
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
              : 'WORTH / UPDATED OCTOBER 16, 2026'}
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
                Your collections, activity entries, notes, dates, rankings, saved filter views, context
                rankings, saved duplicate reviews, private shelf choices, dedications and inscriptions,
                private sources and recommendations, labels/stamps, custom details, purchase and loan
                information (including names you enter), optional Favorite / Meh / Not again calls, Want to
                try, merged originals, revisit queue, per-visit locations, editions, orders and reactions,
                exercise measurements, routines, workout visits, and uploaded photos or collection covers.
                Records are associated with your shared account ID. Worth receives your account identity to
                check access and display your name; passwords are handled by the account service.
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
              <p>
                Booklets and recommendation cards are prepared on your device. Their preview shows the
                selected content; private photos and booklet notes require an explicit choice. Downloaded
                files, shared images and calendar reminders can be copied outside Worth and cannot be revoked.
                These files do not change the scope of public ranking links.
              </p>
            </section>
            <section>
              <h2>On this device</h2>
              <p>
                Worth uses browser storage for unfinished text and photo drafts, retry identifiers, rest
                timers, CSV data and mappings, pending import requests, export settings and your last capture
                choice. Drafts and saved restore retry identifiers older than seven days are removed when you
                next open Worth while signed in. Saving or discarding a draft removes it; Settings lets you
                clear this account’s device drafts and timers. Clearing one device does not clear another.
                Shared login uses an essential session cookie.
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
                Deleted lists, items and logs remain recoverable in Trash for 30 days. Expired records are
                permanently removed when you next open Trash. You can delete individual records or
                collections, or permanently remove all Worth data in Settings, including Trash, photos,
                routines and share snapshots. Download records as JSON, or choose a backup with photos.
                Downloads exclude Trash; records-only files also exclude photos. Restore creates new private
                lists and does not recreate share links.
              </p>
              <p>
                Permanent deletion removes data from the active Worth database; provider recovery copies and
                operational logs may remain under Cloudflare’s retention practices. Deleting Worth data does
                not delete your shared login. For shared account deletion or privacy requests, contact us so
                Worth data can also be removed; do not assume an account-service deletion automatically clears
                Worth.
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
              <h2>Selection, merges and recovery</h2>
              <p>
                Use Select in a collection to move, merge, queue, change type or delete items together. Moves
                carry photos and history and leave items unranked in the destination. A merge keeps one main
                entry; original notes, photos, calls and visits remain in Details. Separate an original there
                to undo its merge. Want to try is independent of opinions, rankings and the revisit queue.
              </p>
              <p>
                Use Undo after deleting, or open Settings → Trash to restore lists, items and logs for 30
                days. Restored items return unranked. Restore a containing list or item first to recover
                records deleted separately inside it. Deleting a list revokes its public links permanently;
                restoring does not publish them again.
              </p>
            </section>
            <section>
              <h2>The collection workbench</h2>
              <p>
                Open Workbench from a collection to try a draft ranking, compare records privately, or draw a
                record from Want to try, the revisit queue or Favorites. Head-to-head comparisons can hide
                saved ranks and calls; Skip and Undo are available. Reveal the result before using it in the
                sandbox. Your main ranking changes only after Preview ranking change and Apply ranking.
              </p>
              <p>
                Saved views keep named filters across devices. Context rankings keep alternative orders such
                as best value; loading one replaces only the sandbox draft after confirmation. A draft can
                recover on this device for seven days, but comparison rounds in progress are not saved. Saved
                views and context rankings are included in records export and photo backups. They are never
                included in public share links.
              </p>
            </section>
            <section>
              <h2>Details for one visit</h2>
              <p>
                After Log again, or when editing an existing revisit, open This visit for an optional
                location, version or edition, order/setup and reaction. These describe that visit and never
                change the item’s overall call or ranking. Visit details appear in private history and Search,
                and stay out of public ranking links, booklets and recommendation cards. Backups include them.
                An unfinished visit draft can recover on this device for seven days; if the saved visit
                changed elsewhere, review Reload saved visit before replacing your draft.
              </p>
              <h2>Archived collections</h2>
              <p>
                Open a collection’s settings and choose Archive collection to remove it from home, the sidebar
                and everyday collection choices. Find it under Collections → Archived or in Search. Its
                records stay editable; Patterns and backups still include them. Use Unarchive collection in
                settings to bring it back. Archiving has no expiry and keeps existing public links at their
                original access and expiry. Trash is separate.
              </p>
              <h2>Possible duplicates</h2>
              <p>
                Open Workbench → Comparison table → Possible duplicates to review matching names and types.
                Open shows a record’s Details; Revisit opens its visit form without saving a visit. Keep
                separate saves a review across devices and leaves all records, calls and rankings unchanged.
                No merge happens automatically.
              </p>
              <p>
                Show groups kept separate lets you reopen a review. A new matching record needs review again;
                other saved reviews can be removed when their membership changed. Reviews are included in
                private backups. Unfinished ranking changes and comparison rounds are protected before opening
                a record from the workbench.
              </p>
            </section>
            <section>
              <h2>Importing CSV and saving links</h2>
              <p>
                In Workbench → Import &amp; capture, choose a CSV file or paste CSV data. Set the separator,
                review which columns supply names, types, notes, calls, source URLs and dates, then preview up
                to 100 records. Possible duplicates start unselected. Choose them explicitly to keep both;
                invalid rows stay out of the save. Existing records and rankings stay unchanged.
              </p>
              <p>
                Link capture can suggest an editable name from the address. It does not open the link or
                verify a page’s identity. Review the name and retained source before saving. Only selected,
                mapped fields are sent to your archive; CSV data and pending requests can recover on this
                device for seven days. If a save is interrupted, retry the same selection. Check the
                collection before starting over, since an unconfirmed save may already have completed.
              </p>
            </section>
            <section>
              <h2>Your collection shelf</h2>
              <p>
                Workbench → Your shelf offers paper pockets or book spines, optional bookends and a faceless
                paper creature beside records without calls. Personalize this shelf keeps a private
                dedication, one keepsake and an inscription attached to a chosen record. These choices are
                saved across devices and included in backup, independently of ranks and calls.
              </p>
              <p>
                Use earliest kept record chooses the earliest record currently available here. The inscription
                stays attached to that record; it never moves automatically to another one. Trashed, moved or
                merged choices stay out of the preview and exports. Drafts can recover on this device for
                seven days. Reloading newer saved choices asks before replacing a draft.
              </p>
            </section>
            <section>
              <h2>Booklets and recommendation cards</h2>
              <p>
                In Workbench, open Booklets &amp; cards. Choose up to 12 records for a booklet, add a
                dedication and captions, then prepare the file. Names and types are included; ranks, calls,
                private notes and photos are separate choices. Download the self-contained HTML to read
                offline, or print/save a PDF. Recommendation cards export one record as a PNG with your own
                message. Review the prepared image before downloading or sharing it.
              </p>
              <p>
                Changing the preview requires preparing a new file. Settings can recover on this device for
                seven days. These exports exclude context and visit history. Copies you download or share
                cannot be revoked; public ranking links keep their original names/types-only scope.
              </p>
            </section>
            <section>
              <h2>Private context and return reminders</h2>
              <p>
                In an item’s Details, open A little more context to keep a source link, why you saved it, who
                recommended it, your follow-up, location/version, custom fields, labels or stamps. Personal
                labels and stamps can filter a collection and be kept in saved views. These fields stay out of
                public ranking snapshots and are included in your private backup.
              </p>
              <p>
                Purchase and loan details can include a return date. Download calendar reminder previews the
                title and date, then saves a calendar file. Import that file into your calendar to enable its
                reminder one day before. Worth does not send notifications itself. The calendar file excludes
                the Person field and private notes; copies outside Worth cannot be revoked.
              </p>
              <p>
                Context changes check for newer edits. If a saved version changed elsewhere, your draft stays
                in place. Reload saved context asks before replacing only those context edits, keeping your
                other form changes.
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
