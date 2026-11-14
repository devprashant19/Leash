# Motion spec: primora.xyz /framework (video 42.5–78.0 s)

Conventions
- Times are absolute video seconds. The recording only updates about 30 times a second, so every timing is ±33 ms.
- Layout uses **video px (vpx)** and **CSS px**, where CSS = vpx / 1.25 (display scale 1.25). The page viewport is the region `crop=1900:870:0:150`, which is 1900×870 vpx = **1520×696 CSS**. Viewport-relative y values in vpx are measured from the top of that crop.
- Colour samples use full-frame coordinates (y includes the 150 px of browser chrome).
- MEASURED = taken from this video. FROM-SOURCE = given in the brief and not contradicted here. EST = estimate.
- Frames and scripts are in `scratchpad/ref/frames_framework/`.

## 1. Energy bursts (frame-difference YAVG, 480 px wide, 60 fps sampling)

| Window (s) | Peak | Cause (verified on frames) |
|---|---|---|
| 42.5–43.45 | ~0 | Previous page sits at its footer. Cursor moves to the nav. |
| 43.50 | 1.26 | **Route swap at 43.52.** Instant: one frame, no cross-fade, no cover. |
| 43.62 / 43.73 | 0.24 / 0.11 | Cursor, then the hero accent line appears (43.72). |
| 44.25–46.25 | 0.05–0.17 (2.1 spike at 44.5) | Hero reveal: chars, then mosaic pop (44.43), images pop (44.57), paragraph, button. Mosaic chips cycle at 46.0–46.3. No scroll. |
| 46.5–47.7 | ~0 | Idle. Mosaic bars and curve morph slightly (46.2–47.3). |
| 47.75–49.25 | 2.4 | Wheel scroll 1: hero to section 1 (step chart). |
| 49.75–51.0 | 1.4 | Scroll 2. The step chart keeps drawing. |
| 51.5–52.5 | 2.0 | Scroll 3: rhombus nodes pop, radar starts. |
| 53.0–54.0 | 1.9 | Scroll 4: radar morph. |
| 54.75–55.75 | 1.5 | Scroll 5: stage bars. |
| 56.25–57.5 | 1.2 | Scroll 6: mid CTA on grid, drifting lines. |
| 57.75–59.0 | 1.6 | Scroll 7: staircase labels, four columns. |
| 59.25–61.75 | 2.8 (60.5) | Scroll 8 plus the $680M+ odometer roll. |
| 62.0–63.0 | 0.2 | Scroll pause. Violet bars keep growing (so they are time-based). |
| 63.5–66.75 | 0.6–1.3 | Slow scrolls: growth line, then the Ecosystem Capital count-up. |
| 67.5–68.75 | 1.75 | Scroll: area curve draws. |
| 69.25–70.75 | 1.7 | Scroll: purple CTA panel enters (radius scrub). |
| 71.25–73.25 | 2.4 (72.0) | Scroll through the CTA (text reveal) into the footer. |
| 73.5–74.25 | 0.9 | Footer card reveal. |
| 74.5–75.75 | ~0 | Still. |
| 75.75–76.9 | **27.5 at 76.0** | Programmatic scroll to top. Most of the distance goes in the first frames, then it eases out. About 850 ms from footer to hero. |
| 77.0–78.0 | ~0 | Back at the hero. Mosaic chip now shows a third dataset, "RAISE +$62M". |

## 2. Per-element motion

| Element | Trigger | Properties from → to | Duration (ms) | Delay / stagger | Easing | Idle loop | Notes |
|---|---|---|---|---|---|---|---|
| **Page enter** | Route change | Old DOM replaced in one frame. Frame lines, header and grid are visible immediately. | 0 | – | – | – | MEASURED. No overlay or fade transition. All motion afterwards comes from per-element reveals. |
| Hero left accent line (2–3 vpx wide, 160 vpx / 128 CSS tall, at x=160 vpx) | Load | opacity 0 → 1, no growth | ≤33 | +200 ms after the swap (43.72) | step | – | MEASURED. Full height in the first frame it appears. |
| Hero H1 line 1 "You build the product." (dim) | Load | SplitText chars: y 24 → 0, blur 12 → 0, autoAlpha 0 → 1 | ~1000 per char | First char at 44.15 (+630 ms after the swap). The line reads as settled at about 45.0. | power1.out | – | FROM-SOURCE props, MEASURED timing. |
| Hero H1 line 2 "We help It scale." (bright) | Same timeline | same | ~1000 | Starts **~600 ms after line 1 starts** (44.75) and settles about 45.7 | power1.out | – | MEASURED offset implies an effective per-char stagger of **~0.03 s** (19 non-space chars in 0.6 s), against 0.04 in the source. Check whether `each`/`amount` or space handling explains the gap. |
| Hero paragraph (3 lines) | After H1 | Lines: blur, y and alpha go to visible | ~500 | First line about 45.4, about 80 ms between lines, done about 45.9 | power1.out | – | Matches FROM-SOURCE 0.5 s with 0.08 stagger. |
| Hero button "Talk to Aiden" | After paragraph | blur and alpha go to sharp | ~400 | 45.9 → 46.3 | out | – | MEASURED. |
| Mosaic frame, grid, bars, S-curve, chips | Load | Pop in. Frame, bars, curve and chip 1 appear in one frame. | ≤33 | 44.43 (+910 ms after swap). Chip 2 follows at +100 ms. | step | yes, see the row after next | MEASURED. Behaves like a Rive canvas's first frame. |
| Mosaic image tiles (coral portrait, violet dithered crowd) | Load | Pop in one frame | ≤33 | 44.57 (+140 ms after the mosaic) | step | static | MEASURED. Looks like the images finished loading; no designed fade. |
| **Mosaic dataset cycle** | Time | Chips fade out, values swap, chips back in. Bars re-height. S-curve re-shapes. | Chips: ~100 out, ~100 in. Bars: 400–500. Curve: ~1000–1100. | Chip 2 enters 100 ms after chip 1. Bars and curve morph together with the chip swap. | smooth in-out (EST) | **Hold ≈1.5 s, period ≈1.7 s per dataset** | MEASURED. Dataset A is TVL +253% / DAU +117%. B is USERS +2.1M / VOL +$1.3B. C is "RAISE +$62M" (seen at 77 s). Each bar is a violet stem with a coral top segment (cap). |
| Section heading / eyebrow / paragraph (all sections) | ScrollTrigger on enter | Same split reveal as the hero | as hero | – | – | – | FROM-SOURCE. Not isolatable here because the progressive blur sits on the same viewport band. |
| **S1 step line chart** | Enters view (chart ~fully visible, chart top ~180 vpx) | The line draws from bottom-left in steps (rise, then run). A square violet node rides the head and stays behind at each corner. | **Time-based, ~300 ms per step.** Total ≥2.3 s (49.0 → ≥51.3). | First node at 49.0 | ~linear per segment | none seen | MEASURED: the head keeps moving during the scroll pause at 49.3–49.7, so it is **not scrubbed**. The grid draws in faintly at 49.0–49.4. A tall violet guide line grows at 49.4–49.6. At each milestone a **dashed violet vertical** appears and a pill label blur-fades in over 200–300 ms (EARLY ADOPTERS at 49.4–49.6, TRACTION at 51.0–51.2). |
| **S2 rhombus loop** (dashed circle, rhombus, concentric rings, glowing centre) | Enters view | Strokes faint at entry. Centre glow brightens. Coral square nodes pop. | Node pop ≈100–150 (first frame is a 2–3 vpx dot, next is the full 12 vpx square). Glow ramp ~200. | Nodes go **top 51.2 → left 51.4 → right 51.6 → bottom 51.8 (200 ms stagger)**. Glow starts 51.1. | back/out pop (EST) | Glow pulse **not determinable** (no long static window) | Labels: the outlined pill border appears first (top about 51.9–52.0, bottom about 52.4), then its text fades in about 500 ms later (bottom label "RENTENTION" readable at 52.5–52.9). The typo is on the site. |
| **S3 radar / pentagon** | Enters view | Polygon starts as a spike from the top vertex, with violet light streaks falling below the vertices (52.3–52.7). It morphs into the data pentagon. | Morph ~1100 (52.3 → 53.4) | Labels: FUNDRAISING (border 51.9, text 52.1), then GROWTH + PARTNERSHIPS (52.3–52.5, blur-in), then STRUCTURE + MARKET POSITION (53.4–53.5) | in-out | **Yes.** The polygon keeps morphing between shapes (compact pentagon ↔ wide trapezoid) at 53.8–54.8, including during a pause. | MEASURED, time-based (Rive-like). |
| **S4 stage bars LAUNCH → SCALE** | Enters view | Each column gets an outlined violet bar that grows in height with a vertical gradient fill. A small violet square floats above the bar. | Grow ~300–400 per bar | LAUNCH at 55.1–55.3, TRACTION from 55.7 (10 vpx) to 55.9 (~30 vpx). **~400–500 ms stagger.** | out | the square floats (EST) | GROWTH and SCALE scrolled out of view before they completed. The four label pills are present from entry. |
| Mid CTA on grid | Scroll | Grid card with dots at the intersections and a centred button. Content reveal follows the standard pattern. | – | – | – | – | Mostly static. |
| **Drifting separator lines** (violet 288 vpx and 1247 vpx segments, coral segments, 33 vpx / 26 CSS apart) | Always | translateX at constant velocity | continuous | – | **linear** | **~25–36 vpx/s (20–29 CSS px/s)**. Adjacent lines drift in opposite directions. | MEASURED. Same speed whether or not the page is scrolling, so time-based. Visible between sections and under the progressive blur. |
| **Staircase labels** (VALIDATION, ENGAGEMENT, SYNDICATION, INSTITUTIONALIZATION) | Per-element on enter | blur + fade (+ y) to visible | ~300 | Order is **top-first**: INSTITUTIONALIZATION → SYNDICATION → ENGAGEMENT → VALIDATION, ~130 ms apart while scrolling | out | – | Looks like each label has its own trigger crossing the start line, not a fixed stagger. Each label sits on a horizontal line segment, and the steps rise to the right. Prefix squares count up (1–4). |
| **Four columns** (icon, serif title, paragraph) | Enter | Paragraph line reveal | ~500 | Blur at 58.43, sharp by about 58.6 | power1.out | – | **Activation:** column 1 ("Scaling with substance", paired with VALIDATION) is bright and columns 2–4 are dim. Nothing changed during 58.6–60.0 and the cursor never hovered, so the switching rule is UNKNOWN. Implement as active = current stage, with the first one by default. |
| **Odometer "$680M+"** | Enter | Chars blur-reveal "$0M+" (59.9 → 60.3), then each digit column rolls **upward** (the next digit enters from below) | **Roll ~1350** (60.40 → 61.75) | Starts ~450 ms after the reveal starts. All columns start and end together. | **power2.out** (fits p(t) within ~0.03) | – | MEASURED. Each column is a strip of digits with its own length: hundreds 0→6, tens 0→8, ones 0→9→0 (10 steps, wraps). Observed intermediate values 12x, 235, 346, 457, **468, 579**, 680 match floor(p·6), floor(p·8), floor(p·10) mod 10. **Neighbour digits stay partly visible above and below**, so there is no hard 1-line clip; the mask is roughly 1.5 lines tall or soft. |
| **Bars under the odometer** (5 grey "before" + 12 violet "after", 61 vpx / 49 CSS pitch, ~2 CSS wide) | Enter | Grey bars fade or blur in together. **Violet bars grow from the baseline, left to right.** | ~300 per bar | **~90–100 ms stagger.** Grey bars at 61.6; violet bars 61.7 → 62.9. | out | – | MEASURED, time-based (continues in the 62.0–63.0 pause). The AFTER pill's violet border brightens at about 62.9–63.0, after the last bar. |
| Growth line ("This is what engineered growth looks like") | Enter | The flat coral segment is already drawn. A **fixed coral dot** marks the inflection. The rising segment draws up and to the right from the dot. | ~600 (64.4 → 65.0) | – | ease-in (accelerating) curve shape | – | MEASURED, time-based. Uses the dark gradient grid square on the right with a PRE-ACCELERATION label. |
| **Ecosystem Capital count-up** "$0M → $680M" | Card in view | Plain text count-up, **not** a roll. Colour/opacity also ramps from dim grey to white as the value rises. | ~2000 (≈65.1 → 67.1) | – | ≈ sine/power1.inOut | – | MEASURED samples at 0.125 s steps: 38, 67, 93, 148, 192, 253, 314, 370, 452, 504, 560, 593, 637, 680. |
| Before/after progress bars | Same | BEFORE fills to 12% quickly (≈65.75). **AFTER fills 0 → 70% in sync with the count.** The % chip and the right-hand $ value ($476M) count with it. | ~2000 | – | same as the count | – | The PLATFORM SHARE GROWTH chip counts +22% → **+58%** and finishes about 67.9, **~0.8 s after** the main number. The chip has a violet border glow. |
| **Area curve "Participation growth"** | Enter | Coral S-curve strokes left to right, with the gradient area fill following it | **~1000** (68.4 → 69.4) | ENGAGEMENT PHASE callout (coral pill with dashed leaders) blur-fades in at 68.4–68.5. Axis 20K EARLY / 200K MID at 68.6. End drop line plus the **2.2M PEAK** highlighted pill at 69.4–69.5. | ~in-out | – | MEASURED, time-based. |
| **Purple CTA panel** | Scroll (scrub) | border-radius **0 → ~36–40 CSS** (~45 vpx), roughly linear with the panel top moving from the viewport bottom toward the top. Width 1857 → 1868 vpx (scale ≈0.994 → 1, 70.1–70.5). | scrub | – | linear (scrub) | – | MEASURED radius from the corner inset: inset 0 at top=787 vpx, 10 at 548, 20 at 368, 26 at 326, 29 at 174, then the header clips it. Consistent with FROM-SOURCE 0 → 2.5em. |
| CTA text "Enter through Aiden" + paragraph + button | top 60% (once) | Chars, then lines, then button blur reveal | Heading 70.8 → 71.8. Paragraph 71.4 → 71.9. Button 72.0 → 72.3. | – | power1.out | – | Dithered vertical strips at the left and right of the panel fade in at about 71.3. |
| Footer wordmark (giant outline "✱ Primora") | – | Moves only with the scroll. No horizontal drift. | – | – | – | none | MEASURED: x stays fixed over 73.0–73.5. |
| Footer card | Enter | Logo, links, tagline, socials and button blur-fade in | ~400 | 73.6 → 74.2 | out | – | |
| Scroll to top | Programmatic (Lenis scrollTo) | scrollY footer → 0 | ~850 | – | expo-out-like (huge first-frame jump) | – | Revealed elements stay revealed (`once`). Rive diagrams show their end or idle state. |
| Progressive blur overlay | Fixed | Blurs content in the bottom ~150–170 vpx (~120–135 CSS) of the viewport | – | – | – | – | FROM-SOURCE, confirmed. Headings at y ≳ 700 vpx render blurred. |

## 3. Layout (viewport 1900×870 vpx = 1520×696 CSS)

| Item | vpx | CSS px |
|---|---|---|
| Header height (bottom border line) | 95 | 76 |
| Content frame vertical lines | x=160 and x=1740 (width 1580) | x=128 and x=1392 (width 1264); 128 side gutters |
| Text column left edge | 247 | 198 (70 inside the frame line) |
| Hero H1 | glyph box 69 tall, line pitch 85, line 1 width 730 | **≈56 px font (3.5rem), line-height ≈1.2 (68)** |
| Hero paragraph | line pitch 36, width ~730 | ≈18 px font, line-height 28.8 (1.6), max-width ~584 |
| Hero button | 230×64 | 184×51, white bg, dithered red square icon |
| Hero accent line | x=160, y 222–381 | 128 tall, at the frame line |
| Hero split | text 247–985, mosaic 1093–1718 | text ~590 wide, **mosaic 500×500** at x≈874–1374 |
| Mosaic grid cells | pitch ~91 | **~73** (7×7-ish grid with dots at intersections) |
| Mosaic tiles (portrait, dither) | 166×163 | ~133×130 (about 2 cells) |
| Mosaic chips | 70×36 (USERS / +2.1M) | 56×29, violet 1 px border, mono text |
| Mosaic bars | 12 bars, pitch ~42, max height ~150 | pitch ~34 |
| Section separator → eyebrow | 94 | 75 |
| Eyebrow square | ~14 | ~11 |
| Section H2 (two-line "Product & engagement / architecture") | line pitch ~58 | ≈40 px font (2.5rem), lh ~46 |
| Section diagram column | x ≈1130–1610 | x ≈904–1288 (~384 wide) |
| Rhombus circle diameter | 410 | 328 |
| Step-chart node square | ~12 | ~10 |
| Pill labels (EARLY ADOPTERS) | ~170×37 | ~136×30, 1 px border #3a373b, mono uppercase with wide tracking |
| Odometer number "$680M+" | glyph box 86 tall, width 352 | **≈76–80 px font (~5rem)**, width 282 |
| Bars under odometer | pitch 61, stroke ~3, 17 bars from x=249 to 1225 | pitch 49, stroke ~2 |
| BEFORE / AFTER pills under bars | 273×37 / 1114×37 | 218×30 / 891×30 |
| Ecosystem Capital card | x 1130–1655 (525 wide), number glyph box 84 | 420 wide, number ≈5rem |
| Progress bars | 525 long, ~4 thick | 420 long, ~3 thick, rounded |
| Purple CTA panel | x 16–1884, height ≈840 (EST) | **12.8 side gutters**, ≈672 tall (≈viewport), radius ends ≈40 |
| Drifting line spacing | 33 | 26 |
| Section height (diagram sections) | not measured cleanly | EST ~0.9–1 viewport |

## 4. Colours (sampled from video; h264 4:2:0, so ±3 per channel)

| Token | Hex | Where |
|---|---|---|
| Page background | **#100D11** | everywhere |
| Frame / separator lines | **#29262A**–#29262C | 1 px hairlines |
| Violet (primary) | **#7F0FD7** (fill #7F0FD5) | mosaic bars, step nodes, eyebrow square, progress fill, CTA panel |
| Violet thin strokes | #531B79 (step line), #5C0E9C (dashed guide), #750DC3 (odometer bars) | antialiased 1–2 px strokes |
| Violet borders | #6D0DB5 (chips, platform chip), #380D5E (AFTER pill, dim) | |
| Violet track | #200732 | progress track |
| Coral | **#ED5E58 / #EF5D56** | bar caps, rhombus nodes |
| Coral thin stroke | #D55450 (mosaic curve), #A65555–#B14D4B (area curve and drop line) | |
| Coral glow centre | #251417 (radial, very dim) | rhombus centre |
| Grey bars ("before") | #484249 | |
| Text bright | #F0EDF1 / #EFECF0 | H1 line 2, chip values |
| Text dim (H1 line 1) | **#827F83** | |
| Paragraph | #B5B1B7 | hero paragraph |
| Pill text / dim labels | #645E65 | BEFORE label, pill text |
| Pill border | #3A373B | |
| Nav inactive, eyebrow text | **#5E6E87 / #565F78 (slate-blue tint)** | Possibly slate-500-like. Note: the section paragraph also sampled bluish, #9EB4D5. |
| Dim column title | ~#7F7E8A | inactive columns |
| CTA paragraph on violet | #EFDBF5 | |
| Button | #FFFFFF bg, dark text | |

## 5. Surprises and implementation notes
1. **There is no page-transition animation.** The swap is a hard cut. All the "enter" feel comes from staggered reveals: accent line at +200 ms, H1 at +630, mosaic at +910, images at +1050.
2. **Hero H1 stagger is effectively ~0.03 s per char** (line 2 starts 0.6 s after line 1), not the 0.04 s in the source.
3. **Mosaic is a looping dataset carousel** with three datasets and a ~1.7 s period. Chips crossfade with a 100 ms stagger, and bars and the S-curve morph in sync.
4. **Diagrams are time-based, not scroll-scrubbed.** That covers the step chart, rhombus, radar, stage bars, bars, growth line and area curve; all of them kept advancing during scroll pauses. **The radar keeps morphing after its intro.**
5. **The odometer uses per-column digit strips of different lengths** with power2.out over ~1.35 s, and neighbour digits remain visible. It is a different effect from the **Ecosystem Capital count-up**, which is a plain number tween of ~2 s whose colour brightens with the value. The secondary +58% chip ends ~0.8 s after the main number.
6. Decorative horizontal line segments **drift constantly** at ~20–29 CSS px/s in alternating directions. They are part of the page's ambient motion.
7. The CTA panel also scales slightly (≈0.994 → 1) at the start of the radius scrub.
8. Staircase labels reveal **top-first**. That is consistent with per-element ScrollTriggers, not an index stagger.
9. The column "active" state never changed in this recording. Treat the activation rule as unverified.
10. Dim UI text (nav, eyebrows) samples as a **blue-grey (#5E6E87)** while body text is neutral. Worth checking against the source CSS.
