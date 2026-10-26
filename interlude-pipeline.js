/* ============================================================
   interlude-pipeline.js — the pipeline: why patents exist (module 2)
   Condition B embodied layer.

   Placed before the courtroom so the case for patents is made before
   evergreening and compulsory licensing are. The player loads candidate
   cancer drugs into a trial rack five at a time and runs the trials. At
   the oncology success rate most of the rack goes dark. Then an
   exclusivity dial sets how many years the survivor keeps the market
   before generics enter, and a tower shows the net revenue it must earn
   each of those years to repay its development.

   Objective: load at least 30 candidates (enough to expect one
   approval at 3.4%) and run the trials.

   Every number is read from the page model (window.ModelData.rd), the
   same one Condition A's section 2 uses:
     3.4%      oncology programmes in trials that reached approval,
               Wong, Siah & Lo (2019), Biostatistics 20(2):273-286
     $2,771.6M median capitalized R&D per approved antineoplastic and
               immunomodulating agent, 2018 USD, Wouters, McKee &
               Luyten (2020), JAMA 323(9):844-853, corrected 2022
     10.5%     the cost of capital in that estimate
     R(T) = C r / (1 - (1 + r)^-T), the constant yearly net revenue
               over T years of exclusivity whose present value is C.
   The rack shows the expected outcome, not a random draw, so every
   participant sees the same result for the same inputs.
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

    window.Interludes.register("pipeline", {
      kicker: "The pipeline",
      title: "Why patents exist",
      step: "R&D attrition, cost and exclusivity",
      instructions: "Click ADD 5 to load candidates, then RUN TRIALS. Then turn the exclusivity dial.",

      assets: {
        rack: { cols: 12, rows: 5, gap: 0.46, x: -1.2, y: 0.9, z: -0.6 },
        vial: { r: 0.12, h: 0.34, idle: 0x8892a4, loaded: 0xd9a441, failed: 0x2c323d, passed: 0x3fae6b },
        target: 30,
        dialYears: [20, 15, 10, 5, 2, 1],
        tower: { x: 6.3, w: 1.0, maxH: 5.0 },
        camera: { elevationDeg: 16, margin: 1.12, lookAt: [0.6, 1.0, 0] }
      },

      build: function (ctx) {
        var THREE = ctx.THREE, scene = ctx.scene, A = ctx.assets;
        var junk = [];
        function keep(o) { junk.push(o); return o; }
        function mat(o) { return keep(ctx.tunedStandard(o)); }
        var labelTex = ctx.labelTexture;
        var makeLabel = ctx.makeLabel;

        var RD = (window.ModelData && window.ModelData.rd) ||
                 { successRate: 0.034, costPerApproval: 2771.6, costOfCapital: 0.105 };
        function required(T) {
          return window.ModelData ? window.ModelData.requiredRevenue(T)
            : RD.costPerApproval * RD.costOfCapital / (1 - Math.pow(1 + RD.costOfCapital, -T));
        }
        function money(v) { return "$" + Math.round(v).toLocaleString("en-US") + "M"; }

        // ---------- bench ----------
        var floor = new THREE.Mesh(
          keep(ctx.roundedBox(17, 0.3, 8)),
          ctx.wood("teak", { repeat: [5, 2] }));
        floor.position.set(0.6, -0.15, 0);
        scene.add(floor);
        (function () {
          var subMat = keep(ctx.wood("walnut", { repeat: [3, 1] }));
          var W = 17, H = 0.3, DD = 8;
          var apron = new THREE.Mesh(keep(ctx.roundedBox(W * 0.95, H * 0.9, DD * 0.92, H * 0.12)), subMat);
          apron.position.set(0.6, -0.15 - H * 0.85, 0);
          scene.add(apron);
          var legGeo = keep(ctx.roundedBox(H * 0.9, H * 3.2, H * 0.9, H * 0.12));
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
            var leg = new THREE.Mesh(legGeo, subMat);
            leg.position.set(0.6 + c[0] * (W / 2 - H * 1.1), -0.15 - H * 2.3, c[1] * (DD / 2 - H * 1.1));
            scene.add(leg);
          });
        })();

        // ---------- the trial rack ----------
        var R = A.rack;
        var rackW = R.cols * R.gap + 0.4, rackH = R.rows * R.gap + 0.4;
        var board = new THREE.Mesh(keep(ctx.roundedBox(rackW, rackH, 0.18, 0.04)),
          keep(ctx.material("paintedMetal", { color: 0x232a36 })));
        board.position.set(R.x, R.y + rackH / 2 - 0.2, R.z - 0.25);
        scene.add(board);
        var shelfMat = keep(ctx.material("machinedSteel", { color: 0x8a939f }));
        for (var sr = 0; sr < R.rows; sr++) {
          var shelf = new THREE.Mesh(keep(ctx.roundedBox(rackW - 0.1, 0.05, 0.36, 0.015)), shelfMat);
          shelf.position.set(R.x, R.y + sr * R.gap - 0.02, R.z);
          scene.add(shelf);
        }
        var vialGeo = keep(ctx.turnedCylinder(A.vial.r, A.vial.r, A.vial.h, 0.03));
        var capGeo = keep(ctx.turnedCylinder(A.vial.r * 1.08, A.vial.r * 1.08, 0.07, 0.02));
        var capMat = keep(ctx.material("machinedSteel", { color: 0xc9ced6 }));
        var M = {
          idle: mat({ color: A.vial.idle, roughness: 0.6, transparent: true, opacity: 0.25 }),
          loaded: mat({ color: A.vial.loaded, roughness: 0.35, emissive: A.vial.loaded, emissiveIntensity: 0.25 }),
          failed: mat({ color: A.vial.failed, roughness: 0.8 }),
          passed: mat({ color: A.vial.passed, roughness: 0.3, emissive: A.vial.passed, emissiveIntensity: 0.7 })
        };
        var vials = [];
        var slots = R.cols * R.rows;
        for (var i = 0; i < slots; i++) {
          var col = i % R.cols, row = Math.floor(i / R.cols);
          var v = new THREE.Mesh(vialGeo, M.idle);
          var x = R.x - (R.cols - 1) * R.gap / 2 + col * R.gap;
          var y = R.y + row * R.gap + A.vial.h / 2;
          v.position.set(x, y, R.z);
          scene.add(v);
          var cap = new THREE.Mesh(capGeo, capMat);
          cap.position.set(x, y + A.vial.h / 2 + 0.035, R.z);
          cap.visible = false;
          scene.add(cap);
          vials.push({ mesh: v, cap: cap });
        }
        var rackLabel = makeLabel(R.x, R.y + rackH + 0.55, R.z,
          { top: "CANDIDATES IN TRIALS", big: "0", sub: "click ADD 5 to load", accent: "#d9a441", box: true, bigSize: 72 },
          3.2, 1.6);
        makeLabel(R.x - 4.4, 3.3, R.z,
          { top: "SUCCESS RATE", big: "3.4%", sub: "cancer drugs in trials that reach approval",
            accent: "#3fae6b", box: true, bigSize: 72 }, 3.2, 1.6);

        // ---------- buttons on the bench ----------
        function makeButton(x, title, color) {
          var g = new THREE.Group();
          var base = new THREE.Mesh(keep(ctx.roundedBox(1.5, 0.22, 0.9, 0.05)),
            keep(ctx.material("paintedMetal", { color: 0x2a3140 })));
          g.add(base);
          var cap = new THREE.Mesh(keep(ctx.turnedCylinder(0.34, 0.38, 0.18, 0.04)),
            mat({ color: color, roughness: 0.3, emissive: color, emissiveIntensity: 0.45 }));
          cap.position.y = 0.2;
          g.add(cap);
          g.position.set(x, 0.12, 2.6);
          scene.add(g);
          var hit = new THREE.Mesh(keep(ctx.roundedBox(1.7, 1.0, 1.2)),
            keep(new THREE.MeshBasicMaterial({ visible: false })));
          hit.position.set(x, 0.45, 2.6);
          hit.userData.rimTarget = cap;
          scene.add(hit);
          ctx.pickables.push(hit);
          var lab = makeLabel(x, -0.6, 4.1, { top: title, sub: "click", accent: "#" + color.toString(16).padStart(6, "0"), box: true },
            3.0, 1.5);
          return { grp: g, cap: cap, hit: hit, label: lab };
        }
        var btnAdd = makeButton(-3.6, "ADD 5", 0xd9a441);
        var btnRun = makeButton(-0.6, "RUN TRIALS", 0x3fae6b);

        // ---------- exclusivity dial ----------
        var dial = ctx.toggleSwitch({
          w: 0.55, h: 1.0, d: 0.34,
          paddleMat: mat({ color: 0xd4573f, roughness: 0.35, metalness: 0.35, emissive: 0xd4573f, emissiveIntensity: 0.18 }),
          housingMat: keep(ctx.material("paintedMetal", { color: 0x2a3140 })),
          steelMat: keep(ctx.material("machinedSteel", { color: 0x8a939f })),
          lampMat: mat({ color: 0xd4573f, roughness: 0.25, emissive: 0xd4573f, emissiveIntensity: 0.7 })
        });
        dial.group.position.set(2.6, 0.02, 2.6);
        scene.add(dial.group);
        var dialHit = new THREE.Mesh(keep(ctx.roundedBox(1.7, 1.6, 1.4)),
          keep(new THREE.MeshBasicMaterial({ visible: false })));
        dialHit.position.set(2.6, 0.6, 2.6);
        dialHit.userData.rimTarget = dial.paddle;
        scene.add(dialHit);
        ctx.pickables.push(dialHit);
        var dialLabel = makeLabel(2.6, -0.6, 4.1,
          { top: "EXCLUSIVITY", big: "20 yrs", sub: "before generics enter · click", accent: "#d4573f", box: true, bigSize: 64 },
          3.0, 1.5);

        // ---------- the revenue tower ----------
        var T = A.tower;
        var tower = new THREE.Mesh(keep(ctx.roundedBox(T.w, 1, T.w, 0.06)),
          mat({ color: 0xd4573f, roughness: 0.45, emissive: 0xd4573f, emissiveIntensity: 0.2 }));
        scene.add(tower);
        var plinthT = new THREE.Mesh(keep(ctx.roundedBox(T.w * 1.5, 0.16, T.w * 1.5, 0.04)), shelfMat);
        plinthT.position.set(T.x, 0.08, 0);
        scene.add(plinthT);
        var towerLabel = makeLabel(T.x, 6.2, 0,
          { top: "NET REVENUE NEEDED / YEAR", big: "$337M", sub: "to repay $2,772M over 20 years at 10.5%",
            accent: "#d4573f", box: true, bigSize: 70 }, 3.4, 1.7);
        makeLabel(T.x - 3.1, 4.9, -1.0,
          { top: "COST PER APPROVED CANCER DRUG", big: "$2,772M",
            sub: "median, failures and capital included (2018 $)", accent: "#9aa6b4", box: true, bigSize: 64 },
          3.2, 1.6);

        // ---------- state ----------
        var loaded = 0, ran = false, yearsIdx = 0, won = false;
        function years() { return A.dialYears[yearsIdx]; }

        function pushToPage(includeCandidates) {
          var t = document.getElementById("slider-rd-years");
          if (t) { t.value = years(); t.dispatchEvent(new Event("input", { bubbles: true })); }
          if (includeCandidates) {
            var n = document.getElementById("slider-rd-candidates");
            if (n) { n.value = Math.max(1, loaded); n.dispatchEvent(new Event("input", { bubbles: true })); }
          }
        }

        function refresh() {
          var expected = loaded * RD.successRate;
          var passedCount = ran ? Math.floor(expected + 1e-9) : 0;
          for (var k = 0; k < vials.length; k++) {
            var on = k < loaded;
            vials[k].cap.visible = on;
            vials[k].mesh.material = !on ? M.idle : !ran ? M.loaded : (k < passedCount ? M.passed : M.failed);
          }
          rackLabel.material.map = labelTex(ran
            ? { top: "AFTER TRIALS", big: expected.toFixed(2), sub: "expected approvals from " + loaded + " candidates",
                accent: "#3fae6b", box: true, bigSize: 72 }
            : { top: "CANDIDATES IN TRIALS", big: String(loaded), sub: loaded ? "add more, or RUN TRIALS" : "click ADD 5 to load",
                accent: "#d9a441", box: true, bigSize: 72 });
          rackLabel.material.needsUpdate = true;

          var rev = required(years());
          var h = Math.max(0.1, (rev / required(1)) * T.maxH);
          tower.scale.y = h;
          tower.position.set(T.x, 0.16 + h / 2, 0);
          towerLabel.material.map = labelTex(
            { top: "NET REVENUE NEEDED / YEAR", big: money(rev),
              sub: "to repay $2,772M over " + years() + (years() === 1 ? " year" : " years") + " at 10.5%",
              accent: "#d4573f", box: true, bigSize: 70 });
          towerLabel.material.needsUpdate = true;
          dialLabel.material.map = labelTex(
            { top: "EXCLUSIVITY", big: years() + " yrs", sub: "before generics enter · click",
              accent: "#d4573f", box: true, bigSize: 64 });
          dialLabel.material.needsUpdate = true;

          if (!won) {
            if (ran && expected >= 1) {
              won = true;
              ctx.setStatus("Funded: " + expected.toFixed(2) + " expected approvals", true);
              ctx.setHint("Now turn the exclusivity dial: fewer years before generics, more revenue needed each year.");
              ctx.setAction("Leave the lab", null);
              ctx.complete();
            } else if (ran) {
              ctx.setStatus(expected.toFixed(2) + " expected approvals — load at least " + A.target + " to expect one", false);
            } else {
              ctx.setStatus(loaded + " candidates loaded — " + A.target + " needed to expect one approval", false);
            }
          }
        }

        ctx.setBrief(null);
        pushToPage(false);
        refresh();

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
              var vv = cs[k].clone().project(cam);
              worst = Math.max(worst, Math.abs(vv.x), Math.abs(vv.y));
            }
            if (worst < 0.0001) break;
            dist *= worst * A.camera.margin;
          }
          cam.position.copy(look).addScaledVector(dir, dist);
          cam.lookAt(look); cam.updateProjectionMatrix();
        }

        var pulse = 0, press = { add: 0, run: 0 };
        return {
          update: function (dt) {
            pulse += dt;
            press.add = Math.max(0, press.add - dt * 4);
            press.run = Math.max(0, press.run - dt * 4);
            btnAdd.cap.position.y = 0.2 - press.add * 0.08;
            btnRun.cap.position.y = 0.2 - press.run * 0.08;
            var wantDial = -0.42 + 0.84 * (yearsIdx / (A.dialYears.length - 1));
            dial.paddle.rotation.z += (wantDial - dial.paddle.rotation.z) * Math.min(1, dt * 8);
            var beck = (!won && loaded < A.target) ? 1 + Math.sin(pulse * 3.6) * 0.06 : 1;
            btnAdd.grp.scale.setScalar(btnAdd.grp.scale.x + (beck - btnAdd.grp.scale.x) * Math.min(1, dt * 8));
            var beckR = (!ran && loaded >= A.target) ? 1 + Math.sin(pulse * 3.6) * 0.06 : 1;
            btnRun.grp.scale.setScalar(btnRun.grp.scale.x + (beckR - btnRun.grp.scale.x) * Math.min(1, dt * 8));
          },
          onPointerDown: function (h) {
            if (!h) return;
            if (h.object === btnAdd.hit) {
              if (loaded >= slots) { ctx.setHint("The rack is full."); return; }
              loaded = Math.min(slots, loaded + 5);
              ran = false;
              press.add = 1;
              ctx.sfx("tick");
              refresh();
            } else if (h.object === btnRun.hit) {
              if (!loaded) { ctx.setHint("Load some candidates first."); return; }
              ran = true;
              press.run = 1;
              ctx.sfx("switch");
              ctx.shake(0.012, 0.08);
              pushToPage(true);       // the page's check marks the objective
              refresh();
              if (loaded * RD.successRate < 1) {
                ctx.setHint("Most candidates fail. At 3.4%, " + loaded + " candidates are not enough to expect one approval. Add more.");
              }
            } else if (h.object === dialHit) {
              yearsIdx = (yearsIdx + 1) % A.dialYears.length;
              ctx.sfx("switch");
              pushToPage(ran);
              refresh();
            }
          },
          onPointerMove: function (h) {
            ctx.renderer.domElement.style.cursor = h ? "pointer" : "default";
          },
          onResize: fitCamera,
          dispose: function () { junk.forEach(function (d) { try { d.dispose(); } catch (e) {} }); }
        };
      }
    });

    window.launchPipeline = function () { window.Interludes.play("pipeline"); };
  });
})();
