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
        function mat(opts) { return keep(new THREE.MeshStandardMaterial(opts)); }
        function geo(g) { return keep(g); }

        // ---- static set: table + sound block ----
        var table = new THREE.Mesh(
          geo(new THREE.BoxGeometry(A.table.w, A.table.h, A.table.d)),
          mat({ color: A.table.color, roughness: 0.65, metalness: 0.05 }));
        scene.add(table);

        var block = new THREE.Mesh(
          geo(new THREE.CylinderGeometry(A.block.r, A.block.r, A.block.h, 32)),
          mat({ color: A.block.color, roughness: 0.5 }));
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
          var side = mat({ color: A.paper.color, roughness: 0.9 });
          var top  = mat({ color: 0xffffff, roughness: 0.9, map: paperTexture(heading, sub) });
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
        var gavel = new THREE.Group();
        var handle = new THREE.Mesh(
          geo(new THREE.CylinderGeometry(A.gavel.handleR, A.gavel.handleR, A.gavel.handleL, 20)),
          mat({ color: A.gavel.color, roughness: 0.55 }));
        handle.rotation.z = Math.PI / 2;
        handle.position.x = A.gavel.handleL / 2 - 0.1;
        var head = new THREE.Mesh(
          geo(new THREE.CylinderGeometry(A.gavel.headR, A.gavel.headR, A.gavel.headL, 24)),
          mat({ color: A.gavel.color, roughness: 0.4, metalness: 0.1 }));
        head.rotation.x = Math.PI / 2;
        gavel.add(handle); gavel.add(head);
        gavel.rotation.z = 0.25;
        scene.add(gavel);

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
        // over the scene: a physical case file they pick up, read, and put down.
        function docTexture() {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 760, _H = 1000;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = "#f4efe2"; g.fillRect(0, 0, _W, _H);
          g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = 3;
          g.strokeRect(26, 26, _W - 52, _H - 52);
          g.fillStyle = "#8a1c1c";
          g.font = "bold 26px Georgia, serif";
          g.fillText(current.label.toUpperCase(), 56, 92);
          g.fillStyle = "#15161a";
          g.font = "bold 40px Georgia, serif";
          var y = wrap(g, current.title, 56, 150, _W - 112, 46);
          g.fillStyle = "#4a4f57";
          g.font = "italic 24px Georgia, serif";
          y = wrap(g, current.drug, 56, y + 26, _W - 112, 32);

          g.strokeStyle = "rgba(0,0,0,.15)"; g.lineWidth = 2;
          g.beginPath(); g.moveTo(56, y + 24); g.lineTo(_W - 56, y + 24); g.stroke();

          g.fillStyle = "#7a6320";
          g.font = "bold 20px Georgia, serif";
          g.fillText("THE CLAIM", 56, y + 66);
          g.fillStyle = "#15161a";
          g.font = "italic 26px Georgia, serif";
          y = wrap(g, "“" + current.claim + "”", 56, y + 104, _W - 112, 34);

          g.fillStyle = "#7a6320";
          g.font = "bold 20px Georgia, serif";
          g.fillText("THE LAW THAT APPLIES", 56, y + 56);
          g.fillStyle = "#2c3038";
          g.font = "24px Georgia, serif";
          y = wrap(g, current.context, 56, y + 94, _W - 112, 32);

          if (docOutcome) {
            g.strokeStyle = "rgba(0,0,0,.15)"; g.lineWidth = 2;
            g.beginPath(); g.moveTo(56, y + 22); g.lineTo(_W - 56, y + 22); g.stroke();
            g.fillStyle = "#1d6b3a";
            g.font = "bold 20px Georgia, serif";
            g.fillText("ON THE RECORD", 56, y + 62);
            g.fillStyle = "#22303a";
            g.font = "23px Georgia, serif";
            wrap(g, docOutcome, 56, y + 98, _W - 112, 30);
          }
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }

        function wrap(g, text, x, y, maxW, lh) {
          var words = String(text || "").split(/\s+/), line = "";
          for (var i = 0; i < words.length; i++) {
            var test = line ? line + " " + words[i] : words[i];
            if (g.measureText(test).width > maxW && line) {
              g.fillText(line, x, y); line = words[i]; y += lh;
            } else line = test;
          }
          if (line) { g.fillText(line, x, y); y += lh; }
          return y;
        }

        var docFace = keep(new THREE.MeshStandardMaterial(
          { color: 0xffffff, roughness: 0.85, map: docTexture() }));
        var docEdge = keep(new THREE.MeshStandardMaterial({ color: 0xe6e0d2, roughness: 0.9 }));
        var caseDoc = new THREE.Mesh(
          keep(new THREE.BoxGeometry(1.5, 0.04, 2.0)),
          [docEdge, docEdge, docFace, docEdge, docEdge, docEdge]);
        var DOC_REST = new THREE.Vector3(0, A.table.h / 2 + 0.03, 1.35);
        caseDoc.position.copy(DOC_REST);
        scene.add(caseDoc);
        ctx.pickables.push(caseDoc);

        var docHeld = false, docOutcome = "";

        function refreshDoc() {
          docFace.map = docTexture();
          docFace.needsUpdate = true;
        }

        ctx.setBrief(null);   // the paper carries the case; no panel over the scene

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
          docOutcome = "";
          docHeld = false;
          refreshDoc();
          ctx.setHint(INSTR);
          ctx.setStatus("Case in session", false);
          ctx.setAction("Continue", function () { /* disabled until ruled */ });
          // setAction enables the button; re-disable until the next ruling
          var go = document.querySelector('.il-overlay [data-act="go"]');
          if (go) go.disabled = true;
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
                      "Pick up the file to read what followed.");

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

        return {
          update: function (dt) {
            bob += dt;

            // The case file lifts toward the reader when picked up. The printed
            // face is the box's +Y side, so it must tip POSITIVELY about X to
            // turn that face toward a camera sitting at +Z; a negative angle
            // shows the blank underside instead.
            var wantPos = docHeld
              ? new THREE.Vector3(0, 1.15, 2.35)
              : DOC_REST;
            var wantRotX = docHeld ? 1.02 : 0;
            caseDoc.position.lerp(wantPos, Math.min(1, dt * 7));
            caseDoc.rotation.x += (wantRotX - caseDoc.rotation.x) * Math.min(1, dt * 7);
            caseDoc.scale.setScalar(
              caseDoc.scale.x + ((docHeld ? 1.45 : 1) - caseDoc.scale.x) * Math.min(1, dt * 7));

            var targetX = papers[selected].position.x;

            if (state === "aim") {
              gavel.position.x += (targetX - gavel.position.x) * Math.min(1, dt * 8);
              gavel.position.y = A.gavel.hoverY + Math.sin(bob * 2.2) * 0.06;
              gavel.position.z = papers[selected].position.z;

              var k = ctx.keys;
              if (k.ArrowLeft && !prevKeys.ArrowLeft)  { selected = 0; highlight(); }
              if (k.ArrowRight && !prevKeys.ArrowRight){ selected = 1; highlight(); }
              if ((k.Enter && !prevKeys.Enter) || (k.Space && !prevKeys.Space)) beginStrike(selected);
              prevKeys = { ArrowLeft: k.ArrowLeft, ArrowRight: k.ArrowRight,
                           Enter: k.Enter, Space: k.Space };
            } else if (state === "striking") {
              strikeT += dt;
              var down = 0.16;
              if (strikeT <= down) {
                var f = strikeT / down;
                gavel.position.y = A.gavel.hoverY - (A.gavel.hoverY - A.gavel.strikeY) * f * f;
              } else {
                gavel.position.y = A.gavel.strikeY;
                papers[selected].scale.set(1.06, 1, 1.06);
                state = "verdict";
                registerRuling(selected);
              }
            } else {
              papers[selected].scale.x += (1 - papers[selected].scale.x) * dt * 6;
              papers[selected].scale.z += (1 - papers[selected].scale.z) * dt * 6;
              gavel.position.y += (A.gavel.strikeY + 0.25 - gavel.position.y) * dt * 4;
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
            if (hit.object === caseDoc) {
              docHeld = !docHeld;
              ctx.setHint(docHeld
                ? "Click the file again to set it down."
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
