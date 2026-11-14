# events-contact segment (video 139.5–175.5 s)

## Conventions and corrections

- **Browser chrome is 150 video px tall, not 60.** The page viewport is video y 150–1020 and x 0–~1900, with the scrollbar at x ≥ 1900. Viewport y = video y − 150. Colour samples use full-frame video coordinates.
- **Units:** "vpx" means video px. "css" means CSS px, which is vpx / 1.25 (display scale 1.25). The viewport is ~1520 × 696 css.
- **Timing resolution:** the file says 120 fps, but the content changes only about every 33.3 ms (VFR ~30 fps; consecutive 120 fps frames repeat). All timings are **±33 ms**. "Start" times are extrapolated from the first visible frame and its progress.
- **Tags:** MEASURED means taken from frames or pixels. FROM-SOURCE means it comes from the brief and was not re-derived. INFERRED means a reading of measurements that the video cannot confirm directly.

## 1. Energy bursts (YAVG of frame difference, 0.25 s bins)

| Video t (s) | Peak YAVG | What it is | Scroll or animation |
|---|---|---|---|
| 140.00 | 9.6 (1 frame) | Route change Insights → /events. Instant cut to a near-blank page with a violet ▷ glyph | Cut, no page transition |
| 140.50–142.25 | 2–7 | Hero image pixel-resolve (140.67–142.27), eyebrow fade, heading SplitText blur-in | Animation (page static) |
| 142.5–143.75 | ~0.1 | Idle | – |
| 144.00–145.25 | 8–16 | Wheel scroll: hero out, media in | Scroll |
| 145.50–147.25 | 15–25 | Scroll: media → "Recent events" cards. Middle card image still pixelated | Scroll |
| 147.75–151.25 | 1–4 | Slower scroll: stat counters roll (147.85–148.7), globe section enters | Scroll + counters |
| 151.50–153.50 | 0.05–0.09 | Idle. Only the globe drifts | Idle loop |
| 153.75–155.25 | 4–9 | Scroll through the purple CTA (radius scrub, text blur-in) and the footer | Scroll |
| 156.13–156.56 | 14–40 | Smooth scroll back to the top of /events in ~430 ms (INFERRED: Lenis scrollTo after clicking the footer "Events" link) | Programmatic scroll |
| 158.567 | 10.8 (1 frame) | Instant cut to /contact | Cut |
| 161.0–165.75 | 1–3.5 | Scroll through the contact grid panel, "Use Aiden for…" and the footer | Scroll |
| 166.5–167.0 | 3.7 | Scroll back up | Scroll |
| 168.93–169.60 | ≤1.0 | **Chat modal open** | Animation |
| 171.10–171.45 | ≤1.5 | "Start new chat" → chat view | Animation |
| 174.167 | 2.8 (1 frame) | "Thinking…" pill removed and modal re-centred, instantly | Cut |

## 2. Per-element motion

| Element | Trigger | Properties from → to | Duration ms | Delay / stagger | Easing | Idle loop | Notes |
|---|---|---|---|---|---|---|---|
| Route change (any page → /events, /contact) | Nav click | None. Hard cut | 0 | – | – | – | MEASURED: single-frame change at 140.00 and 158.567 |
| Image load placeholder | Image not yet loaded | Violet outline ▷ (~20 vpx, #7F0FD5-ish) centred where the image will be | Shown ~500 ms (140.17–140.63) | – | – | – | MEASURED. The same ▷ glyph stays as a faint violet overlay at the centre of the event-card photos |
| Image pixel-resolve (hero, card photos) | Image loaded/in view | Pixelation in discrete steps. Block size in vpx: ~64 → 40 → 29 → 20 → 15 → 11 → 8 → 5 → 4 → sharp (css ≈ 51 → 32 → 23 → 16 → 12 → 9 → 6 → 4 → 3 → 0) | ~1600 total (140.67 → 142.27) | Steps at +0, 167, 333, 467, 767, 967, 1133, 1267, 1433, 1600 ms (≈150–170 ms per step, one ~300 ms hold) | Stepped, roughly geometric (×0.72 per step) | – | MEASURED. The middle card ("2025 Korea Blockchain Meetup") was still coarsely pixelated 1.5 s later and drawn in a **square** box (408×410 vpx) while the others were 16:9. The reveal is per image and gated on load, not on scroll |
| Hero eyebrow (violet square + mono caps) | Page enter | Opacity 0 → 1 | ~300 | Starts ~140.56 | – | – | MEASURED, approximate |
| Hero heading "Building the future…" | Page enter | SplitText chars y:24, autoAlpha 0, blur 12 → visible | 1000 | Stagger 0.04 s. Starts ~140.97 (after eyebrow) | power1.out | – | FROM-SOURCE. Consistent with frames: char blur-in running 140.97–142.4 |
| Hero left vertical rule (1 px white) | Page enter | Appears ~140.3 | – | – | – | – | MEASURED |
| Full-width media ("Recent events" lead photo) | Scroll | **No width change observed.** Constant x 176–1724 vpx (1548 vpx = 1238 css = 81.5 % of viewport) from entry to exit. **No inner parallax**: the image moves 1:1 with its frame | – | – | – | – | MEASURED (edge tracking every frame 144.1–146.7, plus template tracking). An apparent +10 vpx extra width while the media sits at the viewport bottom comes from the fixed progressive-blur overlay, not from scaling. The 80 → 100 % widen in the brief is **not present in this capture** |
| Media violet edge treatment | Static | Inner violet glow: top edge #8924CA fading into the photo over ~60–90 vpx, left/right edges #4E0A83 → photo over ~80 vpx. Strongest at the top | – | – | – | – | MEASURED. The "feathered bottom" seen while scrolling is the fixed `.progressive-blur` overlay |
| Fixed bottom progressive blur | Always | Blurs content in the bottom ~120–170 vpx (~100–135 css) of the viewport. Blur grows toward the bottom edge | – | – | – | – | MEASURED (edge profiles crisp at viewport y 650, soft at 750, very soft at 850) + FROM-SOURCE |
| Stat counters "10,000+ connections", "4000+ event participants", "30+ countries", "4+ years of events" | Scroll into view, near the viewport bottom (inside the blur zone, ~90 % down) | **Odometer**: each digit column rolls vertically through 0–9 (several digits visibly mid-roll at once). Final value settles last | ~600 (row 1: 147.85 → 148.45). Row 2: rolling visible 148.5 → 148.70 | Row 2 triggers ~650 ms after row 1 because it enters later on scroll. Columns roll together, no visible per-digit stagger | Fast start, soft settle (ease-out) | – | MEASURED. "+" and the label sit inline after the number |
| Icon boxes (line drawings in square frames with corner dots) | – | No animation seen at 15 fps | – | – | – | Static | MEASURED, low confidence (small and faint) |
| Section headings ("Recent events…", "Making the whole world our network", "Build beyond the current cycle") | Scroll | Same SplitText char blur-in | 1000 | Stagger 0.04 s | power1.out | – | FROM-SOURCE, visually consistent |
| Card text (title, desc, mono tags) | Scroll | Lines fade/blur up | 500 | Stagger 0.08 s | – | – | FROM-SOURCE, consistent |
| Dotted globe | Always | Dot field drifts **leftward ~12.5 vpx/s (~10 css/s)** on the lit face. Same speed at centre and right limb, ±1 px/s | Continuous | – | Linear | Yes. ≈2°/s if it is an R = 385 vpx sphere, so ~3 min per revolution | MEASURED (sub-pixel correlation, 151.6–153.5). Very slow and calm. No reaction to scroll or cursor detected (cursor mostly still) |
| Globe square markers (4 grey squares) | – | **Do not move** with the dots (0 px over 2 s) | – | – | – | Static | MEASURED. Fixed overlay, not projected onto the sphere |
| Event card (ETH Denver) with violet pin + connector | Scroll | Moves with the page. No independent animation seen | – | – | – | – | MEASURED |
| Purple CTA panel radius | Scroll scrub | border-radius ≈ 20 css (25 vpx) when the panel top is at ~83 % of the viewport → **40 css (50 vpx = 2.5em)** when the panel top reaches ~15 % | Scrubbed over ~600 vpx of scroll | – | Scrub. Fastest early: half of the change happens in the first ~200 vpx | – | MEASURED. Matches FROM-SOURCE 0 → 2.5em; the 0 part is hidden under the bottom blur. Side inset 16 vpx (13 css) |
| CTA heading / paragraph / button | Panel top at ~60 % of viewport | Heading chars blur-in from ~154.0. Paragraph lines ~154.27. Button "Talk to Aiden" fades in ~154.33 | 1000 / 500 / ~200 | As listed | power1.out | – | FROM-SOURCE ('top 60%') + MEASURED times |
| Smooth scroll to top | Click on the same-page link | Page scrolls ~5 screens in ~430 ms | ~430 | – | Ease-in-out (slow ends, fast middle) | – | MEASURED. Lenis (FROM-SOURCE) |
| Contact grid panel (centred "Talk to Aiden") | – | No twinkle or animation detected (frame-diff energy ≤ 0.03, cursor only) | – | – | – | Static | MEASURED |
| **"Use Aiden for…" active-column rule** | Section in view | 1–2 px line above the active column title **grows linearly in width** from x = 102 vpx: 48 → 280 vpx between 161.8 and 164.0 s | **Linear ~105 vpx/s (~84 css/s)**. Starts ~161.34 | – | Linear | INFERRED: auto-advance timer. Column pitch 583 vpx (466 css), so a full sweep takes ~5 s before the next column would activate. The switch was not observed (scrolled away at 164.1) | MEASURED growth. The rule track is barely visible (#221F25 vs bg #100D11). Active title is white, inactive titles/body are grey |
| Decorative coloured horizontal lines (section seams) | Always | Translate X **~+25 vpx/s (~20 css/s)** to the right, even while the page is not scrolling | Continuous | – | Linear | Yes | MEASURED (163.4–163.7 static page, line x 126 → 134). Segments ~288 vpx long (230 css); red/violet/white variants |
| **Chat modal open** | Click nav "Talk to Aiden" (t0 ≈ 168.92) | Sequence below | ~750 total | See below | Ease-out | – | MEASURED |
| ↳ Backdrop | t0 | Page behind: backdrop-filter blur 0 → **≈5 css (σ ≈ 6 vpx)**. Region means are unchanged within 1 level, so dimming is ≤ ~10 % (overlay roughly bg-coloured at low alpha). The nav red dot dims #AA2D2A → #6F2827 | ~180 | 0 | ease-out | – | MEASURED |
| ↳ Close button (□ ✕ above the header's right end) | t0 | Opacity 0 → 1 (no movement) | ~250 | +0 | ease-out (40 % at first frame) | – | MEASURED |
| ↳ "Start new chat" button | t0 | translateY **+25 css (31 vpx) → 0** + opacity 0 → 1. Bottom edge stays fixed at 859 vpx: **the button is clipped by the panel bottom (overflow hidden)** and slides up out of it | ~400 | **+90** | power2.out (offset 31, 24, 18, 13, 10, 7, 5, 3, 2, 1, 0 per 33 ms) | – | MEASURED |
| ↳ Violet header bar | | Opacity 0 → 1 only (edges fixed 375–444 vpx) | ~320 | **+200** | ease-out | – | MEASURED |
| ↳ Icon circle (violet, white asterisk) | | Opacity 0 → 1 + translateY **−9 css (−11 vpx) → 0** (comes down) | ~400 | **+230** | ease-out | – | MEASURED |
| ↳ Title "Talk to Aiden" | | Opacity + translateY −9 css → 0 | ~400 | **+370** | ease-out (7, 25, 42, 57, 69, 77, 84, 89 %…) | – | MEASURED |
| ↳ Subtitle "How can I help you today?" | | Opacity + translateY −7 css → 0 | ~350 | **+480** | ease-out | – | MEASURED |
| "Start new chat" → chat view | Click (≈171.09) | Button opacity 1 → 0 + translateY 0 → +~20 css (slides down into the clip) | ~150 | 0 | ease-in | – | MEASURED |
| ↳ Re-layout | +180 ms | Whole panel jumps **up 9 css (11 vpx)** to re-centre for the taller content | 0 (instant) | +180 | – | – | MEASURED |
| ↳ "Thinking…" pill | +210 ms | Opacity 0 → 1 (grey → #F2F2F2 bg) + translateY ~+6 css → 0 (rises) | ~100 | +210 | ease-out | Spinner: 8-spoke iOS-style, rotating clockwise. Measured ~0.45 s per turn (low confidence; recording stutters) | MEASURED |
| ↳ Message input + send button | +210 ms | Opacity 0 → 1 (+ ≤3 vpx settle) | ~100 | +210 (with the pill) | ease-out | – | MEASURED |
| Pill removal (no reply arrived) | 174.167 | Pill removed and panel re-centred down, both instant | 0 | – | – | – | MEASURED |

Modal build order: close ✕ → CTA button (slides up from the clip) → header bar → icon → title → subtitle. Rows start ~100 ms apart; each fades over 300–400 ms with ease-out. The header fades in place, the content block comes down ~9 css px, and the button comes up 25 css px. Nothing scales.

## 3. Layout (1920 × 1020 video; viewport = video y − 150)

| Item | vpx | css (/1.25) | Source |
|---|---|---|---|
| Viewport | 1900 × 870 | 1520 × 696 | MEASURED |
| Media frame | x 176–1724 (w 1548), h ≈ 790, radius ≈ 24 | x 141, w 1238 (81.5 %), h ≈ 632, r ≈ 19–20 | MEASURED (h ±15) |
| Media top glow depth | 60–90 | 50–70 | MEASURED |
| Event cards | Image 408 × 230 (16:9). Columns at x 230 / 746 / 1262 (pitch 516). Vertical dividers between cards | 326 × 184, pitch 413 | MEASURED |
| Stat icon box | ~264 square, radius ~8, corner dots inset ~10 | ~211 square | MEASURED approx. |
| Hero photo | ~543 × 372 at x 1056 | ~434 × 298 | MEASURED approx. |
| Globe | Diameter ≈ 770, centre at viewport (950, 395). Dots ~3–4 vpx on ~20 vpx spacing, densest and brightest on the right (lit) half, fading to near-invisible on the left limb | d ≈ 616, centre (760, 316) | MEASURED |
| Globe markers | ~43 square, radius ~4 | ~34 | MEASURED |
| Event pin | 42 square, at the end of a 1 px underline 300 vpx long (x 359 → 658) | 34 square, line 240 | MEASURED |
| CTA panel | Inset 16 each side (x 16–1884, w 1868). Final radius 50 | Inset 13, w 1494, r 40 (2.5em) | MEASURED |
| Contact "Use Aiden for" | 3 columns starting x ≈ 102 / 685 / 1268 (pitch 583). Active rule at x 102 above the title | Pitch 466 | MEASURED |
| **Modal** close button | 48 × 42 at x 1415–1462, y 311–353. 1 px border #3A373D, radius ~2 | 38 × 34 | MEASURED |
| Modal header bar | x 439–1463 (w 1024), y 375–444 (h 70). Asterisk icon at x 484, title at x 519 (bold ~20 vpx), reset ↻ icon at x 1424 | w ≈ 820, h 56, padding-left ≈ 36 | MEASURED |
| Modal icon circle | Diameter 90, centre (951, 549). 61 vpx below the header | d 72, gap 49 | MEASURED |
| Modal title / subtitle | Bold ~28 vpx centred at y 635. Regular ~18 vpx grey at y 672 | ~22 / ~14–15 css | MEASURED |
| "Start new chat" | x 439–1463, y 778–859 (1024 × 82), radius ~16, bold white ~19 vpx | 820 × 66, r ~13 | MEASURED |
| Modal panel | Same width as the header (1024 vpx). Background = page bg (no visible card fill) | 820 | MEASURED |
| "Thinking…" pill | 154 × 51 at x 464, radius ~10. Spinner ~22 vpx + text ~18 vpx | 123 × 41, r 8 | MEASURED |
| Message input | x 464–1438 (974 × 60), fully rounded, 1 px border. Placeholder "Message..." at x 490. Send button d 40 at (1408, 855) | 779 × 48, send d 32. Inset 20 from the panel edge | MEASURED |

## 4. Colours (video pixels, full-frame coordinates)

| Item | Hex | Notes |
|---|---|---|
| Page background | #100D11 | MEASURED (unchanged under the modal) |
| Brand violet (modal header, start button, icon circle, send button, globe pin, eyebrow square, CTA panel) | **#7F0FD5** | MEASURED, identical everywhere |
| Modal backdrop result | Background stays #100D11. Bright content dims ~10–35 % and is blurred | MEASURED |
| Close-button border | #3A373D. ✕ glyph #ECE9ED | MEASURED |
| Pill background | #F2F2F2. Text/spinner dark grey (~#4B4B4B) | MEASURED |
| Input fill | #151218 (vs bg #100D11). Border luma ~40 (≈ #2A272D) | MEASURED |
| Globe dots, warm | #EE8A56 (peak), dimming to ~#B56B45 | MEASURED |
| Globe dots, cool | #B185FA (lavender) | MEASURED |
| Globe markers | #3A373D | MEASURED |
| Event pin connector line | ~#642B8E (1 px violet at reduced alpha) | MEASURED |
| Media inner glow | Top #8924CA → transparent. Sides #4E0A83 → transparent | MEASURED |
| Nav "Talk to Aiden" icon | Red dotted square, dots ~#E5615E (#AA2D2A average) | MEASURED |
| Active contact column title / rule | ≈ #EEEBEF (white) | MEASURED (subpixel AA makes text samples approximate) |
| Inactive titles / captions | ~#4F6187 subpixel peak, i.e. mid grey | MEASURED approx. |
| Rule track | #221F25 | MEASURED |

## 5. Surprises / deviations from the brief

1. **Chrome is 150 vpx**, and the real frame rate is ~30 fps despite the 120 fps container (alternate frames are duplicates).
2. **No media widen.** In this capture the full-width media stays at 1548 vpx (81.5 %) through its whole scroll range and has no inner parallax. The violet "feather" is a static inner glow plus the global bottom progressive-blur.
3. **Images resolve by pixelation** in ~10 discrete steps over ~1.6 s once loaded. Before that, a violet ▷ glyph sits at the image centre. An image that loads late stays pixelated (and square) even while on screen.
4. **Counters are odometers** (vertical digit rolls, ~600 ms), not text count-ups.
5. **Globe markers are static overlays.** Only the dots drift, very slowly (~10 css px/s). Dots use two colours (orange #EE8A56 and lavender #B185FA), lit on the right.
6. **The contact "Use Aiden for" rule is a linear progress timer** (~84 css px/s, ~5 s per column INFERRED), not a static active marker.
7. **Section-seam decorative lines drift horizontally** (~20 css px/s) as an idle loop.
8. **Modal:** there is no panel card. The violet header and the CTA button float on the blurred page. The CTA button slides **up out of a clip** while the content slides **down**. The dim is very light; the blur (~5 css px) does most of the work. Chat-view changes re-centre the panel with **instant** jumps (±9 css px), not animated ones.
9. Route changes are hard cuts. Same-page navigation uses a ~430 ms smooth scroll.

Working files: `C:\Users\u\AppData\Local\Temp\claude\3f863b6319ae8e36\06d6a718-a1e3-48a7-8635-9434c5b21bc6\scratchpad\ref\frames_events\` (modal_full.png, chat_bottom.png, globe_vp.png, media_left.png, layout4.png, contact sheets).
