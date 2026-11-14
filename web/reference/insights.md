# primora.xyz /insights motion spec (video 109.5 s to 139.5 s)

Source: `reference.mp4` (1920x1020, 120 fps container). **Effective content frame rate is about 30 fps**: at 60 fps sampling, every other difference frame is 0, so all timings are ±33 ms.

**Correction to the brief: browser chrome is 150 px, not 60.** Page content starts at y = 151 (full-frame), and the viewport is about 1900x869 video px (scrollbar at x 1900 to 1920). The Chrome UI is drawn at about 125 %, so **DPR ≈ 1.25**. The CSS viewport is about 1520x695 CSS px. Every measurement below is in **video px**, with **CSS px = video ÷ 1.25** given where it matters.

Tags: **MEASURED** means taken from the video in this pass. **FROM-SOURCE** means given in the brief and only checked here for consistency.

---

## 1. Energy bursts (motion energy, YAVG of frame difference, 0.25 s bins, crop 1880x900 scaled to 480)

| t (s) | peak | what it is (checked against frames) |
|---|---|---|
| 109.50–109.95 | 0 | Idle on the previous page (/purpose, "Few can sustain adoption") |
| **110.150** | 5.3 (single frame) | **Hard page load (cut).** There is no route transition, fade or wipe. The browser shows its loading spinner, then the new page paints in one frame. |
| 110.233 | 5.6 (single frame) | Featured image first paints, already at pixelation stage 1 |
| 110.25–111.80 | 0.05–0.8 | No scroll. Pixelation steps show as spikes of 0.6–0.8 at 110.417, 110.633, 110.833, 110.967, 111.133, 111.267, 111.433, 111.600 and 111.767. The "Insights" title blur-in (0.03–0.09) runs underneath them. |
| 112.0–113.0 | 3.2 | Scroll: featured block to meta pills and author row |
| 113.75–114.75 | 3.7 | Scroll to "LATEST INSIGHTS / The thinking behind the work" |
| 115.25–116.25 | 3.5 | Scroll. Card row 1 enters and pixelates (about 115.5–117.0). |
| 116.75–117.5 | 5.4 | Scroll from card row 1 to row 2. Row 2 pixelates (about 117.5–119.0). |
| 118.0–119.75 | 5.6 | Scroll through row 2 to "Load more" |
| 120.25–121.25 | 3.7 | Scroll to "DIVE IN DEEPER / Podcasts, interviews and media" and the featured media item |
| 121.75–125.0 | 2–4.9 | Continuous scroll: FILTER BY tabs, then 3 media rows, then "Load more" |
| 125.25–126.5 | 2.4 | Newsletter "Stay up to date…" with the envelope |
| 126.75–128.5 | 1.3 | Purple CTA scrolls in (radius scrub). The heading splits and blurs in from about 126.9. |
| 128.5–129.25 | 1.0 | Scroll to the giant footer wordmark |
| 129.25–134.0 | 0.03 | Scroll idle. **The wordmark marquee and its line segments keep moving** (time-based). |
| 134.25–134.75 | 0.8 | Scroll to the bottom footer (logo, nav, socials, © row) |
| **135.70–136.43** | 40 | **Jump to top in 730 ms** (Home key or programmatic Lenis scrollTo). Images are already revealed and do not re-pixelate. |
| 136.5–139.5 | 0 | Idle at top |

---

## 2. Per-element motion

| element | trigger | properties from → to | duration | delay & stagger | easing | idle loop | notes |
|---|---|---|---|---|---|---|---|
| Route change /purpose → /insights | nav click | hard cut, no transition (MEASURED) | 1 frame | n/a | n/a | n/a | Full document load. The old page shows until 110.150 and the new one paints whole. |
| "Insights" page title (serif, centred) | page load | per char: y 24→0, autoAlpha 0→1, blur 12→0 px (FROM-SOURCE). Chars appear left to right (MEASURED). | first char starts 110.517, last char done ≈111.65 → **≈1.13–1.28 s total** (MEASURED) | **starts ≈370 ms after first paint** (110.15 → 110.52). Stagger 0.04 s/char (FROM-SOURCE; fits the 8-char total). | power1.out (FROM-SOURCE) | none | Paints after the featured image has already started pixelating. |
| Featured heading "Notion Growth Breakdown…", label, button | page load | **not animated**: fully visible on the first painted frame (MEASURED) | n/a | n/a | n/a | n/a | Only the page H1 animates on enter. |
| Featured paragraph | n/a | looks blurred on load only because it sits under the fixed bottom progressive blur. It sharpens as it scrolls up. | n/a | n/a | n/a | n/a | Do not mistake this for a text animation. |
| **Featured dithered image: pixelate reveal** | first paint / in view | mosaic block size 44.5 → 33.5 → 24.5 → 18.3 → 13.5 → 10 → 7.3 → 5.3 → 3.7 → final dither (video px, MEASURED). That is **9 pixelated stages + final**. | stage onsets 110.233, .417, .633, .833, .967, 111.133, .267, .433, .600, final 111.767 → **1.53 s total, ≈170 ms per stage** (range 133–217) | starts ≈83 ms after page paint | **stepped / discrete** (no cross-fade between stages). Roughly linear in time with about ×0.74 block size per step. | none once final | **Time-based, not scroll-linked**: it ran entirely with the scroll at rest. Blocks are anchored at the image's top-left. Each block is a **flat average colour** (stage blocks show mid-tones such as #9E27B1), so this is a mosaic of the dithered bitmap, not a re-dither. In blocks across the image width: ≈12, 16, 22, 30, 40, 54, 74, 102, 147, then full. |
| Card thumbnails (Latest insights grid, 3 per row) | enter viewport (row partly under the bottom blur when it starts) | same mosaic sequence. Card blocks measured 32 → 24 → 18 → 14 → 8 → 6 → 4 → final (MEASURED; image 386 px wide, so about 12 columns at stage 1, the same per-width sequence as the featured image). | ≈1.5 s (row 1 about 115.5 → 117.0; row 2 about 117.5 → 119.0) | **No stagger between the 3 cards**: all three show the same stage in every sampled frame (MEASURED). Rows trigger separately as they enter. | stepped | none | Kept refining while the scroll was nearly stopped (116.0–116.65), so it is **time-based once triggered**. It plays once: on the scroll back up at 136.5 the images were already final. |
| Media thumbnails (featured media portrait, row squares) | enter viewport | same mosaic stepping (coarse blocks visible at 120.3, fine by about 121.3) | ≈1.5 s (MEASURED approx.) | per item | stepped | none | Same component as the card thumbnails |
| Card text (meta pills, serif title, excerpt, author) | n/a | no own entrance seen. The blur at the bottom edge comes from the progressive blur overlay. | n/a | n/a | n/a | n/a | Not conclusive for a short fade. No y offset visible at 10 fps. |
| "Load more" button | hover | **no visible hover change**, though the cursor turned to a pointer over it (≈120.1–120.2, MEASURED) | n/a | n/a | n/a | n/a | No char stagger or fill change was captured. |
| Filter tabs All / Podcasts / Interviews | n/a | **not clicked in this segment** (MEASURED). "All" is white and the others are grey. | n/a | n/a | n/a | n/a | The tab switch animation is not observable here. |
| Envelope illustration | n/a | **static** dithered violet image (a pre-rendered 3D-tilted envelope). Violet pixel count in its box was constant (±0.5 %) from 126.1 to 126.7 (MEASURED). | n/a | n/a | n/a | none detected | It only scrolls. |
| CTA purple panel | scroll | border-radius 0 → 2.5em, scrubbed (FROM-SOURCE). Top corners are small at 126.4 and bottom corners large at 127.6 (consistent). | scrub | n/a | scrub | n/a | Full-bleed with a ≈16 px gutter. Coral/violet dither strips run down the inner left and right edges (x ≈ 16–160 and 1740–1885). |
| CTA heading "Build beyond the current cycle" | 'top 60%' once (FROM-SOURCE) | SplitText chars blur/y/alpha in. "Build beyond the" is legible by ≈127.5 and the second line is still blurred. | ≈1 s per char plus stagger (FROM-SOURCE) | from ≈126.9 | power1.out | n/a | It was played while the page was still scrolling. |
| Giant footer wordmark "Primora ✱ Primora" | always | **horizontal marquee moving left at ≈30 video px/s (≈24 CSS px/s)** (MEASURED: 15 half-scale px/s from 131 to 133 s with no scroll) | continuous | n/a | linear | **yes** | Outline-stroke text, very faint (#1C191E-ish stroke on #100D11). |
| Line segments on the wordmark band's rules | always | coloured segments (coral #BC7272 antialiased, violet, grey) travel left **at the same 30 px/s as the marquee** (MEASURED) | continuous | n/a | linear | yes | They look like part of the marquee track. No colour flicker: a 60 fps pixel probe stayed constant. |
| Scroll to top | key or programmatic | scrollY from footer → 0 | **730 ms** (135.70–136.43) | n/a | Lenis (FROM-SOURCE) | n/a | Fast. No re-trigger of the reveals. |
| Smooth scroll | wheel | Lenis 1.2.3 (FROM-SOURCE). Slow drift tails of about 0.5 px/frame were seen. | n/a | n/a | n/a | n/a | n/a |
| Progressive blur overlay | fixed | blurs the bottom ≈140 video px (≈110 CSS px) of the viewport, rising to a strong blur at the edge (MEASURED approx.) | n/a | n/a | n/a | n/a | It rounds and feathers the bottom corners of any image passing under it. **Images have no mask of their own**: they are crisp rectangles when above the zone. |

---

## 3. Layout (video px at the 1920-wide capture; CSS ≈ ÷1.25)

| item | measurement (MEASURED) |
|---|---|
| Content frame | vertical rules at x = 160 and 1740 → 1580 wide (≈1264 CSS). Horizontal rules separate sections. Outer short rule stubs run at 7–145 and 1757–1895. |
| Nav | 95 px tall. Links Framework/Purpose/Insights/Events/Contact from x = 182, ≈18 px sans. Logo centred. "Talk to Aiden" button 1525–1718 with a dot-canvas square at its right. |
| Featured insight split | text column x 246–≈905. Image frame 1015–1654 (639 wide). |
| Featured label | violet square 14x14 at x 246, then mono caps "FEATURED INSIGHT", letter-spaced, #635D64 |
| Featured accent bar | 3 px white bar at x 158–161 spanning the title height (y 423–597 at 113.3) |
| Featured title | serif, 3 lines, line pitch 58 px (≈46 CSS); font ≈52 px (≈42 CSS) |
| Featured paragraph | sans ≈22 px, line pitch 32 px (≈17.6 / 25.6 CSS), colour ≈#B5AEB8 |
| "Read insight" button | 165x70 (≈132x56 CSS), 1 px #29262C border, radius ≈6, white text |
| Featured image frame | grid of lines at a **93 px pitch** (1055, 1148, 1241 …). Dots at intersections alternate violet and coral. Image 1063–1606 x 421–775 = **543x354 (aspect 1.53)**. Meta pills ("STRATEGY", "JUNE 17, 2026") sit inside the frame below the image (y ≈ 905–940). |
| Card grid | 3 columns. Dividers at x = 692 and 1207 (columns ≈532 / 515 / 533). Card content inset ≈70 from the column's left rule. |
| Card thumbnail | outer frame 408x231 (230–637), 1 px #29262C, radius ≈8, inner padding ≈12. **Image 386x207 → aspect 1.865 (≈15:8)**. |
| Card meta row | 2 bordered pills, ≈40 tall, left (category) and right-aligned (date), mono caps letter-spaced, text #635D64, border #29262C, **no fill**. Pills sit ≈45 below the thumbnail. |
| Card title | serif, ≈34 px, line pitch 38–39 px, #EEEBEF, ≈70 below the pills |
| Card excerpt | sans ≈19 px, line pitch 28 px, ≈#B5AEB8 |
| Author row | avatar **54x54** violet-dithered photo (no radius), then mono bold caps name #EEEBEF. ≈70 below the excerpt. |
| Featured media | title left with the accent bar. Portrait image **353x540 (aspect ≈0.65, 2:3)** in the same 639 px grid frame on the right. "FEATURED" / "PODCASTS" pills are stacked in the frame's right column. **Watch button is filled white with black text.** |
| Filter tabs | "FILTER BY" mono label above "All · Podcasts · Interviews", centred near the content's right third |
| Media rows | image left: frame 462 wide (x 261–723), **square image 348x348**. Text column from x ≈830: tag (coral square + "INTERVIEW", violet square for "PODCAST"), serif title ≈52 px, excerpt, **outlined "Watch"** (1 px #29262C). All rows observed had the image on the left, so they do **not** alternate (the featured media item is the only image-right block). |
| Newsletter | rounded panel 16–1885 (radius ≈24, 1 px border). Serif heading ≈56 px. "Email address:" label. Serif placeholder "hello@gmail.com" ≈#464349 on an underline. Outlined "Subscribe" 147x72. Envelope in a 93 px grid frame on the right (≈1147–1798). |
| CTA panel | x 16–1885, colour #7F0FD5, heading serif centred, white "Talk to Aiden" button |
| Footer | wordmark marquee band, then a bordered footer card: logo, tagline, nav, socials, "Talk to Aiden", © row |

---

## 4. Colours (MEASURED, rgb24 from decoded h264, ±2)

| token | value | where sampled |
|---|---|---|
| Page bg | **#100D11** | many points |
| Rule / pill border / divider | **#29262C** (#28252A) | card pills, column dividers |
| Dither violet | **#7F0FD5** (dither cells cluster at #780AD0–#800FD5) | flat area of the featured image. The same value is used by the CTA panel bg and the label squares. |
| Dither coral | **#E66157** (cells #E85856–#E8605A) | stage-1 solid block. Grid-frame coral dot ≈#DD655E. |
| Stage mid-tone example | #9E27B1 | averaged block (mosaic stage) |
| Primary text | **#EEEBEF** | titles, author names, accent bar |
| Body / excerpt text | ≈#B5AEB8 | card excerpt |
| Mono meta text | **#635D64** | pills, "FEATURED INSIGHT" label |
| Nav inactive | ≈#706A71. Active is white (#F1ECEB). | nav |
| Placeholder | ≈#464349 | newsletter input |
| Avatar tint | violet #780CC7 / #6F0FB7 with dark #140D17 | author avatar |
| Grid-frame dot (violet) | ≈#6E20AC | featured frame intersection |
| Talk-to-Aiden dot canvas | reddish ≈#8F3D3B average | nav button |
| Marquee line (coral) | ≈#BC7272 (1 px, antialiased) | footer band |

---

## 5. Dither analysis (MEASURED)

- **2-colour ordered dither** in violet #7F0FD5 and coral #E66157. A 120x120 native crop shows a regular crosshatch/checker lattice (Bayer-like), not error-diffusion noise. The colour histogram is dominated by the two colours; the few intermediates are h264 chroma bleed.
- **Cell size ≈2.4–2.5 video px ≈ 2 CSS px**. At DPR 1.25 this shows up as alternating 2- and 3-px columns.
- Tonal areas use classic Bayer patterns: sparse isolated dots in near-violet regions, 50 % checker in mid regions, dense coral with violet holes in highlights.
- Mosaic reveal stages use **flat averaged colours** per block, not 2-colour. The sequence is a pixelate filter over the final dithered bitmap, with step size shrinking about ×0.74 per stage. In blocks across the width: 12 → 16 → 22 → 30 → 40 → 54 → 74 → 102 → 147 → native.
- Implementation suggestion: draw to a canvas, downsample to N columns (`imageSmoothingEnabled=false`) and upscale. Step N through [12,16,22,30,40,54,74,102,147] every ~170 ms, then draw the full image (≈1.5 s total). Trigger on enter, once, with no stagger inside a row.

---

## 6. Surprises

1. **No page-enter transition**: it is a plain document load. Only the H1 "Insights" animates, starting about 370 ms after paint. The featured heading, label, paragraph and button are static on first paint.
2. **Pixelation is time-based, stepped and about 1.5 s long**, with no cross-fade. It is not scroll-scrubbed and does not replay on scroll-up.
3. **The 3 cards in a row reveal in lockstep** (no stagger).
4. **The footer wordmark is a perpetual marquee** (≈24 CSS px/s to the left) in faint outline type. Coloured line segments on its rules move with it.
5. **"Load more" has no visible hover state**, apart from the pointer cursor.
6. The **bottom progressive blur** causes all the soft and rounded image bottoms and blurry text near the fold. There is no per-image feather mask.
7. **The chrome is 150 px and DPR is 1.25**: crop with `crop=1900:870:0:150`, not `crop=1920:960:0:60`.
8. **The recording updates at about 30 fps**, so every timing carries about ±33 ms of error.
