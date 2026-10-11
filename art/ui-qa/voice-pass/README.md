# Plainspoken copy pass

The latest user direction asks for cute, nonchalant dry humor without generic brand
filler. Copy changes are documented in VOICE.md and the build contract. They deliberately
supersede the wording in older PNGs, while preserving the cabinet compositions.

Kept the accepted headline, folder captions, Meh reaction and call meanings. Shortened
landing supporting copy, search instructions and repeated Patterns empty messages.
Replaced the personality-diagnosis aside with “Your taste has a paper trail.” Shortcuts
say “Less clicking.” Privacy, destructive actions, errors and workout instructions stay
factual. Personal titles and notes are untouched.

`verify.cjs` intercepts all API requests with local fixtures. Screens are captured at
1440 × 900 and 390 × 780, with overflow checks at 320/430/768px. Reduced motion is used
for copy inspection; this pass does not alter motion. Compare the landing, empty archive,
Search and Patterns with their current cabinet references. Settings, Help and creation
retain the existing supporting layouts. No fixture reaches a real archive.

Verification passed at all five widths with no page errors or horizontal overflow.
Desktop and phone captures were inspected against the accepted cabinet references.
Type checking, formatting, production build and diff checks passed. This was a copy
pass; no data behavior changed and no production deployment was made.
