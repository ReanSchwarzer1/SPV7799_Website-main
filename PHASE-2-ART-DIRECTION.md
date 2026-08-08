# Phase 2, extended — making it look real

Planning document. Nothing here is implemented yet.

The first Phase 2 pass added surface maps to two scenes and an environment map to all of
them. That was not enough, and in one respect it made things worse. This document is the
honest diagnosis and the plan to fix it properly.

---

## 1. Why it currently reads as plastic

Measured, not guessed. Across the twelve scene files:

| Primitive | Count |
|---|---|
| `BoxGeometry` | 55 |
| `PlaneGeometry` | 27 |
| `CylinderGeometry` | 21 |
| `SphereGeometry` | 13 |
| `TorusGeometry` | 7 |
| `CapsuleGeometry` | 4 |
| `TubeGeometry`, `ConeGeometry` | 4 |
| **Total** | **~132 raw primitives** |

Chamfered or bevelled geometry anywhere: **zero**. Transmissive material anywhere:
**zero**.

Five things are causing the look, roughly in order of how much they matter.

**1. Perfectly sharp 90 degree edges.** This is the single biggest tell and it accounts
for 55 boxes plus the ends of every cylinder. No manufactured object has a truly sharp
edge; every real edge carries a small chamfer or radius that catches a bright specular
line. Without that line the eye reads "computer graphics" instantly, no matter how good
the material is. Fixing this alone will do more than everything else on this list.

**2. Low tessellation on curves.** Segment counts in use run from 8 to 48. The gavel
handle is a 20-sided cylinder, one cylinder in the molecule scene is 8-sided. Faceting is
visible on the silhouette and, worse, in the specular highlight, which breaks into bands.

**3. Uniform surface response.** Almost every material is `MeshStandardMaterial` with a
single roughness value and no maps. Wood, painted steel, paper, stone and rubber all
respond to light identically, so nothing reads as a specific substance. Only the
courtroom bench and the antitrust hill currently have any maps at all.

**4. No contact darkening.** Objects meeting a surface have a hard boundary with no
occlusion in the crevice. Shadows from Phase 1 helped the large scale; the small scale
still looks pasted on.

**5. Flat, untextured albedo.** Solid colours with no variation. Real surfaces have
dirt, wear, colour drift and edge wear. Everything is showroom-clean.

---

## 2. Lighting: I over-lit it, and that needs undoing first

The environment map was added because clearcoat and metalness had nothing to reflect,
which was a correct diagnosis. Setting it as a global `scene.environment` at 0.38 on top
of hemi 0.72, key 1.0 and rim 0.34 was not. These scenes were art-directed low-key —
dark navy, one strong key, deep falloff — and the environment flooded them into an even,
flat, overcast look. The verdict that it looked better before is right.

The fix is not simply a lower number.

**2.1 Separate reflection from fill.** In three.js `scene.environment` contributes both
diffuse irradiance and specular reflection. Diffuse is the part that flattens everything.
The correct arrangement is a low global environment, with `material.envMapIntensity`
raised only on the materials that should reflect: metal, glass, polished stone, varnish.
Wood and paper want almost none. Reflections come back, the flood goes away.

**2.2 Add tone mapping.** The renderer currently uses `NoToneMapping`, so anything above
1.0 clips flat to white. That is why the case file blew out and had to be made unlit.
`ACESFilmicToneMapping` (or AgX) with an exposure control rolls highlights off instead of
clipping, which is what makes a bright surface still read as paper rather than as a hole.
This changes every scene and must be reviewed scene by scene, but it is the correct base
for any PBR work.

**2.3 Restore contrast.** Lower the hemisphere fill, keep one dominant key, let the
shadow side actually go dark. Drama comes from range, not from brightness. The reckoning
and the record rooms in particular should be darker than they are now.

**2.4 Per-scene exposure.** A `def.exposure` override so the bench scene and the
monument ring do not have to share one setting.

---

## 3. Geometry: the core of it

There are two honest routes and they are not exclusive.

### Route A — real 3D models (glTF)

**What it needs:** `GLTFLoader` and `DRACOLoader` vendored (both present in the installed
three, so this is straightforward); models authored or sourced; licences documented for a
published artifact; file size budget; and someone to make or choose them.

**Where it genuinely wins:** objects whose form carries meaning and cannot be described by
a lathe or an extrusion. A courtroom gavel is not one of those. A human hand, a detailed
laboratory dispenser, a hospital bed, a shipping container — those are.

**Cost:** this is the only item in the whole pipeline that needs an asset pipeline and a
person to feed it. If we go here, the decision needed is who sources the models and under
what licence, because CC0 model quality varies wildly and a bad model looks worse than a
good primitive.

### Route B — procedural, but properly constructed

Most of what looks bad is not "primitives" as such. It is *unconstructed* primitives. A
turned wooden gavel really is a lathe profile. A bench really is a chamfered box. Built
properly, procedural geometry can look genuinely good and stays self-contained, licence
free and tiny.

Techniques, all available in the installed three:

| Tool | Use |
|---|---|
| `RoundedBoxGeometry` | Direct replacement for most of the 55 boxes. Chamfered edges catch a highlight line. Biggest single win available. |
| `LatheGeometry` | Anything turned: gavel head and handle, the sound block, pedestals, vials, the ward wheel, columns. Profiles are a handful of points. |
| `ExtrudeGeometry` with `bevelEnabled` | Plaques, panels, plates, the ruling papers, signage. Gives a real edge for free. |
| `BufferGeometryUtils.mergeVertices` | Weld duplicated vertices so smooth shading actually works across a surface. |
| `TessellateModifier` | Subdivide where a normal map needs geometry to sit on. |
| Higher segment counts | Cheap. These scenes are nowhere near a geometry budget. |

**Recommendation:** Route B as the backbone, Route A for at most two or three hero props
if models can be sourced cleanly. Route B can be started immediately with no external
dependency; Route A blocks on sourcing. Doing B first also means that if a model never
arrives, nothing is left looking unfinished.

---

## 4. Material families

Stop tuning materials per object. Define a small set of named materials in the harness and
have every scene draw from it, so a bench in one module and a plinth in another are made
of the same wood.

| Family | Character | Notes |
|---|---|---|
| Varnished hardwood | mid roughness, clearcoat, grain normal + roughness | bench, plinths, panelling |
| Raw timber | high roughness, stronger grain, no clearcoat | crates, floor |
| Paper and card | very high roughness, fine tooth, no reflection | rulings, plaques |
| Polished stone | low-mid roughness, veining, light clearcoat, moderate env | hill, monument, floors |
| Machined steel | metalness 1, roughness 0.25–0.4, brushed anisotropy if affordable | levers, gate, switches |
| Brass and bronze | metalness 1, warm tint, higher roughness, edge wear | gavel band, fittings |
| Painted metal | metalness 0, low roughness, clearcoat, chips at edges | firm markers, machinery |
| Glass | see below | vials, sample domes, tubes, display cases |
| Rubber and gasket | roughness 0.9, metalness 0, slight sheen | feet, grips, seals |

Every family gets its own `envMapIntensity`, which is how section 2.1 gets applied in
practice.

---

## 5. Glass — there is none today

`transmission` appears nowhere in the codebase. Anything that ought to read as glass is
currently opaque plastic: the sample domes on the comparison bench, the pill tubes, the
vials in the ward, any display case.

Real glass needs `MeshPhysicalMaterial` with `transmission: 1`, a real `thickness`,
`ior` around 1.5, low roughness, and `envMapIntensity` well above the scene default so it
has something to refract. It renders through a separate transmission pass, so it is the
one material here with a genuine performance cost and it must be measured on the low tier
before it is used widely.

Where it should go, in priority order: the two sealed sample domes in module 1 (they are
the hero objects of the opening scene), the pill tubes in the dispenser, then the ward
vials.

---

## 6. The gavel strike

Called out specifically, and correctly. Here is what it does now:

```js
gavel.rotation.z = 0.25;                                   // set once at build, never again
gavel.position.x += (targetX - gavel.position.x) * dt * 8; // slides sideways to the paper
gavel.position.y  = hoverY + Math.sin(bob * 2.2) * 0.06;   // bobs in the air
gavel.position.y  = hoverY - (hoverY - strikeY) * f * f;   // drops straight down
```

It floats sideways through the air and drops vertically. It never rotates. That is why it
reads as an object being moved rather than a tool being swung.

### What it should be

A gavel pivots at the hand. All of the motion is rotation about that point, and the head
travels on an arc.

**Rebuild:** a `gavelPivot` group positioned where a hand would hold it, with the handle
and head as children offset along the handle so the butt sits at the pivot origin. The
pivot is placed above and slightly behind the target, and it is the pivot that moves
between targets, not the gavel.

**Strike, as five phases rather than one drop:**

1. **Settle** — the pivot eases to the chosen target. The head trails slightly behind the
   handle, because it has mass.
2. **Anticipation** — a short rotation *backwards*, lifting the head up and away. This is
   the beat that sells weight, and it is what is missing most.
3. **Swing** — rotation forward, accelerating. Eased so the head is fastest just before
   contact, not linear.
4. **Impact** — a hard stop the frame the head face meets the surface. The face should be
   flat to the surface at contact, which means the rotation has to be set up so the arc
   lands square rather than glancing. Everything else fires here: the camera kick from
   `ctx.shake()`, the dust burst, the sound, the paper flex.
5. **Recoil and settle** — a small bounce back, over-damped, returning to rest. Two or
   three degrees, quick.

**Aiming:** selecting the other ruling paper should swing the pivot across on an arc with
the head trailing, not slide it linearly.

**What it strikes — an open question.** A real gavel strikes the sound block, not the
document. The bench already has a block on it that is currently decorative. Striking the
block while the chosen ruling glows would be more authentic and would keep the papers
clean; striking the paper is more literal about what is being decided. This is a design
call, not a technical one, and it is worth deciding before the animation is built.

---

## 7. Per-module inventory

What each scene needs, beyond the global lighting and material work.

| Module | Chief offenders | Work |
|---|---|---|
| 1 molecule | sample domes, dispenser, tubes, bench | glass domes and tubes, lathed dispenser, chamfered bench, higher-poly atoms with proper smooth normals |
| 2 courtroom | gavel, block, bench, papers | gavel rebuilt as a lathe with a brass band, animated per section 6; lathed sound block; chamfered bench; bevelled papers |
| 3 market floor | gate, floor, firm markers | heavy machined gate with real fittings; painted-metal firm markers with edge wear |
| 4 clearing house | beams, graph frame | chamfer everything; beams get machined ends and a mounting rail |
| 5 ward | wheel, budget dial | lathed wheel with a proper rim and spokes; glass vials |
| 6 globe | globe, routes, markers | the globe is 48x32 and reads acceptably; routes and markers need thickness and material separation |
| 7 wage floor | tower of working days, switch | the tower is the hero object and is currently a stack of plain boxes; needs chamfers, wear and material variation; a real machined switch |
| 8 antitrust | hill, ball, firms | hill has stone maps already but is thin segmented boxes; rebuild as a continuous lathed or extruded form; ball is fine once the environment is corrected |
| 9 patent race | chips, matrix | chips are the most obviously plastic objects in the build; bevelled edges, a milled rim, weight |
| 10 OECD hall | pedestals, towers | lathed pedestals; towers chamfered with a brushed finish |
| record rooms x4 | cards, meters | intentionally flat, leave alone; only the meter housings need chamfering |
| reckoning | monument column, stones, ring | strongest candidate for stone materials and the darkest grade; the column strata should read as cut stone |

---

## 8. Sequencing

Sub-phases, each independently verifiable.

- **2a — Lighting correction. [DONE — devlog 15]** Tone mapping, exposure, environment split into reflection
  versus fill, per-scene overrides, contrast restored. Nothing else changes. Review all 15
  scenes against the pre-environment screenshots and confirm the low-key look is back.
- **2b — Edges and tessellation. [DONE — devlog 16]** `RoundedBoxGeometry` across the box population, segment
  counts raised, `mergeVertices` for smooth shading. No material change. This is the
  single largest visual return in the whole document.
- **2c — Material library.** The families from section 4 defined centrally and adopted
  scene by scene, with per-family environment intensity.
- **2d — Hero objects.** The gavel rebuilt and animated; the sample domes and tubes in
  glass; the wage tower; the patent race chips. Optionally glTF here if models exist.
- **2e — Wear and dirt.** Edge wear, grime in crevices, colour drift. Small, and the thing
  that takes it from clean to real.

---

## 9. Performance

Current headroom is large: all 15 scenes sit at the 120 Hz vsync interval with p95 at
8.4 ms and no dropped frames. Geometry is not the constraint here and higher tessellation
is affordable.

Two things do need measuring: **transmission**, which renders through a separate pass, and
whatever screen-space ambient occlusion arrives in Phase 3. Both go behind the quality
tiers. The rule stays as it was: never below 30 fps on the weakest target machine.

---

## 10. How we will know it worked

Run `tools/verify-scenes.js` before and after each sub-phase and compare screenshots, plus
this checklist per scene:

- Can you see a highlight running along the edges of solid objects?
- Does any silhouette show faceting?
- Do two different substances in the same shot respond to light differently?
- Is there darkening where objects meet?
- Is there a dark side, or is everything evenly lit?
- Does the brightest surface still read as a material rather than as white?
- Is every piece of text still fully legible? *(this one outranks all the others)*

---

## 11. Decisions needed

1. ~~Real models or not.~~ **DECIDED: hero glTF models for the objects the player sees most — the gavel and the bench. Procedural for everything else.**
   Route B starts immediately either way, so this is not blocking, but it has a long lead
   time if the answer is yes.
2. ~~What the gavel strikes.~~ **DECIDED: the ruling paper.**
3. ~~How dark is too dark.~~ **DECIDED:  courtroom is the reference. Applied in 2a.** Section 2 pushes contrast back up and the shadow side down.
   Worth agreeing a reference: the pre-environment courtroom screenshot in
   `tools/verify-out-p1/` is a reasonable starting point for the mood.
