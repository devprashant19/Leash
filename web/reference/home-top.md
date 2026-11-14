# home-top: motion spec (video 5.5 s to 21.0 s)

Source: `reference.mp4`. Frames and scripts are in `scratchpad/ref/frames_home-top/` and `scratchpad/ref/*.js`.

## Units and capture notes

- **Browser chrome is 151 px tall** (tab strip, toolbar and bookmarks bar), not 60 px. Page content runs from y=151 to y=1020 in full-frame coordinates. The page scrollbar takes x=1901 to 1919 (19 px).
- **The display scale is 1.25.** Two things confirm it: one wheel notch scrolls about 125 video px (100 CSS px × 1.25), and the scrollbar is 19 px wide (15 × 1.25).
  - Video px = device px. CSS px = video px / 1.25.
  - Viewport: **1901×869 video px, which is 1521×695 CSS px**.
- The recording is variable-frame-rate. The average is about 29 fps, so real changes arrive about every 33 ms (sometimes 17 ms). **All timings are ±33 ms.**
- **Browser stall:** the frames from 7.10 to 7.30 s are identical. The page or the recorder hung for about 200 ms during the hero entrance, so durations measured across that window are less reliable.
- **Tags:** M = MEASURED from frames, the energy curve or pixel analysis. S = FROM-SOURCE (given in the brief; not contradicted unless stated). E = estimate or inference.

## 1. Energy bursts

The energy curve is the mean frame difference at 60 fps after scaling to 480 px (`energy.txt`). Scroll offsets come from block matching (`scroll.csv`).

| Time (s) | Peak YAVG | What moves | Kind |
|---|---|---|---|
| 5.5–6.15 | 0 | Blank browser tab (flat mauve #463144, browser colour, not the site) | none |
| 6.20 | 33 (1 frame) | First paint of the page: hard cut, everything static (nav, container lines, hero grid, intersection dots, candle strip under the blur). **No nav or grid entrance.** | cut |
| 6.20–6.90 | ~0 | Hero text not yet visible: about 0.7 s of empty hero | idle |
| 6.92–8.50 | 0.2–1.0 | Hero headline chars, then subtitle lines, then CTA button | animation (load) |
| 8.50–9.85 | **0.00** | Nothing moves. The grid, intersection dots and button dot canvas have **no idle loop** | idle |
| 9.90–10.70 | 6 | First scroll burst (hero leaves, candle strip comes up through the progressive blur) | scroll |
| 11.0–11.6, 11.75–12.6 | 4 / 2.7 | Scroll: streak rails, then "What we've learned matters most", then the orbit | scroll (+ orbit loop) |
| 12.6–13.47 | 0.9→0.1 | Scroll decays. The remaining energy is the **orbit rotation** (continuous) | scroll tail + loop |
| 13.5–14.5 | 3.4 | Scroll: orbit out, "When strategy becomes measurable impact" in | scroll |
| 14.65–16.3 | 6.2 | Scroll plus the **odometer** (14.83–16.6) | scroll + animation |
| 16.55–17.8 | 5 | Scroll to the mid-page CTA on the grid. Streaks drift | scroll + loop |
| 17.9–18.3 | 0.15 | Scroll paused. Only the **streak drift** is left | loop |
| 18.33–20.1 | 5.5 | Scroll plus the **scrubbed paragraph reveal** (19.37–20.67) | scroll-scrubbed |
| 20.1–20.33 | ~0.3 | Scroll is still but the paragraph reveal keeps catching up (scrub lag) | scrub lag |
| 20.37–21.0 | 13 | Scroll on to the next section ("Who we work with") | scroll |

**Scroll behaviour (M, matches Lenis defaults S):**
- Each wheel notch gives an impulse that decays with a ratio of about 0.80 per 33 ms (lerp 0.1 at 60 Hz gives 0.81). The first frame moves about 24 px; the total is about 120–125 video px (100 CSS px).
- Peak speed with stacked notches: 57 video px per 33 ms, about 1700 video px/s (1370 CSS px/s).
- Average from 9.9 to 21.0 s: 4627 video px in 11.1 s, about 417 video px/s (333 CSS px/s).

## 2. Per-element motion

| Element | Trigger | Properties from → to | Duration | Delay / stagger | Easing | Idle loop | Notes |
|---|---|---|---|---|---|---|---|
| Page / nav / hero grid | Load | Hard cut at first paint (6.20) | 0 | — | — | None (energy 0 from 8.5 to 9.85) | M. Nothing fades in. The nav is opaque, so content scrolls under it and is hidden. |
| Hero headline chars (16 chars, 2 lines) | Load | opacity 0→1, blur 12px→0 (S; M: heavy blur visible, about 15 video px at the first frames), y +24 CSS px → 0 (S; M: about 25–30 video px lower at 7.0–7.1, which fits) | Per char 1.0 s (S). M: luminance 10%→90% takes about 0.45 s per char; the whole headline is visible-to-settled from 6.92 to 8.05 (1.13 s) | tl delay 0.2 (S). First char visible at 6.92 (0.72 s after first paint, M). Stagger 0.04 (S); M ≈ 0.03–0.04 s (50% crossings span 7.08→7.55 over 15 steps) | power1.out (S). M: fast early rise, long tail | none | Chars appear to resolve word by word because of the blur overlap. Line 2 trails line 1 by about 0.15–0.25 s. |
| Hero subtitle lines (3) | Load | opacity 0→1, blur (visible, roughly 8–10 video px)→0, y about 6–8 video px → 0 (M, small) | M: 2%→98% in about 0.43 s per line (S: 0.5) | M: line starts 7.45 / 7.50 / 7.55; 90% at 7.78 / 7.88 / 7.95, so stagger ≈ 0.05–0.08 (S: 0.08) | ease-out | none | **Discrepancy:** M puts the subtitle start 0.53 s after the first headline char. S (`-=0.8`) predicts about 0.8 s. Use the measured gap if matching the video. |
| Hero CTA button | Load | opacity 0→1 plus blur→0 (button is clearly blurred at 8.0, M) | M: 2%→98% from 7.95 to 8.48 (0.53 s; S: 0.6) | M: starts 0.50 s after subtitle line 1 (S: `-=0.3`, which is about 0.36 s) | ease-out | Dot canvas static at idle (M) | Whole entrance from first char to button settled: **6.92 → 8.48 (≈1.56 s)**. |
| Button hover (coral dots ripple, label char stagger) | Hover | — | — | label chars 0.01 s (S) | — | — | The cursor only crosses the hero CTA during scroll (about 10.33 s). **No hover effect could be resolved** in this segment (M: inconclusive). |
| Progressive blur overlay | Fixed | Bottom band of viewport blurred | — | — | — | static | M: blurred band ≈ bottom 110–130 video px (≈ 90–105 CSS), stronger toward the bottom edge. Every "blurred heading" in this segment (candles, h2s, stats, CTA, paragraph) is this overlay, **not** an entrance animation. |
| Candlestick strip | Scroll only | Nothing animates. The strip rises through the blur band | — | — | — | static | M: candle heights identical from 10.4 to 11.0. The "rise" in the sheets is scroll plus de-blur. |
| Horizontal streak lines | Continuous loop | translateX of coloured segments on fixed grey rails | Constant | Adjacent rails move in opposite directions | linear | **Yes** | M at 17.9–18.3 (scroll paused): rail at y666 moves +30 video px/s (right), rail at y700 −35 video px/s (left), rail at y734 +30 video px/s. **About 24–28 CSS px/s.** Each rail carries one violet and one coral segment (for example 290 px violet plus a separate coral segment near the right edge), and they wrap. |
| Orbit diagram (Rive) | Plays while in view (S: 25% visible) | Rings rotate. Nodes ride the rings; the "REAL PROBLEMS" tag stays attached to its coral node | Continuous | — | linear (constant angular speed, M) | **Yes** | M: inner (coral, r68) **+11.9°/s clockwise**; middle (violet, r171) **−12.0°/s counter-clockwise**; outer (white, r292) **+12.0°/s clockwise**. That is **30 s per revolution** on every ring. No entrance animation seen (nodes and rings already present as the orbit leaves the blur band at about 11.8 s). |
| Impact stats odometer (4 columns) | In view: fires as the stats row enters the bottom of the viewport (E: about `top 90–100%`). Column 1 is already rolling on its first visible frame (14.83) | Per-digit vertical strips 0–9 translateY **upward** (the next digit enters from below). Final values: 3M+, $1B+, $100M+, $10M+ | M: column 1 ends 15.70, column 2 ends 15.33, column 3 ends ≈16.55, column 4 ends ≈16.45. Rolling time ≈ 1.4–1.6 s for the long-spin columns | M: start ≤14.85 / 14.92 / 15.02 / 15.10, so **stagger ≈ 0.08–0.1 s per column** | Strong ease-out (power3/expo-like): motion peaks about 0.2 s after start, then a long tail | none | Digit columns are **added** as the value grows ("$0M+" → "$1M+" → "$12M+" → "$023M+"), and **leading zeros show during the roll** ("$045M+"). Each place spins on its own: in $100M+ the hundreds go 0→1 and arrive first, while tens and ones spin a **full revolution back to 0** ("$188" → "$199" → "$100"). In $10M+ the ones digit also spins 0→…→9→0. |
| Section h2s, image card, mid-page CTA | Scroll only | — | — | — | — | — | M: no entrance animation separate from the blur overlay. |
| Scrubbed paragraph ("Primora works with…", 6 lines, about 215 chars) | Scroll-scrubbed **with lag** | Per **character** colour/opacity: dim #322d34–#362e36 (≈ 0.15–0.2 opacity of #eeebef) → #eeebef. Soft front about 6–10 chars wide (for example "scal" bright, "able" fading) | Tied to scroll | — | Linear per char along the scroll; smoothing lag on top | — | M: line 1 reveals 19.37→19.50 while the paragraph top moves from viewport y 583 to 454. Line 6 is done at 20.63 (para top at y 221). **Lag:** from 19.83 to 20.33 the scroll moves only 16 px, yet line 5 keeps going from 3% to 72% and levels off, i.e. catch-up of about 0.5 s. This fits ScrollTrigger `scrub: ~0.5–1`, not `scrub: true`. Inferred mapping with lag removed: starts at para top ≈ viewport 68% (y≈590/869) and ends at para top ≈ 30% (y≈265), roughly **`start: "top 70%"`, `end: "bottom 70%"`** (E). |

## 3. Layout at 1920 video width (DPR 1.25, viewport 1521 CSS)

Viewport y is measured from the top of the page area (full-frame y − 151).

| Item | Video px | CSS px | Tag |
|---|---|---|---|
| Viewport | 1901 × 869 | 1521 × 695 | M |
| Container (1 px vertical rules, full page height) | x 160–1740, width 1580 | width 1264, side margins 128 | M |
| Nav height (to 1 px bottom rule) | 94 | 75 | M |
| Nav contents | Links on the left from x≈180 (Framework, Purpose, Insights, Events, Contact; cap ≈ 10). Logo "✱ Primora" centred. Small "Talk to Aiden" button plus dot icon on the right | links ≈ 13–14 px font | M/E |
| Hero grid cell | pitch 94.6 (x 193, 288, 382, 477 … 1707; y rows 144, 239, 333, 428 … at viewport) | ≈ 75.7 | M |
| Grid inset from container rule | 33 | 26 | M |
| Grid extent | 16 columns. Lines **masked out in the centre band** (x≈670–1230) behind the hero text | — | M |
| Grid intersection markers | about 3 × 3 squares, mixed violet, coral and white | about 2–3 | M |
| Hero bottom rule | viewport y 760 | 608 | M |
| Headline "We build / what lasts" | Cap height 66, ascender 72, **line pitch 96**. Line 1 top at viewport 213. Line 2 width 418 | cap 53, line-height ≈ 77. **Font-size ≈ 76–80, line-height ≈ 1.0** (serif) | M (size E) |
| Headline → subtitle gap | Baseline of line 2 (532) to subtitle top (598): 66 | 53 | M |
| Subtitle | 3 lines centred, **pitch 36**, max width 407 | line-height 28.8, **≈ 18 px font** (sans), max-width ≈ 326 | M (font E) |
| Subtitle → button gap | 48 | 38 | M |
| Hero CTA button | **219 × 64**, radius ≈ 8 | **175 × 51**, radius ≈ 6 | M |
| CTA label | cap ≈ 15 | ≈ 16 px sans, colour #0c0c0c | M/E |
| CTA dot icon | 43 × 42 square, radius ≈ 5, 9 × 9 dots at pitch ≈ 4.7, dot ≈ 3. Brighter coral at the centre (radial) | ≈ 34 sq, dot pitch ≈ 3.8 | M |
| Candles | **pitch 44, body 30, gap 14**, wick ≈ 2; about 35 candles across x≈178–1690 | pitch 35, body 24, gap 11 | M |
| Streak rails | rail pitch 34; line about 1.25 thick (1 CSS) | pitch 27 | M |
| Orbit radii | **inner 68, middle 171, outer 292**. Core ring ≈ 30 diameter | 54 / 137 / 234; core ≈ 24 | M |
| Orbit nodes | squares ≈ 12. Counts: 3 coral (inner, about 120° apart), 5 violet (middle), 6 white (outer, irregular spacing) | ≈ 10 | M |
| "Read the framework" button (ghost) | ≈ 242 × 71, 1 px grey border, radius ≈ 6, white bold label | ≈ 194 × 57 | M |
| Stats row | **4 equal columns of 395** with 1 px dividers at x 555 / 950 / 1345; text inset ≈ 45 | 316 per column, inset ≈ 36 | M |
| Scrub paragraph | 6 lines centred, width ≈ 970, cap 37, **line pitch 59** | width ≈ 776, line-height 47, **font ≈ 43** (serif, line-height ≈ 1.1) | M (font E) |
| Eyebrow label | Violet square 13 plus mono caps letter-spaced, cap ≈ 11 | square 10, about 11–12 px mono | M |

## 4. Colours

Sampled at the stated time and full-frame pixel. Thin text is affected by 4:2:0 chroma subsampling; those values are marked approximate.

| Token | Hex | Where sampled | Tag |
|---|---|---|---|
| Page background | **#100d11** | 9.0 s, (300,565) | M |
| Container / nav rules | **#29262c** | 9.0 s, x160 and y245 | M |
| Hero grid lines | **#211e23** (peak #201d21–#221f25) | 9.0 s, (193,325), (305,390) | M |
| Orbit section background tint | #110d16 (faint radial violet) | 13.43 s | M |
| Text primary | **#eeebef** (to #f0edf1) | headline "l" stem, 9.0 s | M |
| Text secondary (hero subtitle) | **#b4b1b7** | 9.0 s, subtitle line 1 | M |
| Text dim (unrevealed scrub chars) | **#322d34–#362e36** | 19.62 s, line 4 | M |
| Eyebrow text | ≈ #8a8690 (pixels read #5a5e73 because of chroma bleed) | 19.62 s | E |
| Violet (eyebrow square, ITERATE, middle nodes, candles) | **#7f0fd7 / #8010d8** (candle peak #800dd4) | 13.43 s, 19.62 s, 10.95 s | M |
| Coral (nodes, candles, core) | **#ed5e56 / #e85e56**, core ring #e76060, CORE label #c6605d | 13.43 s, 10.95 s | M |
| Intersection dots | violet #a328b1 / #7024a2 / #8d3a94; coral #e65e5c / #e35a5f; some white | 9.0 s, around (193,295), (382,484), (1707,390) | M |
| Candles at the strip edges | #2f0d46 (violet) and #672b29 (coral), i.e. a horizontal edge fade | 10.95 s | M |
| Streak segments (as rendered, antialiased) | violet ≈ #652b93, coral ≈ #bc7174 (likely brand violet/coral at reduced opacity) | 17.9 s, rows 666–734 | M |
| Orbit dashed rings | ≈ #2a272d | 13.43 s | M |
| White nodes / DISTRIBUTE label | #efecf2 / #e2dfe5 | 13.43 s | M |
| CTA background / label | #ffffff / #0c0c0c | 9.0 s | M |
| CTA icon background / dots | #100f12 / #ee5f5b (peak), #dd130a (most saturated) | 9.0 s | M |
| Dot palette | #F96D57, #F8543A, #F7472B | — | S |

## 5. Easy to miss

1. **The chrome is 151 px and the DPR is 1.25.** Every px value above has a CSS conversion; build to the CSS column.
2. **Hero dead time:** the page paints at 6.20 but the first glyph shows at 6.92. That is roughly the 0.2 s tl delay plus about 0.5 s of font, Rive or JS start-up. Nothing on screen animates in between, so the grid and nav simply sit there.
3. The hero is **completely static at idle**. No grid shimmer, no dot pulse. The only always-on motion in this segment is the **orbit (12°/s)** and the **streak drift (≈ 25 CSS px/s, alternating direction per rail)**.
4. Inner and outer orbit rings turn clockwise; the **middle ring turns the other way**. All three take 30 s per revolution. The "REAL PROBLEMS" callout travels with its node.
5. The odometer starts **before the row is readable**: it fires on enter, while the row is still under the progressive blur. Columns are staggered by about 0.08–0.1 s. Each place digit spins on its own (full revolutions for trailing zeros), new digit columns are inserted, and leading zeros show mid-roll.
6. The paragraph reveal is **per character with a soft front** and **lags the scroll by about 0.5 s**: it keeps revealing after the wheel stops. Don't wire it with `scrub: true`.
7. What looks like a "blur-in" on headings, the candles, stats and the CTA is the **fixed progressive-blur band at the bottom of the viewport**. Those elements have no entrance tweens of their own.
8. In the hero, the **subtitle starts earlier and the button later** than the source offsets predict: subtitle about 0.53 s after the first char (source about 0.8 s), button about 0.50 s after the subtitle (source about 0.36 s). The total is similar (about 1.56 s from first char to the button settling).
9. Grid lines are **hidden in the centre band** behind the hero text. They are not drawn under it.
10. Candles are fully static. Their edge candles fade horizontally, and the brightest candles sit at the centre.
