# Exterior depth rebuild - 2026-11-11

Uluru is now a continuous 3D sandstone mass on a desert plain. The geometry is illustrative, not a survey. The rounded asymmetric crown, steep sides and irregular shallow runoff channels give the monolith a recognisable silhouette without reconstructing sacred sites or offering a climbing route. Sparse spinifex and desert oaks add parallax. The distant domes are an illustrative range, not mapped individual landmarks.

Four exterior viewpoints cover dawn, midday, sunset and night. Drag turns the camera freely through 360 degrees; Reset clears angular velocity and holds the chapter's entry view. Arc-only swipes change chapter, arrow keys step the dial. Persistent labels are 16px minimum, all controls have named targets at least 44px. Text stays on dark bounded surfaces. Local fonts retain their OFL license.

## Executed checks

- Every chapter at 320, 390 and 1440 reduced motion, plus 390 and 1440 normal motion: actual drag + Reset + held entry angle, dial swipe, arrows, named 44px targets, visible 16px scene labels, audio off on load, no overflow or page/console errors.
- 72 glyph-core/backdrop samples over all four chapters at 390 and 1440, including title, both control texts, caption, detail and all four scene labels. Minimum 11.574:1. Diagnostic black/white masks isolate glyph cores; actual rendered ink is compared against transparent-ink background at matching pixels. Settled canonical states, not every transition or rotated view.
- Every chapter's phone/desktop pixels inspected. The monolith is stylized, not photoreal.
- Actual app audio captured for 10 seconds, not a reconstructed offline graph. Mean -31.4dB, peak -19.8dB; no clipping. Subjective listening is unverified. Sound is opt-in synthesized wind, not a field recording or cultural music.
- Runtime JS syntax checked. A real browser CI gate runs all three widths and both motion settings and uploads its screenshots.

## Sources

Parks Australia: https://uluru.gov.au/discover/highlights/uluru/ describes the 348m-high sandstone monolith as about half a billion years old and explains its significance to Aṉangu. This replaces the old unsupported 600-million-year caption.

https://uluru.gov.au/things-do/activities/sunrise-sunset/talinguru-nyakunytjaku/ describes the sunrise viewpoint and light on the rock's rippled surface. No exact visitor-platform reconstruction is claimed.

https://uluru.gov.au/static/cb2d9a32e0ee507fca49cc3642552d8d/uktnp-a4factsheet-geology_23-sept.pdf explains iron oxidation and rainwater runoff channels. Night is a star-lit plain, not a claimed recreation of a commercial Field of Light installation.

## Reproduce

`npm ci --ignore-scripts`; serve this folder with `python3 -m http.server 8792`; run `npm test`. CHROME_PATH can set an installed Chrome path; WIDTHS, MOTIONS, BASE_URL and OUT scope the gate. For contrast: `node tests/glyph-capture.mjs` with SIZES set to the two width/height pairs, then `python3 tests/glyph-contrast.py` (Pillow and NumPy). OUT selects the shared capture/output folder. The local artifacts in this document do not claim a successful preview or production deploy.
