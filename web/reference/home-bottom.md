# primora.xyz home, bottom half: motion spec (video 21.0–42.5 s, plus click at 43.49 s)

Units and accuracy
- Page content in the video is at **y = 151–1019**, x 0–1899. The browser chrome is 150 px and the scrollbar sits at x ≥ 1900. So the viewport is **1900×869 video px, which is 1520×695 CSS px**.
- Display scale is 1.25. **CSS px = video px / 1.25.** Layout values are given in both units. Colour sample Y values are full-frame.
- The recording changes about 30 times/s, so all times are **±33 ms**.
- The CSS sizes match a root/em size of **12.8 CSS px** at this viewport: 1em = 12.8, 2.5em = 32, 24em = 307 (see layout). That suggests vw-based fluid type.
- Tags: MEASURED means taken from frames or pixels; FROM-SOURCE means taken from the site JS/CSS and confirmed against frames where possible.

## 1. Energy bursts (YAVG of 60 fps frame-diff, 0.25 s bins) and what causes them

| start–end (s) | peak mean | cause (checked in frames) |
|---|---|---|
| 21.00–21.60 | 4.1 | Scroll (end of hero paragraph). Wheel ticks of about 70–90 px. |
| 22.25–23.80 | 1.3 | Scroll ticks. "Who we work with" rows enter. Hover image fades in at 22.95. First row-activation swap at 23.80. |
| 24.25–25.40 | 1.0 | Scroll and row swaps. The hover image stays fixed in the viewport. |
| 25.75–26.80 | 1.3 | Scroll. The cursor moves right and the image follows with lag. Image swap at 26.48. |
| 27.25–28.00 | 2.0 | Fast scroll (≈550 video px in 0.6 s). Hover image exits (fades out). Logo-grid ramp starts at 27.6. |
| 28.50–29.10, 30.00–31.00 | 1.3 | Scroll ticks. The logo brightening ramp runs continuously underneath. |
| 31.50–32.75 | 2.5 | Scroll into Events. The heading crosses the bottom progressive-blur band. |
| 33.25–34.50 | 3.7 | Podcast list hover colour swaps under a static cursor, plus scroll. The "See all podcasts" label rolls at 34.7–35.0. |
| 35.00–35.75 | 2.6 | Insights heading and cards scroll through the blur band. No separate reveal. |
| 36.25–37.75 | **5.6** | Purple CTA panel enters (large saturated area moving). Its top corner radius scrubs. |
| 37.75–39.40 | 2.7 | CTA heading chars, then paragraph lines, then button (time-based), plus scroll. |
| 39.50–40.25 | 1.4 | CTA scrolls out. The outlined wordmark is revealed. |
| 40.50–41.40 | 0.7 | Footer card scrolls in. The progressive blur turns off at 41.23. |
| 41.50–42.50 | ~0 | Idle. The cursor travels to the "Framework" nav link. |
| (43.49) | — | Click on "Framework": hard cut to the new page (outside this segment, noted in §2). |

Scroll (MEASURED by profile matching at 20 fps)
- Total travel was 7 910 video px (6 330 CSS) over 21.5 s.
- Each wheel tick moves about 100–130 video px (80–105 CSS). Per-50 ms deltas run 34→19→10→5→3→1, so a tick settles in about **0.5–0.6 s**. Lenis default damping (FROM-SOURCE) is consistent with this.
- Peak instantaneous speeds were about 1 300–1 600 video px/s, at 27.6 s and 38.1 s.

## 2. Per-element motion

| element | trigger | properties from → to | duration | delay / stagger | easing | idle loop | notes |
|---|---|---|---|---|---|---|---|
| Section divider band (5 hairlines, ~33 video / 26 CSS apart) | always | Coloured 1-px segments on the grey hairlines translate in x | continuous | — | linear | **Yes.** About 30 video px/s (≈24 CSS px/s). Adjacent segments move in opposite directions (left-red end +10 px/0.3 s; short segments −8 to −12 px/0.3 s). The drift is time-based, not scroll-linked. | MEASURED. Short segments are ≈290 video (232 CSS) long. The left segment spans 0→~450 video. The purple segment runs from ~950 to the right edge. |
| "Who we work with": row activation (title + description + left bar) | **Hover.** The cursor is static, so the row that scrolls under it becomes active. Activation does not depend on viewport position. | Title colour #3e3b3f → #f0edf1 (≈ opacity 0.2 → 1). Description #333034 → #b7b1b8. Left bar dim → #eeebf1. The outgoing row reverses at the same moment. | **≈470 ms** (luma 69→222: 23.80→24.27) | Incoming and outgoing start together (±33 ms) | CSS `ease`-like: slow first 60 ms, half done at ~160 ms, long tail | — | MEASURED. Luma samples every 33 ms (normalised): .02 .07 .14 .25 .39 .53 .65 .75 .80 .86 .92 .95 .97 .99 1. Active rows have no blur, scale or y offset. |
| Hover image (dithered photo, one per row) enter | Cursor enters the list | opacity 0 → 1. No scale, clip or pixelation stages. The dither pattern is static. | ≈150 ms (22.95→~23.10) | — | ease-out-ish | — | MEASURED. Grid lines show through mid-fade. |
| Hover image swap between rows | Active row changes | Crossfade old → new image | ≈70–100 ms (26.478 old, 26.511 mixed, 26.544 new) | — | linear-ish | — | MEASURED. The image size stays constant. |
| Hover image follow | mousemove | x follows the cursor. The image is centred on cursor x. Vertically the cursor sits ~65–85 video px above the image bottom (≈80 % down). The image is viewport-anchored: it does **not** scroll with the rows. | Retargeting tween ≈ **0.45–0.6 s** | — | **power2/3.out.** After the last move it covered 36 %, 64 %, 88 %, 99.5 % at +0.1/0.2/0.3/0.4 s. This is not an exponential lerp. | — | MEASURED. x is **clamped to the list's inner bounds**: the right edge stopped at 1723 video (1378 CSS) while the cursor sat further right. The image renders under the fixed header (clipped at header bottom). Peak follow speed ≈ 800 video px/s. |
| Hover image exit | Cursor leaves the list (page scrolled it away) | opacity 1 → 0. Size stays 384 video px; no scale. | ≈400 ms (27.30→27.70) | — | ease-out-ish | — | MEASURED. The x tween keeps running during the fade. |
| Logo network grid (4 cols × 6 rows) | Grid top reaches the viewport bottom (≈ 'top bottom') at 27.6 | Each cell (logo + 1-px border) brightens from invisible → light grey. Logo max went 16 → 97 → 155+ luma. | **Very long linear ramp**: about +41 luma/s. Still rising at 31.6 s (col0 #aeabb1, col2 #d1ced2). Total ≥ 4 s; the final value was never seen in view. | **Column stagger ≈ 0.30–0.35 s** (col0 27.6, col1 ~27.95, col2 ~28.27, col3 ~28.57). **No row stagger**: all rows in a column match within ±3 luma. | linear (`none`) | — | MEASURED. Time-based: the brightening continued at the same rate while scrolling paused (28.2–28.6). The border brightness follows the same column gradient, so this is whole-cell opacity. Reproduce as stagger by column index × 0.33 s, duration ≈ 4–5 s, ease none. |
| Section headings (Events, Insights) | Scroll | Blur only while inside the bottom **progressive-blur band** (≈ bottom 120–130 video / 100 CSS px of the viewport). Sharp above it. | — | — | — | — | MEASURED. These headings have no entrance tween; the blur comes from the fixed overlay (FROM-SOURCE). |
| Events big media and insights thumbnails | Scroll | No reveal tween. They scroll through the blur band. No pixelation stages. | — | — | — | — | MEASURED. Static duotone dither (see colours). |
| Podcast list item hover | Hover (static cursor, rows scroll under it) | Title #f0edf1 → accent #7f0fd5 and back. The cursor becomes a pointer. | ≤ 33–67 ms (effectively instant / ~0.1 s) | — | — | — | MEASURED. No movement of the chevron was visible. |
| "See all podcasts" pill (white) label | Hover | The label chars roll vertically: the outgoing line slides up, the duplicate line comes in from below | ≈300 ms total | chars stagger 0.01 s (FROM-SOURCE) | — | — | Seen at 34.8–35.0 (half-rolled frames "See all ---- / --- all podcasts"). |
| CTA panel (`.section_cta`) | Scroll | **Moves 1:1 with scroll.** Top-edge displacement 405 px vs scroll 404 px over 37.6→38.1, so there is no parallax. Corner radius scrubs from 0 (37.2) → ~24 video px (38.1) → 40 video = 32 CSS (= 2.5em) by the time the bottom shows. | scrub | — | none, scrub 1 (FROM-SOURCE) | — | The rise is just the page scrolling. Width 1869 video (1495 CSS), 16 video (12.8 CSS = 1em) side margins. The dotted `.cta_bg` columns sit at the left/right inner edges. |
| CTA heading chars "Enter through Aiden" | Panel top passes ~60 % of the viewport (37.65) | y 24 → 0, autoAlpha 0 → 1, blur 12 → 0 | 1 s each | stagger 0.04 → first char 37.75, last ~39.0 | power1.out | — | FROM-SOURCE, timing confirmed MEASURED. |
| CTA paragraph lines | Heading start + ~0.9 s | Same blur/fade style per line | 0.5 s | 0.08 | — | — | Lines visible blurred at 38.6–39.0 (MEASURED). |
| CTA button | After the paragraph | fade/blur in | 0.6 s | '-=0.3' | — | coral dot canvas pulses (FROM-SOURCE) | Fully crisp by ~39.4 (MEASURED). |
| Giant outlined wordmark "Primora ✳ Primora…" | Revealed as the CTA scrolls off | **Vertical: scrolls 1:1 with the page** (dy −190 for scroll 189). **Horizontal: constant leftward marquee drift ≈ 30 video px/s (24 CSS px/s), time-based.** | continuous | — | linear | **Yes** (marquee) | MEASURED via template match: dx −6 per 0.2 s and −10 per 0.35 s regardless of scroll amount. 1-px stroke, very faint (#29262c–#312e34). |
| Footer card | Scroll | No entrance tween. Text is blurred only in the bottom band. | — | — | — | — | MEASURED. |
| Progressive-blur overlay | `.progressive-blur_trigger` enters the viewport (FROM-SOURCE) | Blur band on → **off instantly** | 0 ms (41.216 blurred, 41.250 crisp) | — | step | — | MEASURED. There is no fade. |
| Click "Framework" (43.49, outside this segment) | click | Nav link turns white. The **old page is replaced in one frame** (hard cut, no fade) at 43.52, scrolled to the top. The new page first shows empty structure (grid lines, card frame). The nav "Talk to Aiden" dot canvas disappears. | content starts ≈ 0.9 s later | — | — | — | MEASURED. At 44.40 the hero heading chars blur in ("You build…"), the chart card draws and the dot canvas returns. Details belong to the next segment. |

## 3. Layout at 1900-px video width (= 1520 CSS)

| item | video px | CSS px | notes |
|---|---|---|---|
| viewport | 1900 × 869 | 1520 × 695 | |
| fixed header height (bottom hairline) | 94 | 75 | Hairline #29262a |
| container vertical lines | x = 160 and 1740 | 128 / 1392 | Width 1580 → **1264 CSS**. Side margin 10em. |
| horizontal hairlines | stop 16 px each side of the container lines; start 8 px from the viewport edge | 12.8 / 6.4 | "cross-gap" look |
| content inset from container line (rows, logo grid) | 86 | 69 | Title x = 247 video / 198 CSS |
| events media inset | 54 | 43 | Media x 214–1159 |
| "Who we work with" row height | 275 | 220 | Row borders span x 176–1724 (141–1379 CSS) |
| row description column x | 966 | 773 | |
| active left bar | 3 × 72, on the container line x 159–161 | 2.4 × 58 | |
| title font (approx.) | cap+x ≈ 40 tall | ≈ 35 px serif | approximate |
| hover image | 384 × ≈385 | **307 × 307** (24em) | |
| logo cell | 334 × 117 | 267 × 94 | 1-px border #1e1b1f; fill = bg |
| logo gaps | 22 within a group / 33 between NETWORK and PROJECTS | 17.6 / 26.4 | Cols at x 246, 601, 967, 1321 |
| events media | 946 wide | 757 | Small radius. List column x 1268 (1014 CSS), chevron ≈ 1670 (1336). |
| CTA panel | x 16–1884, w 1869, h ≈ 870–900 | 12.8 margin, w 1495, h ≈ 700 (≈100vh) | Radius 40 → **32 CSS (2.5em)** |
| footer card | x 182–1718 (w 1537), h 373 | 146–1374 (w 1229), h 298 | Padding 44 all sides → **35 CSS** |
| footer legal row | 63 below the card bottom | 50 | © left, links right |
| nav "Talk to Aiden" button | 195 wide (x 1524–1718), coral dot square ≈ 34 | 156 / 27 | |

## 4. Colours (MEASURED, full-frame samples)

| hex | where |
|---|---|
| #100d11 | page background |
| #29262c / #29262a | hairlines, container lines, row borders |
| #1e1b1f | logo cell border |
| #f0edf1 (#f2eff3 logo) | primary text: active row title, headings, list titles |
| #b7b1b8 | active row description |
| #3e3b3f / #333034 | inactive row title / description (≈ 20 % opacity) |
| #636064 | eyebrow mono labels ("EVENTS & PODCASTS", "RECENT AND FEATURED PODCASTS") |
| **#7f0fd5** | accent: CTA panel fill, eyebrow square, list-hover text, dither dark tone (#820fd6) |
| **#ea5d56** (#e85c54–#ec5c58) | coral, the dither light tone in events media and insight thumbnails |
| ~#a428ac | CTA background dot columns (magenta dots on violet) |
| ~#ab6060 / #9f4c4f | nav-button coral dot canvas (dim dots) |
| #bd7275 + #430000 | red divider segment (1-px bright + antialias row) |
| #642a91 + #2c0058 | purple divider segment |
| #29262c–#312e34 | outlined wordmark stroke |
| #b4b1b7 | footer tagline. Footer nav and legal text are grey around #8a878b (approximate; ClearType-tinted). |
| hover-image dither | single-tone purple dots on dark: avg rgb(91,17,146), dots ~#7f0fd5 |

## 5. Surprises / implementation notes
1. **Row activation is hover-driven, not viewport-driven.** With a static cursor, scrolling moves rows under it, so a 470 ms crossfade cascades down the list. Rebuild with `mouseenter` plus re-hit-testing on scroll. A pure ScrollTrigger "centre row" approach would not match.
2. **The hover image is viewport-fixed and clamped to the list's x bounds.** It follows x with a ~0.5 s power-out retarget tween, not a lerp. Enter is ≈150 ms, exit ≈400 ms, swap ≈80 ms crossfade. It sits under the header.
3. **The logo grid reveal is a slow linear opacity ramp (≥ 4 s) staggered only by column (~0.33 s).** It is not a quick per-cell fade.
4. **The dithered media have no animated pixelation.** Their softness on entry comes entirely from the bottom progressive-blur band (≈100 CSS px tall), which is removed with a hard switch at the page end.
5. **The "rising" CTA panel has no parallax.** Only its top corner radius scrubs (0 → 2.5em); the content reveal is time-based.
6. **The wordmark drifts horizontally on a clock** (~24 CSS px/s leftward), independent of scroll, while scrolling normally in y.
7. **Divider-band colour segments also drift on a clock** (~24 CSS px/s), in opposite directions per line.
8. **The page transition is a hard cut** (no overlay or fade) and is followed ~0.9 s later by the new page's entrance animations.
9. **The brief's chrome height (60 px) was wrong.** Content starts at y 151 and the scrollbar takes x ≥ 1900. Earlier 5 fps overview sheets used a y-60 crop and still show the bookmarks bar.
