/* ============================================================
   interlude-courtroom.js — 3D courtroom for the Legal Labyrinth
   (module 2 of the artifact; Condition B embodied layer)

   The bench: a table, the two rulings as physical case papers,
   and a gavel. Choose a paper (mouse hover/click, or arrow keys)
   and strike (click, or Enter/Space).

   Flow: the game director opens this scene automatically after
   module 1's objective; the player rules on ALL SIX cases here,
   one after another, without returning to the page in between.
   Each strike calls the page's existing makeRuling(), so rulings
   drive the same market state and Access/Innovation scoring as
   the 2D buttons; "Next case" advances the underlying section
   via nextCase() and redresses the bench for the new case.

   Primitives only for now. Every color/dimension lives in the
   `assets` config so textures, materials, shaders and animation
   clips can replace them per item without touching interaction
   logic. Paper labels are CanvasTextures generated at runtime.
   ============================================================ */

(function () {
  "use strict";

  function whenReady(fn) {
    if (window.Interludes) return fn();
    var tries = 0;
    var t = setInterval(function () {
      if (window.Interludes) { clearInterval(t); fn(); }
      else if (++tries > 100) { clearInterval(t); console.warn("[courtroom] Interludes never appeared"); }
    }, 30);
  }

  function readCase() {
    var g = function (id) { var e = document.getElementById(id); return e ? e.textContent.trim() : ""; };
    // the section renders the claim wrapped in quotes and prefixes the context
    // with "Context:"; strip both so the brief reads cleanly in the scene
    var claim = g("case-claim").replace(/^[“"']+/, "").replace(/[”"']+$/, "").trim();
    var context = g("case-context").replace(/^Context:\s*/i, "").trim();
    var num = g("case-number"), total = g("total-cases");
    return {
      title: g("case-title") || "Rule on the case",
      drug: g("case-drug") || "Legal Labyrinth",
      rejectLabel: g("btn-reject") || "Reject / Intervene",
      claim: claim,
      context: context,
      label: num ? ("Case file " + num + (total ? " / " + total : "")) : "Case brief"
    };
  }

  function caseNumber() {
    var e = document.getElementById("case-number");
    var n = e ? parseInt(String(e.textContent).replace(/\D/g, ""), 10) : NaN;
    return isNaN(n) ? 0 : n;
  }

  function allCasesRuled() {
    var card = document.getElementById("goal-card-1");
    return !!(card && card.classList.contains("done"));
  }

  whenReady(function () {

    window.Interludes.register("courtroom", {
      kicker: "The bench",
      title: "Rule on the case",           // set per case via params/setTitle
      step: "Legal Labyrinth",
      instructions: "Choose a ruling paper with the mouse or arrow keys, then click or press Enter to strike the gavel.",

      // ---- swappable asset config (colors now; textures/shaders later) ----
      assets: {
        table:   { w: 7.0, h: 0.35, d: 3.8, color: 0x6b4a2f },
        block:   { r: 0.34, h: 0.14, color: 0x54371f },
        paper:   { w: 1.9, t: 0.05, d: 2.5, color: 0xf5f0e6, ink: 0x22222a,
                   grantHeading: "GRANT MONOPOLY", selectGlow: 0x4f86c6 },
        gavel:   { handleR: 0.055, handleL: 1.15, headR: 0.17, headL: 0.52,
                   color: 0x8a5a33, hoverY: 1.35, strikeY: 0.42 },
        // the camera is auto-fitted to the bench so nothing is ever cut off;
        // elevation sets the viewing angle, margin leaves breathing room
        camera:  { elevationDeg: 34, margin: 1.12, lookAt: [0, 0.35, 0] }
      },

      build: function (ctx) {
        var THREE = ctx.THREE, scene = ctx.scene, A = ctx.assets;
        var INSTR = "Choose a ruling paper with the mouse or arrow keys, then click or press Enter to strike the gavel.";

        var lookAt = new THREE.Vector3(A.camera.lookAt[0], A.camera.lookAt[1], A.camera.lookAt[2]);
        // Fit the whole bench in frame regardless of viewport aspect. Pulls the
        // camera back along a fixed elevation until every corner of the content
        // bounding box lands inside the frustum, then applies a margin.
        function frameScene() {
          var cam = ctx.camera;
          var el = A.camera.elevationDeg * Math.PI / 180;
          var dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el)).normalize();

          var box = new THREE.Box3();
          scene.traverse(function (o) { if (o.isMesh) box.expandByObject(o); });
          if (box.isEmpty()) return;
          // include the gavel's full hover arc so it never clips
          box.expandByPoint(new THREE.Vector3(box.min.x, A.gavel.hoverY + 0.4, box.min.z));

          var corners = [];
          for (var i = 0; i < 8; i++) {
            corners.push(new THREE.Vector3(
              (i & 1) ? box.max.x : box.min.x,
              (i & 2) ? box.max.y : box.min.y,
              (i & 4) ? box.max.z : box.min.z));
          }

          var dist = box.getBoundingSphere(new THREE.Sphere()).radius * 2;
          for (var pass = 0; pass < 6; pass++) {   // converges in a few passes
            cam.position.copy(lookAt).addScaledVector(dir, dist);
            cam.lookAt(lookAt);
            cam.updateMatrixWorld(true);
            cam.updateProjectionMatrix();
            var worst = 0;
            for (var c = 0; c < corners.length; c++) {
              var p = corners[c].clone().project(cam);
              worst = Math.max(worst, Math.abs(p.x), Math.abs(p.y));
            }
            if (worst < 0.0001) break;
            dist *= worst * A.camera.margin;
            if (pass === 5) break;
            // once inside the frustum with margin, stop tightening
            if (worst * A.camera.margin > 0.995 && worst * A.camera.margin < 1.005) break;
          }
          cam.position.copy(lookAt).addScaledVector(dir, dist);
          cam.lookAt(lookAt);
          cam.updateProjectionMatrix();
        }

        var disposables = [];
        function keep(o) { disposables.push(o); return o; }
        function mat(opts) { return keep(ctx.tunedStandard(opts)); }
        function geo(g) { return keep(g); }

        // ---- static set: table + sound block ----
        /* Surface maps. The paper gets a fine tooth so the key light breaks
           across it instead of reading as flat card; the bench gets a long
           grain plus a clearcoat so the off-axis key catches varnish. Both are
           generated on a canvas and cached by the harness. */
        var paperNormal = ctx.normalTexture("paper", 256, 256, ctx.surfaces.paper(0.55), 0.55, 3, 4);
        var paperRough  = ctx.grayTexture("paperR", 256, 256, ctx.surfaces.paper(0.35), 3, 4);
        var woodHeight  = ctx.surfaces.wood(11, 1.1);
        var woodNormal  = ctx.normalTexture("wood", 512, 512, woodHeight, 1.5, 2, 1);
        var woodRough   = ctx.grayTexture("woodR", 512, 512, woodHeight, 2, 1);

        var table = new THREE.Mesh(
          geo(ctx.roundedBox(A.table.w, A.table.h, A.table.d)),
          keep(ctx.material("varnishedWood", { color: A.table.color })));
        scene.add(table);

        /* A bench is not a slab. The apron below the top, the moulded lip that
           runs round the front edge and the legs are what give it thickness and
           somewhere for the key light to break. All are chamfered, so every one
           of them carries its own highlight line. */
        var benchDark = ctx.wood("walnut", { repeat: [3, 1] });
        keep(benchDark);

        var apron = new THREE.Mesh(
          keep(ctx.roundedBox(A.table.w * 0.96, 0.30, A.table.d * 0.92, 0.03)),
          benchDark);
        apron.position.set(0, -A.table.h / 2 - 0.13, 0);
        scene.add(apron);

        // a moulded lip proud of the front edge, the detail closest to camera
        var lip = new THREE.Mesh(
          keep(ctx.roundedBox(A.table.w + 0.10, 0.10, 0.16, 0.04)),
          benchDark);
        lip.position.set(0, A.table.h / 2 - 0.045, A.table.d / 2 + 0.03);
        scene.add(lip);

        /* micro-detail: a run of rivets along the moulded lip, and a rubber pad
           under every leg so the bench sits on the floor rather than in it */
        (function () {
          var brass = ctx.material("brass"); keep(brass);
          var rivets = ctx.rivetLine(A.table.w * 0.92, 18, 0.022, brass);
          rivets.position.set(0, A.table.h / 2 - 0.045, A.table.d / 2 + 0.10);
          scene.add(rivets);
          var rubber = ctx.material("rubber", { color: 0x2a2c30 }); keep(rubber);
          var pads = ctx.footPads(A.table.w - 0.56, A.table.d - 0.56, rubber, 0.11);
          pads.position.y = -A.table.h / 2 - 0.93;
          scene.add(pads);
        })();
        var legGeo = keep(ctx.roundedBox(0.28, 0.9, 0.28, 0.035));
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
          var leg = new THREE.Mesh(legGeo, benchDark);
          leg.position.set(c[0] * (A.table.w / 2 - 0.28),
                           -A.table.h / 2 - 0.48,
                           c[1] * (A.table.d / 2 - 0.28));
          scene.add(leg);
        });

        // the sound block, turned: a chamfered rim and a dished top
        var BR = A.block.r, BH = A.block.h;
        var block = new THREE.Mesh(
          keep(new THREE.LatheGeometry([
            [0, -BH / 2], [BR * 0.92, -BH / 2], [BR, -BH * 0.28],
            [BR, BH * 0.28], [BR * 0.93, BH / 2],
            [BR * 0.72, BH / 2], [BR * 0.66, BH * 0.34], [0, BH * 0.30]
          ].map(function (q) { return new THREE.Vector2(q[0], q[1]); }), 128)),
          ctx.wood("mahogany", { repeat: [2, 1] }));
        block.position.set(0, A.table.h / 2 + A.block.h / 2, -1.1);
        scene.add(block);

        // ---- paper label textures (runtime canvas; swap for real assets later) ----
        function paperTexture(heading, body) {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 512, _H = 640;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = "#" + A.paper.color.toString(16).padStart(6, "0");
          g.fillRect(0, 0, _W, _H);
          g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 6;
          g.strokeRect(14, 14, _W - 28, _H - 28);
          g.fillStyle = "#" + A.paper.ink.toString(16).padStart(6, "0");
          g.font = "bold 44px Georgia, serif"; g.textAlign = "center";
          var words = heading.toUpperCase().split(" "), line = "", y = 130, lines = [];
          words.forEach(function (w) {
            if ((line + " " + w).trim().length > 16) { lines.push(line.trim()); line = w; }
            else line += " " + w;
          });
          lines.push(line.trim());
          lines.forEach(function (l) { g.fillText(l, _W / 2, y, _W - 80); y += 56; });
          if (body) {
            g.font = "italic 24px Georgia, serif";
            g.fillText(body, _W / 2, _H - 60, _W - 80);
          }
          var tx = ctx.tune(new THREE.CanvasTexture(c));
          disposables.push(tx);
          return tx;
        }

        function makePaper(x, heading, sub) {
          var side = mat({ color: A.paper.color, roughness: 0.94 });
          var top  = mat({ color: 0xd8d8d8, roughness: 0.94,
                           normalMap: paperNormal,
                           normalScale: new THREE.Vector2(0.3, 0.3),
                           map: paperTexture(heading, sub) });
          // BoxGeometry material order: +x,-x,+y(top),-y,+z,-z
          var p = new THREE.Mesh(
            geo(new THREE.BoxGeometry(A.paper.w, A.paper.t, A.paper.d)),
            [side, side, top, side, side, side]);
          p.position.set(x, A.table.h / 2 + A.paper.t / 2, 0.45);
          scene.add(p);
          ctx.pickables.push(p);
          return p;
        }

        var current = readCase();
        var papers = [
          makePaper(-1.75, A.paper.grantHeading, "the company keeps exclusivity"),
          makePaper( 1.75, current.rejectLabel,  "the market is pried open")
        ];
        var IS_GRANT = [true, false];

        // ---- gavel ----
        /* The gavel is a turned object, so it is built the way a turned object
           is made: lathe profiles revolved about the axis. Two cylinders could
           never carry the chamfered strike faces, the waist of the handle or
           the swell at the butt, and those are the details that read as wood
           on a workbench rather than as primitives.

           Profiles are in lathe space: x is radius, y runs along the axis. */
        function lathe(profile, segments) {
          var pts = profile.map(function (p) { return new THREE.Vector2(p[0], p[1]); });
          // the gavel is the object the player looks at most; 128 around the axis
          return keep(new THREE.LatheGeometry(pts, segments || 128));
        }

        var HR = A.gavel.headR, HL = A.gavel.headL / 2;
        var headGeo = lathe([
          [0, -HL], [HR * 0.55, -HL], [HR * 0.86, -HL * 0.94],   // chamfered strike face
          [HR * 0.99, -HL * 0.80], [HR * 0.96, -HL * 0.42],
          [HR * 1.00, 0], [HR * 0.96, HL * 0.42],                 // slight belly
          [HR * 0.99, HL * 0.80], [HR * 0.86, HL * 0.94],
          [HR * 0.55, HL], [0, HL]
        ]);

        var hr = A.gavel.handleR, hl = A.gavel.handleL;
        var handleGeo = lathe([
          [0, 0], [hr * 0.90, 0], [hr * 1.02, hl * 0.03],         // butt, with a swell
          [hr * 0.86, hl * 0.10], [hr * 0.74, hl * 0.42],         // waist
          [hr * 0.78, hl * 0.72], [hr * 0.92, hl * 0.93],
          [hr * 0.86, hl], [0, hl]
        ]);

        // the brass ferrule where the handle enters the head
        var ferruleGeo = lathe([
          [0, 0], [hr * 1.28, 0], [hr * 1.34, 0.03],
          [hr * 1.34, 0.10], [hr * 1.22, 0.13], [0, 0.13]
        ]);

        var woodMat   = ctx.wood("walnut", { repeat: [2, 1] });
        var brassMat  = ctx.material("brass");
        keep(woodMat); keep(brassMat);

        /* A gavel pivots at the hand. Everything hangs off this group, and it
           is the group that moves between targets, so the head always travels
           on an arc rather than sliding through the air. */
        var gavelPivot = new THREE.Group();
        var gavel = new THREE.Group();          // the tool itself, hung off the pivot
        gavelPivot.add(gavel);

        var handle = new THREE.Mesh(handleGeo, woodMat);
        handle.rotation.z = Math.PI / 2;        // lay the axis along -x, butt at origin
        handle.position.x = 0;
        gavel.add(handle);

        var ferrule = new THREE.Mesh(ferruleGeo, brassMat);
        ferrule.rotation.z = Math.PI / 2;
        ferrule.position.x = -hl * 0.86;
        gavel.add(ferrule);

        var head = new THREE.Mesh(headGeo, woodMat);
        head.rotation.x = Math.PI / 2;          // barrel across the swing
        head.position.x = -hl;
        gavel.add(head);

        /* Rest pose.

           The tool hangs down and to the left of the hand, so at angle t the
           head sits at hl*(-cos t, -sin t) from the pivot. The hand is placed
           from that relation, not guessed, so the head hovers just clear of
           whichever ruling paper is selected instead of floating off the bench.

           Larger angle swings the head lower: RAISED is the shallow angle with
           the head lifted, CONTACT the deep one with it down on the paper. */
        var G_REST = 0.62, G_RAISED = 0.16, G_CONTACT = 0.98;
        var GAVEL_HOVER = A.table.h / 2 + 0.46;   // head height above the bench
        function pivotFor(x, z, angle) {
          return new THREE.Vector3(
            x + hl * Math.cos(angle),
            GAVEL_HOVER + hl * Math.sin(angle),
            z);
        }
        gavel.rotation.z = G_REST;
        gavelPivot.position.copy(pivotFor(-1.75, 0.45 - 0.9, G_REST));
        scene.add(gavelPivot);

        // ---- state ----
        var selected = 0;
        var state = "aim";            // aim -> striking -> verdict
        var strikeT = 0;
        var prevKeys = {};
        var bob = 0;
        var ruledThisSession = 0;

        function highlight() {
          papers.forEach(function (p, i) {
            var on = (i === selected && state === "aim");
            p.material[2].emissive = new THREE.Color(on ? A.paper.selectGlow : 0x000000);
            p.material[2].emissiveIntensity = on ? 0.35 : 0;
          });
        }
        highlight();
        ctx.setStatus("Case in session", false);

        // The case reaches the player as an object on the bench, not as a panel
        // over the scene: a two-page file that lies closed until it is opened.
        // Opening runs in two beats. The folder first lifts and turns toward the
        // reader, then the covers swing apart to a full spread, so the whole case
        // is legible at once instead of being scrolled through.
        var PAGE_W = 1.5, PAGE_H = 2.0, PAGE_T = 0.016;
        // The open file is parked in front of the camera and sized to the frame
        // rather than pinned to a world position. A fixed spot cannot survive the
        // range of window shapes this runs in, and sitting too near the lens
        // keystones the pages badly. Holding it at a distance and scaling to fit
        // keeps the spread square to the reader on any viewport.
        var OPEN_DIST = 4.6;          // far enough that perspective stays gentle
        var OPEN_TILT = -0.10;        // a touch of lean, still square to the reader
        var FIT_H = 0.80, FIT_W = 0.94;
        var REST_TILT = -Math.PI / 2; // lying flat on the bench
        var _camDir = new THREE.Vector3(), _openPos = new THREE.Vector3();
        var _restQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(REST_TILT, 0, 0));
        var _openQ = new THREE.Quaternion(), _tiltQ = new THREE.Quaternion();
        var _tiltE = new THREE.Euler(OPEN_TILT, 0, 0);
        var _camUp = new THREE.Vector3();

        function pageCanvas(draw) {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 760, _H = 1000;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = "#f4efe2"; g.fillRect(0, 0, _W, _H);
          g.strokeStyle = "rgba(0,0,0,.16)"; g.lineWidth = 3;
          g.strokeRect(24, 24, _W - 48, _H - 48);
          draw(g, _W, _H);
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }

        function rule(g, y, W) {
          g.strokeStyle = "rgba(0,0,0,.15)"; g.lineWidth = 2;
          g.beginPath(); g.moveTo(58, y); g.lineTo(W - 58, y); g.stroke();
        }

        // left page: who is asking, and what they are asking for
        function leftPageTexture() {
          return pageCanvas(function (g, W) {
            g.fillStyle = "#8a1c1c";
            g.font = "bold 29px Georgia, serif";
            g.fillText(current.label.toUpperCase(), 58, 100);
            g.fillStyle = "#15161a";
            g.font = "bold 50px Georgia, serif";
            var y = wrap(g, current.title, 58, 170, W - 116, 57);
            g.fillStyle = "#4a4f57";
            g.font = "italic 28px Georgia, serif";
            y = wrap(g, current.drug, 58, y + 26, W - 116, 36);
            rule(g, y + 26, W);
            g.fillStyle = "#7a6320";
            g.font = "bold 25px Georgia, serif";
            g.fillText("THE CLAIM", 58, y + 76);
            g.fillStyle = "#15161a";
            g.font = "italic 32px Georgia, serif";
            wrap(g, "“" + current.claim + "”", 58, y + 124, W - 116, 42);
          });
        }

        // right page: the law it runs into, and afterwards what actually happened
        function rightPageTexture() {
          return pageCanvas(function (g, W) {
            g.fillStyle = "#7a6320";
            g.font = "bold 25px Georgia, serif";
            g.fillText("THE LAW THAT APPLIES", 58, 100);
            g.fillStyle = "#2c3038";
            g.font = "32px Georgia, serif";
            var y = wrap(g, current.context, 58, 152, W - 116, 42);
            if (docOutcome) {
              rule(g, y + 30, W);
              g.fillStyle = "#1d6b3a";
              g.font = "bold 25px Georgia, serif";
              g.fillText("ON THE RECORD", 58, y + 82);
              g.fillStyle = "#111318";
              g.font = "30px Georgia, serif";
              wrap(g, docOutcome, 58, y + 130, W - 116, 40);
            }
          });
        }

        // the outside of the folder, seen while it lies closed on the bench
        function coverTexture() {
          return pageCanvas(function (g, W, H) {
            g.textAlign = "center";
            g.fillStyle = "#8a1c1c";
            g.font = "bold 30px Georgia, serif";
            g.fillText(current.label.toUpperCase(), W / 2, 300);
            g.fillStyle = "#15161a";
            g.font = "bold 48px Georgia, serif";
            wrap(g, current.title, 0, 400, W, 58, W / 2);
            g.fillStyle = "#6b6250";
            g.font = "italic 30px Georgia, serif";
            g.fillText("Click the file to open it", W / 2, H - 200);
            g.textAlign = "left";
          });
        }

        function wrap(g, text, x, y, maxW, lh, centerAt) {
          var words = String(text || "").split(/\s+/), line = "";
          function put(t) { g.fillText(t, centerAt != null ? centerAt : x, y); }
          for (var i = 0; i < words.length; i++) {
            var test = line ? line + " " + words[i] : words[i];
            if (g.measureText(test).width > maxW && line) {
              put(line); line = words[i]; y += lh;
            } else line = test;
          }
          if (line) { put(line); y += lh; }
          return y;
        }

        var edgeMat = keep(new THREE.MeshStandardMaterial({ color: 0xe6e0d2, roughness: 0.9 }));
        // The pages turn to face the camera while the key light stays off to one
        // side, which drains the paper to grey. Letting the page carry its own
        // texture as emissive keeps it cream and readable at any angle without
        // going fully unlit and flat.
        /* The case file is a reading surface, so it is unlit: the texture is
           shown exactly as it was drawn. Every attempt to light it fought the
           same battle from both ends, reading grey when it turned to face the
           camera and clipping to white once image based lighting arrived. The
           record room cards solved this long ago by being MeshBasicMaterial,
           and they are the most legible surfaces in the game. The pages still
           cast a shadow, because shadow casting reads depth, not shading. */
        function faceMat(tex) {
          return keep(new THREE.MeshBasicMaterial({ map: tex, fog: false, toneMapped: false }));
        }
        function setFace(mat, tex) {
          mat.map = tex; mat.needsUpdate = true;
        }
        var leftFaceMat  = faceMat(leftPageTexture());
        var rightFaceMat = faceMat(rightPageTexture());
        var coverMat     = faceMat(coverTexture());

        // BoxGeometry face order is [+x, -x, +y, -y, +z, -z]
        function pageMesh(front, back) {
          return new THREE.Mesh(
            keep(new THREE.BoxGeometry(PAGE_W, PAGE_H, PAGE_T)),
            [edgeMat, edgeMat, edgeMat, edgeMat, front, back]);
        }

        var bookRoot = new THREE.Group();
        var spine = new THREE.Group();
        var leftPivot = new THREE.Group();
        var rightPivot = new THREE.Group();

        var leftPage = pageMesh(leftFaceMat, coverMat);   // its back is the cover
        leftPage.userData.forceCast = true;                // still grounded on the bench
        leftPage.position.x = -PAGE_W / 2;
        leftPivot.add(leftPage);

        var rightPage = pageMesh(rightFaceMat, edgeMat);
        rightPage.userData.forceCast = true;
        rightPage.position.x = PAGE_W / 2;
        rightPivot.add(rightPage);

        spine.add(leftPivot); spine.add(rightPivot);
        bookRoot.add(spine);

        var DOC_REST = new THREE.Vector3(0, A.table.h / 2 + 0.03, 1.35);
        bookRoot.position.copy(DOC_REST);
        bookRoot.rotation.x = REST_TILT;
        scene.add(bookRoot);
        ctx.pickables.push(leftPage, rightPage);

        var docHeld = false, docOutcome = "";
        var openT = 0;                 // 0 closed and flat, 1 open and facing the reader

        function smooth(x) {
          x = Math.max(0, Math.min(1, x));
          return x * x * (3 - 2 * x);
        }

        function refreshDoc() {
          setFace(leftFaceMat, leftPageTexture());
          setFace(rightFaceMat, rightPageTexture());
          setFace(coverMat, coverTexture());
        }

        ctx.setBrief(null);   // the paper carries the case; no panel over the scene

        // The bench lets the player walk back through cases they have already
        // seen, re-read the file, and change a ruling they did not mean to make.
        // Anything already on the record is reversed through the game layer so
        // the meters and the term record stay honest.
        function ruledRecord() {
          return (typeof window.GameRulingFor === "function")
            ? window.GameRulingFor(caseNumber()) : null;
        }

        function armGavel() {
          state = "aim"; strikeT = 0;
          papers.forEach(function (p) { p.scale.set(1, 1, 1); });
          highlight();
        }

        function changeRuling() {
          var n = caseNumber();
          if (typeof window.GameUndoRuling !== "function" || !window.GameUndoRuling(n)) return;
          docOutcome = "";
          refreshDoc();
          armGavel();
          ctx.setStatus("Ruling withdrawn — rule again", false);
          ctx.setHint("The earlier ruling is off the record. " + INSTR);
          refreshFooter();
        }

        // present a case that is already on the record: the outcome is printed
        // on the file, and the footer offers the correction rather than a gavel.
        function showRuledState() {
          var rec = ruledRecord();
          if (!rec) return false;
          docOutcome = rec.outcome || "Ruling registered.";
          refreshDoc();
          ctx.setStatus("Already ruled: " + (rec.action || "decided"), false);
          ctx.setHint("You have ruled on this case. Pick up the file to re-read it, " +
                      "or change the ruling.");
          ctx.setAction("Next case", function () {
            if (typeof window.nextCase === "function") {
              try { window.nextCase(); } catch (e) { console.error(e); }
            }
            redress();
          });
          return true;
        }

        function refreshFooter() {
          var rec = ruledRecord();
          var n = caseNumber();
          var btns = [];
          // going back is only offered where there is something behind you
          if (n > 1 && typeof window.prevCase === "function") {
            btns.push({ label: "◀ Previous case", onClick: function () {
              try { window.prevCase(); } catch (e) { console.error(e); }
              redress();
            } });
          }
          // a ruling already on the record can be withdrawn and made again
          if (rec) btns.push({ label: "Change this ruling", onClick: changeRuling });
          ctx.setAux(btns);
        }

        function redress() {
          // dress the bench for the (new) current case
          current = readCase();
          ctx.setTitle(current.title, current.drug);
          var newTop = paperTexture(current.rejectLabel, "the market is pried open");
          papers[1].material[2].map = newTop;
          papers[1].material[2].needsUpdate = true;
          papers.forEach(function (p) { p.scale.set(1, 1, 1); });
          state = "aim"; strikeT = 0; selected = 0;
          highlight();
          docHeld = false;

          if (showRuledState()) {
            /* the player walked back onto a case they already decided */
          } else {
            docOutcome = "";
            refreshDoc();
            ctx.setHint(INSTR);
            ctx.setStatus("Case in session", false);
            ctx.setAction("Continue", function () { /* disabled until ruled */ });
            // setAction enables the button; re-disable until the next ruling
            var go = document.querySelector('.il-overlay [data-act="go"]');
            if (go) go.disabled = true;
          }
          refreshFooter();
        }

        function registerRuling(idx) {
          var isGrant = IS_GRANT[idx];
          if (typeof window.makeRuling === "function") {
            try { window.makeRuling(isGrant); } catch (e) { console.error(e); }
          }
          ruledThisSession++;
          var out = document.getElementById("ruling-outcome");
          var verdict = out ? out.textContent.trim() : "";
          // the record is written onto the case file itself
          docOutcome = verdict || "Ruling registered.";
          refreshDoc();
          ctx.setHint((isGrant ? "You granted the monopoly. " : "You intervened in the market. ") +
                      "Pick up the file to read what followed, or change the ruling if that " +
                      "was not what you meant.");
          refreshFooter();

          if (allCasesRuled()) {
            ctx.complete();                       // marks the goal, enables button
            ctx.setStatus("All six cases ruled", true);
            ctx.setAction("Leave the bench", null); // default: close the scene
          } else {
            ctx.setStatus(ruledThisSession + " ruled this session — more cases wait", false);
            ctx.setAction("Next case", function () {
              if (typeof window.nextCase === "function") {
                try { window.nextCase(); } catch (e) { console.error(e); }
              }
              redress();
            });
          }
        }

        function beginStrike(idx) {
          if (state !== "aim") return;
          selected = idx;
          state = "striking";
          strikeT = 0;
          highlight();
        }

        // the scene can be entered on a case the player has already ruled, so the
        // footer and the file are dressed from the record before the first frame
        if (!showRuledState()) ctx.setHint(INSTR);
        refreshFooter();

        return {
          update: function (dt) {
            bob += dt;

            // The case file lifts toward the reader when picked up. The printed
            // face is the box's +Y side, so it must tip POSITIVELY about X to
            // turn that face toward a camera sitting at +Z; a negative angle
            // shows the blank underside instead.
            // Opening runs in two overlapping beats so it reads as a folder
            // being picked up and then opened, rather than one blended morph.
            openT += ((docHeld ? 1 : 0) - openT) * Math.min(1, dt * 5.5);
            var lift = smooth(openT / 0.62);            // rise and turn to face the reader
            var fold = smooth((openT - 0.34) / 0.66);   // covers swing apart

            var cam = ctx.camera;
            cam.getWorldDirection(_camDir);
            _openPos.copy(cam.position).addScaledVector(_camDir, OPEN_DIST);
            var vh = 2 * Math.tan(cam.fov * Math.PI / 360) * OPEN_DIST;
            var vw = vh * cam.aspect;
            var fit = Math.min(vh * FIT_H / PAGE_H, vw * FIT_W / (PAGE_W * 2));
            // lift it clear of the hint pill along the camera's own up axis
            _camUp.set(0, 1, 0).applyQuaternion(cam.quaternion);
            _openPos.addScaledVector(_camUp, vh * 0.05);

            bookRoot.position.lerpVectors(DOC_REST, _openPos, lift);
            _tiltQ.setFromEuler(_tiltE);
            _openQ.copy(cam.quaternion).multiply(_tiltQ);
            bookRoot.quaternion.copy(_restQ).slerp(_openQ, lift);
            bookRoot.scale.setScalar(1 + (fit - 1) * lift);
            // closed, the left leaf lies folded over the right one; open, it swings
            // out to a flat spread, and the spine slides so the stack stays centred
            leftPivot.rotation.y = -Math.PI * (1 - fold);
            spine.position.x = -(PAGE_W / 2) * (1 - fold);

            var targetX = papers[selected].position.x;

            if (state === "aim") {
              /* The pivot moves; the tool hangs off it. Swinging across to the
                 other ruling therefore arcs, and the head lags a little behind
                 the hand because it has mass. */
              var want = pivotFor(targetX, papers[selected].position.z - 0.9, G_REST);
              var dx = want.x - gavelPivot.position.x;
              // the idle bob is part of the target, never added to the position:
              // adding it each frame against a soft lerp integrates it into a
              // swing many times its own amplitude, which is what was driving
              // the head down through the ruling paper
              want.y += Math.sin(bob * 2.2) * 0.035;
              gavelPivot.position.lerp(want, Math.min(1, dt * 6));
              // hard floor: the head may never reach the paper while idling
              var minY = pivotFor(targetX, 0, G_REST).y - 0.02;
              if (gavelPivot.position.y < minY) gavelPivot.position.y = minY;
              // the head trails the hand while it travels, because it has mass
              gavel.rotation.z += ((G_REST - dx * 0.22) - gavel.rotation.z) * Math.min(1, dt * 7);

              var k = ctx.keys;
              if (k.ArrowLeft && !prevKeys.ArrowLeft)  { selected = 0; highlight(); }
              if (k.ArrowRight && !prevKeys.ArrowRight){ selected = 1; highlight(); }
              if ((k.Enter && !prevKeys.Enter) || (k.Space && !prevKeys.Space)) beginStrike(selected);
              prevKeys = { ArrowLeft: k.ArrowLeft, ArrowRight: k.ArrowRight,
                           Enter: k.Enter, Space: k.Space };
            } else if (state === "striking") {
              /* Five beats, not one drop. The anticipation is the beat that
                 sells the weight, and it is the one the old vertical slide had
                 no room for. Angles are rotations of the tool about the hand,
                 so the head always arrives on an arc and lands face-flat on
                 the ruling paper. */
              strikeT += dt;
              var LIFT = 0.14, SWING = 0.10;   // seconds
              var REST = G_REST, RAISED = G_RAISED, CONTACT = G_CONTACT;
              if (strikeT <= LIFT) {
                // 1-2. settle and anticipate: rotate back, lifting the head away
                var f = smooth(strikeT / LIFT);
                gavel.rotation.z = REST + (RAISED - REST) * f;
              } else if (strikeT <= LIFT + SWING) {
                // 3. swing: accelerating, so it is fastest just before contact
                var g = (strikeT - LIFT) / SWING;
                gavel.rotation.z = RAISED + (CONTACT - RAISED) * (g * g);
              } else {
                // 4. impact: hard stop, and everything fires on this frame
                gavel.rotation.z = CONTACT;
                papers[selected].scale.set(1.06, 1, 1.06);
                ctx.shake(0.055, 0.16);
                state = "verdict";
                strikeT = 0;
                registerRuling(selected);
              }
            } else {
              // 5. recoil and settle: a small over-damped bounce back to rest
              strikeT += dt;
              var bounce = Math.exp(-strikeT * 7) * Math.sin(strikeT * 26) * 0.16;
              gavel.rotation.z += ((G_REST + bounce) - gavel.rotation.z) * Math.min(1, dt * 9);
              papers[selected].scale.x += (1 - papers[selected].scale.x) * dt * 6;
              papers[selected].scale.z += (1 - papers[selected].scale.z) * dt * 6;
              var rest = pivotFor(papers[selected].position.x, papers[selected].position.z - 0.9, G_REST);
              gavelPivot.position.lerp(rest, Math.min(1, dt * 4));
            }
          },

          onPointerMove: function (hit) {
            if (state !== "aim" || !hit) return;
            var i = papers.indexOf(hit.object);
            if (i >= 0 && i !== selected) { selected = i; highlight(); }
          },

          onPointerDown: function (hit) {
            if (!hit) return;
            // the file can be picked up and put down at any time
            if (hit.object === leftPage || hit.object === rightPage) {
              docHeld = !docHeld;
              ctx.setHint(docHeld
                ? "Click the file again to close it and rule."
                : INSTR);
              return;
            }
            if (docHeld) { docHeld = false; ctx.setHint(INSTR); return; }
            if (state !== "aim") return;
            var i = papers.indexOf(hit.object);
            if (i >= 0) beginStrike(i);
          },

          // the harness calls this on mount and on every viewport change
          onResize: function () { frameScene(); },

          dispose: function () {
            disposables.forEach(function (d) { try { d.dispose(); } catch (e) {} });
          }
        };
      }
    });

    // ---- public launcher: the game director calls this to enter the scene ----
    window.launchCourtroom = function () {
      var c = readCase();
      window.Interludes.play("courtroom", {
        title: c.title, step: c.drug, rejectLabel: c.rejectLabel
      });
    };

    // No entry button is injected into the page. The game director opens this
    // scene, and re-opens it if the player leaves with cases still undecided.
  });
})();
