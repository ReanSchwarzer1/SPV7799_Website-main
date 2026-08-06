# Condition B — polish, aesthetics and game feel: phased plan

Planning document only. No implementation until phases are agreed.

---

## 0. Where we actually stand

Measured from the source, not assumed:

| Fact | Consequence for this plan |
|---|---|
| `WebGLRenderer({ antialias: true, alpha: true })`, pixel ratio capped at 2 | Transparent backbuffer complicates fog and post-processing compositing |
| Render path is a bare `renderer.render(scene, camera)` in one loop | Every effect below needs a composer; this is a single central change |
| Harness owns **all** lighting: one `HemisphereLight`, one `DirectionalLight` | Good news. All 12 scene files declare **zero** lights, so the rig upgrades in one place |
| `castShadow` / `receiveShadow` appear **nowhere** | Shadows are a from-scratch pass across 12 scenes, not a toggle |
| No audio anywhere: no `AudioListener`, no `PositionalAudio` | Audio is greenfield |
| Importmap maps **only** `"three"` → `./vendor/three.module.min.js` | **This is the blocker. See below.** |
| Labels are `MeshBasicMaterial`, `transparent: true`, `depthTest: false`, `renderOrder: 5` | They must be excluded from depth-based passes or SSAO will read garbage |

### The blocking constraint

**Every post-processing effect in the brief lives in `three/examples/jsm/`, and none of it is vendored.**

`EffectComposer`, `SSAOPass`, `UnrealBloomPass`, `LUTPass`, `ShaderPass`, `FXAAShader`
are addons. The vendored `three.module.min.js` is the core build and contains none of
them. The app is deliberately offline and self-contained, so they cannot be pulled from
a CDN at runtime.

Nothing in sections 1–3 of the brief can begin until the matching r160 addon subset is
vendored and the importmap is extended with a `"three/addons/"` entry. That work is
Phase 0 and it gates roughly two thirds of the pipeline.

### Two corrections to the brief

- **"Baked ambient occlusion workflow"** is not achievable here. Every scene is built
  from runtime primitives with no authored UVs and no DCC pipeline. There is nothing to
  bake to. SSAO is the correct route and the brief's fallback is the right call.
- The record-room contrast fix is `#111318` **on the cream card `#f4efe2`**. `#22303a`
  was the old, too-light body colour that was replaced. Worth stating so a later pass
  doesn't reintroduce it.

---

## 1. Phase overview

| Phase | Theme | Depends on | Can run in parallel? |
|---|---|---|---|
| **0** | Foundations, addons, perf harness, safety rails | — | **COMPLETE** (devlog 12) |
| **1** | Light, shadow, atmosphere | 0 | **COMPLETE** (devlog 13) |
| **2** | Materials and PBR | 1 | **MOSTLY DONE** (devlog 14) |
| **3** | Post-processing stack | 0, 1, 2 | — |
| **4** | Kinesthetics and game feel | 0 | Partly with 2–3 |
| **5** | Transitions and flow | 0, 4 | — |
| **6** | Audio and soundscapes | 0 (asset decision) | **Yes — independent of the render stack** |
| **7** | Integration, accessibility, repack | all | No |

Phase 6 touches none of the rendering code and can proceed alongside 1–5 once the asset
question is settled. It is placed last only because it is the easiest to defer.

---

## Phase 0 — Foundations  [COMPLETE]

Nothing visible ships in this phase. It exists so the rest does not collapse.

1. **Vendor the r160 addon subset.** Pull `EffectComposer`, `RenderPass`, `ShaderPass`,
   `SSAOPass`, `UnrealBloomPass`, `FXAAShader`, `CopyShader` and their transitive
   dependencies into `vendor/jsm/`, matching the exact three version already vendored.
   Extend the importmap:
   ```json
   { "imports": { "three": "./vendor/three.module.min.js",
                  "three/addons/": "./vendor/jsm/" } }
   ```
   Version mismatch between core and addons is the classic failure here, so the r160 pin
   is non-negotiable.

2. **Composer-ready render path.** Replace the single `renderer.render` with a composer
   behind a flag, defaulting to the current behaviour until Phase 3 turns it on. Resolve
   the `alpha: true` compositing question now: either give the scene an explicit
   background matching the page, or configure `RenderPass` clear alpha. Fog and every
   fullscreen pass depend on this being settled.

3. **Camera rig split.** `frameScene()` currently writes camera position directly. Split
   into a *fit* transform and an *offset* transform, composed each frame. Without this,
   screen shake (Phase 4) and eased sweeps (Phase 5) will be overwritten by the auto-fit
   on the next resize or scene change.

4. **Performance instrumentation and budget.** Add a frame-time counter readable over
   CDP, capture a per-scene baseline now, and set the budget: **60 fps at 1440p on the
   development machine, never below 30 fps on the weakest target machine**. Every later
   phase re-runs this and must stay inside it.

5. **Quality tiers.** `High / Medium / Low`, auto-detected with manual override. Low
   disables SSAO and bloom and drops shadow map size. A study session that stutters is
   worse than one that looks plain, and we cannot control the lab hardware.

6. **Regression harness.** Promote the throwaway CDP scripts into one repeatable runner:
   for each of the 15 registered scenes, build it, capture a screenshot, record frame
   time, and assert zero console errors. This becomes the gate for every phase.

7. **Audio strategy decision.** See "Decisions needed" below. Longest lead time, so it
   is raised first even though implementation is Phase 6.

**Exit criteria:** addons import cleanly offline; composer flag flips with no visual
change; baseline frame times recorded for all 15 scenes; regression runner green.

---

## Phase 1 — Light, shadow, atmosphere  [COMPLETE]

1. **Standardised light rig** in the harness: key, fill and rim, with per-scene intensity
   and colour overrides. Because no scene declares its own lights, this is one edit that
   reaches everything — and equally, one edit that can break everything, so it is
   screenshot-diffed scene by scene.
2. **Shadows.** `renderer.shadowMap.enabled`, `PCFSoftShadowMap`, tuned map size per
   quality tier. Then `castShadow` / `receiveShadow` across the 12 scene files:
   interactables cast, floors and benches receive. Contact shadows under the case file,
   the gavel, the ball on the hill and the chips are what sell physical presence.
3. **Shadow acne and peter-panning pass.** Bias and normal-bias tuning per scene. This
   always takes longer than expected on procedural geometry with thin boxes.
4. **`FogExp2`** for depth, tuned hardest in the reckoning's monument ring. Must be
   reconciled with the transparent backbuffer decision from Phase 0.
5. **Legibility re-check.** Labels, readouts and record cards must be re-verified after
   the rig changes. Legibility beats atmosphere every time — this is a study instrument
   before it is a game.

**Exit criteria:** all 15 scenes screenshot-reviewed; no label or readout regression;
inside frame budget on all tiers.

---

## Phase 2 — Materials and PBR  [courtroom + antitrust done; consistency sweep outstanding]

No external texture assets exist and none should be introduced if avoidable, so maps are
**generated procedurally on canvas** at load, the same technique the labels already use.

1. **Case file and bench (module 2).** Keep the `emissiveMap` at 0.5 that fixed the grey
   paper. Add a high-frequency procedural normal map plus a roughness map for paper
   grain. Bench moves to `MeshPhysicalMaterial` with a clearcoat so the off-axis key
   catches varnish.
2. **Antitrust hill (module 8).** Matte topographic or polished marble surface, high
   metalness low roughness ball. This scene is the strongest candidate for the "premium
   diorama" look because it is a single hero object on a plinth.
3. **Consistency audit.** Once two scenes have real materials, the other ten will look
   flat by comparison. Budget a pass to lift the rest to a common standard rather than
   leaving a visible quality cliff between modules.

**Exit criteria:** no scene looks materially cheaper than its neighbours; memory and
frame budget held.

---

## Phase 3 — Post-processing

Order matters: `RenderPass → SSAO → selective bloom → colour grading → FXAA → output`.

1. **SSAO**, with labels and record cards excluded via layers. They are unlit,
   depth-test-disabled billboards and will otherwise poison the AO buffer.
2. **Selective bloom on the molecule.** Honest note: selective bloom in three.js needs a
   two-pass layer technique where non-bloom objects are rendered black, and it interacts
   badly with transparency. With `alpha: true` and transparent labels in every scene this
   is the highest-risk item in the plan. Contingency: fall back to an emissive-only glow
   on the molecule with no fullscreen bloom, which achieves most of the effect for a
   fraction of the risk.
3. **Colour grading driven by game state.** Rather than shipping LUT files, use a grading
   `ShaderPass` with lift/gamma/gain plus temperature, and drive it from the existing
   state in `game.js`: cold and corporate when patents are upheld and the gate is bolted,
   warmer as access rises. This avoids an asset dependency and, more importantly, ties the
   grade to the same model both conditions share.
4. **Perf gate.** SSAO plus bloom at device pixel ratio 2 is the single most likely thing
   to blow the budget. If it does, SSAO drops to half-resolution, then out entirely on
   Medium tier.

**Exit criteria:** frame budget held on High and Medium; Low tier bypasses the composer
entirely and still looks coherent.

---

## Phase 4 — Kinesthetics and game feel

The one phase that most directly serves the paper's embodied-interaction argument, and
the cheapest in risk. Could be pulled earlier if the schedule tightens.

1. **Gavel strike:** decaying camera shake over ~0.15 s via the Phase 0 offset layer,
   plus a small particle dust burst at the impact point.
2. **Weighted drags** on the supply and demand beams, the market gate lever and the ward
   wheel: interpolate between the pointer and the object so the object trails the cursor.
   The existing `rotateTowards` magnetic assist stays; this adds mass, not difficulty.
3. **Fresnel rim light** on anything pickable or draggable, via a small custom shader.
   Replaces outline-style affordances and reads as lighting rather than as UI.
4. **Meter catch-up.** Access and Innovation tick to their new value rather than snapping,
   with a colour flash: red on loss, gold on gain. This is HUD work in `game.js` and
   `game.css`, independent of the 3D stack.
5. **Record-card hover:** Z-lift plus expanding drop shadow, so the cards read as objects
   on a desk.

**Accessibility gate:** shake and any rapid flash must respect a reduced-motion setting.
Participants sit through this for half an hour and some will be motion-sensitive.

---

## Phase 5 — Transitions and flow

1. Cubic Bezier easing on all auto-fit camera moves; `ease-in-out-cubic` sweeps between
   modules and record rooms instead of hard cuts.
2. Entry and exit treatments that preserve spatial continuity, so the term feels like one
   place rather than fifteen loading screens.
3. **Re-measure total run time.** Fifteen scenes with slow sweeps adds up. The paper's
   25–30 minute box is already flagged as provisional and pilot-set; this phase changes
   the number, so the new figure must go back into the methods section.

---

## Phase 6 — Audio

Independent of the render stack. Can start as soon as the asset question is answered.

1. **Plumbing.** `AudioListener` on the harness camera, `PositionalAudio` on emitting
   objects, and an autoplay unlock on the first user gesture — Electron will otherwise
   silently refuse to start a context.
2. **Foley** per the brief: bench slide and dispenser ca-chunk (module 1), gavel thud and
   paper rustle (module 2), switch clank with a jarring welded-shut variant when the Bayer
   ruling blocks it (module 7).
3. **Dynamic ambience.** Market floor room tone that crossfades into a busier trading
   floor as competitors are admitted. Reckoning: sub-bass drone and wind over stone, with
   a harmonic chime per lit stratum.
4. **Mix and controls.** Master bus, per-category levels, and a **mute that is reachable
   in one action and persists**. Sessions may run in shared rooms and some participants
   will need it off; this is a requirement, not a nicety.

---

## Phase 7 — Integration, accessibility, repack

1. Full playthrough regression on **both** opposed branches (licence granted vs upheld),
   since the consequence chains change what the later scenes contain.
2. Quality-tier validation on the weakest machine we can find.
3. **Accessibility sweep**, including one item worth calling out on its own:

   > The molecule turns **red under monopoly and green under generic**. That is the exact
   > pair that red-green colour vision deficiency collapses, affecting roughly 8% of men.
   > Bloom in Phase 3 makes colour even more load-bearing. A second, non-colour cue
   > should carry the same information. This matters more than usual here because the
   > study measures comprehension: no participant's score should depend on colour
   > discrimination.

4. Rebuild `dist`, refresh `READ ME FIRST.txt`, update `CONDITION-B-DEVLOG.md`, ship to
   co-authors.

---

## Decisions needed before Phase 0 closes

**1. Audio assets.** DECIDED: **hybrid**. Procedural synthesis for impacts, meters and
chimes; sourced CC0 recordings only for the market floor and reckoning ambiences, whose
licences must be documented for a published artifact.

Three routes were considered:

| Route | Pros | Cons |
|---|---|---|
| **Procedural (WebAudio synthesis)** | No licensing, tiny footprint, fully offline, deterministic, I can build it end to end | Less "real" than recorded foley |
| **Sourced CC0 foley** | Authentic texture | Someone must find, audit licences and download; adds MBs; licence provenance must be documented for a published artifact |
| **Hybrid** — **CHOSEN** | Procedural for impacts, meters and chimes; sourced only for the two ambiences that genuinely need recordings | Small sourcing task remains |

**2. Selective bloom risk.** Accept the two-pass layer approach with a fallback, or go
straight to the cheaper emissive-glow alternative?

**3. Performance floor.** What is the weakest machine a session will actually run on? The
quality tiers should be calibrated to that, not guessed.

---

## Risks, stated plainly

- **Addon vendoring is the critical path.** If the r160 addon subset does not import
  cleanly offline, sections 1–3 of the brief do not happen in their current form.
- **Selective bloom with `alpha: true` and transparent labels** is the most likely
  individual item to be cut.
- **Frame budget** is the constraint most likely to force scope reduction overall.
- **Legibility regression** is the failure mode that would actually damage the study.
  Atmosphere, fog, grading and bloom all work against text contrast. Every phase re-checks
  readouts, and legibility wins any conflict.
- **The aesthetic gap between conditions widens.** §4.8 already names novelty as a
  confound and lists desktop-app-versus-web-page and 3D-versus-2D as inseparable from the
  manipulation. A heavy polish pass makes Condition B markedly more attractive than a
  plain web document. Condition A is frozen, so the mitigation is documentation, not
  code: the limitation section should say that B received a dedicated audiovisual pass
  and A did not. Worth a sentence now rather than a reviewer finding it later.

---

## If time runs short

Cut in this order, from first to go:

1. Selective bloom (Phase 3) → emissive glow fallback
2. SSAO (Phase 3) → shadows alone already carry most of the grounding
3. Sourced ambiences (Phase 6) → procedural only
4. Material consistency sweep across the other ten scenes (Phase 2)

Protect, in this order:

1. Legibility and the accessibility items
2. Shadows and the light rig — best visual return per unit of risk
3. Meter catch-up and gavel feedback — cheapest, most felt
4. Mute and reduced-motion controls
