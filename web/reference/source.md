# primora.xyz: motion and design-token extraction (source-level)

All paths below are relative to `scratchpad/ref/`.

**Helper files written for this analysis (all in `analysis/`):**
- `analysis/scripts/<hash>.js`: every unique inline `<script>`, deduped across the 6 pages. The table in section 1 maps each hash to the page and line it came from.
- `analysis/styles/<hash>.css`: every unique inline `<style>`.
- `analysis/site.pretty.css`: `site/site.css` split into one rule per line. The original file is a single line, so **every `site.pretty.css:N` reference points at this file**.
- `analysis/attrs.txt`: every non-standard attribute on every page, with its enclosing section.
- `analysis/home_inline_section.html`: the markup of the home inline-CTA section.

**Line numbers:** the HTML pages are mostly long single lines, so `home.html:673` means "the long line 673".

**Gaps (not downloaded, not fetched):**
- ~~Page-specific Webflow IX3 bundles~~: **resolved.** They were downloaded later and are decoded in **section 8**.
- **`lenis.css` (CDN)** was not downloaded.
- **Static SVG/AVIF art** was not downloaded. URLs are listed where relevant.

---

## 1. Inline GSAP and JS behaviour (all six pages, deduped)

### 1.0 Script inventory

| hash (analysis/scripts) | = inline_home_* | Pages and lines | What it does |
|---|---|---|---|
| 0e9e3ad5 | 0 | all pages, line 1 | Webflow `w-mod-js` / `w-mod-touch` class |
| c7d718d9, 44a788fc, d6c0c896, 3ebb05c8, ad69001a, 47946da9 | 1 | each page's head | JSON-LD only |
| 86f696b6 | 2 | home:816, framework:1121, purpose:834, insights:705, events:932, contact:691 | `gsap.registerPlugin(CustomEase,ScrollTrigger,SplitText)` |
| 3d871d26 | 3 | home:819 and the same position on all pages | Lenis and ScrollTrigger glue |
| d3456cfc | 4 | home:834 / framework:1139 / purpose:852 / insights:723 / events:950 / contact:709 | Button dot canvas, button char stagger, progressive-blur ScrollTrigger |
| ce66f52b | 5 | home:1114 / framework:1419 / purpose:1132 / insights:1003 / events:1230 / contact:989 | Global CTA section (custom `blur` plugin, radius scrub, text reveal) |
| 64cdf919, ec5b10e9, e2400ee2, 96e507da | 6–9 | all pages | Voiceflow chat loader and dark theme (not motion) |
| 0608e56c | 10 | home:1429 | Home hero intro |
| c1da13d2 | 11 | home:1527 | Inline-CTA mouse parallax, odometer, who-rows hover and cursor follow, flower float |
| 99c0904b / 8c7a0221 | 12 | home:2132 / framework:2320 | Rive play/pause via IntersectionObserver |
| bf0f862f | – | framework:1734 | Framework hero intro (same as home but uses `querySelectorAll` for the heading) |
| 904f7ecf | – | framework:1832 | Inline-CTA parallax, auto-advancing tabs with progress bar, odometer |
| 22842495 | – | purpose:1447 | Purpose hero intro (heading only) |
| 1eb68315 | – | purpose:1518 | Floating particle canvases, problem-card image hover parallax, approach-table row reveal |
| 526ab494 | – | purpose:597 | `#scene` / `#card` 3D tilt and float (letter card) |
| 32eb2cfd | – | insights:1318 | Insights hero intro (heading only) |
| 457a9e5f / 0a2a8d9b | – | insights:618 / insights:1636 | Subscribe-card tilt (runs twice on insights) and email underline |
| 03e22235 / bd6d0749 | – | insights:1391 / events:1698 | Pixelate-render image reveal (insights version also watches for CMS-injected nodes) |
| 9b9ead9e | – | events:705 | Canvas dot-sphere "globe" |
| e153b1aa | – | events:1545 | Events hero intro (tagline first) |
| c586e846 | – | events:1642 | Image-cycle crossfade |
| 3050e238 | – | events:1922 | Globe marker click sets `.active` |
| 325b3fe3 | – | events:1947 | Odometer (same code as home) |
| fa41bed8 | – | contact:1304 | Contact background parallax and tabs (same as framework) |
| 63f23317, 22e6b316, f180618e | – | events | Embedly JSON (not JS) |

### 1.1 Libraries and globals

- GSAP 3.15.0 (`https://cdn.prod.website-files.com/gsap/3.15.0/{gsap,CustomEase,ScrollTrigger,SplitText}.min.js`) and Lenis 1.2.3 (`cdn.jsdelivr.net/npm/lenis@1.2.3/dist/lenis.min.js` + `lenis.css`). Seen at home.html:816-817.
- **CustomEase is registered but never used.** No `CustomEase.create` appears anywhere. Every custom curve on the site is a CSS `cubic-bezier` (see section 6.9).
- **Custom GSAP `blur` plugin.** Defined at ce66f52b.js:5-35, with a duplicate `initBlurPlugin()` in each hero script.
  - It interpolates `filter`, replacing any existing `blur(...)` or appending `blur(0px)`.
  - The CTA uses it as a property, e.g. `blur: 12`.
  - The hero scripts tween the `filter: 'blur(12px)'` string directly instead.

### 1.2 Hero intro ("blur-rise" text reveal). Same grammar on 5 pages

All versions share these steps:
1. CSS hides the wrapper first: `[data-hero-wrap]{opacity:0;visibility:hidden}` (styles/e961dd76.css, every page).
2. On `DOMContentLoaded` the script waits for `document.fonts.ready`, then waits one `requestAnimationFrame`.
3. It runs `SplitText.create(heading,{type:'lines,chars'})` and, where a paragraph exists, `SplitText.create(paragraph,{type:'lines'})`.
4. It calls `gsap.set(items,{y:24, autoAlpha:0, filter:'blur(12px)'})`, then `gsap.set(wrap,{autoAlpha:1})`.
5. It plays `gsap.timeline({delay:0.2})`.

| Step | Target | To | duration | ease | stagger | position |
|---|---|---|---|---|---|---|
| 1 | `heading.chars` | y:0, autoAlpha:1, blur 0 | 1 | power1.out | 0.04 (per char) | start |
| 2 | `paragraph.lines` | same | 0.5 | power1.out | 0.08 | `'-=0.8'` |
| 3 | `[data-hero-button]` | same | 0.6 | power1.out | – | `'-=0.3'` |

Page variants:
- **Home** (0608e56c.js:39-91): uses all three steps.
- **Framework** (bf0f862f.js): all three steps. It uses `querySelectorAll('[data-hero-heading]')`, so both `.f-hero_head` lines (the second has `.is-secondary`, opacity .5) are split as one char sequence.
- **Purpose** (22842495.js) and **insights** (32eb2cfd.js): step 1 only. On purpose there are two `.pr-hero_head` divs carrying `data-hero-heading`.
- **Events** (e153b1aa.js:57-89): the order changes:
  1. `[data-hero-tagline]` → duration .5, power1.out (start)
  2. chars → duration 1, stagger .04, at `'-=0.1'`
  3. button → duration .6, at `'-=0.3'`

### 1.3 Global CTA section (`.section_cta`, every page). ce66f52b.js

**Card radius scrub** (lines 53-64):
- `gsap.fromTo('.cta_card', {borderRadius:'0em'}, {borderRadius:'2.5em', ease:'none'})`
- ScrollTrigger: `trigger: card, start:'top bottom', end:'bottom bottom', scrub:1`.

**Background fade and drift** (lines 66-80):
- `.cta_bg` via `querySelector`, so only the first (left) image: `{opacity:0, yPercent:0}` → `{opacity:1, yPercent:-10, ease:'none'}`.
- ScrollTrigger: `start:'top bottom', end:'top 30%', scrub:1`.
- IX3 also animates both `.cta_bg` images (see 2.3).

**Text reveal** (lines 88-133):
- Split: `[cta-head]` with type `lines,chars`; `[cta-p]` with type `lines`; `[cta-btn]` is the wrapper.
- Initial `gsap.set` on all of them: `{y:24, autoAlpha:0, blur:12}`.
- Timeline ScrollTrigger: `trigger: card, start:'top 60%', once:true`.

| Step | Target | duration | ease | stagger | position |
|---|---|---|---|---|---|
| 1 | chars | 1 | power1.out | .04 | start |
| 2 | p lines | .5 | power1.out | .08 | `'-=0.8'` |
| 3 | button | .6 | power1.out | – | `'-=0.3'` |

The whole thing is gated on `document.fonts.ready`.

### 1.4 Progressive blur toggle. d3456cfc.js:259-268

- `ScrollTrigger.create({trigger:'.progressive-blur_trigger', start:'top bottom', ...})`.
- `onEnter` adds `.is-hidden` to `.progressive-blur`; `onLeaveBack` removes it.
- The trigger is a 1px div placed just above the footer legal row (home.html, before `.footer_legal_wrap`). The fixed bottom blur therefore fades out once the page bottom is reached.
- The CSS is in section 5.

### 1.5 Button char roll. d3456cfc.js:236-257 plus the CSS at styles/f0fd5685.css:25-53

**JS:** every `[data-button-animate-chars]` gets its text split into `<span>`s, each with `transition-delay = index × 0.01s`. Spaces get `white-space:pre`.

**CSS:**
- Each span has `display:inline-block; text-shadow:0 1.3em currentColor; transform:translateY(0) rotate(.001deg); transition:transform .6s cubic-bezier(.625,.05,0,1)`.
- The parent has `overflow:hidden`.
- `[s-button]:hover` sets each span to `translateY(-1.3em)`. The text-shadow copy rolls up into view.
- `.n-button_bg` transitions `inset` from 0 → `.125em` over `.6s cubic-bezier(.625,.05,0,1)`. On hover the white pill shrinks inward, revealing a hairline gap.

### 1.6 Odometer / number roll. c1da13d2.js:33-400 (identical in 904f7ecf.js and 325b3fe3.js)

**Defaults:**
- `duration 1`, `ease 'power3.out'`
- `elementStagger .1`, `digitStagger .04`
- `revealDuration .5`, `revealEase 'power2.out'`
- `triggerStart 'top 80%'`, `staggerOrder 'left'`, `digitCycles 2`

**Hooks** (per group or per element):
- Group: `[data-odometer-group]`, optionally with `data-odometer-stagger-order` (left/right/random), `data-odometer-trigger-start`, `data-odometer-stagger`.
- Element: `[data-odometer-element]`, optionally with `data-odometer-start`, `-duration`, `-grow`.

**Algorithm:**
1. Split the final text into digit and static segments.
2. Each digit becomes a mask `span` (height = `step` em, where `step` = line-height ÷ font-size, or 1.2 when line-height is `normal`). Inside it sits a roller span holding `"0\n1\n…9\n0\n…9"` (20 cells, `white-space:pre`).
3. Each roller starts at `y = -startDigit × step em`. It tweens to `-targetPos × step em`, where `targetPos = end > start ? end : 10 + end`. This always rolls forward, through the second cycle if needed.
4. Digits run right to left: the rightmost digit starts first, each further left one `.04s` later. Elements are offset by `index × .1`.
5. If the start value has fewer digits ("grow"), the leading digit masks and their separators begin at `width:0` and tween to their measured em width plus `opacity:1` (.5s power2.out). Their rollers start at `+step` em, i.e. below the mask.
6. Trigger: one timeline per group, `ScrollTrigger{trigger:group, start, once:true}`. On complete the rollers are replaced by plain digits.
7. Skipped entirely under `prefers-reduced-motion`.

**CSS** (styles/f0fd5685.css:105-131):
- Element: `display:inline-flex; font-variant-numeric:tabular-nums`.
- Mask and static spans: `overflow:clip; padding:.05em; margin:-.05em`.
- Roller: `display:block; white-space:pre; text-align:center; will-change:transform`.

**Usage:**
- Home `.h-impact_main_stat`: 4 stats, durations 1 / 0.5 / 2.5 / 1.5, starts `0` or `$0`. Also the `.f-chart_header` group.
- Framework `.f-chart_head`: "$680M+", duration 2, start `$0`.
- Events: 4 `h3.ev-stats_title`.

### 1.7 Auto-advancing tabs. 904f7ecf.js:33-108 (framework `.f-how_main`), fa41bed8.js:33-108 (contact `.uses_grid`)

**Hooks:** `[data-tabs="wrapper"]` → `[data-tabs="content-item"]` → `[data-tabs="item-progress"]` (a 1px bar with `transform-origin:left`).

**Behaviour:**
- `gsap.set(bar,{scaleX:0})` → `gsap.to(bar,{scaleX:1, duration:autoplayDuration/1000, ease:'none', onComplete: next})`.
- An IntersectionObserver (threshold .2) starts the cycle at tab 0, pauses the progress tween when the section is off-screen, and resumes it on return.
- Clicking an item switches tab; the outgoing bar resets to scaleX 0.
- **Bug to note:** the HTML has `data-tabs-autoplayDuration="7000"`. The HTML parser lowercases attribute names, so `dataset.tabsAutoplayDuration` is undefined. The **effective duration is the 5000 ms fallback.**

**Active-state CSS** (`.active` class, all `transition: … .3s`):
- framework (styles/01476559.css): `.f-how_tagline_dot` turns purple; tagline and title colour #635f65 → #efedf0; `.f-how_p` → #b6b2b8; icon border #100e11 → #3b383d.
- contact (styles/bb9a4a62.css): the same pattern.

### 1.8 Purpose page. 1eb68315.js

**Approach table reveal** (175-204):
- `gsap.fromTo('.pr-approach_table_row', {opacity:0, y:24, filter:'blur(12px)'}, {opacity:1, y:0, filter:'blur(0px)', duration:1, ease:'power2.out', stagger:.15, delay:.15})`.
- ScrollTrigger: `trigger: '.pr-approach_main', start:'top 85%', once:true`.

**Problem-image hover parallax** (122-173):
- Wrapped in `gsap.matchMedia('(hover:hover)')`.
- On mouseenter it creates `gsap.quickTo(img,'x'|'y',{duration:.6, ease:'power3.out'})`.
- Move: target = ((pointer − wrapper centre) / half-size) × 24px.
- Leave: `gsap.to(img,{x:0, y:0, duration:.8, ease:'power3.out'})`.

**Floating particles:** see section 7.

### 1.9 Other GSAP use

- **Inline/contact background parallax.** c1da13d2.js:2-31 (`.inline_bg_wrap`), 904f7ecf.js:2-31, fa41bed8.js:2-31 (`.contact_bg_wrap`). Section 4.2 has the details.
- **Who-row image crossfade.** `gsap.to(img, {opacity, duration:.2, ease:'power2.out'})`. Section 7.
- **Who-row visual follow.** `gsap.set` called every rAF. Section 7.

---

## 2. Data-attribute hooks and Webflow IX

### 2.1 Animation hooks (from analysis/attrs.txt)

| Hook | Used by | Where (section / element) |
|---|---|---|
| `data-hero-wrap`, `data-hero-heading`, `data-hero-paragraph`, `data-hero-button`, `data-hero-tagline` (events) | hero intro (1.2) | home `.section_h-hero` (`.h-hero_content`, `h1.h-hero_head`, `p.h-hero_p`, `.button-group`); framework `.section_f-hero` (`.f-hero_content`, two `.f-hero_head`); purpose `section.section_pr-hero` (wrap is the section itself; 2× `.pr-hero_head`); insights `.is-hero_header` / `h1.is-hero_head`; events `.ev-hero_content`, `.tagline_wrap`, `h1.ev-hero_head`, `.ev-hero_btn-wrap` |
| `cta-head`, `cta-p`, `cta-btn` | CTA reveal (1.3) | `.section_cta` (`h2.cta_head`, `p.cta_p`, `.cta_btn-wrap`) on every page |
| `s-button` | char-roll hover scope | `button.n-button` (nav, hero, inline, CTA, footer); `a.s-button` (secondary links) |
| `data-button-animate-chars` | char split (1.5) | `span.n-button_text-char` inside each button |
| `.n-button` with `canvas.n-button_canvas` (class hook, not data) | dot-grid icon (4.1) | every primary button |
| `data-animation-type="rive"` with `data-rive-*` | Webflow Rive and IO play/pause (3) | home `.section_h-intro .h-intro_visual > div.img`; framework (9 instances) |
| `data-odometer-group`, `data-odometer-element`, `-start`, `-duration` | odometer (1.6) | home `.section_h-impact` (`.f-chart_header`, `.h-impact_main_grid`); framework `.section_f-chart`; events `.section_ev-stats` |
| `data-tabs="wrapper"/"content-item"/"item-progress"`, `data-tabs-autoplay`, `data-tabs-autoplayDuration` | tabs (1.7) | framework `.section_f-how`; contact `.section_uses` |
| `data-visual="a"/"b"` | who-rows crossfade | home `.section_h-who .h-who_visual-img` |
| `data-flower-scene`, `data-flower-card` | float loop (7) | home `.section_h-impact .h-impact_top_visual` / `.h-impact_flower-wrap` |
| `data-particles` | particle canvas (7) | purpose `.section_pr-problem canvas.pr-problem_canvas` ×3 |
| `data-subscribe-scene`, `data-subscribe-card` | tilt card (7) | insights `.subscribe_visual_scene` |
| `data-email-underline="input"/"fill"` | email underline width | insights subscribe form |
| `data-pixelate-render`, `-img`, `-trigger="inview"` | pixelate reveal (7) | insights ×11 (`.is-hero_main-img`, `.is-latest_img`, `.mf-feat_img`, `.mf-all_img`); events ×3 |
| `data-image-cycle="5"`, `data-image-cycle-item` | crossfade gallery (7) | events `.section_ev-banner .ev-banner_list` (10 items, 5 s interval) |
| `data-globe-*` (`-section`, `-active`, `-trigger`, `-card`, `-name`, …) | globe markers; only `.ev-globe_item.active` is used by JS (3050e238) | events `.section_ev-globe` |
| `header-line` | CSS 2px bright left accent (6.7) | `.heading-wrap` in most sections |
| `inline-blur-left` / `inline-blur-right` | CSS edge feather (4.2) | `.inline_bg_blur` (home/framework), `.contact_bg_blur` |
| `bg-color-purple` / `bg-color-orange` | coloured marquee dashes (7) | `.pattern_line` |
| `insights-list`, `insights-link` | CSS grid borders | insights lists, home related, events highlight |
| `ev-highlight-ratio` | CSS aspect ratios | events |
| `data-lenis-prevent` | Lenis `prevent` | `.voiceflow_component` |
| `purpose-hero-heading`, `pr-believe-heading` | **no inline JS**; probably IX3 in the missing purpose bundle | purpose |
| `fs-modal*`, `fs-list*` | Finsweet Attributes v2 (modal and list load/filter) | not motion |

### 2.2 Webflow IX2

**None.** There is no `data-w-id` or `data-ix` on any page. The site uses **IX3** (`Webflow.require("ix3")`) only.

### 2.3 IX3 definitions (home bundle, `site/webflow.799941e4.d94de2de8c8f0f58.js`, verbatim values)

Ease index table from the IX3 runtime (webflow.schunk.c1b912…js): `["none","power1.in","power1.out",…]`, so `ease:0` = `"none"`. `tt` values: 0=To, 1=From, 2=FromTo, 3=Set. Default duration is 0.5.

| id | Scope | Trigger `wf:scroll` | Targets | Timeline |
|---|---|---|---|---|
| i-7459630e → t-0ce39251 | CTA component | start `top bottom`, end `bottom top`, **scrub .8**, clamp | `.cta_bg.is-alt` (right image, `…af465`) | tt:1, duration .3, ease none: `opacity 0%→100%`, `xPercent 100%→0` (slides in from right) |
| i-55d57237 → t-75e5fe67 | CTA component | same | `.cta_bg` (left, `…af464`) | tt:2, duration .3, ease none: `opacity 0%→100%`, `xPercent -100→0` |
| i-6b6928c8 → t-ae500cc2 | home page | start `top 70%`, end `bottom 70%`, **scrub .8** | `.h-text_p` | `splitText:{type:"chars"}`, To `color → #efedf0` from #332f34 (`.h-text_p` = neutral-500), stagger each .05, ease none (scroll-scrubbed "read-along" text colouring) |
| i-13a20420 → t-cd85aad2 | home page | start `top bottom`, end `bottom top`, scrub null, enter: play (plays once on enter) | `.h-ecosystem_item` | tt:1 From `opacity 0%`, duration 4, stagger each .05 with `grid:"auto"`, ease none |

- **FOUC guard:** each page's inline style (styles/d90f4131.css on home, 96d355dc.css elsewhere) sets `visibility:hidden!important` on the IX3 targets until `html.w-mod-ix3` is added.
- **Other Webflow-native motion:** the navbar (`data-collapse="medium"`, `data-animation="default"`, `data-duration="400"`, `data-easing="ease"`) and hamburger CSS (6.9).

---

## 3. Rive

**Runtime:**
- Webflow `rive` module (webflow.schunk.d64be…js) on top of `@rive-app/canvas` **2.35.0** (bundled in webflow.schunk.288df1…js, with jsdelivr/unpkg WASM fallback).
- Init reads `data-rive-url`, `-state-machine`, `-artboard`, `-fit`, `-alignment`, `-autoplay`, `-is-touch-scroll-enabled`, `-automatically-handle-events`.
- It creates `new rive.Rive({src, canvas, artboard, stateMachines, layout:new Layout({fit, alignment}), autoplay, autoBind:true, useOffscreenRenderer:true})`.
- `onLoad` calls `resizeDrawingSurfaceToCanvas()`.
- Custom play/pause: 99c0904b.js / 8c7a0221.js. An IntersectionObserver with threshold .25 calls `instance.rive.play()` / `.pause()`.

Every instance uses the same parameters: artboard **"Artboard"**, state machine **"State Machine 1"**, `fit="contain"`, `alignment="center"`, `autoplay="true"`, touch-scroll false, auto-events false. The container is `div.img`, absolutely filling its visual box.

URL prefix: `https://cdn.prod.website-files.com/69c9b7ea102fd7a413465c69/`

| Page / section | Heading nearby | File (after prefix) | Native size |
|---|---|---|---|
| home `.section_h-intro .h-intro_visual` (max 40em, 1:1) | "What we've learned matters most" | `69e55c708cbeb0c880725fad_2bfa5d52eae4ea572e8f26a842283f14_%5Bprimota%5D%2310_core_iterate_distribute_%5B1000x600%5D.riv` | 1000×600 |
| framework `.section_f-hero .f-hero_visual_inner` | "You build the product. We help it scale." | `69e55c7052afabb71b4e0184_%5Bprimora%5D%231_we_help_it_scale_%5B488x488%5D.riv` | 488² |
| framework `.section_f-feat` #1 | "Early growth & user acquisition" | `69e55c70fe05b4f6088e53f9_%5Bprimora%5D%232_early_growth_%5B400x400%5D.riv` | 400² |
| framework `.section_f-feat` #2 | "Product & engagement architecture" | `69e55c70bec0fb7b06334d16_%5Bprimora%5D%233_product_%26_engagement_%5B400x400%5D.riv` | 400² |
| framework `.section_f-feat` #3 | "Capital & strategic positioning" | `69e55c70053cdb8000a82f86_%5Bprimora%5D%234_c%26s_positioning_%5B400x400%5D.riv` | 400² |
| framework `.section_f-feat` #4 | "Scale & transition strategy" | `69e55c70e5df374b7f90c584_%5Bprimora%5D%235_s%26t_strategy_%5B400x400%5D.riv` | 400² |
| framework `.section_f-chart .f-chart_visual-wrap` (aspect 1072/406) | "$680M+" (odometer) | `69e55c70af6436e9a05ade1c_%5Bprimora%5D%236_after_structural_acceleration_%5B1070x405%5D.riv` | 1070×405 |
| framework `.section_f-2feat` #1 | "This is what engineered growth looks like" | `69e55c701f9f9d3ca422f306_%5Bprimora%5D%237_pre%26post_framework_%5B400x400%5D.riv` | 400² |
| framework `.section_f-2feat` #2 | "Real distribution attracts real capital" | `69e55c7062459f9da4880397_%5Bprimora%5D%238_ecosystem_capital_%5B400x400%5D.riv` | 400² |
| framework `.section_f-2feat` #3 | "We turn distribution into participation" | `69e55c7004e0e07faa0aa15f_%5Bprimora%5D%239_participation_growth_%5B400x400%5D.riv` | 400² |

- **Content mapping is inferred from filenames only.** The .riv files were not downloaded.
  - "core_iterate_distribute" is likely the orbit/cycle diagram.
  - "after_structural_acceleration" (the wide 1070×405 chart) is likely the candlestick/growth chart.
  - The others are 400² diagram tiles.
- **No Rive on purpose, insights, events or contact.**
  - The events "globe" is a **canvas** (section 7).
  - The purpose "point clouds" are **SVG/canvas dots**.

---

## 4. Algorithms to re-implement

### 4.1 Button dot canvas (`.n-button` icon). d3456cfc.js:2-234

- **Geometry:**
  - The canvas is square. Its CSS size = `.n-button_canvas` = 86.67% of `.n-button_icon-wrap` (2em × 2em, bg #100e11, radius .25em).
  - Backing store = size × devicePixelRatio. Unit `SC = size/26 × dpr`.
  - A **9×9 grid** of squares sits at logical coords x,y ∈ {0,3,6,…,24}. Each square is **2 units** (`DS = 2·SC`), centred at (x+1, y+1), so 1-unit gutters.
  - The grid fills 26 units: 9 squares × 2 + 8 gaps × 1.
- **Per-dot base opacity and colour.** A diamond (Manhattan) falloff from the centre cell (4,4) in cell indices:
  - Colour by Manhattan distance d: 0 → `#F62909`, 1 → `#F7472B`, 2 → `#F8543A`, ≥3 → `#F96D57`.
  - Base alpha: d≤3 → 1, 4 → .9, 5 → .75, 6 → .5, 7 → .25, 8 (corners) → .1.

  ```
   .10 .25 .50 .75 .90 .75 .50 .25 .10
   .25 .50 .75 .90  1  .90 .75 .50 .25
   .50 .75 .90  1   1b  1  .90 .75 .50     b=#F8543A c=#F7472B d=#F62909
   .75 .90  1   1b  1c  1b  1  .90 .75
   .90  1   1b  1c  1d  1c  1b  1  .90
   (mirror)
  ```

- **Pulse (idle loop):**
  - Constants: `dist` = Euclidean distance of (x+1, y+1) from (13,13); `MD = √(13²+13²) ≈ 18.385`; `dr = dist/MD`.
  - `cycleDur = 2200 + dr·600` ms (2.2–2.8 s; outer dots are slower).
  - `boost = 0.12 + dr·0.28` (outer dots pulse more).
  - `phase = −((dist·0.38) mod cycleDur)` ms, which is negligible (0–7 ms).
  - Each frame: `t = (now − start − phase) mod cycleDur`; `alpha = base + boost·(1 − cos(2π·t/cycleDur))/2`, clamped to [0,1] when drawn. Scale is 1.
  - **Result:** all dots brighten together at first and then drift out of phase over time.
- **Hover ripple** (`mouseenter` on the button, re-entrant guard):
  - Each dot starts after `delay = dr·400` ms and runs `RD = 800` ms: `p = clamp((elapsed − delay)/800)`, `pk = sin(p·π)`.
  - Then `scale = 1 + 0.35·pk` (scaled about the square's centre) and `alpha = base + 0.3·pk`.
  - Total about 1.2 s, radiating from the centre outwards. When every dot finishes, scales reset and the pulse restarts from t=0.
- **Lifecycle:**
  - An IntersectionObserver (threshold 0) stops the rAF when off-screen and restarts the pulse when visible.
  - Setup waits for non-zero size (ResizeObserver).
  - Drawing: `clearRect`, then for each dot `save / translate(cx·SC, cy·SC) / scale(s) / globalAlpha / fillRect(−SC, −SC, 2SC, 2SC)`.

### 4.2 Inline CTA background (`inline_home_11.js` = c1da13d2.js, plus markup in analysis/home_inline_section.html)

**Correction to the brief: nothing is drawn procedurally here.** `initInlineCTA` is a **mouse-parallax** on a layered static background.

**Layers** inside `.inline_card` (border 1px #2b282d, radius 1em, height 17.5em, `overflow:clip`, contents centred):
1. `.inline_bg_wrap`: absolutely positioned, `height:35.5em`, `aspect-ratio:1136/568`, centred by flex. It is about twice the card height, so it overflows and gets clipped. It holds three stacked `.inline_bg_img` layers:
   - `69cd30c4c5d75d4e96f6894f_Inline%20BG%20Left.svg` and `69cd30c4680c17faaec81bcd_Inline%20BG%20Right.svg`: static vector art, not downloaded.
   - An embedded `<svg viewBox="0 0 1136 568">` with **21 animated 2×2 squares** on a **71-unit pitch**: columns x = 354…780 (7), rows y = 212, 283, 354 (3).
     - Each square runs CSS `@keyframes colorSwap { 0%,45% {fill:start} 50%,95% {fill:end} 100% {fill:start} }`, i.e. a hold, a fast 5% cross-fade, a hold, and a snap back.
     - Per square, `--dur` / `--del` are: d0 4.2/0, d1 3.8/.8, d2 4.6/1.7, d3 3.5/2.4, d4 5.1/.3, d5 4.0/1.2, d6 4.8/2.1, d7 3.6/.6, d8 4.9/3.0, d9 3.7/.4, d10 4.4/1.5, d11 3.3/2.7, d12 5.3/.1, d13 4.1/1.9, d14 4.7/2.3, d15 3.9/0, d16 5.0/3.2, d17 3.4/1.6, d18 4.3/.7, d19 3.2/2.9, d20 5.5/.5 (seconds).
     - Even indices go purple #8827DD → coral #F96D57; odd indices go coral → purple (styles/6164f401.css).
2. **Edge feathers** `[inline-blur-left]` / `[inline-blur-right]` (`.inline_bg_blur`, 30% wide, full height, left/right):
   - `backdrop-filter: blur(15px); background: #100e11`
   - `mask: linear-gradient(to right|left, #000 0%, transparent 100%)`
3. **`.inline_btn-bg`** (17.25em × 8.375em, centred behind the button): `radial-gradient(50% 50% at 50% 50%, #100e11 70%, rgba(16,14,17,0) 100%)`. This dark halo cleans up the area behind the CTA button.
4. **Button:** `.n-button` "dark" variant.

**Motion** (identical on home, framework and contact; contact targets `.contact_bg_wrap`, whose card is 35.5em tall):
- Target: `(clientX/innerWidth − .5)·2·30` px and the same for y, i.e. ±30 px across the whole window (window `mousemove`). Window `mouseleave` resets the target to 0.
- Smoothing: `current += (target − current)·0.05` on every `gsap.ticker` tick (about 60 Hz, roughly a 0.33 s time constant).
- Output: `gsap.quickSetter(bg,'x'|'y','px')`.

**Home hero background (the same idea)** (`.h-hero_bg_wrap`, aspect 12/5, centred, height 100% of the 31.25em hero):
- `Hero BG lines.svg` (static).
- An inline `<svg viewBox="0 0 1200 500">` with **84 2×2 rects** on a 71-unit pitch: 12 columns (x 31…386 and 812…1167, leaving the centre clear for text) × 7 rows (y 36…462).
- Classes `.dp` / `.dc` run `@keyframes ptc {0%,100% {fill:#8827DD} 50% {fill:#F96D57}}` (and the reverse) with `ease-in-out infinite`. Per-rect inline `animation-duration` is 2.5–5.5 s (0.1 s steps) and `animation-delay` is −0.1 to −3.4 s (styles/c1c0a0be.css).
- The purpose `.pr-believe_svg` (viewBox 569², 7×7 = 49 rects, pitch 71) uses the same `purpleToCoral` / `coralToPurple` keyframes (styles/e1674d2e.css).

---

## 5. Progressive blur (site.pretty.css:1049-1059)

```css
.progressive-blur{z-index:40;pointer-events:none;isolation:isolate;contain:paint;width:100%;height:15em;
  transform-style:preserve-3d;transition:opacity .4s ease;position:fixed;bottom:0;left:0;overflow:hidden;transform:translateZ(0)}
.progressive-blur.is-hidden{opacity:0}
.progressive-blur_layer{width:100%;height:100%;position:absolute}
.is--1{backdrop-filter:blur(.09375em);mask:linear-gradient(#0000 50%,#000 62.5% 75%,#0000 87.5%)}
.is--2{backdrop-filter:blur(.1875em); mask:linear-gradient(#0000 62.5%,#000 75% 87.5%,#0000 100%)}
.is--3{backdrop-filter:blur(.375em);  mask:linear-gradient(#0000 75%,#000 87.5% 100%)}
.is--4{backdrop-filter:blur(.75em);   mask:linear-gradient(#0000 82%,#000 92% 100%)}
.is--5{backdrop-filter:blur(1.5em);   mask:linear-gradient(#0000 88%,#000 100%)}
.progressive-blur_trigger{pointer-events:none;width:100%;height:1px}
```

- Five stacked layers, each with a `-webkit-` duplicate. Masks run top → bottom (default direction).
- Blur doubles per layer: 1.5, 3, 6, 12, 24 px at 16px/em.
- The band is fixed to the viewport bottom, 15em tall (240 px at 1440 wide).
- The fade-out is driven by 1.4.
- The purpose hero has a horizontal version (`.pr-hero_blur_wrap`, 120% wide, right-anchored, z 40): the same five layers with `linear-gradient(90deg, …)` masks (site.pretty.css:1044-1048).

---

## 6. Design tokens

### 6.1 Root font-size scheme (fluid em). styles/fb2376a2.css (inline on every page)

```css
:root{--size-unit:16; --size-container-ideal:1440; --size-container-min:992px; --size-container-max:1920px;
  --size-container:clamp(var(--size-container-min),100vw,var(--size-container-max));
  --size-font:calc(var(--size-container) / (var(--size-container-ideal) / var(--size-unit)));}
@media (max-width:991px){:root{--size-container-ideal:834;--size-container-min:768px;--size-container-max:991px}}
@media (max-width:767px){:root{--size-container-ideal:660;--size-container-min:480px;--size-container-max:767px}}
@media (max-width:479px){:root{--size-container-ideal:402;--size-container-min:320px;--size-container-max:479px}}
```

- `body{font-size:var(--size-font)}` (site.pretty.css:411). **`html` font-size is not set**, so `rem` stays 16px.
- Nearly all component sizing uses **em**, so it scales with the viewport. Spacing utilities and section-padding tokens use **rem**, so they stay static.

| Range | Body font-size |
|---|---|
| Desktop (992–1920 px) | 100vw/90: 11.02 → 21.33 px (16 px at 1440) |
| Tablet | clamp(768,100vw,991)/52.125: 14.7–19.0 px |
| Mobile landscape | /41.25: 11.6–18.6 px |
| Mobile portrait | /25.125: 12.7–19.1 px (16 px at 402) |

`.container{width:100%; max-width:var(--size-container); padding-inline:var(--_layout---spacing--global-padding)}`. The same applies to `.section-border_container` and `.nav_mobile_container`.

### 6.2 CSS variables (site.pretty.css:402; responsive overrides at :1079 for 991px, :1180 for 767px, :1288 for 479px)

**Colour**

| Token | Value | Role |
|---|---|---|
| `--neutral--100` | #100e11 | page background (`body` bg, `--_theme---background--primary`) |
| `--neutral--200` | #1a181b | hover fill (`.h-ecosystem_item:hover`), empty states |
| `--neutral--300` | #242126 | dark-button inset ring, progress track |
| `--neutral--400` | #2b282d | **`--_theme---border-color--primary`** (all 1px grid lines), inactive dot |
| `--neutral--500` | #332f34 | `.h-text_p` starting colour (IX3 scrubs it to #efedf0) |
| `--neutral--600` | #3b383d | secondary button border, boxed-section border, bullets |
| `--neutral--700` | #49454b | input placeholder |
| `--neutral--800` | #635f65 | footer social icons |
| `--neutral--900` | #706c72 | nav and footer link default |
| `--neutral--1000` | #635f65 | eyebrow/tagline text, inactive titles (same value as 800) |
| `--neutral--1100` | #b6b2b8 | **`--_theme---text-color--secondary`** (`p`) |
| `--neutral--1200` | #efedf0 | **`--_theme---text-color--primary`** (headings, active) |
| `--brand--foxglove-purple` | #8827dd | link colour, focus ring, selection bg, CTA card bg, tagline dot, `--_theme---background--secondary` |
| `--brand--dahlia-coral` | #f96d57 | accent dashes, email underline, rich-text links, highlight bullets |
| `--brand--lichen-silver` | #d6d2da | current footer logo |
| `--brand--white` | #fff | primary button fill |

Selection: bg #8827dd, text #efedf0.

**Colours outside the tokens:**
- Button-dot coral ramp: #F62909, #F7472B, #F8543A, #F96D57.
- Globe purple: base rgb(110,95,170), highlight rgb(180,145,255). Globe orange: base rgb(170,105,70), highlight rgb(255,150,80).
- CTA/banner inner vignette: `box-shadow: inset 0 2.5em 3.5em 1.5em #8827dd` (`.cta_overlay`); `.ev-banner_overlay` uses `inset 0 2.5rem 6.5rem 1.5rem #8827dd`.
- Inline halo: rgba(16,14,17,0).
- SVG line art: stroke #706c72, #3b383d, #2b282d; gradient stops #3b383d (×132).
- Voiceflow theme (96e507da.js): #16141a, #211d26, #2b282d, `rgba(136,39,221,.14/.55)`.

**Typography tokens**

| Token | Desktop | 991px | 767px |
|---|---|---|---|
| `--font-family--heading` | "STK Bureau Serif" | | |
| `--font-family--body` | Inter | | |
| `--font-family--eyebrow` | "Geist Mono" | | |
| h1 size / line-height | 3.5em / 1 | 3.5em | 3em |
| h2 | 2.5em / 1.1 | 2.5em | 2em |
| h3 | 2em / 1.2 | 2em | 1.5em |
| h4 | 1.5em / 1.2 | 1.375em | 1.25em |
| h5 | 1.25em / 1.2 | 1.25em | 1em |
| h6 | 1em / 1.2 | | 1em |
| heading weight | 400 (normal) | | |
| letter-spacing (all headings and body) | `--_typography---letter-spacing--tight: -.02em` | | |
| body-font-size (`.text-size-regular`) | 1.125em, line-height 1.5 | 1.125em | 1em |
| font-size small / regular / xsmedium | .875em / 1em / 1.125em | | .875em / .875em / 1em |
| font-size tiny / medium / large | .75rem / 1.25rem / 1.5rem | | large 1.25rem |

**Layout tokens**

| Token | Desktop | 991px | 767px | 479px |
|---|---|---|---|---|
| `--_layout---spacing--global-padding` (container side padding) | 7.5em | 3em | 3em | 1em |
| `--_layout---content-inner` (padding inside the grid lines) | 4em | 3em | 2em | 1em |
| `--_layout---content-gap` | 5em | 4em | 3em | 2em |
| section-padding s / m / l | 3 / 5 / 8 rem | 3 / 4 / 6 | 2 / 3 / 4 | 3 / 5 / 8 |

- Spacing scale: tiny .125, xxsmall .25, xsmall .5, small 1, medium 2, large 3, xlarge 4, xxlarge 5, huge 6, xhuge 8, xxhuge 12 (rem).
- Radii: small .25rem, medium .5rem, large 1rem. In components the radii are em: .25em (icon wrap, logo tiles, small images), .375em (buttons), .5em (visual frames, footer), 1em (cards, CTA). The CTA radius is scrubbed 0 → 2.5em.
- Containers: small 48rem, medium 64rem, large 80rem (utility). The main container is `--size-container` (max 1920 px).
- Focus ring: `outline: .125rem solid #8827dd; outline-offset: .125rem`.

### 6.3 Fonts (site.pretty.css:398-401; all `woff2`, `font-display:swap`)

URL prefix: `https://cdn.prod.website-files.com/69c9b7ea102fd7a413465c69/`

| Family | Weight | File (after prefix) |
|---|---|---|
| Inter | 400 | `69caba4dfded1ba2e685a4aa_inter-v20-latin-regular.woff2` |
| Inter | 500 | `69caba4d544acc206064b270_inter-v20-latin-500.woff2` |
| Geist Mono | 700 | `69caba713244123b26c9de27_geist-mono-v4-latin-700.woff2` |
| STK Bureau Serif | 400 (Book) | `69caba71a8a0108bfd7b2264_STKBureauSerif-Book.woff2` |

`body{-webkit-font-smoothing:antialiased}`.

### 6.4 Type scale in use (em of the fluid body size; px at 1440)

| Role | Font | Size | Line-height | Letter-spacing | Colour |
|---|---|---|---|---|---|
| Home hero h1 `.h-hero_head` | STK Bureau Serif 400 | 4.5em (72px); 991: 4em; 767: 3.5em; 479: 3em | 1 | -.02em | #efedf0 |
| h1 / `.h1` / `.f-hero_head` | Serif 400 | 3.5em (56px) | 1 | -.02em | |
| Stat / chart head `.f-chart_head` | Serif | 4.5em | 1 | | |
| h2 / `.h-impact_main_stat` | Serif | 2.5em (40px) | 1.1 | -.02em | |
| h3 / `.h-who_title` | Serif | 2em | 1.2 | | |
| h4 (card titles) | Serif | 1.5em | 1.2 | | |
| `.pr-approach_table_text` | Serif | 1.5em | 1.2 | -.02em | #635f65 (highlight #efedf0) |
| Body `p` / `.text-size-regular` | Inter 400 | 1.125em (18px) | 1.5 | -.02em | #b6b2b8 |
| Small paragraphs (`.f-how_p`, `.is-latest_p`) | Inter | .875em | 1.5 | | |
| Eyebrow `.tagline_text` / `.text-style-tagline` / `.is-author_name` | Geist Mono 700, uppercase | .75em (12px) | 1.1 | **.08em** | #635f65 |
| Eyebrow bullet `.tagline_dot` | – | .625em square | | | #8827dd (inactive #2b282d) |
| Primary button `.n-button` | Inter 500 | 1em | 1 | | #100e11 on white |
| Nav link `.nav_link` | Inter 500 | .875em | | | #706c72 → #efedf0 |
| Mobile nav link | Serif | 2em | 1.1 | | |
| Footer link | Inter 500 | .875em | | | #706c72 → #b6b2b8 |

### 6.5 Buttons

**`.n-button` (primary):**
- Base: `display:flex; gap:1em; padding:.5em .5em .5em 1em; radius:.375em; position:relative; overflow:clip`.
- Layers: `.n-button_bg` (white, radius .25em, `inset:0` → `.125em` on hover, .6s `cubic-bezier(.625,.05,0,1)`), then the text span, then `.n-button_icon-wrap` (2em square, #100e11, radius .25em) holding the dot canvas.
- **"dark"** variant (w-variant-60df…): white text; bg #100e11 with `box-shadow: inset 0 0 0 1px #242126`; radius .3125em; icon wrap gets a 1px #242126 border.
- **"nav"** small variant (w-variant-090f…): font .875em, padding .375em .375em .375em .75em.

**`.s-button` (secondary link):**
- `border:1px solid #3b383d; background:#100e11; padding:.875em 1em; radius:.375em; font 1em/500`.
- "white" variant: white border and bg, text #100e11.
- It has the same char-roll hover (needs the `[s-button]` attribute).

### 6.6 Hover/transition table

| Element | Property | Duration | Easing |
|---|---|---|---|
| Button chars (`[s-button] [data-button-animate-chars] span`) | transform translateY(0 → -1.3em), 0.01s per-char delay | .6s | cubic-bezier(.625,.05,0,1) |
| `.n-button_bg` | inset 0 → .125em | .6s | cubic-bezier(.625,.05,0,1) |
| Logo star `.anim-logo-star` | rotate 180deg on wrap hover | .6s | cubic-bezier(.34,1.56,.64,1) (overshoot) |
| `.nav_link` | color | .3s | ease |
| `.nav_component` | transform .7s, color .3s, bg .3s | | ease |
| Hamburger lines | all | .5s, delay 200ms when closing / 0 when opening | cubic-bezier(.625,.05,0,1) |
| Hamburger inner | transform rotate ±45° | .2s | ease |
| `.h-who_item` | opacity .2 ↔ 1 | .6s | cubic-bezier(.38,.005,.215,1) |
| `.h-who_visual` | opacity 0 → 1 on `.h-who_main:hover` | .35s | same |
| `.h-who_visual-img` | opacity | .15s | same (plus GSAP .2s power2.out) |
| `.h-ecosystem_item` | background → #1a181b | .3s | ease |
| `.f-how_*` / `.uses_*` active | color, bg, border-color | .3s | ease |
| `.is-latest_title`, `.h-podcast_link` | color → #8827dd | .2s | ease |
| `.footer_nav_link`, `.footer_social_link` | color | (no transition) | |
| `.ev-globe_card` | opacity | .6s | cubic-bezier(.625,.05,0,1) |
| `.ev-globe_btn:hover` | bg #3b383d → #49454b | instant | |
| `[data-image-cycle-item]` | opacity .4s; outgoing item delayed .4s | | ease |
| `.subscribe_input-line` | transform scaleX | 60ms | linear |
| `.progressive-blur` | opacity | .4s | ease |

Box-shadows are used only as inset vignettes or rings (no drop shadows):
- `.cta_overlay`: inset purple, 6.2
- `.ev-globe_btn`: `0 0 0 .5em #100e11` (cut-out ring)
- dark button: inset 1px ring

### 6.7 The 1px page grid (how it is built)

1. **Vertical lines:** every section uses `.container > .section-inner`, and `.section-inner` has `border-left` / `border-right: 1px solid #2b282d`. The container is `max-width: clamp(992px,100vw,1920px)` with side padding 7.5em, so the two verticals sit 7.5em in from each edge (at 1440: x = 120 and 1320).
2. **Horizontal lines:** between sections a `.section-border_wrap` (component, variants `base` / `nav`) contains:
   - `.section-border_bg`: 1px tall, `width: calc(100vw - 1.5em)`, centred, colour #2b282d. The line stops .75em from each viewport edge.
   - `.section-border_container > .section-border_inner` (1px high): uses the same container padding, so its left and right edges coincide with the vertical lines.
3. **Intersection squares:**
   - Two `.section-border_square`s (left, `.is-right`), each 1.5em × 1.5em, z-index 2, centred on the crossing with `translate(±50%,-50%)`.
   - **Their colour is the page background #100e11, not an accent.** They punch a 24 px gap where the lines cross, so the lines read as separate segments.
   - The `nav` variant squares are .75em tall, bottom-anchored (half-height under the nav).
   - At 479px the squares are .5em wide.
   - Any coloured squares seen in screenshots come from other elements: `.tagline_dot` (.625em purple), `.pr-approach_table_bullet` (.625em, coral when highlighted), `.ar-toc_h2-link::before` (.8333em purple), the blockquote corner dots (3px coral via 4 background-image gradients), or the animated SVG dots.
4. **The same cut-out trick elsewhere:**
   - `.pr-approach_table_divider-space` (1.5em bg-coloured gap in a 1px divider)
   - `.ev-stats_cutout` (1.5em bg square at the cell corner, `translate(.8125em,.8125em)`)
   - 1px-gap grids: `.h-impact_main_grid` / `.ev-stats_grid` (`gap:1px; background:#2b282d`, cells bg #100e11)
5. **`[header-line]`:** `::before`, 2px wide, full height, `#efedf0`, at `left: calc(-1 * var(--_layout---content-inner) - 1.5px)`. This places a **bright 2px segment exactly over the left grid line** beside each heading block.
6. **Boxed sections** (`.f-how_layout`, `.uses_layout`, `.subscribe_layout`): `border:1px solid #3b383d; radius:1em; padding:4em var(--content-inner)`, inside a section with .75em side padding.

### 6.8 Breakpoints

- `max-width: 991px` (tablet; Webflow nav collapses here, `data-collapse="medium"`)
- `max-width: 767px`
- `max-width: 479px`
- one `min-width: 768px`
- CSS-only grids: `min-width: 992px` and `768–991px` (insights list borders)

### 6.9 Easing vocabulary (exhaustive)

| Ease | Where |
|---|---|
| `cubic-bezier(.625,.05,0,1)` | the house "expo-ish" curve: buttons, hamburger, globe card |
| `cubic-bezier(.38,.005,.215,1)` | who rows |
| `cubic-bezier(.34,1.56,.64,1)` | logo star overshoot |
| GSAP `power1.out` | text reveals |
| GSAP `power2.out` | table rows, image fades, odometer reveal |
| GSAP `power3.out` | odometer digits, hover parallax |
| `none` | scrubs and the progress bar |
| CSS `ease`, `linear` | marquees |

---

## 7. Other motion

**Lenis** (3d871d26.js):
- `new Lenis({ prevent: node => node.hasAttribute('data-lenis-prevent') })`. All other options are Lenis 1.2.3 defaults: `lerp 0.1`, `smoothWheel true`, `wheelMultiplier 1`, `touchMultiplier 1`, `syncTouch false`, `autoRaf false`.
- `lenis.on('scroll', ScrollTrigger.update)`; `gsap.ticker.add(t => lenis.raf(t*1000))`; `gsap.ticker.lagSmoothing(0)`.
- `lenis.css` is loaded from the CDN.

**Marquees** (pure CSS):
- Keyframes `pattern-marquee {0% {translateX(0)} 100% {translateX(-50%)}}` (styles/f0fd5685.css:69). The track contains its content twice (`.pattern_inner` ×2, `.h-marquee_inner` ×2) so −50% loops seamlessly. `will-change:transform; flex:none`.
- **Pattern divider** (`.pattern_component`): 3 rows with 1.5em gap and padding. Each row's track holds 1px lines:
  - `.pattern_line` 15vw (min 13.5rem); `.is-medium` 24vw (min 21rem); `.is-long` 65vw (min 58.5rem).
  - `margin-right: .75em`; colour #2b282d, or purple/coral via `[bg-color-*]`.
  - Rows 1 and 3 run at 100s linear normal; row 2 (`.is-reverse`) runs at 120s reverse. The `inverse` component variant swaps these. At 767px the durations are 80s / 100s.
- **Home logo marquee** `.h-marquee_track`: 100s (variant 120s reverse). Items are `Home Marquee N.svg` / `Home Marquee R.svg` at width 100vw (min 50em). An overlay fades the edges: `linear-gradient(90deg, #100e11, transparent 50%, #100e11)`.
- **Footer marquee** `.footer_marquee_inner`: 100s. Logo SVG items at 80vw (110vw at 991, 144vw at 479).

**Odometer:** see 1.6.

**Who-we-work-with rows** (home `.section_h-who`; c1da13d2.js:402-577 plus styles/d7fd5830.css):
- **Hover dimming:** with `(hover:hover)`, rows sit at opacity .2 and the `.active` row goes to 1 (.6s cubic-bezier(.38,.005,.215,1)). The first row is active on init. Leaving the list clears `.active`, so all rows go to .2.
- **Image source:** each row hides a `.h-who_img-wrap img` (`display:none` always). On `mouseenter` its `src` is copied into whichever of two stacked `<img data-visual="a"|"b">` is hidden. That image tweens to opacity 1 and the other to 0 (0.2s power2.out). This ping-pong A/B crossfade avoids flashes.
- **Cursor follow** (`gsap.matchMedia('(hover:hover) and (pointer:fine)')`):
  - `.h-who_visual` is 18em square, absolutely positioned in a full-size `.h-who_visual-wrap`, `xPercent/yPercent: -50`, z-index 10 (rows are z 20).
  - `pointerenter` snaps it to the pointer.
  - On `pointermove`, scroll and resize the target is recomputed relative to the wrap rect.
  - A rAF loop runs `current += (target − current)·0.04` (a very soft lag) via `gsap.set(x,y)`. `pointerleave` stops the loop.
  - The visual's opacity fades 0 → 1 via CSS `.h-who_main:hover .h-who_visual` (.35s).

**Page transitions:** **none active.**
- CSS for `.transition` exists (site.pretty.css: fixed, z 99999, purple #8827dd, `grid-template-columns: repeat(16,1fr)` of square `.transition-block`s; 6 columns at 767, 4 at 479; `display:none`).
- No page contains a `.transition` element and no script drives it. It is a vestigial block-wipe transition.

**Dither images:** **pre-rendered assets, not runtime.**
- Files are named like `dither-black-purple-1777987682217.avif` (who rows ×6) and `dither-orange-purple-17776…avif` (insights, home event). They are timestamped exports from a dither tool, served as AVIF `<img>` with `object-fit:cover`.
- The CTA backgrounds (`CTA Left.avif`, `CTA Right.avif`, `CTA Mobile Bg.avif`) are pre-rendered dot patterns too.
- The **runtime** image effect is the **pixelate reveal** (03e22235.js / bd6d0749.js):
  - An overlay canvas is cover-fitted to the image.
  - Steps form a geometric series from 12 columns to the canvas pixel width over 12 stages, but only the first `floor(12·.9) = 10` are used, so it never reaches full resolution. Example at 1200 px: 12, 18, 26, 38, 56, 82, 121, 177, 260, 382 columns. Rows = cols × h/w.
  - Each stage is drawn by downscaling to a tiny canvas and upscaling with `imageSmoothingEnabled=false`, holding **150 ms** per stage (about 1.35 s).
  - The canvas then gets `opacity:0` (instant) and is removed after 250 ms, revealing the real `<img>`.
  - Trigger `inview`: IntersectionObserver with threshold .25 and rootMargin `0 0 -25% 0`. The `load`, `hover` and `click` triggers are also supported.

**Floating "flower" / "letter" / subscribe cards:**
- `tick += .022` per frame.
- `transform: translateY(sin(tick)·10px) rotateZ(sin(.6·tick)·1.5deg)`. That is a 4.8 s float period at 60 fps.
- The tilt versions add `rotateX` and `rotateY` lerped at .08 toward ±14° based on the pointer's offset from the scene centre (rotateX = −dy·14, rotateY = dx·14), inside `perspective:800px` with `transform-style:preserve-3d`, and reset on mouseleave.
- Used by: home `[data-flower-card]` (float only), purpose `#scene/#card`, insights `[data-subscribe-scene/card]`.

**Purpose particles** (`canvas[data-particles]`, 1eb68315.js:4-120):
- 20 particles per canvas, 60% #8827DD and 40% #F96D57, each drawn as a circle of **radius 1 px** (CSS px, dpr-scaled).
- Homes come from a jittered grid inset by 20 px (±30% of the cell). Each particle orbits: x = hx + sin(φx)·20, y = hy + cos(φy)·20.
- φ advances by `freq·0.35·3` per frame, with freq in [.004, .006]. That gives periods of about 17–25 s at 60 fps.
- Particles are rebuilt on resize. No cursor interaction.

**Events globe** (`.primora-globe-wrap canvas`, 9b9ead9e.js):
- **Points:** 2200 on a Fibonacci sphere, radius = .42 × min(w,h). Each point is 50/50 purple or orange, with a jitter factor `j` in [.85, 1.15]. The sphere spins slowly about y (`t·0.00006` rad/ms).
- **Moving light:** `Hx = cos(t·.00045)·.85`, `Hy = sin(t·.00018)·.35`, Hz chosen to make a unit vector.
- **Per point:**
  - Intensity = exp(−angle² / (2·.55²)) of the angle to the light.
  - Alpha = (.05 + depth·.22)·j + intensity·.75, where depth = (z+1)/2.
  - Square size = (1.4 + 2.4·intensity)·dpr.
  - Colour = lerp(base, highlight, intensity).
- **Cursor lens:** radius 120 px. Points are pushed outward by (1 − d/R)²·16 px and gain +.08 alpha. Cursor easing is .08 per frame.
- Respects reduced motion (time frozen). `dpr` is capped at 2.
- Markers are DOM `.ev-globe_item`s (2em squares, `box-shadow: 0 0 0 .5em #100e11`); a click toggles `.active`, which fades in the card (.6s).

**Image cycle** (events banner, c586e846.js plus the CSS):
- Every N seconds (`data-image-cycle="5"`), the item states rotate `active` → `previous` → `not-active`.
- The incoming item fades in over .4s. The outgoing item fades out .4s later, so there is never a dark frame.
- Runs only while in view.

**Email underline** (insights): the coral 1px line `scaleX` = measured text width ÷ input width, with a 60 ms linear transition.

**Nav:** sticky, top 0, z 999, bg #100e11. Its `transform .7s` transition implies a hide-on-scroll, but **no script sets a transform** in the downloaded files (possibly in the missing page bundles, though home has none).

---

## 8. Page bundles (page-specific Webflow IX3 registrations)

Each page loads the shared chunks plus one page entry bundle. Every bundle has the same shape:
1. It waits for `document.readyState === "complete"`.
2. It calls `Webflow.require("ix3").ready()`, then `getInstance().setFeatures({timelineGroups:false})`.
3. It runs `register([interactions],[timelines])`.
4. It fires a `__wf_ix3_ready` event and adds `html.w-mod-ix3` (this lifts the `visibility:hidden` FOUC guard).

### 8.1 Bundle → page map (from each page's `<script src>`)

| Bundle (site/) | Page(s) | Webpack chunks pulled | Extra modules | IX3 contents |
|---|---|---|---|---|
| `webflow.799941e4.d94de2de8c8f0f58.js` | home | 772, 328, **352 (Rive)** | rive (3657) | CTA ×2, `.h-text_p` char colour, `.h-ecosystem_item` fade (section 2.3) |
| `webflow.157f27ed.1aec6d7211358f3f.js` | framework | 772, 328, **352 (Rive)** | rive (3657) | CTA ×2 only |
| `webflow.6d3a7781.8ce3ca1d0da5a499.js` | purpose | 328 | – | CTA ×2 plus **`[pr-believe-heading]` char colour** |
| `webflow.3dd9912c.e4602185cc8389eb.js` | insights | 328 | **forms** (`define("forms")`, the reason for its 12 KB; subscribe form) | CTA ×2 only |
| `webflow.b7370b66.05231cc97303b0f4.js` | events **and** contact (shared) | 328 | – | CTA ×2 only |

### 8.2 Decoded interactions

Conventions: `ease:0` = `"none"` (linear). `tt`: 0 To, 1 From, 2 FromTo. The default duration when omitted is 0.5 s, and under scrub the whole timeline is stretched over the scroll range. `clamp:true` on every trigger.

**A. CTA background slide-ins: identical on all 6 pages** (ids `i-7459630e` / `i-55d57237`, component `cda407d4-…af460`)

| Interaction → timeline | Target | Scroll trigger | Tween |
|---|---|---|---|
| i-7459630e → t-0ce39251 / ta-a19958fb | `img.cta_bg.is-alt` (right; instance `…af465`) | start `top bottom`, end `bottom top`, **scrub .8**; enter play, other directions none | tt:1, duration .3, ease none: **opacity 0% → 100%, xPercent 100% → 0** |
| i-55d57237 → t-75e5fe67 / ta-4ad09b32 | `img.cta_bg` (left; instance `…af464`) | same | tt:2 (FromTo), duration .3, ease none: **opacity 0% → 100%, xPercent −100 → 0** |

- The two halves of the purple dotted CTA art slide in from their own side while fading in, scrubbed across the card's full pass through the viewport.
- On top of this, the inline JS (1.3) separately tweens the left `.cta_bg` from opacity 0 to 1 and yPercent 0 to −10 (scrub 1, end `top 30%`). The two overlap on opacity.
- Below 991px, `.cta_bg` is `display:none` and `.cta_mobile-bg` is shown instead, so these do nothing on mobile.

**B. Purpose-only: "It will become denser." read-along recolour** (`i-c7ecda1b`, scoped to page `69d4fdcedfe7a78845eab831` = purpose)

| Field | Value |
|---|---|
| Trigger target | `wf:attribute "[pr-believe-heading]"`: the single `div.pr-believe_head.h1` in `.section_pr-believe` (text "It will become denser.") |
| Scroll | start **`top 75%`**, end **`top center`**, **scrub .8**, clamp |
| Timeline | t-c70f6c36 / ta-a977fa85: `splitText:{type:"chars"}`, tt 0 (To) |
| Property | `color: [null → var(--neutral--1200)]`. It goes from the computed colour (`.pr-believe_head.h1` = neutral-900 **#706c72**) to **#efedf0** |
| Timing | no duration, so the default 0.5 s per char; `stagger.each: .05`; ease none |

- This is the same grammar as home's `.h-text_p` (i-6b6928c8).
- Home's version starts from #332f34 and uses the window `top 70%` → `bottom 70%`. Purpose uses `top 75%` → `top center`, i.e. a shorter, earlier window.
- Recipe: split into chars, then a linear colour To with each 0.05, scrub 0.8.

**C. Not present anywhere**
- **`purpose-hero-heading`:** no IX3 or JS targets this attribute. It sits on the same element as `data-hero-heading`, so the purpose hero is animated only by the inline blur-rise script (1.2). It is a dead hook.
- **Framework, insights, events and contact** have no page-specific IX3 beyond the CTA pair. All their other motion is the inline JS from section 1.

### 8.3 Rive mapping: confirmed

- None of the four new bundles contains Rive data or `.riv` URLs. The Rive files are referenced only in the HTML `data-rive-url` attributes.
- Only the **home** and **framework** bundles pull chunk 352 (the Rive module plus @rive-app/canvas 2.35.0). This confirms **no Rive on purpose, insights, events or contact**.
- The section-3 table therefore stands as complete and confirmed against the page markup:
  - home `.section_h-intro`: `#10_core_iterate_distribute` (1000×600)
  - framework `.section_f-hero`: `#1_we_help_it_scale` (488²)
  - framework `.section_f-feat` ×4: `#2_early_growth`, `#3_product_&_engagement`, `#4_c&s_positioning`, `#5_s&t_strategy` (400²)
  - framework `.section_f-chart`: `#6_after_structural_acceleration` (1070×405)
  - framework `.section_f-2feat` ×3: `#7_pre&post_framework`, `#8_ecosystem_capital`, `#9_participation_growth` (400²)
- The visual content of each file is still inferred from filenames; the .riv binaries were not downloaded.
