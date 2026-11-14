# Leash web redesign: implementation plan

Goal: rebuild the Vercel page (`web/`) with the motion grammar of the reference site (primora.xyz), carrying Leash's own content, brand and live demo. Every API route, deep link and CI check that works today keeps working.

**Taken from the reference:** layout grammar, motion timings, palette direction, type hierarchy, dither style.
**Not taken:** Primora's name, logo, copy, photos, the "Aiden" persona or any of their asset files (their AVIF/SVG/Rive art). Every picture on the Leash page is generated in code from Leash's own shapes and data.

## 0. How the reference was analysed

| Pass | What | Output |
|---|---|---|
| Overview | Whole recording (`reference.mp4`, 2:55) at 1 fps; 9 screenshots | section map |
| Close-ups | 21 motions at 2.5–5 fps | first motion notes |
| Frame-accurate | 6 segments (home top, home bottom, framework, purpose, insights, events + contact + modal) at 10 fps, motion bursts at 30–60 fps; per-frame motion-energy curve (frame differencing at 60 fps) to time every animation; pixel colour sampling; layout measured in CSS px | `web/reference/<segment>.md` |
| Source | The site's CSS, inline GSAP scripts and Webflow IX3 bundles for all 6 pages, Lenis config, Rive usage | `web/reference/source.md` |

Recording facts: 1920×1020 video, browser chrome 150 px, display scale 1.25 (CSS px = video px ÷ 1.25), viewport 1520×695 CSS px. The capture holds ~30 unique frames/s, so timings are ±33 ms. Where measured timings differ from the source code, **measured wins** (it is what people see).

## 1. The reference's motion system (consolidated, measured)

### 1.1 Global

| Thing | Spec | Source |
|---|---|---|
| Smooth scroll | Lenis (1.2.3) defaults, driven from the animation ticker; 1 wheel notch = 100 px | source + measured |
| Sizing | Fluid `em`: body font-size = container width / 90 on desktop (container clamped 992–1920 px, so 11–21.3 px; 16 px at 1440); tablet /52.125, mobile landscape /41.25, mobile portrait /25.125. All components sized in `em`. | source |
| Frame | Every section sits in `.container > .section-inner` with 1px `#2b282d` borders left/right, 7.5em in from the edges; side padding 7.5–10em | source + measured |
| Grid backdrop | 1px lines `#2b282d`; at intersections 1.5em squares in the page background colour cut the lines (they are **gaps**, not coloured dots) | source |
| **Progressive blur** | Fixed band at the bottom of the viewport, ~100–128 CSS px, stacked blur layers with gradient masks. **This is the main "blur-in" look**: headings, stats, charts and images sharpen as they scroll up out of the band; most elements have no entrance of their own. Hidden instantly when a trigger near the page end enters. | source + measured (all segments) |
| Ambient lines | Bands of 3–5 horizontal 1px rails with coloured segments (violet / coral / grey) drifting sideways at 20–26 px/s on a clock, neighbouring rails in opposite directions | measured |
| Footer wordmark | Giant outlined logo + name, very dim stroke, marquee moving left at ~24 px/s on a clock (not scroll-linked) | measured |
| Page change | Hard cut, no transition. Then: grid +230 ms, accent rule +200 ms, heading chars +600 ms | measured |
| House easing | CSS `cubic-bezier(.625,.05,0,1)` .6 s (buttons, nav, cards); rows `cubic-bezier(.38,.005,.215,1)` .6 s; logo star `cubic-bezier(.34,1.56,.64,1)` (overshoot); text `power1.out`; odometer `power2.out` | source |
| Breakpoints | 991 / 767 / 479 px | source |

### 1.2 Text

| Motion | Spec |
|---|---|
| Heading reveal | Split into chars. Each char `y 24px→0, opacity 0→1, blur 12px→0`, 0.95–1 s `power1.out`, stagger **0.03–0.034 s** measured (source 0.04). Paragraph split by lines: 0.5 s, stagger 0.08, starts **~0.53 s after the first char**. Button 0.6 s, starts **~0.5 s after the paragraph**. Hero starts 0.2 s after fonts load. Fires once. |
| Statement pair | Line 1 dim (`#655E68`) with a **static per-char blur ramp** on its tail (0 → 8 px over the last word), never refocuses. Line 2 sweeps in 0.9 s after line 1, ends sharp white. |
| Scroll colour scrub | Chars of a heading go `#706c72 → #efedf0`, stagger .05, scrubbed (smoothing .8) from `top 75%` to `top center` |
| Scroll paragraph reveal | Chars `#332f34 → #efedf0`, soft leading edge, scrubbed with smoothing (~0.5–1 s catch-up), `top 70%` → `bottom 70%` |
| Button label | Hover: each char slides `translateY(0 → -1.3em)` with a duplicate below (text-shadow trick), 0.01 s per char, .6 s house ease; white bg insets `0 → .125em` |

### 1.3 Components

| Component | Spec |
|---|---|
| Button icon | 2em dark square holding a canvas of coral dots (9×9 grid, `#F96D57 #F8543A #F7472B`, opacities 0.1–1) that pulse on a cosine cycle; hover = ripple from the centre (per-dot delay ∝ distance × 400 ms, 800 ms each, `sin(pπ)` peak) |
| Odometer | Digit columns roll **upward** with neighbours visible, ~1.35–1.5 s `power2.out`, per-column stagger 80–100 ms, trailing zeros spin a full turn, new columns inserted as the number grows. Starts as the row enters the viewport. |
| Count-up | Plain number count over ~2 s with brightening colour, a progress bar filling in sync |
| Rows list | Hover-driven: rows at opacity .2, hovered row → 1 over .6 s (`.38,.005,.215,1`); first row active on load; leaving the list dims all. Title turns violet instantly on hover. |
| Hover image | 24em square, fixed position, centred on cursor **x**, retargeting tween ~0.5 s `power3.out` (not a lerp), clamped to the list bounds; fade in 150 ms, cross-fade 80 ms between rows, fade out 400 ms |
| Logo/cell grid | Cells brighten linearly over ≥4 s, staggered by **column** ~0.33 s |
| Orbit | 3 rings rotating at 12°/s (30 s/turn), inner and outer clockwise, middle counter-clockwise; labels stay upright |
| Diagrams | Time-based once in view (not scrubbed): step chart ~300 ms per step led by a square node; rhombus nodes pop top→left→right→bottom 200 ms apart, glowing centre; radar morphs 1.1 s then keeps morphing idly; stage bars 400–500 ms stagger; bar charts 90–100 ms stagger; area curve 1 s |
| Dashboard mosaic | Cycles three datasets every ~1.7 s; stat chips swap with 100 ms stagger; bars and curve morph |
| Pixelate reveal | 9–10 hard steps, ~150–170 ms each (~1.5 s), block size ≈ 51 → 4 px, flat block colours, no cross-fade; runs once on reveal; a violet ▷ placeholder sits there until loaded; cards in a row reveal together |
| Dither art | Two-colour ordered (Bayer-like) pattern, violet `#7F0FD5` + coral `#E66157`, ~2 px cells |
| Point clouds | No idle animation; points shift up to 10 px toward the cursor (in 130–250 ms, out 0.3–1 s) |
| Comparison rows | Each row unblurs over 0.8–1 s when it reaches 60–68% of the viewport (no fixed stagger); left column grey squares/grey text, right column coral squares/white text |
| Staircase labels | Appear top-right first, stepping down-left; then 4 columns with column 1 bright |
| Globe | Dotted sphere, two dot colours `#EE8A56` / `#B185FA`, lit on the right, drifting ~2°/s; grey square markers static; no scroll/cursor reaction |
| Media frame | Static ~81.5% width, violet inner glow (`#8924CA` top, `#4E0A83` sides); softness at the bottom comes from the progressive blur |
| Tabbed columns | 3 columns, active one bright with a rule growing linearly (~5 s autoplay per column) |
| CTA panel | Scrolls 1:1. Radius `0 → 2.5em` scrubbed (`top bottom`→`bottom bottom`); bg opacity `0→1`, `yPercent 0→-10` (`top bottom`→`top 30%`); left/right bg halves slide in `xPercent ∓100 → 0` with opacity (scrub .8); bg follows the mouse ±30 px (smoothing .05/tick); 21 tiny squares blink violet/coral; dark radial halo behind the button; heading chars play once at `top 60%` |
| Modal | No card. Backdrop blur ~5 px, dim ≤10%. Build: close button 0 ms → primary button +90 (slides up 25 px out of a clip) → header bar +200 (fade only) → icon +230 → title +370 → subtitle +480 (each drops ~9 px), each 300–400 ms ease-out. Chat view: button leaves in 150 ms; "Thinking…" pill and input fade in over 100 ms; spinner ~0.45 s/turn. |

### 1.4 Tokens (sampled + source)

```
bg            #100D11   (source #100e11)
bg-hover      #1A181B
track         #242126
line          #2B282D   grid + borders
line-2        #3B383D   secondary borders, bullets
text          #EFEDF0
text-2        #B6B2B8   paragraphs
text-dim      #827F83   dim heading line
text-mute     #635F65   eyebrows, inactive titles
inactive      #3E3B3F   rows at 20%
violet        #7F0FD5   brand, dither, active titles
violet-dot    #8827DD   eyebrow bullet
coral         #EA5D56 / #EF5D56 (charts), dither #E66157
coral-btn     #F96D57 #F8543A #F7472B (button dots)
fonts         heading "STK Bureau Serif" 400 (commercial) · body Inter 400/500 · eyebrow Geist Mono 700 uppercase .08em
type (em)     hero 4.5 / lh 1 · h1 3.5 · h2 2.5 / 1.1 · h3 2 / 1.2 · h4 1.5 / 1.2 · body 1.125 / 1.5 · small .875 · eyebrow .75
tracking      -.02em on headings and body
button        padding .5em .5em .5em 1em, radius .375em, inner radius .25em, icon 2em
```

## 2. Leash design decisions

| Decision | Choice |
|---|---|
| Palette | Same dark base and violet/coral pair, used with meaning: **violet = ALLOW, coral = DENY** everywhere (bars, pills, dither, grid cells). A third colour (mint `#6EE7B7`) only for "prediction matched" ticks. |
| Heading font | **Newsreader** 400 (free, `@fontsource-variable/newsreader`), closest open match to a low-contrast text serif; `-0.02em` tracking |
| Body / eyebrow | Inter (`@fontsource-variable/inter`), Geist Mono 700 (`@fontsource/geist-mono`) |
| Sizing | Same fluid-em scheme and 991/767/479 breakpoints |
| Logo | New Leash mark: a ring with a short lead line (SVG), hover rotates 180° with the overshoot ease |
| Theme | Dark only (as the reference). The light-theme tokens are dropped for this page; `/dashboard/` keeps its own styles. |

## 3. Section map: reference → Leash

One long page; nav anchors replace the reference's separate pages. `/dashboard/` stays as it is.

| # | Reference pattern | Leash section | Data |
|---|---|---|---|
| 0 | Nav: links left, logo centre, CTA right | Demo · Rules · How it works · Proof · GitHub · centre Leash mark · **Run the demo** button with the dot-canvas icon (pulses faster while a run is in progress) | static |
| 1 | Hero heading + paragraph + CTA on the grid | **"Limits written once. / Enforced twice."** · "One Fe policy compiles to the Safe module that enforces it on-chain and the CLI that predicts it off-chain, so the two can't drift." · Run the demo · health pill ("Predictor ready · fe 26.6.0 · 0x3efc…ee") | `/api/health` |
| 2 | Candlestick strip (static, sharpened by the blur band) + ambient rails | **Transaction stream**: one bar per agent transaction, violet ALLOW / coral DENY, height ∝ value; seeded from `run.json`, replaced by live results; hover tooltip (step, verdict, reason) | `run.json`, `/api/demo` |
| 3 | Orbit diagram | **What the policy checks**: core `decide()`, rings carrying CAPS · ALLOWLIST · SELECTORS · BREAKER · GUARDIAN at 12°/s alternating; button "Read the policy (rules.fe)" | static |
| 4 | Impact heading + 4 odometer stats | **"When a policy becomes provable."** `22,029` bytes · `21` deny codes · `159` EVM tests · `1` fingerprint; side card with dithered vault art | static |
| 5 | Mid CTA on the grid | Run the demo · Try a transaction | — |
| 6 | Scroll paragraph reveal | "Agents hold keys. Leash puts a Safe module between the agent and the money…" | static |
| 7 | Hover rows + cursor image | **The rules**: per-transaction cap · rolling 24 h window · recipient allowlist · token selectors · unlimited approvals · delegatecall · circuit breaker · guardian pause. Hover image = dithered card showing that rule's Fe signature. On touch: row in the viewport centre is active, tap expands the code inline. | static |
| 8 | Logo grid, column-staggered brighten | **Deny-code grid**: 21 cells `00 None … 20 EscalationRequired`; cells flash coral when a live run hits that code | `REASONS` |
| 9 | Framework hero + cycling dashboard mosaic | **Live demo**: "Watch an agent hit its limits." + Run. Mosaic idles by cycling the 5 recorded transactions every 1.7 s (chips: VERDICT / GAS / CODE swap 100 ms apart, bars morph). On Run: streaming log, then 5 step rows (predicted vs decided pills, ✓ stroke), gas bars, balance odometers, fingerprints. | `run.json` → `/api/demo` |
| 10 | Four timed diagrams | **How it works**: (1) one source → two targets, step-chart draw; (2) `decide` pure vs `record` mutates, rhombus loop; (3) fingerprints converge, radar of rule coverage; (4) Local → Sepolia → Safe stage bars | static |
| 11 | Staircase + 4 columns | **Proof ladder**: COMPILES → TESTED → MATCHED → DEPLOYED (labels top-right first); columns: size headroom, 159/119/77 tests, fingerprint, release binaries | static |
| 12 | Big odometer + before/after bars | **"2,547 bytes of headroom"** odometer; bars = contract size vs the 24,576-byte limit; count-up "0 → 5/5 predictions matched" with a bar | static |
| 13 | Statement pair (blurred tail) | **"Anyone can write a spending limit."** (tail "spending limit" blurred) / **"Few can prove both sides agree."** | — |
| 14 | Point-cloud trio | **Three ways agents lose money**: drifted rules · unlimited approvals · runaway loops; canvas point clouds (split arrows, infinity, spiral) that lean toward the cursor | — |
| 15 | Scroll colour-scrub heading | "Off-chain checks will not get simpler. / **They need one source.**" | — |
| 16 | Comparison table | **Off-chain checks alone vs Leash** (6 rows) | — |
| 17 | Tabbed columns (contact) | **Use Leash for…**: Agent builders · Safe owners · Auditors, 5 s autoplay with the growing rule | — |
| 18 | Globe | **Where Leash runs**: dotted sphere with markers EVM · Sepolia · Linux x86-64 · macOS arm64 · Vercel; card with violet pin | static |
| 19 | Purple CTA panel | **"Put your agent on a leash."** Try a transaction (opens the console) · GitHub | — |
| 20 | Footer + wordmark marquee | Outlined "Leash" marquee, rails, footer card (tagline, anchors, GitHub, release, Apache-2.0, Fe 26.6.0) | — |
| 21 | Chat modal | **Transaction console**: the reference's build order; presets as chips; fields; "Checking…" pill; result as two bubbles ("Fe CLI predicted DENY · PerTxCapExceeded", "LeashModule decided DENY") + match line + remaining budget. Same component embedded inline in section 9's footer so it works without the modal. | `/api/check` |

Deep links kept: `/?run` runs the demo and scrolls to it; `/?try=N` opens the console and runs preset N.

## 4. Tech stack

| Need | Choice |
|---|---|
| UI | React 18.3.1 + TypeScript |
| Motion | `motion` (Framer Motion) 11.x: `useScroll`, `useTransform`, `useSpring`, `animate`, `AnimatePresence`, `MotionConfig reducedMotion="user"`, `LazyMotion` |
| Smooth scroll | `lenis` 1.x, default options, ticked from Motion's `frame` loop |
| Build | Vite 6 + `@vitejs/plugin-react`, output `web/dist` |
| Fonts | `@fontsource-variable/newsreader`, `@fontsource-variable/inter`, `@fontsource/geist-mono` (self-hosted) |
| Canvas art | Own components: Bayer dither, pixelate, point clouds, globe, button dots |

Versions pinned exactly and ≥ 2 weeks old (checked with `npm view` at install). Build-time only: devDependencies in the root `package.json`; the API functions do not import them.

## 5. File layout

```
web/
  index.html  vite.config.ts  tsconfig.json  REDESIGN_PLAN.md  reference/*.md
  src/
    main.tsx  App.tsx
    styles/tokens.css   fluid-em root, colours, type scale, breakpoints
    styles/global.css   frame, grid backdrop, focus rings
    lib/api.ts  presets.ts  useDemo.ts (idle → deploying → stepping(i) → done | error)
    motion/ease.ts       house curves + durations from §1
    motion/SplitReveal.tsx    char/line reveal (§1.2), once
    motion/StatementPair.tsx  blurred-tail pair
    motion/ScrubChars.tsx     colour scrub + paragraph reveal
    motion/Odometer.tsx  CountUp.tsx
    motion/Rails.tsx     ambient drifting rails
    motion/Marquee.tsx   time-based wordmark
    motion/ProgressiveBlur.tsx
    motion/HoverImage.tsx     fixed square, x-retarget tween
    gfx/GridBackdrop.tsx  ButtonDots.tsx  Dither.tsx  Pixelate.tsx  PointCloud.tsx  Globe.tsx  LeashMark.tsx
    gfx/Stream.tsx  Orbit.tsx  Mosaic.tsx  diagrams/{Split,Loop,Radar,Stages}.tsx
    ui/Button.tsx  Eyebrow.tsx  Section.tsx
    sections/*.tsx       one per row of §3
    console/Console.tsx  ConsoleModal.tsx
```

Build wiring:
- `scripts/build-web.mjs`: run `vite build` (JS API) into `web/dist`, then copy `demo/dashboard/index.html` and `demo/run.json` as today.
- `package.json`: `dev:web` (Vite with an `/api` proxy to `scripts/dev-web.ts`), `typecheck:web` covers `web/tsconfig.json` too.
- `vercel.json`: unchanged. Root `tsconfig.json` (commonjs, for `api/`) unchanged.
- CI `web` job: add the web typecheck and a bundle smoke check (`web/dist/index.html` → hashed assets, `run.json`, `dashboard/`).

## 6. Primitive specs (implementation targets)

| Primitive | Implementation |
|---|---|
| `ProgressiveBlur` | `position:fixed; bottom:0; height:8.5em` (~110 px at 1520); 5 layers with `backdrop-filter: blur(0.5/1/2/4/8px)` and stepped `mask-image` linear gradients; hidden (`opacity 0`, instant) when the footer sentinel enters; off when `backdrop-filter` unsupported or reduced motion. |
| `SplitReveal` | Split to chars (words wrapped to avoid breaks) and lines; `animate()` sequence: chars {y:24→0, opacity, filter blur 12→0} 0.95 s `cubicBezier(0.25,0.46,0.45,0.94)` (power1.out), stagger 0.034; lines at +0.53 s, 0.5 s, stagger 0.08; button at +0.5 s after lines, 0.6 s. Trigger `useInView({ once, amount: 0.4 })` or after fonts for the hero (+0.2 s). `aria-label` holds the plain text. |
| `StatementPair` | Line 1 rendered with per-char `filter: blur(ramp)` on the tail and colour `--text-dim`; line 2 `SplitReveal` delayed 0.9 s. |
| `ScrubChars` | `useScroll({target, offset})` → per-char colour interpolation; smoothed with `useSpring(progress, {stiffness: 120, damping: 30})` to reproduce the ~0.5–0.8 s catch-up. |
| `Odometer` | Per digit a 0–9 column ×2; `y` to `-(10+digit)em` (so zeros spin once) with `power2.out` 1.4 s, stagger 0.09 s per column; `tabular-nums`; triggered when 10% in view. |
| `Rails` | 3–5 rails per band; segments animated with `animate(x, …, {repeat: Infinity, ease: 'linear'})` at 20–26 px/s, alternating direction. |
| `Marquee` | Time-based `x` loop at 24 px/s; duplicated content for seamless wrap. |
| `HoverImage` | Fixed 24em square; on pointer move inside the list, `animate(x, target, {duration: .5, ease: power3.out})` (retargeting); y locked to the hovered row centre; opacity in .15 s / cross-fade .08 s / out .4 s; hidden on `(hover: none)`. |
| `ButtonDots` | Canvas 9×9 dots, base opacities per the reference pattern but our own layout (a leash knot); cosine pulse; hover ripple (delay = distance×400 ms, 800 ms each). |
| `Pixelate` | Draw the source (our dither art) into a canvas at block sizes [51, 38, 28, 20, 14, 10, 7, 5, 4, 2] px, 160 ms per step, hard cuts; ▷ placeholder before; once. |
| `Dither` | Offscreen canvas → 8×8 Bayer threshold into violet/coral at 2 px cells; source shapes: Safe vault, chain links, agent glyph, Fe logo-free abstract forms. |
| `PointCloud` | ~1,500 points sampled from an SVG path; each point lerps toward the cursor up to 10 px (in 0.2 s, out 0.6 s). |
| `Globe` | Fibonacci sphere (~900 dots), orange→lilac by longitude light, 2°/s; projected square markers; paused offscreen. |
| `Orbit` | SVG rings with `animate(rotate, 360, {duration: 30, repeat: Infinity, ease: 'linear'})`, direction alternates; labels counter-rotate. |
| `Mosaic` | `setInterval` 1.7 s over the 5 recorded transactions; chips swap with 100 ms stagger; bars `layout` spring. |
| Diagrams | `pathLength 0→1` per segment (300 ms), nodes `scale 0→1` (200 ms apart), triggered once in view; radar idle morph loop. |
| `ConsoleModal` | Backdrop `backdrop-filter: blur(5px)` + 8% dim; children with the measured delays (0 / 90 / 200 / 230 / 370 / 480 ms), 350 ms ease-out; primary button `y 25→0` inside an `overflow: clip` wrapper; focus trap, Esc, return focus; Lenis stopped while open. |
| Reduced motion | `MotionConfig reducedMotion="user"`; Lenis off; rails, marquee, orbit, globe static; reveals show final state; odometers show final numbers; progressive blur off. |

## 7. Responsive

- ≥ 992 px: full layout, fluid em.
- 768–991 px: diagrams under text; stats 2×2; deny grid 4 columns; nav collapses to a menu sheet (serif 2em links).
- < 768 px: hero clamp; stream shows 24 bars; rules use centre-of-viewport activation and inline code; deny grid 3 columns; console fields stacked; no horizontal scroll at 375 px.

## 8. Accessibility

One `h1`, ordered headings, landmarks. Focus rings on every control. Modal: focus trap, Esc, `aria-modal`, return focus. Live regions for demo progress and console results. ALLOW/DENY always written, never colour alone. Dim states (20% rows, blurred tail) are on text that is also readable elsewhere or becomes active on hover/focus; keyboard focus activates rows. Canvas art `aria-hidden`.

## 9. Performance budget

JS ≤ 180 KB gzip. Fonts: Latin subsets, preload the heading font. Animate only transform / opacity / filter; per-char blur only during one-shot reveals. Canvases capped at DPR 1.5 and paused offscreen (IntersectionObserver). Targets: Lighthouse Performance ≥ 90 desktop, Accessibility ≥ 95, CLS < 0.05, 60 fps scroll on a mid laptop.

## 10. Build order (each step checked before the next)

1. **Scaffold**: Vite + React + TS in `web/`, build script, dev proxy, tokens, fonts, fluid em, frame + grid. Check: `build:web`, `test:web` pass; `/api/*` unchanged.
2. **Global layer**: ProgressiveBlur, Rails, Lenis, nav with ButtonDots, LeashMark.
3. **Text primitives**: SplitReveal, StatementPair, ScrubChars, Odometer, CountUp — timed against the reference numbers in §1 with a 120 fps screen capture.
4. **Sections 1–6** (hero, stream, orbit, stats, mid CTA, paragraph).
5. **Sections 7–8** (rules + HoverImage, deny grid).
6. **Section 9 live demo** with Mosaic idle loop and the full run state machine.
7. **Sections 10–18** (diagrams, proof ladder, big number, statement, point clouds, scrub heading, comparison, tabs, globe).
8. **Sections 19–21** (CTA panel with mouse parallax and blinking squares, footer marquee, console modal + inline console, deep links).
9. **Responsive, accessibility, reduced motion** pass.
10. **Verification**: typecheck, build, `test:web` (10/10 fe-native in the Linux container), headless Chrome screenshots at 1440 / 768 / 375, a scripted scroll capture compared side by side with the reference timings, Lighthouse, zero console errors, `/?run` and `/?try=2`. Update README screenshot and the CI web job. Commit and push only when asked.

## 11. Risks

| Risk | Mitigation |
|---|---|
| `backdrop-filter` stack is costly | 5 layers max, fixed element (composited once), disabled on low-end (`hardwareConcurrency ≤ 4`) and reduced motion |
| Per-char blur on long headings drops frames | Cap split reveals to headings; paragraphs reveal by line |
| Lenis vs anchors and modal | `lenis.scrollTo` for anchors; `lenis.stop()` while the modal is open |
| Cold Vercel function (2–6 s) for the live demo | The loading state is content: streaming log, mosaic keeps cycling |
| Looking like a copy | Own logo, copy, data-driven art, serif swap, violet/coral given ALLOW/DENY meaning, no reference assets or text |
