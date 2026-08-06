/* ============================================================
   interlude-reckoning.js — the end of your term
   Condition B embodied layer.

   Not another wall of cards. The player stands inside their own
   term: ten decisions arranged in a ring around them, a monument
   at the centre built out of the record itself, and a camera that
   orbits so the whole term passes in front of them. Drag to turn
   the ring, click a stone to read what that decision actually did.

   The monument's strata are the modules, stacked in order and lit
   where the objective was met. Its height is the term. The final
   grade is cut into the capstone.

   Everything here is read from the record the game kept while the
   player was playing. No line of it is written in advance.
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

  function wrap(g, text, x, y, maxW, lh, maxLines) {
    var words = String(text || "").split(/\s+/), line = "", lines = 0;
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (g.measureText(test).width > maxW && line) {
        g.fillText(line, x, y); line = words[i]; y += lh; lines++;
        if (maxLines && lines >= maxLines) return y;
      } else line = test;
    }
    if (line) { g.fillText(line, x, y); y += lh; }
    return y;
  }

  whenReady(function () {

    window.Interludes.register("reckoning", {
      kicker: "End of term",
      title: "The reckoning",
      step: "Everything you decided",
      instructions: "Drag to turn the ring. Click a stone to read that decision.",

      /* The far side of the ring recedes into the page rather than ending at a
         hard silhouette, which gives the monument somewhere to stand. Density is
         deliberately low: the stones carry text the player has to read. */
      fog: { color: 0x0e111a, density: 0.02 },

      assets: {
        ring:   { radius: 7.4, stoneW: 2.9, stoneH: 2.1 },
        column: { r: 1.25, strata: 0.52, gap: 0.06 },
        camera: { elevationDeg: 13, margin: 1.16, lookAt: [0, 1.1, 0] }
      },

      build: function (ctx) {
        var THREE = ctx.THREE, scene = ctx.scene, A = ctx.assets;
        var junk = [];
        function keep(o) { junk.push(o); return o; }
        function mat(o) { return keep(new THREE.MeshStandardMaterial(o)); }

        var rec = (typeof window.GameFullRecord === "function")
                    ? window.GameFullRecord()
                    : { modules: [], access: 0, innov: 0, levels: 0, rulings: [] };
        var mods = rec.modules || [];
        var access = rec.access || 0, innov = rec.innov || 0;
        var balanced = access >= 50 && innov >= 40;
        var total = access + innov + (balanced ? 20 : 0);
        var grade, verdict;
        if (balanced && total >= 130) {
          grade = "A";
          verdict = "You widened access and kept invention alive. That balance is the thing real " +
                    "policy keeps failing to hold.";
        } else if (access >= 60 && innov < 40) {
          grade = "B";
          verdict = "Access soared. You left little reason to invent the next drug, and that bill " +
                    "arrives later than your term does.";
        } else if (innov >= 55 && access < 45) {
          grade = "C";
          verdict = "You protected the incentive to invent and the pricing power that came with " +
                    "it. Most patients stayed priced out.";
        } else {
          grade = "B";
          verdict = "A mixed term. The two levers pulled against each other the whole way, which " +
                    "is exactly what they do.";
        }

        // ---------- ground and sky ----------
        var ground = new THREE.Mesh(
          keep(new THREE.CylinderGeometry(13, 13, 0.4, 56)),
          mat({ color: 0x10141c, roughness: 0.95 }));
        ground.position.y = -2.4;
        scene.add(ground);
        for (var r2 = 0; r2 < 3; r2++) {
          var halo = new THREE.Mesh(
            keep(new THREE.TorusGeometry(4.6 + r2 * 2.5, 0.02, 6, 90)),
            mat({ color: 0x2f4358, roughness: 1,
                  emissive: 0x2f4358, emissiveIntensity: 0.3 }));
          halo.rotation.x = Math.PI / 2;
          halo.position.y = -2.18;
          scene.add(halo);
        }

        // ---------- the monument ----------
        var column = new THREE.Group();
        scene.add(column);
        for (var i = 0; i < mods.length; i++) {
          var m = mods[i];
          var seg = new THREE.Mesh(
            keep(new THREE.CylinderGeometry(A.column.r - i * 0.03, A.column.r - i * 0.03 + 0.02,
                                            A.column.strata, 8)),
            mat({ color: m.ok ? 0x2f5f45 : 0x2a2f3a, roughness: 0.7,
                  emissive: m.ok ? 0x3fae6b : 0x000000,
                  emissiveIntensity: m.ok ? 0.22 : 0 }));
          seg.position.y = -2.0 + i * (A.column.strata + A.column.gap) + A.column.strata / 2;
          seg.rotation.y = i * 0.22;
          column.add(seg);
        }
        var capY = -2.0 + mods.length * (A.column.strata + A.column.gap) + 0.5;

        function capTex() {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 512, _H = 512;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = "rgba(10,12,18,.95)"; g.fillRect(0, 0, _W, _H);
          g.strokeStyle = "#fffb00"; g.lineWidth = 10; g.strokeRect(6, 6, 500, 500);
          g.textAlign = "center";
          g.fillStyle = "#fffb00"; g.font = "bold 30px system-ui, sans-serif";
          g.fillText("FINAL GRADE", 256, 74);
          g.fillStyle = "#fff"; g.font = "bold 210px system-ui, sans-serif";
          g.fillText(grade, 256, 250);
          g.fillStyle = "#9aa6b4"; g.font = "26px system-ui, sans-serif";
          g.fillText("score " + total, 256, 310);
          g.fillStyle = "#3fae6b"; g.font = "bold 30px system-ui, sans-serif";
          g.fillText("ACCESS " + access, 256, 372);
          g.fillStyle = "#4f86c6";
          g.fillText("INNOVATION " + innov, 256, 420);
          g.fillStyle = "#7b828c"; g.font = "23px system-ui, sans-serif";
          g.fillText(rec.levels + " of 10 objectives met", 256, 466);
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }
        var capstone = new THREE.Mesh(
          keep(new THREE.PlaneGeometry(3.0, 3.0)),
          keep(new THREE.MeshBasicMaterial({ map: capTex(), transparent: true })));
        capstone.position.set(0, capY + 1.5, 0);
        scene.add(capstone);

        // ---------- the ring of decisions ----------
        function stoneTex(m, open) {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = open ? 1024 : 620, _H = open ? 680 : 460;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = "#f4efe2"; g.fillRect(0, 0, _W, _H);
          var accent = m.ok ? "#1d6b3a" : "#8a1c1c";
          g.strokeStyle = accent; g.lineWidth = open ? 12 : 9;
          g.strokeRect(6, 6, _W - 12, _H - 12);
          var pad = open ? 52 : 36;
          g.fillStyle = accent;
          g.font = "bold " + (open ? 26 : 21) + "px system-ui, sans-serif";
          g.fillText("MODULE " + m.n + (m.ok ? "  ·  OBJECTIVE MET" : "  ·  LEFT OPEN"), pad, open ? 74 : 60);
          g.fillStyle = "#15161a";
          g.font = "bold " + (open ? 44 : 34) + "px Georgia, serif";
          var y = wrap(g, m.name, pad, open ? 136 : 112, _W - pad * 2, open ? 50 : 40, 2);
          g.fillStyle = "#3a4048";
          g.font = (open ? 27 : 22) + "px system-ui, sans-serif";
          y = wrap(g, m.did, pad, y + (open ? 26 : 16), _W - pad * 2, open ? 34 : 28, 3);
          g.strokeStyle = "rgba(0,0,0,.15)"; g.lineWidth = 2;
          g.beginPath(); g.moveTo(pad, y + 14); g.lineTo(_W - pad, y + 14); g.stroke();
          g.fillStyle = "#6b6250";
          g.font = "bold " + (open ? 21 : 18) + "px system-ui, sans-serif";
          g.fillText("WHAT IT PRODUCED", pad, y + 52);
          g.fillStyle = "#111318";
          g.font = (open ? 28 : 23) + "px Georgia, serif";
          wrap(g, m.out, pad, y + 90, _W - pad * 2, open ? 34 : 28, open ? 6 : 3);
          if (!open) {
            g.fillStyle = "#7b828c"; g.font = "italic 16px system-ui, sans-serif";
            g.fillText("click to read", pad, _H - 26);
          }
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }

        var stones = [];
        var ringGroup = new THREE.Group();
        scene.add(ringGroup);
        mods.forEach(function (m, i) {
          var ang = (i / mods.length) * Math.PI * 2;
          var s = new THREE.Mesh(
            keep(new THREE.PlaneGeometry(A.ring.stoneW, A.ring.stoneH)),
            keep(new THREE.MeshBasicMaterial({ map: stoneTex(m, false), transparent: true,
                                               opacity: 1, side: THREE.FrontSide })));
          s.position.set(Math.sin(ang) * A.ring.radius, 0.9, Math.cos(ang) * A.ring.radius);
          s.lookAt(0, 0.9, 0);
          s.rotateY(Math.PI);              // face outward toward the camera
          s.userData = { mod: m, ang: ang };
          ringGroup.add(s);
          ctx.pickables.push(s);
          stones.push(s);
        });

        // ---------- the verdict slab ----------
        function verdictTex() {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 1280, _H = 280;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = "rgba(10,12,18,0.94)"; g.fillRect(0, 0, _W, _H);
          g.strokeStyle = "#fffb00"; g.lineWidth = 6;
          g.beginPath(); g.moveTo(0, 3); g.lineTo(_W, 3); g.stroke();
          g.fillStyle = "#fffb00"; g.font = "bold 28px system-ui, sans-serif";
          g.fillText("THE VERDICT ON YOUR TERM", 40, 58);
          g.fillStyle = "#e6e9ee"; g.font = "27px Georgia, serif";
          var y = wrap(g, verdict, 40, 112, _W - 80, 38);
          g.fillStyle = "#9aa6b4"; g.font = "italic 24px Georgia, serif";
          var line = rec.rulings && rec.rulings.length
            ? "It began with " + rec.rulings.length + " rulings: you opened the market in " +
              rec.opened + " and upheld monopoly in " + rec.granted + "."
            : "It began at the bench, with cases you never ruled on.";
          wrap(g, line, 40, y + 14, _W - 80, 32);
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }
        var verdictSlab = new THREE.Mesh(
          keep(new THREE.PlaneGeometry(9.6, 2.1)),
          keep(new THREE.MeshBasicMaterial({ map: verdictTex(), transparent: true })));
        verdictSlab.position.set(0, -3.55, 0);
        scene.add(verdictSlab);

        // ---------- state ----------
        var spin = 0, autoSpin = 0.085;
        var dragging = false, lastX = 0;
        var openStone = null;
        var pulse = 0;

        ctx.setBrief(null);
        ctx.setStatus("Grade " + grade + "  ·  " + rec.levels + " of 10 objectives", true);
        ctx.setHint("Drag to turn the ring. Click a stone to read that decision.");
        ctx.complete();
        ctx.setAction("End the term", null);

        function openIt(s) {
          if (openStone === s) { closeIt(); return; }
          if (openStone) closeIt();
          openStone = s;
          s.material.map = stoneTex(s.userData.mod, true);
          s.material.needsUpdate = true;
          s.renderOrder = 20;
          s.material.depthTest = false;
          ctx.setHint("Click it again to set it back in the ring.");
        }
        function closeIt() {
          if (!openStone) return;
          openStone.material.map = stoneTex(openStone.userData.mod, false);
          openStone.material.needsUpdate = true;
          openStone.renderOrder = 0;
          openStone.material.depthTest = true;
          openStone = null;
          ctx.setHint("Drag to turn the ring. Click a stone to read that decision.");
        }

        function fitCamera() {
          var cam = ctx.camera;
          var el = A.camera.elevationDeg * Math.PI / 180;
          var dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el)).normalize();
          var look = new THREE.Vector3().fromArray(A.camera.lookAt);
          // frame the ring plus the monument, from outside the ring
          var radius = A.ring.radius + A.ring.stoneW;
          var height = capY + 3.2;
          var dist = Math.max(radius / Math.tan((cam.fov * Math.PI / 180) / 2) * 0.62,
                              height * 1.25) * A.camera.margin;
          cam.position.copy(look).addScaledVector(dir, dist);
          cam.lookAt(look);
          cam.updateProjectionMatrix();
        }

        return {
          update: function (dt) {
            pulse += dt;
            if (!dragging && !openStone) spin += dt * autoSpin;
            ringGroup.rotation.y = spin;
            column.rotation.y = -spin * 0.4;
            capstone.rotation.y = 0;
            // the open stone rides out in front of the reader
            var camDir = new THREE.Vector3();
            stones.forEach(function (s) {
              var want = (s === openStone) ? 1.85 : 1;
              s.scale.setScalar(s.scale.x + (want - s.scale.x) * Math.min(1, dt * 8));
              // Stones on the far side of the ring face away from the reader,
              // so their text would show through mirrored. Fade them out and
              // let the ring bring each one round to be read.
              var n = new THREE.Vector3(0, 0, 1).applyQuaternion(s.getWorldQuaternion(new THREE.Quaternion()));
              camDir.copy(ctx.camera.position).sub(s.getWorldPosition(new THREE.Vector3())).normalize();
              var facing = n.dot(camDir);
              var target = (s === openStone) ? 1 : Math.max(0, Math.min(1, (facing - 0.05) * 3.2));
              s.material.opacity += (target - s.material.opacity) * Math.min(1, dt * 6);
              s.visible = s.material.opacity > 0.02;
            });
            capstone.position.y = capY + 1.5 + Math.sin(pulse * 1.3) * 0.05;
          },
          onPointerDown: function (h, ev) {
            if (h && stones.indexOf(h.object) >= 0) { openIt(h.object); return; }
            if (openStone) { closeIt(); return; }
            dragging = true;
            lastX = ev ? ev.clientX : 0;
          },
          onPointerMove: function (h, ev) {
            if (!dragging) {
              ctx.renderer.domElement.style.cursor = h ? "pointer" : "grab";
              return;
            }
            ctx.renderer.domElement.style.cursor = "grabbing";
            if (ev) { spin += (ev.clientX - lastX) * 0.005; lastX = ev.clientX; }
          },
          onPointerUp: function () {
            dragging = false;
            ctx.renderer.domElement.style.cursor = "default";
          },
          onResize: fitCamera,
          dispose: function () { junk.forEach(function (d) { try { d.dispose(); } catch (e) {} }); }
        };
      }
    });

    window.launchReckoning = function () { window.Interludes.play("reckoning"); };
  });
})();
