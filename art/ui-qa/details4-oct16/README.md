# Everyday details — October 16

Ranking image line breaks now keep complete emoji, skin tones and combining marks together. The sharing dialog says “Download started.” after handing the file to the browser.

The isolated local review used a ranked collection with multilingual titles. Desktop and phone captures use the contract’s 1440 × 900 and 390 × 780 viewports. The export keeps the current dark canvas, DM Sans type, butter wordmark and cream rank panel. No primary composition changed. The fixtures were created only in disposable local state.

- [Desktop sharing](sharing-1440.png)
- [Phone sharing](sharing-390.png)
- [Actual ranking download](ranking.png)

The rendering regression records the actual canvas text calls at a wrap boundary. Replacing grapheme segmentation with code-point splitting makes it fail. The existing sharing tests cover public-field scope, image failure and retry. Browser review checks the actual download and feedback.

## Cross-app audit scope

| Detail                     | Result                                                                                                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Emoji-aware presentation   | Fixed exported names and note reveals in bloomnote, ranking images here, plan images in wherever, and long evidence captions in iguess. Input and API limits retain their existing meaning.                                |
| Tab titles                 | Accounts now names sign-in, recovery, settings and legal steps. Other apps already provide page, room or round context.                                                                                                    |
| Accidental gestures        | Wherever ignores voting keys while text is selected or a control is focused; cancelled touch presses cannot open a card. Existing Portfolio orbit and bloomnote chip-drag guards were reviewed.                            |
| Returning clocks           | Sealed bloomnote gardens and mrrp reminders refresh immediately on return. Worth rest and iguess round timers already derive remaining time from deadlines.                                                                |
| Printing                   | Bloomnote prints full notes during the reveal and keeps flower art visible. Owewell already has print-only recap content, repeated table headings, wrapped cells and protected rows.                                       |
| Download feedback          | Accounts, bloomnote, mrrp, wherever and Worth distinguish a browser download starting from an OS-confirmed save. iguess already used “Download started.”                                                                   |
| Connection recovery        | Existing offline, queued-save and reconnect states were reviewed. Everything Is Fine distinguishes unanswered providers from an empty result.                                                                              |
| Short landscape screens    | Wherever’s details were checked at 844 × 390. Existing short-screen dialog, chat and editor rules remain in place.                                                                                                         |
| Leaving the app            | New-tab links now have accessible descriptions; payment links describe the app-or-tab handoff. Existing email links and installed-app share fallbacks remain explicit. Portfolio’s résumé file and button were left alone. |
| Touch and repeated actions | Existing hover-capability rules and pending/disabled destructive actions were reviewed. No additional destructive action or confirmation was introduced.                                                                   |

This records the reviewed paths, not a claim that every possible device or future data shape has been tested. Browser emulation does not verify physical keyboards, native share destinations or spoken screen-reader output.

[Desktop feedback](sharing-feedback-1440.png) and [phone feedback](sharing-feedback-390.png) show the scrolled confirmation and reachable Create link action. The initial captures show the title and Close control. `pnpm run check` and the isolated browser review passed.
