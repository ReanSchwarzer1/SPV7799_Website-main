/* ============================================================
   interlude-molecule.js — the comparison bench (module 1)
   Condition B embodied layer.

   Two acts, both done with the hands:

   ACT 1 "are they the same drug?"  The player physically drags
   the US sample across and drops it onto the Indian sample. The
   two structures superimpose, flash, and fuse: one compound.

   ACT 2 "then why the price?"  A single banknote for one US pill
   appears. Drag it into the dispenser and both market tubes fill
   at once: one pill on the left, a cascade of about a hundred and
   twenty on the right, for the same money.

   All context is diegetic: labels, stamps and readouts live on
   objects in the scene rather than in a panel over it.

   Geometry is the real imatinib structure, heavy atoms and bonds
   from PubChem CID 5291 (C29H31N7O, 37 heavy atoms, 41 bonds),
   embedded so the app runs offline. Hydrogens omitted.
   Prices are the artifact's own figures: $179.93 and ~$1.50.
   ============================================================ */

(function () {
  "use strict";

  var ATOMS =
    "O,-0.828,0.249,-1.042;N,6.458,0.266,-0.655;N,8.515,-0.162,1.331;N,-0.107,-1.833,-0.233;" +
    "N,-4.945,-1.888,-0.270;N,-4.375,0.358,0.104;N,-6.608,-0.258,-0.560;N,-2.852,4.834,0.299;" +
    "C,6.155,0.324,0.780;C,7.849,0.663,-0.902;C,7.123,-0.558,1.577;C,8.817,-0.217,-0.105;" +
    "C,5.535,1.108,-1.415;C,9.436,-1.005,2.089;C,4.104,0.676,-1.235;C,3.783,-0.672,-1.305;" +
    "C,3.126,1.633,-1.002;C,2.456,-1.071,-1.139;C,1.800,1.234,-0.836;C,1.465,-0.118,-0.905;" +
    "C,0.083,-0.535,-0.730;C,-1.324,-2.513,0.015;C,-3.722,-2.541,-0.003;C,-2.523,-1.871,-0.246;" +
    "C,-3.703,-3.843,0.498;C,-1.288,-3.804,0.512;C,-2.487,-4.474,0.756;C,-4.972,-4.584,0.769;" +
    "C,-5.327,-0.534,-0.241;C,-4.775,1.646,0.123;C,-3.756,2.599,0.491;C,-6.057,2.055,-0.184;" +
    "C,-6.940,1.050,-0.521;C,-2.724,2.249,1.356;C,-3.774,3.893,-0.005;C,-1.757,3.189,1.692;" +
    "C,-1.865,4.456,1.142";
  var BONDS =
    "0,20,2;1,8,1;1,9,1;1,12,1;2,10,1;2,11,1;2,13,1;3,20,1;3,21,1;4,22,1;4,28,1;5,28,1;" +
    "5,29,2;6,28,2;6,32,1;7,34,1;7,36,2;8,10,1;9,11,1;12,14,1;14,15,2;14,16,1;15,17,1;" +
    "16,18,2;17,19,2;18,19,1;19,20,1;21,23,2;21,25,1;22,23,1;22,24,2;24,26,1;24,27,1;" +
    "25,26,2;29,30,1;29,31,1;30,33,1;30,34,2;31,32,2;33,35,2;35,36,1";

  function parseAtoms(s) {
    return s.split(";").map(function (r) { var p = r.split(",");
      return { el: p[0], x: +p[1], y: +p[2], z: +p[3] }; });
  }
  function parseBonds(s) {
    return s.split(";").map(function (r) { var p = r.split(",");
      return { a: +p[0], b: +p[1] }; });
  }

  function whenReady(fn) {
    if (window.Interludes) return fn();
    var n = 0, t = setInterval(function () {
      if (window.Interludes) { clearInterval(t); fn(); }
      else if (++n > 100) clearInterval(t);
    }, 30);
  }

  whenReady(function () {

    window.Interludes.register("molecule", {
      kicker: "The comparison bench",
      title: "Two samples, one molecule",
      step: "Imatinib · Gleevec",
      instructions: "Drag the red sample across and drop it onto the green one.",

      assets: {
        scale: 0.16,
        // ball and stick, not space filling. At van der Waals radius the
        // spheres merge and the bonds vanish inside them, which is why the
        // molecule read as a blob rather than a structure.
        // A carbon-carbon bond is about 1.4 angstrom, which at scale 0.16 is
        // roughly 0.22 world units. An atom radius anywhere near that swallows
        // the bond whole, which is why the structure kept reading as a heap of
        // spheres. A quarter of the bond length is what makes it skeletal.
        atomRadius: { C: 0.062, N: 0.072, O: 0.072 },
        elementColor: { C: 0xc9ced6, N: 0x5b7fd4, O: 0xd4573f },
        bond:   { radius: 0.030, color: 0xb6bec9 },
        us:      { tint: 0xd4573f, name: "UNITED STATES", price: 179.93, pills: 1 },
        india:   { tint: 0x3fae6b, name: "INDIA", price: 1.50, pills: 120 },
        plinth: { r: 1.5, h: 0.18, color: 0x171b23 },
        tube:   { r: 0.62, h: 3.1, color: 0x8fb6d8 },
        pill:   { r: 0.11, len: 0.26 },
        note:   { w: 1.5, h: 0.72 },
        snapDistance: 1.9,          // how close the drop has to be: generous
        camera: { elevationDeg: 14, margin: 1.14, lookAt: [0, 0.2, 0] }
      },

      build: function (ctx) {
        var THREE = ctx.THREE, scene = ctx.scene, A = ctx.assets;
        var atoms = parseAtoms(ATOMS), bonds = parseBonds(BONDS);
        var junk = [];
        function keep(o) { junk.push(o); return o; }

        var LX = -3.1, RX = 3.1;

        // ---------- diegetic signage ----------
        function signTexture(lines) {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 512, _H = 256;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.clearRect(0, 0, _W, _H);
          g.fillStyle = "rgba(8,10,15,0.9)";
          g.fillRect(0, 0, _W, _H);
          g.strokeStyle = lines.accent; g.lineWidth = 7;
          g.strokeRect(4, 4, _W - 8, _H - 8);
          g.textAlign = "center";
          g.fillStyle = lines.accent;
          g.font = "bold 36px system-ui, sans-serif";
          g.fillText(lines.top || "", _W / 2, 62, _W - 40);
          if (lines.big) {
            g.fillStyle = "#fff";
            g.font = "bold 88px system-ui, sans-serif";
            g.fillText(lines.big, _W / 2, 158, _W - 40);
          }
          if (lines.sub) {
            g.fillStyle = "#94a0b0";
            g.font = "26px system-ui, sans-serif";
            g.fillText(lines.sub, _W / 2, 216, _W - 40);
          }
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }

        function makeSign(x, y, lines, w, h) {
          var m = new THREE.Mesh(
            keep(new THREE.PlaneGeometry(w || 2.3, h || 1.15)),
            keep(new THREE.MeshBasicMaterial({ map: signTexture(lines), transparent: true })));
          m.position.set(x, y, 0);
          scene.add(m);
          return m;
        }

        // ---------- molecules ----------
        function buildMolecule(tint) {
          var g = new THREE.Group(), s = A.scale, mats = {};
          ["C", "N", "O"].forEach(function (el) {
            var col = new THREE.Color(A.elementColor[el]).lerp(new THREE.Color(tint), 0.4);
            mats[el] = keep(new THREE.MeshStandardMaterial(
              { color: col, roughness: 0.35, metalness: 0.15 }));
          });
          var sph = keep(new THREE.SphereGeometry(1, 64, 40));
          atoms.forEach(function (a) {
            var m = new THREE.Mesh(sph, mats[a.el] || mats.C);
            m.position.set(a.x * s, a.y * s, a.z * s);
            m.scale.setScalar(A.atomRadius[a.el] || 0.3);
            g.add(m);
          });
          var bm = keep(new THREE.MeshStandardMaterial(
            { color: A.bond.color, roughness: 0.5, metalness: 0.2 }));
          var cyl = keep(ctx.turnedCylinder(A.bond.radius, A.bond.radius, 1));
          var up = new THREE.Vector3(0, 1, 0);
          bonds.forEach(function (b) {
            var pa = atoms[b.a], pb = atoms[b.b];
            if (!pa || !pb) return;
            var va = new THREE.Vector3(pa.x * s, pa.y * s, pa.z * s);
            var vb = new THREE.Vector3(pb.x * s, pb.y * s, pb.z * s);
            var dir = vb.clone().sub(va), len = dir.length();
            var m = new THREE.Mesh(cyl, bm);
            m.position.copy(va).add(vb).multiplyScalar(0.5);
            m.scale.set(1, len, 1);
            m.quaternion.setFromUnitVectors(up, dir.clone().normalize());
            g.add(m);
          });
          return g;
        }

        function makePlinth(x, tint) {
          var p = new THREE.Mesh(
            keep(ctx.turnedCylinder(A.plinth.r, A.plinth.r, A.plinth.h)),
            keep(new THREE.MeshStandardMaterial({ color: A.plinth.color, roughness: 0.65 })));
          p.position.set(x, -1.75, 0);
          scene.add(p);
          var ring = new THREE.Mesh(
            keep(new THREE.TorusGeometry(A.plinth.r, 0.025, 32, 128)),
            keep(new THREE.MeshStandardMaterial(
              { color: tint, roughness: 0.4, emissive: tint, emissiveIntensity: 0.4 })));
          ring.rotation.x = Math.PI / 2;
          ring.position.set(x, -1.75 + A.plinth.h / 2 + 0.01, 0);
          scene.add(ring);
        }

        makePlinth(LX, A.us.tint);
        makePlinth(RX, A.india.tint);

        var subject = buildMolecule(A.us.tint);      // the one you drag
        var target = buildMolecule(A.india.tint);    // the one you drop onto
        subject.position.set(LX, 0, 0);
        target.position.set(RX, 0, 0);
        subject.rotation.set(0.3, 0.9, 0.2);
        target.rotation.set(0.3, 0.9, 0.2);
        scene.add(subject); scene.add(target);

        var signL = makeSign(LX, 2.15, { top: A.us.name, sub: "sealed sample", accent: "#d4573f" });
        var signR = makeSign(RX, 2.15, { top: A.india.name, sub: "sealed sample", accent: "#3fae6b" });

        // grab handle for the draggable sample
        var grab = new THREE.Mesh(
          keep(new THREE.SphereGeometry(1.55, 64, 40)),
          keep(new THREE.MeshBasicMaterial({ visible: false })));
        grab.position.copy(subject.position);
        scene.add(grab);
        ctx.pickables.push(grab);

        // ---------- act 2 props (hidden until act 1 is done) ----------
        var act2 = new THREE.Group();
        act2.visible = false;
        scene.add(act2);

        function makeTube(x, tint) {
          var t = new THREE.Mesh(
            keep(ctx.turnedCylinder(A.tube.r, A.tube.r, A.tube.h)),
            keep(ctx.material("glass", {
              color: A.tube.color, thickness: 0.9, roughness: 0.06,
              transmission: 0.94, ior: 1.48, opacity: 1 })));
          t.position.set(x, 0.05, 0);
          act2.add(t);
          var base = new THREE.Mesh(
            keep(ctx.turnedCylinder(A.tube.r + 0.08, A.tube.r + 0.08, 0.12)),
            keep(new THREE.MeshStandardMaterial({ color: tint, roughness: 0.5 })));
          base.position.set(x, 0.05 - A.tube.h / 2, 0);
          act2.add(base);
          return t;
        }
        var tubeL = makeTube(LX, A.us.tint);
        var tubeR = makeTube(RX, A.india.tint);

        var pillGeo = keep(new THREE.CapsuleGeometry(A.pill.r, A.pill.len, 24, 64));
        // the join line round the middle of a two-part capsule, now that the
        // tubes are real glass and the pills are actually visible through them
        var pillSeamGeo = keep(ctx.turnedCylinder(A.pill.r * 1.035, A.pill.r * 1.035,
                                                  A.pill.len * 0.16, A.pill.r * 0.14));
        var pillSeamMat = keep(ctx.tunedStandard({ color: 0xdfe4ea, roughness: 0.42 }));
        var pillMatL = keep(new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.5 }));
        var pillMatR = keep(new THREE.MeshStandardMaterial({ color: 0xd7f0e0, roughness: 0.5 }));
        var pills = [];   // {mesh, targetY, vy}

        function dropPills(x, count, mat) {
          for (var i = 0; i < count; i++) {
            var m = new THREE.Mesh(pillGeo, mat);
            var seam = new THREE.Mesh(pillSeamGeo, pillSeamMat);
            m.add(seam);
            var a = Math.random() * Math.PI * 2, rr = Math.random() * (A.tube.r - 0.18);
            m.position.set(x + Math.cos(a) * rr, 2.6 + i * 0.16, Math.sin(a) * rr);
            m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
            act2.add(m);
            // stack height: pills settle in layers of ~9 per level
            var level = Math.floor(i / 9);
            pills.push({ mesh: m, targetY: 0.05 - A.tube.h / 2 + 0.16 + level * 0.2, vy: 0 });
          }
        }

        // the banknote the player drags into the slot
        function noteTexture() {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 512, _H = 246;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = "#e8e2cf"; g.fillRect(0, 0, _W, _H);
          g.strokeStyle = "#5c6b4a"; g.lineWidth = 8; g.strokeRect(10, 10, _W - 20, _H - 20);
          g.fillStyle = "#2f3a24"; g.textAlign = "center";
          g.font = "bold 86px system-ui, sans-serif";
          g.fillText("$179.93", _W / 2, 130);
          g.font = "26px system-ui, sans-serif";
          g.fillText("the price of ONE pill in the US", _W / 2, 186);
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }
        /* A banknote is paper, not a decal: give it thickness and a rounded
           edge so it catches the key light, and a raised border frame. */
        var note = new THREE.Mesh(
          keep(ctx.roundedBox(A.note.w, A.note.h, 0.012, 0.005)),
          keep(new THREE.MeshBasicMaterial({ map: noteTexture(), transparent: true,
                                             side: THREE.DoubleSide, toneMapped: false })));
        note.position.set(0, -1.15, 1.2);
        act2.add(note);
        (function () {
          var frameMat = ctx.material("paper", { color: 0xbfae6a });
          keep(frameMat);
          var frame = new THREE.Mesh(
            keep(ctx.roundedBox(A.note.w * 1.045, A.note.h * 1.09, 0.008, 0.004)), frameMat);
          frame.position.set(0, -1.15, 1.194);
          act2.add(frame);
        })();

        var slot = new THREE.Mesh(
          keep(ctx.roundedBox(1.75, 0.16, 0.5)),
          keep(new THREE.MeshStandardMaterial({ color: 0x2b3240, roughness: 0.6,
                                                emissive: 0xfffb00, emissiveIntensity: 0.18 })));
        slot.position.set(0, 0.55, 0);
        act2.add(slot);
        var slotSign = makeSign(0, 1.5, { top: "INSERT NOTE", sub: "buy in both markets",
                                          accent: "#fffb00" }, 2.6, 1.0);
        slotSign.visible = false;

        // ---------- state ----------
        var act = 1;                 // 1 = compare, 2 = buy, 3 = done
        var dragging = null;         // 'sample' | 'note' | null
        var dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        var hitPoint = new THREE.Vector3();
        var flash = 0;

        ctx.setBrief(null);          // this scene carries its own signage
        ctx.setStatus("Samples not compared", false);
        ctx.setHint("Drag the red sample across and drop it onto the green one.");

        function pointerToWorld() {
          ctx.raycaster.setFromCamera(ctx.pointer, ctx.camera);
          return ctx.raycaster.ray.intersectPlane(dragPlane, hitPoint) ? hitPoint.clone() : null;
        }

        function mergeSamples() {
          act = 2;
          subject.position.copy(target.position);
          subject.rotation.copy(target.rotation);
          grab.visible = false;
          ctx.pickables.length = 0;
          flash = 1;

          signL.material.map = signTexture(
            { top: "IDENTICAL", sub: "same compound, both vials", accent: "#fffb00" });
          signL.material.needsUpdate = true;
          signR.material.map = signTexture(
            { top: "IMATINIB", sub: "C29H31N7O · PubChem CID 5291", accent: "#3fae6b" });
          signR.material.needsUpdate = true;

          // hand the bench over to act 2
          setTimeout(function () {
            if (act !== 2) return;
            subject.visible = false; target.visible = false;
            signL.visible = false; signR.visible = false;
            act2.visible = true;
            slotSign.visible = true;
            ctx.pickables.push(note);
            ctx.setStatus("Same molecule. Now the price.", false);
            ctx.setHint("Drag the banknote into the slot.");
            if (typeof ctx.onLayoutChange === "function") ctx.onLayoutChange();
          }, 1100);
        }

        function buy() {
          act = 3;
          note.visible = false;
          dropPills(LX, A.us.pills, pillMatL);
          dropPills(RX, A.india.pills, pillMatR);

          makeSign(LX, 2.15, { top: A.us.name, big: String(A.us.pills),
                               sub: "pill for $179.93", accent: "#d4573f" });
          makeSign(RX, 2.15, { top: A.india.name, big: String(A.india.pills),
                               sub: "pills for the same $179.93", accent: "#3fae6b" });
          slotSign.visible = false;

          ctx.setStatus("Identical drug. 1 pill against " + A.india.pills + ".", true);
          ctx.setHint("Same molecule, same money, a hundredfold difference in medicine.");

          // keep the page in step; this is module 1's objective
          if (typeof window.setSynthesis === "function") {
            try { window.setSynthesis("alternative"); } catch (e) {}
          }
          ctx.complete();
          ctx.setAction("Take it to the bench", null);
        }

        function fitCamera() {
          var cam = ctx.camera;
          var el = A.camera.elevationDeg * Math.PI / 180;
          var dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el)).normalize();
          var look = new THREE.Vector3().fromArray(A.camera.lookAt);
          var box = new THREE.Box3();
          scene.traverse(function (o) {
            if (o.isMesh && o.visible && o.parent && o.parent.visible) box.expandByObject(o);
          });
          if (box.isEmpty()) return;
          var corners = [];
          for (var i = 0; i < 8; i++) corners.push(new THREE.Vector3(
            (i & 1) ? box.max.x : box.min.x, (i & 2) ? box.max.y : box.min.y,
            (i & 4) ? box.max.z : box.min.z));
          var dist = box.getBoundingSphere(new THREE.Sphere()).radius * 2;
          for (var p = 0; p < 6; p++) {
            cam.position.copy(look).addScaledVector(dir, dist);
            cam.lookAt(look); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
            var worst = 0;
            for (var c = 0; c < corners.length; c++) {
              var v = corners[c].clone().project(cam);
              worst = Math.max(worst, Math.abs(v.x), Math.abs(v.y));
            }
            if (worst < 0.0001) break;
            dist *= worst * A.camera.margin;
          }
          cam.position.copy(look).addScaledVector(dir, dist);
          cam.lookAt(look); cam.updateProjectionMatrix();
        }
        ctx.onLayoutChange = fitCamera;

        return {
          update: function (dt) {
            if (act === 1) {
              subject.rotation.y += dt * 0.35;
              target.rotation.y += dt * 0.35;
              grab.position.copy(subject.position);
            }
            if (flash > 0) {
              // the fused sample swells and settles, so the merge reads as an event
              flash = Math.max(0, flash - dt * 1.6);
              var s = 1 + flash * 0.22;
              subject.scale.setScalar(s);
              target.scale.setScalar(s);
            }
            // pills fall and settle
            for (var i = 0; i < pills.length; i++) {
              var p = pills[i];
              if (p.mesh.position.y > p.targetY) {
                p.vy -= 9.8 * dt * 0.35;
                p.mesh.position.y += p.vy * dt;
                p.mesh.rotation.x += dt * 1.2;
                if (p.mesh.position.y <= p.targetY) { p.mesh.position.y = p.targetY; p.vy = 0; }
              }
            }
          },

          onPointerDown: function (hit) {
            if (!hit) return;
            if (act === 1 && hit.object === grab) dragging = "sample";
            else if (act === 2 && hit.object === note) dragging = "note";
          },

          onPointerMove: function (hit) {
            if (!dragging) {
              ctx.renderer.domElement.style.cursor = hit ? "grab" : "default";
              return;
            }
            ctx.renderer.domElement.style.cursor = "grabbing";
            var w = pointerToWorld();
            if (!w) return;
            if (dragging === "sample") {
              subject.position.set(w.x, w.y, 0);
              var d = subject.position.distanceTo(target.position);
              ctx.setStatus(d <= A.snapDistance ? "Release to compare"
                                                : "Bring the samples together", false);
              if (d <= A.snapDistance * 0.55) { dragging = null; mergeSamples(); }
            } else if (dragging === "note") {
              note.position.set(w.x, w.y, 1.2);
              if (note.position.distanceTo(slot.position) <= 1.25) { dragging = null; buy(); }
            }
          },

          onPointerUp: function () {
            if (dragging === "sample") {
              var d = subject.position.distanceTo(target.position);
              if (d <= A.snapDistance) { dragging = null; mergeSamples(); return; }
            }
            dragging = null;
            ctx.renderer.domElement.style.cursor = "default";
          },

          onResize: fitCamera,
          dispose: function () { junk.forEach(function (d) { try { d.dispose(); } catch (e) {} }); }
        };
      }
    });

    window.launchMolecule = function () { window.Interludes.play("molecule"); };
  });
})();
