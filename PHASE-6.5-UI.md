# Phase 6.5 — UI, typography and readability

Everything in this phase is diegetic UI: the plaques, readouts, record cards and the
hint bubble. No geometry, no lighting, no materials. Condition A is untouched throughout.

---

## 1. Why it looks generic

The seven problems reported are not seven problems. They are four root causes, and each
one is measurable rather than a matter of taste.

### Cause A — text size is an accident, not a decision

`labelTexture()` paints a **fixed 512 × 256 canvas**. `makeLabel(x, y, z, l, w, h)` then
maps that canvas onto a plane of whatever size the scene passed. So the on-screen size of
a word is `canvas px ÷ plane width` — which nobody chose.

The plane widths actually in use, all carrying the same 512 px canvas:

```
2.15  2.24  2.41  2.75  2.82  3.00  3.01  3.17  3.20  3.28  3.40  3.50  4.40  5.63
```

The market floor uses the two smallest (2.15 and 2.41). Every other module sits around
3.0–3.4. That is a **~30 % smaller cap height** on the market floor for identical text,
which is exactly the "text is too small and hence unreadable" report, and it was never a
decision — it is what fell out of the plane sizes.

### Cause B — glyphs are stretched wherever the plane aspect is not 2:1

The canvas is 2.00:1. A plane of a different aspect scales the glyphs non-uniformly.
Most labels are 2:1 and fine. These are not:

| Label | Plane | Aspect | Effect |
|---|---|---|---|
| `PATIENTS SERVED AT THE CLEARING PRICE` (equilibrium) | 5.63 × 0.97 | **5.80:1** | glyphs squashed to ~34 % width |
| record-room header | 4.40 × 2.00 | 2.20:1 | ~9 % narrow |
| others | 3.50 × 1.10 | 3.18:1 | ~37 % narrow |
| others | 3.28 × 1.17 | 2.80:1 | ~29 % narrow |

The equilibrium bar is the one flagged as "weirdly stretched out". It is not an illusion
and it is not a size problem — it is a **5.8:1 plane carrying a 2:1 image**.

### Cause C — there is no UI system, there are nineteen painters

Distinct canvas-text painters in the codebase:

- `labelTexture` (harness)
- `signTexture` (molecule)
- `plaqueTex` (oecd)
- `cellTex` (race)
- `capTex`, `stoneTex`, `verdictTex` (reckoning)
- `headerTexture` × 4, `cardTexture` × 4, `plaqueTexture` × 4 (dispatch — **four
  near-identical copies, one per record room**)

Nineteen painters, two font families (`system-ui` in 42 places, `Georgia` in 30), no
shared type scale, padding, border weight or colour rule. That is why the molecule
plaques, the market readouts and the record cards read as three different products.

`box: true` is opt-in and half the game never opts in:

```
wage 13 · globe 10 · antitrust 8 · race 8 · ward 7 · oecd 5 · equilibrium 5
market 0 · molecule 0 · courtroom 0 · dispatch 0 · reckoning 0
```

So the market floor's readouts are unframed floating text while every module either side
of it is framed. That is the "different from all the other modules" report.

### Cause D — nothing prevents a label covering something

`resolveLabelOverlap()` pushes labels apart in screen space, ten relaxation passes, and it
works. But it only knows about **registered labels**. It does not know about:

1. **Plaques and signs built as meshes directly** — `oecd` and `dispatch` create their
   plaques with `new THREE.Mesh(new THREE.PlaneGeometry(...))` rather than `makeLabel`, so
   they are not in the `labels` array and never participate in separation. This is exactly
   why **LOCK IN sits behind UNITED STATES**.
2. **Interactive objects.** Nothing stops a label landing on the thing the player has to
   drag — `DEMAND`/`SUPPLY` over the beams, `THE PATENT`/`COMMIT` over the slot.

One correction to the report, because it changes the fix: those labels are **not
pickable**, so the drag still works — the raycast passes straight through them. The
problem is that the player cannot see what they are dragging, not that the input is
blocked. The exception is the OECD `LOCK IN` plaque and the dispatch cards, which *are*
in `ctx.pickables` — those are genuinely both a label and a click target.

---

## 2. Reported issue → cause → fix

| # | Reported | Cause | Fixed in |
|---|---|---|---|
| 1 | Text/UI looks generic | C | 6.5a |
| 2 | Hint bubble should be at the top | — (CSS placement) | 6.5b |
| 3 | Record rooms look bad | C | 6.5d |
| 4 | Market floor UI differs, text too small | A + C | 6.5a |
| 5 | `DEMAND`/`SUPPLY` cover the beams | D | 6.5c |
| 6 | "Patients served" is stretched | B | 6.5a |
| 7 | `THE PATENT`/`COMMIT` cover the slot | D | 6.5c |
| 8 | `LOCK IN` hidden behind `UNITED STATES` | D | 6.5c |

---

## 3. The work

### 6.5a — one type system  *(the big one)*

Replace the nineteen painters with a single `ctx.plaque(spec)` in the harness.

**Text is sized in world units, not canvas pixels.** The painter takes the plane size and
derives the canvas from it at a fixed resolution-per-world-unit, so:

- the same style is the same physical size in every module, whatever the plane is;
- **the canvas aspect always equals the plane aspect**, so nothing can stretch again.

A type scale, named rather than numeric, so call sites stop passing raw pixel sizes:

| Role | Use |
|---|---|
| `title` | plaque heading — `PRIVATE PROFIT` |
| `readout` | the number — `15,072` |
| `caption` | the qualifier — `drag the lever` |
| `action` | button-like — `LOCK IN`, `PROCEED TO MODULE 3` |
| `body` | prose, record rooms only |

One rule for the two fonts, applied consistently instead of by accident: **Georgia for
anything that is meant to read as a document** (case files, record cards, the reckoning),
**system-ui for anything that is an instrument reading** (plaques, readouts, meters).

Framing becomes the default rather than opt-in, with a single frame treatment: plate, hair
rule, accent bar keyed to the module's colour. `box: false` stays available for the few
places a frame genuinely hurts.

**Scope note:** this touches every scene file. It is a wide, shallow change — call sites
swap `makeLabel(..., 2.15, 1.07)` for `ctx.plaque({...})`. It is also the change most
likely to shift something unintentionally, so it is screenshot-diffed scene by scene and
done before anything else.

### 6.5b — the hint bubble moves to the top

`.il-hint` is `position: absolute; bottom: 18px` inside `.il-stage`. It moves to the top
of the stage.

One thing to resolve while doing it: the brief panel (`.il-brief`) is already pinned
top-left of the stage. The hint is centred, so at narrow widths they would meet. The hint
gets a max-width that respects the brief's column, and on narrow viewports the brief
collapses first — it already has a collapse control.

The breathing and flash animations carry over unchanged, including the reduced-motion
suppression.

### 6.5c — labels stop covering things

Two additions to the existing separation solver, which already works and stays:

1. **Register everything.** The oecd and dispatch plaques become real registered labels
   so they take part in separation. This alone fixes `LOCK IN` behind `UNITED STATES`.
2. **Keep-out volumes.** A scene marks an object as something a label must not cover
   (`userData.keepClear = true`, or automatically for anything in `ctx.pickables`). The
   solver projects those to screen rects and pushes labels off them, using the same
   relaxation it already uses for label-vs-label.

Per-scene placement fixes where the solver is the wrong tool — a label that has nowhere to
go should be moved by hand rather than shoved somewhere worse:

- **equilibrium:** `DEMAND`/`SUPPLY` move off the beams to the outer margins; the beams
  keep their handles as the grab affordance.
- **race:** `THE PATENT` and `COMMIT` move clear of the slot throat.
- **equilibrium:** the patients bar is rebuilt at a 2:1 aspect and enlarged, which it can
  afford now that the hint bubble has vacated the bottom of the screen.

### 6.5d — record rooms

The four record rooms are the weakest screens in the game and they are also the most
duplicated code: twelve painter functions for four rooms that differ only in content.

- Collapse to **one** room builder parameterised by content.
- Real typographic hierarchy on the header panel: masthead, rule, standfirst, body — at a
  canvas resolution matched to its plane, so the prose is crisp rather than resampled.
- Cards get a document treatment: case number as an eyebrow, title, drug and indication as
  metadata, the ruling as a distinct block with a status colour, and a footer affordance.
  Consistent margins, one accent rule.
- The `PROCEED TO MODULE n` plaque becomes an `action` plaque, visually distinct from the
  readouts so it reads as the button it is.

### 6.5e — cohesion pass and verification

- Screenshot every scene against the pre-phase baseline, one at a time.
- Check the smallest text in every module at 1080p and at the study machine's resolution.
- Confirm nothing occludes an interactive object in the resting frame of any scene.
- Re-run `tools/verify-scenes.js` and `tools/verify-audio.js`.

---

## 4. Guardrails

Given how the last two phases went, stated explicitly:

- **No geometry, lighting, material or camera changes.** If a scene's props change, that
  is a bug in this phase.
- **Legibility outranks atmosphere** — the standing rule. Labels keep `depthTest: false`,
  `fog: false` and `toneMapped: false`. Nothing here goes near the composer.
- **Frame budget unchanged.** Bigger canvases cost memory at build, not per frame; the
  existing texture cache still applies.
- Every sub-phase is verified before the next starts, and each is revertible on its own.

---

## 5. Decisions I need from you

1. **Font pairing.** The proposal is Georgia for documents, system-ui for instruments.
   The alternative is one family everywhere, which is more uniform but loses the "this is a
   legal document" feel the case files currently have. My recommendation is the pairing.
2. **Frame everything?** Making `box` the default means the market floor's readouts gain
   frames, matching everywhere else. It also means slightly more visual weight on screen.
   I think it is right, but it is the most visible single change in the phase.
3. **Record room layout.** Currently a header panel above a 3 × 2 card grid between two
   meters. Do you want the same arrangement rebuilt properly, or should the layout itself
   change? I would keep the arrangement — it works — and fix the execution.

---

## 6. Exit criteria

- One painter. Nineteen become one, plus the deliberate content textures (case pages,
  banknote) which are not UI.
- Every label's canvas aspect equals its plane aspect. No stretched glyphs anywhere.
- The same style is the same physical size in all fifteen scenes; the market floor is no
  longer an outlier.
- No label overlaps an interactive object in any scene's resting frame.
- The hint bubble is at the top of the stage in every module.
- All 15 scenes build with zero console errors, inside frame budget.
- Condition A shows no diff.
