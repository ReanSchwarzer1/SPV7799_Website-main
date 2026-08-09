/* ============================================================
   interlude-race.js — the winner-takes-all patent race (module 9)
   Condition B embodied layer.

   Two firms, one patent, sealed bids. The player is the CEO of
   Firm A and physically shoves a stack of chips into the commit
   slot: four hundred million for High R&D, one hundred for Low.
   The rival's envelope stays shut until the player commits, then
   flips open and the matrix lights the cell they landed in.

   The trap only becomes visible by playing it twice. High beats
   Low whichever way the rival goes, so both firms take High and
   both walk away with a hundred million, when both playing Low
   would have paid four hundred each. The scene invites the replay
   rather than explaining it.

   Objective: make the call as CEO.

   Payoffs are the artifact's own: a patent worth $1,000M, High
   R&D at $400M, Low at $100M, ties split on a coin toss.
   ============================================================ */

(function () {
  "use strict";

  function whenReady(fn) {
    if (window.Interludes) return fn();
    var n = 0, t = setInterval(function () {
      if (window.Interludes) { clearInterval(t); fn(); }
      else if (++n > 100) clearInterval(t);
    }, 30);
  }

  whenReady(function () {

    window.Interludes.register("race", {
      kicker: "The war room",
      title: "One patent, two firms",
      step: "A winner-takes-all race",
      instructions: "Push a stack of chips into the slot to commit your R&D.",

      assets: {
        patentValue: 1000, highCost: 400, lowCost: 100,
        chip:  { r: 0.52, h: 0.11, high: 22, low: 6,       // chips in each stack
                 highColor: 0xd4573f, lowColor: 0x4f86c6 },
        slot:  { w: 1.9, h: 0.22, d: 1.5, color: 0x2a3140 },
        table: { w: 15, d: 9, color: 0x141821 },
        cell:  { w: 2.5, h: 1.5, gap: 0.22 },
        camera: { elevationDeg: 26, margin: 1.12, lookAt: [0, 0.6, 0.2] }
      },

      build: function (ctx) {
        var THREE = ctx.THREE, scene = ctx.scene, A = ctx.assets;
        var junk = [];
        function keep(o) { junk.push(o); return o; }
        function mat(o) { return keep(ctx.tunedStandard(o)); }

        var labelTex = ctx.labelTexture;
        var makeLabel = ctx.makeLabel;

        // ---------- table ----------
        var table = new THREE.Mesh(
          keep(ctx.roundedBox(A.table.w, 0.3, A.table.d)),
          ctx.wood("mahogany", { repeat: [3, 2] }));
        table.position.set(0, -0.15, 0);
        scene.add(table);

        /* Substructure. A base with a moulded lip and an apron under it reads
           as a built surface rather than a floating slab, and every one of
           those edges is chamfered so it carries its own highlight. */
        (function () {
          var subMat = ctx.wood("walnut", { repeat: [3, 1] }); keep(subMat);
          var W = A.table.w, H = 0.3, DD = A.table.d;
          var lip = new THREE.Mesh(ctx.roundedBox(W + H * 0.5, H * 0.42, H * 0.7, H * 0.14), subMat);
          lip.position.set(table.position.x, table.position.y + H * 0.30, table.position.z + DD / 2 + H * 0.12);
          scene.add(lip);
          var apron = new THREE.Mesh(ctx.roundedBox(W * 0.95, H * 0.9, DD * 0.92, H * 0.12), subMat);
          apron.position.set(table.position.x, table.position.y - H * 0.85, table.position.z);
          scene.add(apron);
          var legGeo = ctx.roundedBox(H * 0.9, H * 3.2, H * 0.9, H * 0.12);
          [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function (c) {
            var leg = new THREE.Mesh(legGeo, subMat);
            leg.position.set(table.position.x + c[0] * (W / 2 - H * 1.1),
                             table.position.y - H * 2.3,
                             table.position.z + c[1] * (DD / 2 - H * 1.1));
            scene.add(leg);
          });
        })();

        // ---------- the prize ----------
        var prize = new THREE.Mesh(
          keep(ctx.turnedCylinder(0.75, 0.75, 0.3)),
          mat({ color: 0xd9a441, roughness: 0.25, metalness: 0.4,
                emissive: 0xd9a441, emissiveIntensity: 0.4 }));
        prize.position.set(0, 0.16, -2.9);
        scene.add(prize);
        /* The prize was a bare gold disc. It is now a struck medallion: a
           bezel, a knurled edge, a raised inner boss with a rim, and a stepped
           plinth with feet so it sits on the table rather than in it. */
        (function () {
          var gold = mat({ color: 0xd9a441, roughness: 0.22, metalness: 0.62,
                           emissive: 0xd9a441, emissiveIntensity: 0.30 });
          var deep = mat({ color: 0x8a6321, roughness: 0.36, metalness: 0.70 });
          var PX = 0, PZ = -2.9, PY = 0.16;

          var bezel = new THREE.Mesh(
            keep(new THREE.TorusGeometry(0.755, 0.055, 20, 128)), deep);
          bezel.rotation.x = Math.PI / 2;
          bezel.position.set(PX, PY + 0.10, PZ);
          scene.add(bezel);

          var knurlGeo = keep(ctx.roundedBox(0.05, 0.26, 0.06, 0.014));
          for (var kn = 0; kn < 48; kn++) {
            var kk = new THREE.Mesh(knurlGeo, deep);
            var ka = (kn / 48) * Math.PI * 2;
            kk.position.set(PX + Math.cos(ka) * 0.775, PY, PZ + Math.sin(ka) * 0.775);
            kk.rotation.y = -ka;
            scene.add(kk);
          }

          var boss = new THREE.Mesh(keep(ctx.turnedCylinder(0.44, 0.50, 0.10, 0.03)), gold);
          boss.position.set(PX, PY + 0.20, PZ);
          scene.add(boss);
          var bossRing = new THREE.Mesh(
            keep(new THREE.TorusGeometry(0.40, 0.028, 16, 96)), deep);
          bossRing.rotation.x = Math.PI / 2;
          bossRing.position.set(PX, PY + 0.26, PZ);
          scene.add(bossRing);

          [[0.98, 0.12, -0.06], [1.12, 0.10, -0.17]].forEach(function (st) {
            var step = new THREE.Mesh(
              keep(ctx.turnedCylinder(st[0], st[0] * 1.05, st[1], 0.03)), deep);
            step.position.set(PX, PY + st[2], PZ);
            scene.add(step);
          });
          var pfeet = ctx.footPads(1.9, 1.9, ctx.material("rubber", { color: 0x24262a }), 0.09);
          pfeet.position.set(PX, PY - 0.26, PZ);
          scene.add(pfeet);
        })();

        makeLabel(0, 1.5, -2.9,
          { top: "THE PATENT", big: "$1,000M", sub: "winner takes all",
            accent: "#d9a441", box: true, bigSize: 72 }, 2.72, 1.36);

        // ---------- chip stacks ----------
        function makeStack(x, count, color, label, cost) {
          var grp = new THREE.Group();
          var geo = keep(ctx.turnedCylinder(A.chip.r, A.chip.r, A.chip.h));
          var m = mat({ color: color, roughness: 0.4, metalness: 0.15,
                        emissive: color, emissiveIntensity: 0.22 });
          // one geometry and one material for every chip in the stack, not one
          // of each per chip
          var rimGeo = keep(ctx.turnedCylinder(A.chip.r * 0.62, A.chip.r * 0.62,
                                               A.chip.h * 1.04, A.chip.h * 0.2));
          var rimMat = mat({ color: 0xf3f1ea, roughness: 0.55 });
          for (var i = 0; i < count; i++) {
            var c = new THREE.Mesh(geo, m);
            c.position.y = 0.06 + i * (A.chip.h + 0.008);
            // an inlaid rim on the chip face, the way a real casino chip reads
            var rim = new THREE.Mesh(rimGeo, rimMat);
            rim.position.copy(c.position);
            grp.add(rim);
            c.rotation.y = i * 0.24;
            grp.add(c);
          }
          grp.position.set(x, 0, 2.3);
          scene.add(grp);
          var hit = new THREE.Mesh(
            keep(ctx.turnedCylinder(A.chip.r + 0.5, A.chip.r + 0.5, count * (A.chip.h + 0.008) + 0.7)),
            keep(new THREE.MeshBasicMaterial({ visible: false })));
          hit.userData.rimTarget = grp;       // the stack of chips
          hit.position.set(x, count * (A.chip.h + 0.008) / 2 + 0.2, 2.3);
          scene.add(hit);
          ctx.pickables.push(hit);
          // label sits on the table in front of its stack, clear of the matrix
          var lab = makeLabel(x, -0.55, 4.15,
            { top: label, big: "$" + cost + "M", sub: "click to commit",
              accent: "#" + color.toString(16).padStart(6, "0"), box: true, bigSize: 68 }, 2.32, 1.16);
          return { grp: grp, hit: hit, label: lab, x: x };
        }
        var stackHigh = makeStack(-3.6, A.chip.high, A.chip.highColor, "HIGH R&D", A.highCost);
        var stackLow = makeStack(3.6, A.chip.low, A.chip.lowColor, "LOW R&D", A.lowCost);

        // ---------- commit slot ----------
        /* the commit slot is a machine, so it gets a mouth, a frame and feet */
        var slotSteel = ctx.material("machinedSteel", { color: 0x8b949f });
        keep(slotSteel);
        /* You push a stack of chips into this, so it should look like a thing
           that takes something in: a recessed throat, a chamfered lead-in,
           guide rollers with end caps, side rails, a bolted frame and lamps.
           A flat box gave the player nothing to aim at. */
        var slotUnit = ctx.intakeSlot({
          w: A.slot.w, h: A.slot.h, d: A.slot.d,
          bodyMat: mat({ color: A.slot.color, roughness: 0.7,
                         emissive: 0xfffb00, emissiveIntensity: 0.10 }),
          throatMat: mat({ color: 0x11151d, roughness: 0.95 }),
          steelMat: keep(ctx.material("machinedSteel", { color: 0x8d97a6 }))
        });
        slotUnit.group.position.set(0, 0.11, 0.9);
        scene.add(slotUnit.group);
        var slot = slotUnit.group;
        makeLabel(0, 1.05, 0.55,
          { top: "COMMIT", sub: "your sealed bid", accent: "#fffb00", box: true }, 1.92, 0.96);

        // ---------- rival envelope ----------
        (function () {
          // a small screwed plate on the face of the machine
          var plate = ctx.nameplate(A.slot.w * 0.5, 0.18, slotSteel,
                                    ctx.material("brass"));
          plate.position.set(slot.position.x, slot.position.y - A.slot.h * 0.18,
                             slot.position.z + A.slot.d * 0.52);
          scene.add(plate);
        })();
        var envelope = new THREE.Mesh(
          keep(ctx.roundedBox(2.0, 0.08, 1.3)),
          mat({ color: 0xe8e2cf, roughness: 0.85 }));
        envelope.position.set(0, 0.2, -1.15);
        scene.add(envelope);
        /* A flat slab is not a sealed envelope. It gets a triangular flap, a
           bound edge on each side, and a wax seal with a raised ring. */
        (function () {
          var shade = mat({ color: 0xd6cfb8, roughness: 0.92 });
          var wax = mat({ color: 0x8e2b28, roughness: 0.42, metalness: 0.05 });
          var EX = 0, EY = 0.2, EZ = -1.15;

          var flap = new THREE.Mesh(
            keep(new THREE.ConeGeometry(1.06, 0.62, 4, 1)), shade);
          flap.rotation.set(Math.PI / 2, 0, Math.PI / 4);
          flap.scale.set(1.34, 1, 0.62);
          flap.position.set(EX, EY + 0.045, EZ - 0.02);
          scene.add(flap);

          [-1, 1].forEach(function (c) {
            var band = new THREE.Mesh(keep(ctx.roundedBox(0.06, 0.10, 1.32, 0.02)), shade);
            band.position.set(EX + c * 0.99, EY, EZ);
            scene.add(band);
          });

          var seal = new THREE.Mesh(keep(ctx.turnedCylinder(0.20, 0.17, 0.07, 0.025)), wax);
          seal.position.set(EX, EY + 0.10, EZ - 0.02);
          scene.add(seal);
          var sealRing = new THREE.Mesh(
            keep(new THREE.TorusGeometry(0.145, 0.018, 12, 48)), wax);
          sealRing.rotation.x = Math.PI / 2;
          sealRing.position.set(EX, EY + 0.135, EZ - 0.02);
          scene.add(sealRing);
        })();

        var rivalLabel = makeLabel(0, 2.15, -1.15,
          { top: "FIRM B", sub: "sealed until you commit", accent: "#9aa6b4", box: true }, 2.40, 1.20);

        // ---------- payoff matrix ----------
        var cells = [];
        var CELLDEF = [
          { r: 0, c: 0, you: "high", rival: "high", a: 100, b: 100, note: "both overspend" },
          { r: 0, c: 1, you: "high", rival: "low", a: 600, b: -100, note: "you win outright" },
          { r: 1, c: 0, you: "low", rival: "high", a: -100, b: 600, note: "they win outright" },
          { r: 1, c: 1, you: "low", rival: "low", a: 400, b: 400, note: "both save" }
        ];
        function cellTex(d, lit) {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 512, _H = 300;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = lit ? "#fff8c4" : "rgba(20,24,33,.92)";
          g.fillRect(0, 0, _W, _H);
          g.strokeStyle = lit ? "#fffb00" : "#39404e"; g.lineWidth = lit ? 12 : 5;
          g.strokeRect(4, 4, _W - 8, _H - 8);
          g.textAlign = "center";
          g.fillStyle = lit ? "#5c5200" : "#7b828c";
          g.font = "bold 24px system-ui, sans-serif";
          g.fillText("YOU " + d.you.toUpperCase() + " · THEM " + d.rival.toUpperCase(), _W / 2, 52);
          g.font = "bold 64px system-ui, sans-serif";
          g.fillStyle = lit ? "#15161a" : "#e6e9ee";
          g.fillText((d.a >= 0 ? "$" + d.a : "-$" + Math.abs(d.a)) + "M", _W / 2, 140);
          g.font = "26px system-ui, sans-serif";
          g.fillStyle = lit ? "#5c5200" : "#94a0b0";
          g.fillText("rival " + (d.b >= 0 ? "$" + d.b : "-$" + Math.abs(d.b)) + "M", _W / 2, 196);
          g.font = "italic 24px Georgia, serif";
          g.fillText(d.note, _W / 2, 246);
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }
        CELLDEF.forEach(function (d) {
          var m = new THREE.Mesh(
            keep(new THREE.PlaneGeometry(A.cell.w, A.cell.h)),
            keep(new THREE.MeshBasicMaterial({ map: cellTex(d, false), transparent: true })));
          m.position.set(-6.2 + d.c * (A.cell.w + A.cell.gap),
                         2.6 - d.r * (A.cell.h + A.cell.gap), -3.4);
          scene.add(m);
          cells.push({ mesh: m, def: d });
        });
        makeLabel(-4.85, 4.55, -3.4,
          { top: "THE PAYOFF MATRIX", sub: "your net profit, then theirs",
            accent: "#9aa6b4", box: true }, 2.72, 1.12);

        var resultLabel = makeLabel(6.3, 3.3, -1.0,
          { top: "NO CALL MADE", sub: "commit a stack to run the race",
            accent: "#9aa6b4", box: true }, 3.20, 1.60);

        // ---------- state ----------
        var committed = null;       // 'high' | 'low'
        var animating = 0;
        var flying = null;
        var played = {};

        function lightCell(you) {
          cells.forEach(function (c) {
            var lit = c.def.you === you && c.def.rival === "high";
            c.mesh.material.map = cellTex(c.def, lit);
            c.mesh.material.needsUpdate = true;
            c.mesh.position.z = lit ? -3.25 : -3.4;
          });
        }

        function commit(choice) {
          if (animating > 0) return;
          committed = choice;
          played[choice] = true;
          animating = 1;
          flying = choice === "high" ? stackHigh.grp : stackLow.grp;

          // the page's own handler runs the race and scores the level
          if (typeof window.playPatentRace === "function") {
            try { window.playPatentRace(choice); } catch (e) { console.error(e); }
          }

          var mine = choice === "high" ? 100 : -100;
          lightCell(choice);
          rivalLabel.material.map = labelTex(
            { top: "FIRM B PLAYED HIGH", sub: "its dominant strategy, every time",
              accent: "#d4573f", box: true });
          rivalLabel.material.needsUpdate = true;

          resultLabel.material.map = labelTex(
            { top: choice === "high" ? "YOU BOTH OVERSPENT" : "THEY TOOK THE PATENT",
              big: (mine >= 0 ? "$" + mine : "-$" + Math.abs(mine)) + "M",
              sub: choice === "high"
                    ? "both playing Low would have paid $400M each"
                    : "outspent, so you lost the $100M and got nothing",
              accent: choice === "high" ? "#d9a441" : "#d4573f", box: true, bigSize: 74 });
          resultLabel.material.needsUpdate = true;

          if (typeof window.GameNote === "function") {
            window.GameNote("raceChoice",
              choice === "high" ? "Committed $400M to High R&D" : "Held back at $100M Low R&D");
            window.GameNote("raceOutcome",
              choice === "high"
                ? "Both firms overspent; $100M each, against $400M each if both had held back"
                : "The rival outspent you and took the patent; you lost $100M");
          }

          if (played.high && played.low) {
            ctx.setStatus("You have played both sides of it", true);
            ctx.setHint("High wins whichever way they go, so both firms take it, and both end up poorer.");
            ctx.setAction("Leave the war room", null);
          } else {
            ctx.setStatus("Committed " + (choice === "high" ? "High" : "Low") +
                          " — try the other stack", false);
            ctx.setHint("Now try the other stack and see whether it would have gone better.");
            ctx.setAction("Leave the war room", null);
          }
          ctx.complete();
        }

        ctx.setBrief(null);
        ctx.setStatus("No call made", false);
        ctx.setHint("Push a stack of chips into the slot to commit your R&D.");

        function fitCamera() {
          var cam = ctx.camera;
          var el = A.camera.elevationDeg * Math.PI / 180;
          var dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el)).normalize();
          var look = new THREE.Vector3().fromArray(A.camera.lookAt);
          var box = new THREE.Box3();
          scene.traverse(function (o) { if (o.isMesh && o.visible) box.expandByObject(o); });
          if (box.isEmpty()) return;
          var cs = [];
          for (var i2 = 0; i2 < 8; i2++) cs.push(new THREE.Vector3(
            (i2 & 1) ? box.max.x : box.min.x, (i2 & 2) ? box.max.y : box.min.y,
            (i2 & 4) ? box.max.z : box.min.z));
          var dist = box.getBoundingSphere(new THREE.Sphere()).radius * 2;
          for (var p = 0; p < 6; p++) {
            cam.position.copy(look).addScaledVector(dir, dist);
            cam.lookAt(look); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
            var worst = 0;
            for (var k = 0; k < cs.length; k++) {
              var v = cs[k].clone().project(cam);
              worst = Math.max(worst, Math.abs(v.x), Math.abs(v.y));
            }
            if (worst < 0.0001) break;
            dist *= worst * A.camera.margin;
          }
          cam.position.copy(look).addScaledVector(dir, dist);
          cam.lookAt(look); cam.updateProjectionMatrix();
        }

        var pulse = 0;
        return {
          update: function (dt) {
            pulse += dt;
            prize.rotation.y += dt * 0.7;
            if (animating > 0) {
              animating = Math.max(0, animating - dt * 1.1);
              if (flying) {
                flying.position.lerp(new THREE.Vector3(0, 0.16, 0.9), Math.min(1, dt * 5));
              }
              // the rival's envelope flips open
              envelope.rotation.x += (-1.0 - envelope.rotation.x) * Math.min(1, dt * 4);
              if (animating === 0) {
                // return the stacks so the other option can be tried
                stackHigh.grp.position.set(stackHigh.x, 0, 2.3);
                stackLow.grp.position.set(stackLow.x, 0, 2.3);
                envelope.rotation.x = 0;
                flying = null;
              }
            } else {
              var beck = !committed ? 1 + Math.sin(pulse * 3.4) * 0.05 : 1;
              stackHigh.grp.scale.setScalar(
                stackHigh.grp.scale.x + (beck - stackHigh.grp.scale.x) * Math.min(1, dt * 8));
            }
          },
          onPointerDown: function (h) {
            if (!h) return;
            if (h.object === stackHigh.hit) { ctx.sfx("slot"); ctx.shake(0.018, 0.10); commit("high"); }
            else if (h.object === stackLow.hit) { ctx.sfx("slot"); ctx.shake(0.018, 0.10); commit("low"); }
          },
          onPointerMove: function (h) {
            ctx.renderer.domElement.style.cursor = h ? "pointer" : "default";
          },
          onResize: fitCamera,
          dispose: function () { junk.forEach(function (d) { try { d.dispose(); } catch (e) {} }); }
        };
      }
    });

    window.launchRace = function () { window.Interludes.play("race"); };
  });
})();
