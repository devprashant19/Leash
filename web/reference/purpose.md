# primora.xyz /purpose: motion spec (video 78.0–109.5 s)

**Units and accuracy**
- Video px = pixels in the 1920×1020 recording. **CSS px = video px / 1.25** (display scale 1.25). Every size gives both values, written as `video / CSS`.
- Browser chrome is 150–152 px tall. The page viewport is x 0–1900 and y 152–1020 in the full frame, which is **1900×868 video px, or 1520×694 CSS**. The scrollbar is at x 1900–1920. Colours were sampled using full-frame Y coordinates.
- The video is nominally 120 fps but holds only about **31 unique frames/s** (pts step 33 ms, sometimes 42 or 50 ms). All timings are therefore **±33 ms**.
- Scroll positions come from vertical block-matching on a 60 fps grayscale strip (`frames_purpose/scroll.txt`, `track.js`). Accumulated drift is about 15 px over the whole segment. Scroll is unreliable over flat purple areas (CTA).
- Tags: **M** = MEASURED from the video, **S** = FROM-SOURCE (not contradicted unless noted), **E** = estimate or inference.

---

## 1. Energy bursts and what causes them

Energy is `tblend` difference YAVG on the 1900×868 viewport, scaled to 480 px wide, at 60 fps. Scroll is in video px, with the top of the page = 0.

| Time (s) | Peak energy | Cause | Scroll (video px) |
|---|---|---|---|
| 78.60 | 6.8 (1 frame) | Page swap: the /framework hero disappears in one frame | 0 |
| 78.83 | ~0.1 | Grid frame lines appear (single-frame step) | 0 |
| 79.20–80.6 | 0.1–0.2 | Statement line 1 char entrance | 0 |
| 80.10–81.5 | 0.1–0.2 | Statement line 2 char entrance | 0 |
| 82.15–84.35 | ≤4.0 | Wheel scroll down (3 flicks, each with a Lenis tail) | 0 → 996 |
| 84.4–85.9 | ≤4.4 | Scroll down; captions and "Software will not…" reveal | 996 → 1571 |
| 85.95–86.9 | ≤4.2 | Scroll back up | 1571 → 1000 |
| 87.0–90.4 | 0.05–0.3 | No scroll. Cursor hovers the illustrations (parallax response) | 1000 |
| 90.43–91.7 | ≤4.4 | Scroll down to "What we believe" | 1000 → 1990 |
| 91.75–95.25 | ≤7.5 | Fast scroll: denser, tower block, comparison table | 1990 → 5254 |
| 95.3–96.6 | ≤6.6 | Scroll up | 5254 → ~4525 |
| 96.9–98.6 | ≤5.9 | Scroll down (table) | → ~5150 |
| 98.9–101.9 | ≤8.3 | CTA rises; scroll reaches footer wordmark | 5150 → 7140 |
| 102.45–103.4 | ≤2.2 | Final scroll to the footer bottom | 7140 → 7399 (max) |
| 104.32–105.45 | 22.5 | User scrolls back to the top in **1.13 s** (non-monotonic velocity, so wheel flicks, not a scripted scrollTo) | 7399 → 0 |
| 105.5–109.5 | 0.0 | Idle at the top; cursor over the nav | 0 |

- **Page height:** about 7399 + 868 = **8270 video / 6615 CSS** (M).
- **Lenis decay (M):** the tail after a flick decays by about ×0.81–0.85 per 33 ms. For example, after 99.6 s the per-frame deltas run 21, 18, 14, 12, 9, 8, 6, 5, 5, 3, 3, 2. That is consistent with Lenis `lerp` ≈ 0.1 at 60 Hz, a time constant of about 180–200 ms (S: Lenis 1.2.3).

---

## 2. Per-element motion

| # | Element | Trigger | Properties from → to | Duration (ms) | Delay & stagger | Easing | Idle loop | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | Page enter | Nav click (route change) | Old page content → gone in **one frame** at 78.60. No fade, no slide (M) | 0 | — | — | — | The nav stays in place. "Purpose" is already active (white) at 78.25. There is a blank page for 230 ms |
| 2 | Grid frame lines (verticals at x 160/1740 video; horizontals) | Mount | Absent → present in **one frame** at 78.83 (M) | 0 | +230 ms after the swap | — | — | No draw-in or scale animation |
| 3 | Statement line 1 "Anyone can generate attention" | Mount (time-based, not scroll) | Per char: opacity 0→1, blur ~15→0 video (12 CSS, S), y +24 CSS → 0 (S) | Each char ≈ **900–1000** (M; S = 1000) | Starts at 79.20 (+600 ms after swap). Stagger **≈34 ms/char** over non-space chars (M; S says 40 ms) | Decelerating, matches power1.out (S) | — | Ends dimmed, with a **permanent per-char blur ramp** on the tail (see row 4). The whole line is done ≈80.95 |
| 4 | Line-1 tail ("generate attention") | Final state of row 3 | Blur rises with char index (M, peak-luma calibration): "Anyone can" 0 · "generate" ≈1–2 video (≈1 CSS) · "att" ≈4 (≈3 CSS) · "ent" ≈6.5 (≈5 CSS) · "ion" ≈9–10 (≈7–8 CSS) | static | — | — | **Static.** The ramp is unchanged after scrolling away and back (82–83, 105.5–109.5) | Colour is the same dim tier as the rest of line 1. The ramp is ≈linear from char ~9 to the last char. Implement as the per-char `to` blur, or a fixed per-char filter |
| 5 | Statement line 2 "Few can sustain adoption" | Mount, chained | Same as row 3, ending fully sharp and **#F0EDF1** | ≈950 per char (M) | Starts 80.10 (**+900 ms after line 1 start**, overlapping it). Stagger ≈34 ms/char (M) | power1.out-like | — | Fully settled ≈81.45–81.9. No focus shift with scroll: line 1 stays dim, line 2 stays bright |
| 6 | Grid "beam" band (5 horizontal lines, 33 video / 26 CSS pitch) between sections | Always running | Coloured segments slide horizontally along the lines | continuous | Lines 2 and 4 drift **left**; the middle line drifts **right** | linear | **≈31–33 video px/s ≈ 25–26 CSS px/s** (M, measured twice) | Segments are ≈288 video / 230 CSS long (lines 2 and 4) or long runs (middle line). Coral #BC7274 on a dark-red line, purple #642B8E. One run appeared over 2–3 frames when it came into view (fade in, E). Also visible blurred under the bottom overlay |
| 7 | "Industry problem" illustrations (compass, hourglass, arch) | Enter view | **No measurable entrance.** HF-sharpness and mean luma are flat from first visibility (M) | — | — | — | **Static when the cursor is away:** diff energy 0.01, no twinkle or drift of dots or sparkles (M, 87.3–88.9) | Possibly Rive or canvas, but no autoplay motion was seen |
| 8 | Illustration cursor parallax | Pointer over the card | Whole illustration translates **toward the cursor**: ≈5–7 video (arch), ≈10+ video (compass, hourglass), so ≈4–10 CSS on x; y ≤3 video | in ≈130–250 ms, out ≈300–1000 ms (M) | — | Lerp/ease-out (E) | — | The cursor turned into a "not-allowed" glyph over the hourglass. Sparkle dots move with the object |
| 9 | Captions under illustrations (title + 2-line body) | Scroll (≈83.7 s) | Blur and opacity → visible, like SplitText lines (S: 0.5 s, stagger 0.08) | ≈500 (E) | — | — | — | At rest the lower line looks blurred when it sits in the bottom ≈160 video of the viewport. That blur comes from the overlay (row 16), not the element |
| 10 | "Software will not become simpler." (dim) | Scroll in (84.85–85.35) | Char blur-in. Ends at the **dim tier rgb(114,107,117)** and **stays dim** | Visible ramp ≈450 ms during a slow scroll (M) | — | — | — | It is the dim half of the pair. It never brightens, even at the top of the viewport (91.5 s) |
| 11 | "It will become denser." (bright) | Scroll in | Char blur-in, then **dim → white**: peak luma 114 → 134 → 170 → 242 at 91.95 / 92.00 / 92.05 / 92.10 (M) | ≈150–200 ms colour step (M) | Begins when the heading is at ≈76% of viewport height | — | — | **Does not revert** on the fast scroll back up (104.97: still white). Treat it as once / time-based. Right-aligned in the second half of the 8-column grid |
| 12 | Square grid behind the "Software / denser" headings | — | Vertical lines every **94.4 video / 75.5 CSS**; coral and purple dots at some intersections; fades out left and bottom | — | — | — | Not seen moving | The grid did not render on frames during the 300+ px/frame scroll-to-top (104.97–105.0). It may be a lazily drawn canvas (E) |
| 13 | "Value will not…" (dim) / "It will be defined by efficiency of structure." (white) + tower point-cloud card | Scroll | Same dim/bright pair pattern as rows 10–11. The paragraph and the white "Talk to Aiden" button blur in | — | — | — | Tower idle **not measurable** (no static window) | The tower is a stack of noisy dot-slabs inside a gridded card with coral and purple intersection dots |
| 14 | "A different operating mindset" + column labels | Scroll (≈93.9–94.3) | Char blur-in. The CONVENTIONAL / ★ PRIMORA WAY labels fade in first (≈94.26) | — | — | — | — | — |
| 15 | Comparison rows (5 rows × 2 cells) | **Per-row scroll trigger** when a row's top reaches ≈ **viewport y 510–590 video (≈60–68%)** (M) | Opacity 0→1 + blur → 0. Both cells of a row reveal together | Each row ≈**800–1000** to fully sharp (M) | Row starts 94.43, 94.57, 94.70, 94.84, 95.04 (≈130–200 ms apart, set by scroll speed, not a fixed stagger) | Ease-out (E) | — | Once only. Rows did not re-hide on the scroll up (95.3–96.6) or the scroll down after it |
| 16 | Fixed bottom `.progressive-blur` | Always | Content blurs progressively toward the bottom edge. Blur starts ≈ **viewport y 708 video** (bottom **≈160 video / 128 CSS**). A 1 px line reaches σ≈2 px at ≈viewport y 750 and vanishes by ≈y 780 | — | — | — | — | (S + M). It also tints and dims a little: the band beams show only as soft glows there |
| 17 | CTA panel (#7F0FD5) | Scroll, scrubbed | **Radius 0 → 50 video / 40 CSS (= 2.5em, matches S)**. Measured R ≈10 / 20 / 30 / 37 / 50 video at panel-top viewport y = 636 / 398 / 238 / 184 / settled (≈linear from "top bottom" to "top top", E) | scrubbed | — | linear (scrub) | — | Panel top moves ≈1:1 with scroll (Δ482 vs Δ481 scroll, 99.0–99.6). A yPercent −10 parallax is not resolvable here. Background opacity is already 1 when the panel first appears (the opacity ramp must finish below the fold, or it is not visible) |
| 18 | CTA heading "Build beyond the / current cycle" (white) | Once, when the panel top passes ≈60% (panel top at vy≈522 at ≈99.42) (S `top 60%`, matches M) | SplitText chars: blur + fade + y | ≈1000/char | First chars 99.50; line 2 ≈99.95; done ≈100.9 | power1.out (S) | — | Paragraph "Markets move…" lines start ≈100.75, two lines at ≈80 ms stagger (S) |
| 19 | CTA side ornaments | — | Dot-matrix columns at the left and right panel edges (lighter purple #951FE7) | — | — | — | Not seen moving | — |
| 20 | Footer wordmark (outlined "Primora ✳ Primora…") | **Time-based marquee** | translateX continuously **leftward ≈31 video px/s ≈ 25 CSS px/s** (M: −1 px/frame at 30 fps, also while scroll is static 102.0–102.44) | infinite | — | linear | marquee | Scroll speed adds no measurable extra drift. Stroke ≈1 px #29262A (same as the grid lines), no fill |
| 21 | Footer card | Scroll | Nothing beyond the overlay blur on the tagline near the bottom | — | — | — | — | Rounded bordered card containing the logo, tagline, nav, Talk to Aiden, socials and the © line |
| 22 | Scroll to top | User | 7399 → 0 video in 1130 ms | 1130 | — | Lenis | — | The statement pair was not re-animated on return (it is a once-only mount animation) |

---

## 3. Layout at 1920 recording width (viewport 1900 video = 1520 CSS)

| Item | Video px | CSS px | Tag |
|---|---|---|---|
| Nav height (bottom rule at y 245–246, 2 px) | 95 | 76 | M |
| Content frame verticals | x = 160 and 1740 (frame width 1580) | 128 / 1392, so the frame is 1264 wide with 128 side margins | M |
| Grid line breaks at intersections | 32 gap (e.g. 144–175) | ≈26 | M |
| Statement rows | Row 1 y 246–578 (332 tall); row 2 578–≈910 | ≈266 per row, text vertically centred | M |
| Statement font | Cap height 53 | Cap ≈42, so serif **≈60 CSS** font (E: cap ≈0.7 em) | M/E |
| Statement line 2 width | 538–1365 (828), centred on 951 | 662 | M |
| "Software will not / become simpler." | Cap ≈52, line pitch ≈74 | ≈60 font, line-height ≈1.0 | M/E |
| Industry columns | Dividers at x 160 / 687 / 1214 / 1740, so columns are 527 | 421 each | M |
| Illustration footprint (compass) | ≈340 × 445 | ≈270 × 355 | M (approx) |
| Caption title / body | Cap ≈21 / body ≈14 CSS font | Title ≈24 CSS serif | E |
| Beam band | 5 lines, pitch 33 (y 375, 409, 442, 475, 508 when measured) | 26.4 pitch | M |
| Software/denser square grid pitch | 94.4 | 75.5 | M |
| Comparison table | Left cell x 214–935, right 966–1686; row pitch **140** (dividers at 273 / 413 / 553) | 171–748 / 773–1349; row pitch **112** | M |
| Comparison row text | Cap ≈19 | ≈22 CSS serif | E |
| CTA panel | Inset **16** each side (x 16–1884); radius 50 at rest | 12.8 inset (≈0.8 rem); **40 radius = 2.5em** | M |
| CTA heading | Cap ≈56 | ≈60 font, centred | M/E |
| Footer wordmark | Cap "P" ≈220 | Cap ≈176, so font **≈250 CSS** (≈16.5 vw) | M/E |
| Progressive blur zone | Bottom ≈160 | ≈128 | M |
| Page height | ≈8270 | ≈6615 | M |

---

## 4. Colours (rgb sampled from the h264 video; ±2–3 from chroma subsampling)

| Token | rgb | hex | Where |
|---|---|---|---|
| Background | 16,13,17 | #100D11 | Page |
| Grid / frame line | 41,38,42 (AA neighbours 28–30) | #29262A | All hairlines, nav rule, wordmark outline |
| Text bright | 240,237,241 | #F0EDF1 | Line 2, "denser", right table column, headings |
| Text dim tier | 101,94,104 to 114,107,117 | #655E68 to #726B75 (≈38–44% of the bright text over the bg) | Line 1, "Software…", "Value will not…", left table column |
| Body / caption text | ≈180,175,180 | ≈#B4AFB4 | Captions, 3-column body text |
| Mono label text | ≈100,93,103 | ≈#645D67 | "INDUSTRY PROBLEM", "WHAT WE BELIEVE" |
| Label square / CTA panel / brand purple | 127,15,213 | **#7F0FD5** | Label squares, CTA background |
| Coral (Primora way squares, grid dots) | 235,95,88 | **#EB5F58** | Table right-column squares; grid intersection dots ≈231,94,95 |
| Grey table square (conventional) | 58,55,61 | **#3A373D** | Table left-column squares |
| Point-cloud dots (objects) | ≈51–54, 44–49, 52–54 (p99) | ≈#33 2E 35 | Compass, hourglass, arch, tower |
| Sparkle dots | Coral ≈205,77,75; purple ≈123,20,197 | #CD4D4B / #7B14C5 | Scattered 2–3 px dots around the illustrations |
| Beam coral / purple | 188,113,116 / 100,43,142 | #BC7174 / #642B8E | Band beams |
| CTA ornament dots | ≈149,31,231 | #951FE7 | CTA edge columns |

---

## 5. Surprises and corrections

1. **The page enter has no transition.** It is a hard cut at 78.60, then a blank frame with grid lines at +230 ms, then the heading at +600 ms. The only "transition" is the SplitText entrance.
2. **The blurred tail is a graded per-char blur ramp, not one blurred word.** It goes from 0 at "can" to ≈8 CSS at the last char. The whole line 1 sits at the dim tier. It is static: no scroll link, no timed loop, and it does not refocus.
3. **There is a dim/bright pair pattern three times:** Anyone/Few, Software/denser, Value/defined. In the second pair the bright line visibly shifts from dim to white in ≈150–200 ms after its chars blur in, and it does not revert.
4. **Char stagger measured ≈34 ms per char**, against 40 ms in source. Per-char duration ≈0.95 s matches the 1 s in source.
5. **The point clouds do not idle-animate.** They only parallax toward the cursor, by up to ≈10 CSS. Sparkles do not twinkle.
6. **The "glitch" coloured lines are a 5-line beam band** with segments drifting at ≈26 CSS px/s, running in opposite directions on alternate lines. It recurs between sections and above the footer.
7. **The footer wordmark is a time-based marquee** (≈25 CSS px/s leftward), not scroll-scrubbed.
8. **Comparison rows are triggered per row by scroll** at ≈60–68% of the viewport. This is not a fixed stagger.
9. **The CTA background is fully opaque on arrival.** The radius scrub matches 2.5em (40 CSS). The −10 yPercent parallax was not resolvable.
10. **Brief corrections:** the chrome is 150–152 px, not 60. The recording's effective frame rate is ≈31 fps.

**Artifacts:** `C:\Users\u\AppData\Local\Temp\claude\3f863b6319ae8e36\06d6a718-a1e3-48a7-8635-9434c5b21bc6\scratchpad\ref\frames_purpose\` holds the contact sheets `sheet_01–08.png` and close-ups `st1.png` / `st2.png` (statement), `hover_compass.png`, `diff_*.png`, `dense.png`, `cloud.png`, `table.png`, `cta.png` and `upgrid.png`. It also holds the data files `scroll.txt` (scroll per frame), `energy2.txt`, `cta_edge.txt` and `wm.js` (marquee tracker).
