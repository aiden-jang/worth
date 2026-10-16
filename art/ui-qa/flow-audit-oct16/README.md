# App flow review — October 16

This review follows the October 16 feature-trim pass. It checks existing tasks, recovery paths and delivery details. The source changes are the Safari fixes in Accounts and Bloomnote, manual-copy recovery and browser-test reliability in Everything Is Fine, and caching for Worth’s fingerprinted assets. The other apps retain their interfaces.

## Core tasks

| App                | Local browser evidence                                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| worth              | iPhone WebKit: create a collection, capture items, keep Favorite / Meh / Not again through reload, filter by call; create a workout, record separate reps and weights, duplicate sets, reload saved logs, finish the visit and recover its recap. |
| owewell            | iPhone WebKit: create a group, add spending, check balances, record a settling payment, restore drafts after failures, inspect uneven rounding and both palettes.                                                                                 |
| bloomnote          | Full verification in desktop Chromium and iPhone WebKit: drafts, generation, recipient links, sharing recovery, library, scheduling, downloads and complete printed notes.                                                                        |
| wherever           | iPhone WebKit: create and join, complete shared voting, replay, undo special votes, preserve failed-create input, open details, and recover from cancelled native-image sharing.                                                                  |
| iguess             | iPhone WebKit: change modes after leaving, rejoin explicitly, retain chat drafts, keep long-chat input reachable, recover connectivity and rotate the layout. Provider endpoints are mocked locally.                                              |
| mrrp               | iPhone WebKit: create and join both seats, preserve room choices, send replies, draw in the frame, recover from a failed notes read and keep a long reply’s actions reachable.                                                                    |
| Accounts           | Full verification in desktop Chromium and iPhone WebKit: register, follow dev-mail links, sign in and out, recover a password, manage account data and cancel confirmation without losing focus.                                                  |
| Portfolio          | WebKit phone journeys: car controls, navigation, dialogs, project previews, browser history and accessibility checks. The résumé was not edited.                                                                                                  |
| Everything Is Fine | Full verification and isolated keyboard repetitions are recorded in its accompanying review. Recorded feeds cover view restoration, keyboard access, playback, event details and hazards.                                                         |

The review did not identify further controls that needed removing from these tasks. It adds no product features. Earlier removals of Mrrp’s extra sound presets, duplicate passkey timing and citation export remain in place.

## Live handoffs

All nine public entry pages and their primary module scripts answered successfully in anonymous HTTP checks. Google sign-in returned to Worth with the selected account. owewell and Bloomnote recognized the same session. owewell retained its existing on-device split after the sign-in handoff and browser Back. No existing live draft was cleared or saved to an account during this review.

Wherever’s join dialog, Mrrp’s entry, iguess’s information pages, Accounts’ account page and the globe’s live earthquake/hazard data were inspected. Shared garden, room and recovery-link tasks use isolated local data for the automated checks. Those checks do not establish that an arbitrary private production invite still exists.

**Live issue:** iguess’s `/play-status` answered `{"vision":"unavailable"}`, matching the page’s retry result. Check the game server’s `AI_WORKER_URL` and the AI Worker’s health, provider configuration and shared secret before treating live guessing as ready. No production secrets or deployment settings were changed, and no paid vision call was made.

Verification and password-reset links were followed through Accounts’ local dev-mail log. A fresh live verification/reset email was not sent, so current delivery to a real mailbox is unverified. The existing domain-mail setup was not changed.

## Measurements

These are single unthrottled observations from this computer on October 16, not a mobile-network benchmark. The live asset column is the compressed transfer of the primary module only; it excludes lazy chunks, fonts, images and car models. Live measurements precede the local commits and were not repeated after deployment, because nothing was pushed.

The revisions below identify the checked source; the Worth and Everything Is Fine rows include their working-tree fixes.

| App              | Local revision reviewed | Live HTML first response | Primary module transfer |
| ---------------- | ----------------------- | ------------------------ | ----------------------- |
| worth            | `9fae885`               | 202 ms                   | 131.3 KiB               |
| owewell          | `0f1007d`               | 251 ms                   | 121.6 KiB               |
| bloomnote        | `7cf3372`               | 227 ms                   | 100.8 KiB               |
| wherever         | `05c7023`               | 294 ms                   | 144.3 KiB               |
| iguess           | `0642c11`               | 185 ms                   | 56.0 KiB                |
| mrrp             | `26bdbef`               | 112 ms                   | 107.0 KiB               |
| everythingisfine | `51afa90`               | 215 ms                   | 49.1 KiB                |
| auth             | `232c1b4`               | 494 ms                   | 85.3 KiB                |
| portfolio        | `1bb98d7`               | 148 ms                   | 79.5 KiB                |

[Raw public network observations](public-network.json) preserve URLs, response codes, sizes and cache policy. The phone measurement files below record local WebKit paint entries and viewport overflow at a specific checkpoint. Most use development servers; Portfolio uses its production build, and Worth records a populated collection reload. Their readiness checkpoints differ, so they are not comparative speed scores. Native share UI, phone network behavior and interaction latency are not measured by these samples.

Worth was the live caching outlier: its fingerprinted module was marked for revalidation while the other apps’ primary modules were immutable. Its `/assets/*` response now uses a one-year immutable policy, verified against the [built Worker preview](worth-cache-headers.json). HTML, the unhashed favicon and account responses retain their existing cache behavior. No speculative bundle or renderer rewrite was made.

## Phone captures

These are isolated local data and browser emulation, inspected at a 390px phone width. PNG previews are reduced to their CSS-pixel size for the review. They are not screenshots from a physical iPhone.

- [Worth collection](worth-phone.png) · [workout recap](worth-workout-phone.png) · [measurement](worth-phone-measurement.json)
- [owewell](owewell-phone.png) · [measurement](owewell-phone-measurement.json)
- [Bloomnote](bloomnote-phone.png) · [measurement](bloomnote-phone-measurement.json)
- [Wherever](wherever-phone.png) · [measurement](wherever-phone-measurement.json)
- [iguess](iguess-phone.png) · [measurement](iguess-phone-measurement.json)
- [Mrrp](mrrp-phone.png) · [measurement](mrrp-phone-measurement.json)
- [Accounts](auth-phone.png) · [measurement](auth-phone-measurement.json)
- [Portfolio](portfolio-phone.png) · [measurement](portfolio-phone-measurement.json)
- [Everything Is Fine](everythingisfine-phone.png) · [measurement](everythingisfine-phone-measurement.json)

## Physical iPhone / Safari checks still needed

1. Enter a long message, expense description and exercise set with the real keyboard. Rotate with it open; check that Save, Send and the chat composer stay reachable and that focus does not zoom the page unexpectedly.
2. Open and cancel native sharing for a garden, room link and exported image. Return to the app and confirm the content remains, cancellation does not claim delivery, and the fallback link can be selected.
3. Background Safari during a round, rest timer and scheduled garden; return and confirm the displayed time and connection state recover.
4. Open a shared invite and an account email link from another app. Confirm the destination survives sign-in. Verify a newly requested email arrives in the intended inbox.
5. Check Safari’s password manager and, if desired, real passkey enrollment. Automated tests use synthetic accounts and do not establish native credential UI behavior.

No physical phone was available to this review. These checks remain unverified rather than being inferred from browser emulation.
