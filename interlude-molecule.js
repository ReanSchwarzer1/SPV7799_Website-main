/* ============================================================
   interlude-molecule.js — the synthesis bench (module 1)
   Condition B embodied layer.

   The player is handed two sealed samples: one bought in the US
   monopoly market, one from an Indian generic maker. The task is
   the chemist's own test for "same compound": rotate one sample
   until it superimposes on the other. Once they match, the price
   tags drop, and the gap is the lesson — identical molecule,
   wildly different price, because price tracks market power and
   law rather than chemistry.

   Geometry is the real imatinib structure: heavy-atom coordinates
   and bonds extracted from PubChem CID 5291 (3D conformer,
   C29H31N7O -> 37 heavy atoms, 41 bonds) and embedded so the
   scene works offline. Hydrogens are omitted for legibility.

   Interaction: drag with the mouse to rotate the sample under
   examination; arrow keys nudge it. Everything visual lives in
   `assets` so materials, textures and shaders can be swapped
   per element later without touching the interaction logic.
   ============================================================ */

(function () {
  "use strict";

  // --- real imatinib heavy-atom structure, PubChem CID 5291 (3D) ---
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
    return s.split(";").map(function (r) {
      var p = r.split(",");
      return { el: p[0], x: +p[1], y: +p[2], z: +p[3] };
    });
  }
  function parseBonds(s) {
    return s.split(";").map(function (r) {
      var p = r.split(",");
      return { a: +p[0], b: +p[1], order: +p[2] };
    });
  }

  function whenReady(fn) {
    if (window.Interludes) return fn();
    var tries = 0;
    var t = setInterval(function () {
      if (window.Interludes) { clearInterval(t); fn(); }
      else if (++tries > 100) { clearInterval(t); console.warn("[molecule] Interludes never appeared"); }
    }, 30);
  }

  whenReady(function () {

    window.Interludes.register("molecule", {
      kicker: "The synthesis bench",
      title: "Two samples, one molecule",
      step: "Imatinib · Gleevec",
      instructions: "Drag left or right to spin the US sample. Line its yellow marker up with the other one to prove the two are the same compound.",

      assets: {
        scale: 0.17,                       // structure units -> scene units
        atom: {
          radius: { C: 0.30, N: 0.32, O: 0.32 },
          color:  { C: 0.0, N: 0.0, O: 0.0 } // filled per-sample from tint below
        },
        bond:  { radius: 0.085, color: 0x9aa3af },
        sample: {
          us:      { tint: 0xd4573f, label: "US MONOPOLY", price: "$179.93", per: "per pill" },
          generic: { tint: 0x3fae6b, label: "INDIAN GENERIC", price: "~$1.50", per: "per pill" }
        },
        plinth: { r: 1.55, h: 0.16, color: 0x1e222b },
        tag:    { w: 2.0, h: 0.9 },
        // a bright marker fixed to each sample, so rotational alignment is
        // something the player can see rather than something they must infer
        key:    { length: 0.55, radius: 0.17, dist: 1.95, color: 0xfffb00 },
        // Deliberately forgiving. The point of this scene is the price gap,
        // not a dexterity test: the samples differ by a single axis of spin,
        // and anything roughly facing the right way counts. Below assistWithin
        // the sample eases itself the rest of the way home.
        startOffsetDeg: 135,
        matchToleranceDeg: 26,
        assistWithinDeg: 50,
        camera: { elevationDeg: 12, margin: 1.18, lookAt: [0, 0.1, 0] }
      },

      build: function (ctx) {
        var THREE = ctx.THREE, scene = ctx.scene, A = ctx.assets;
        var atoms = parseAtoms(ATOMS), bonds = parseBonds(BONDS);
        var disposables = [];
        function keep(o) { disposables.push(o); return o; }

        var ELEMENT_COLORS = { C: 0xc9ced6, N: 0x5b7fd4, O: 0xd4573f };

        // ---- build one ball-and-stick molecule as a group ----
        function buildMolecule(tint) {
          var g = new THREE.Group();
          var s = A.scale;
          var mats = {};
          ["C", "N", "O"].forEach(function (el) {
            // element colour, pulled toward the sample tint so the two
            // samples read as different vials of the same substance
            var c = new THREE.Color(ELEMENT_COLORS[el]).lerp(new THREE.Color(tint), 0.35);
            mats[el] = keep(new THREE.MeshStandardMaterial(
              { color: c, roughness: 0.35, metalness: 0.15 }));
          });
          var sphere = keep(new THREE.SphereGeometry(1, 20, 14));
          atoms.forEach(function (a) {
            var m = new THREE.Mesh(sphere, mats[a.el] || mats.C);
            m.position.set(a.x * s, a.y * s, a.z * s);
            var r = (A.atom.radius[a.el] || 0.3);
            m.scale.setScalar(r);
            g.add(m);
          });
          var bondMat = keep(new THREE.MeshStandardMaterial(
            { color: A.bond.color, roughness: 0.5, metalness: 0.2 }));
          var cyl = keep(new THREE.CylinderGeometry(A.bond.radius, A.bond.radius, 1, 10));
          var up = new THREE.Vector3(0, 1, 0);
          bonds.forEach(function (b) {
            var pa = atoms[b.a], pb = atoms[b.b];
            if (!pa || !pb) return;
            var va = new THREE.Vector3(pa.x * s, pa.y * s, pa.z * s);
            var vb = new THREE.Vector3(pb.x * s, pb.y * s, pb.z * s);
            var mid = va.clone().add(vb).multiplyScalar(0.5);
            var dir = vb.clone().sub(va);
            var len = dir.length();
            var m = new THREE.Mesh(cyl, bondMat);
            m.position.copy(mid);
            m.scale.set(1, len, 1);
            m.quaternion.setFromUnitVectors(up, dir.clone().normalize());
            g.add(m);
          });

          // alignment key: a bright pointer rigidly attached to the sample.
          // when the two keys point the same way, the samples are aligned.
          var keyMat = keep(new THREE.MeshStandardMaterial(
            { color: A.key.color, roughness: 0.3, emissive: A.key.color, emissiveIntensity: 0.35 }));
          var cone = new THREE.Mesh(
            keep(new THREE.ConeGeometry(A.key.radius, A.key.length, 18)), keyMat);
          cone.position.set(A.key.dist, 0, 0);
          cone.rotation.z = -Math.PI / 2;      // point along +X
          g.add(cone);
          var stem = new THREE.Mesh(
            keep(new THREE.CylinderGeometry(0.035, 0.035, A.key.dist * 0.5, 8)), keyMat);
          stem.rotation.z = Math.PI / 2;
          stem.position.set(A.key.dist - A.key.length / 2 - A.key.dist * 0.25, 0, 0);
          g.add(stem);
          return g;
        }

        // ---- label / price tag textures drawn at runtime ----
        function tagTexture(lines, tint, big) {
          var c = document.createElement("canvas");
          c.width = 512; c.height = 232;
          var g = c.getContext("2d");
          g.fillStyle = "rgba(12,14,20,0.92)";
          g.fillRect(0, 0, c.width, c.height);
          g.strokeStyle = "#" + tint.toString(16).padStart(6, "0");
          g.lineWidth = 8; g.strokeRect(4, 4, c.width - 8, c.height - 8);
          g.textAlign = "center";
          g.fillStyle = "#" + tint.toString(16).padStart(6, "0");
          g.font = "bold 34px 'Work Sans', system-ui, sans-serif";
          g.fillText(lines[0], c.width / 2, 62, c.width - 40);
          if (lines[1]) {
            g.fillStyle = "#ffffff";
            g.font = "bold " + (big ? 86 : 54) + "px 'Work Sans', system-ui, sans-serif";
            g.fillText(lines[1], c.width / 2, big ? 152 : 132, c.width - 40);
          }
          if (lines[2]) {
            g.fillStyle = "#9aa3af";
            g.font = "24px 'Work Sans', system-ui, sans-serif";
            g.fillText(lines[2], c.width / 2, 200, c.width - 40);
          }
          var t = new THREE.CanvasTexture(c);
          keep(t);
          return t;
        }

        function makeTag(x, lines, tint, big) {
          var m = keep(new THREE.MeshBasicMaterial(
            { map: tagTexture(lines, tint, big), transparent: true }));
          var mesh = new THREE.Mesh(
            keep(new THREE.PlaneGeometry(A.tag.w, A.tag.h)), m);
          mesh.position.set(x, 1.95, 0);
          scene.add(mesh);
          return mesh;
        }

        // ---- plinths ----
        function makePlinth(x, tint) {
          var p = new THREE.Mesh(
            keep(new THREE.CylinderGeometry(A.plinth.r, A.plinth.r, A.plinth.h, 40)),
            keep(new THREE.MeshStandardMaterial({ color: A.plinth.color, roughness: 0.6 })));
          p.position.set(x, -1.5, 0);
          scene.add(p);
          var ring = new THREE.Mesh(
            keep(new THREE.TorusGeometry(A.plinth.r, 0.022, 8, 48)),
            keep(new THREE.MeshStandardMaterial({ color: tint, roughness: 0.4, metalness: 0.3 })));
          ring.rotation.x = Math.PI / 2;
          ring.position.set(x, -1.5 + A.plinth.h / 2 + 0.01, 0);
          scene.add(ring);
          return p;
        }

        var LX = -2.15, RX = 2.15;
        makePlinth(LX, A.sample.us.tint);
        makePlinth(RX, A.sample.generic.tint);

        // the sample under examination (left, US) and the reference (right)
        var subject = buildMolecule(A.sample.us.tint);
        var reference = buildMolecule(A.sample.generic.tint);
        subject.position.set(LX, 0, 0);
        reference.position.set(RX, 0, 0);
        scene.add(subject); scene.add(reference);

        // an invisible grab sphere so the whole molecule is easy to pick up
        var grab = new THREE.Mesh(
          keep(new THREE.SphereGeometry(1.7, 16, 12)),
          keep(new THREE.MeshBasicMaterial({ visible: false })));
        grab.position.copy(subject.position);
        scene.add(grab);
        ctx.pickables.push(grab);

        // Both samples share one base tilt and differ ONLY by a spin about the
        // world Y axis. That keeps the puzzle one-dimensional: dragging left or
        // right is always the right move, and there is no orientation the player
        // can get stuck in.
        var BASE_TILT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.24, 0, 0.10));
        var Y_AXIS = new THREE.Vector3(0, 1, 0);
        reference.quaternion.copy(BASE_TILT);
        subject.quaternion.copy(BASE_TILT).premultiply(
          new THREE.Quaternion().setFromAxisAngle(Y_AXIS, A.startOffsetDeg * Math.PI / 180));

        var labelL = makeTag(LX, [A.sample.us.label, "", "sealed sample"], A.sample.us.tint, false);
        var labelR = makeTag(RX, [A.sample.generic.label, "", "sealed sample"], A.sample.generic.tint, false);

        // ---- state ----
        var stage = "align";        // align -> revealed
        var dragging = false;
        var lastPointer = null;

        function angleToMatch() {
          // smallest rotation taking subject onto reference
          var qd = reference.quaternion.clone().invert().multiply(subject.quaternion);
          var w = Math.min(1, Math.abs(qd.w));
          return 2 * Math.acos(w) * 180 / Math.PI;
        }

        function brief(extra) {
          ctx.setBrief({
            label: "Sample dossier",
            claim: "Imatinib (brand name Gleevec), C29H31N7O — used to treat chronic myeloid leukaemia and gastrointestinal stromal tumours.",
            context: extra || ("Both vials hold the same compound. Structure shown is the real imatinib " +
              "conformer from PubChem CID 5291, hydrogens omitted. Spin the left sample until its yellow " +
              "marker points the same way as the right one; it will settle into place once you are close.")
          });
        }
        brief();
        ctx.setStatus("Samples not yet matched", false);

        function reveal() {
          stage = "revealed";
          // snap cleanly onto the reference so the match reads as exact
          subject.quaternion.copy(reference.quaternion);
          labelL.material.map = tagTexture(
            [A.sample.us.label, A.sample.us.price, A.sample.us.per], A.sample.us.tint, true);
          labelL.material.needsUpdate = true;
          labelR.material.map = tagTexture(
            [A.sample.generic.label, A.sample.generic.price, A.sample.generic.per],
            A.sample.generic.tint, true);
          labelR.material.needsUpdate = true;

          ctx.setBrief({
            label: "What the samples are worth",
            claim: "Same molecule. $179.93 a pill in the United States, about $1.50 in India.",
            outcome: "Novartis raised the US price through the 2000s while holding the patent. In 2013 " +
              "the Indian Supreme Court refused a fresh patent under Section 3(d) of the Patents Act, " +
              "so generic manufacturers kept producing it. Nothing about the chemistry differs. The " +
              "price difference is market power and law."
          });
          ctx.setHint("Same compound. Roughly a hundredfold difference in price.");
          ctx.setStatus("Identity confirmed", true);

          // keep the page's own state in step: this is module 1's objective,
          // and completing it lets the director carry the player onward
          if (typeof window.setSynthesis === "function") {
            try { window.setSynthesis("alternative"); } catch (e) { console.error(e); }
          }
          ctx.complete();
          ctx.setAction("Take it to the bench", null);
        }

        // horizontal drag spins the sample about world Y; that single axis is
        // all the task needs, so vertical movement is ignored on purpose
        function rotateSubject(dx) {
          if (stage !== "align") return;
          subject.quaternion.premultiply(
            new THREE.Quaternion().setFromAxisAngle(Y_AXIS, dx * 0.012));
          reportAlignment();
        }

        function reportAlignment() {
          var a = angleToMatch();
          if (a <= A.matchToleranceDeg) { reveal(); return true; }
          ctx.setStatus(a <= A.assistWithinDeg
            ? "Close — keep turning, it will settle"
            : "Off by " + Math.round(a) + "°", false);
          return false;
        }

        return {
          update: function (dt) {
            if (stage === "align") {
              // the reference stays put: it is the thing being matched against
              var k = ctx.keys, step = 5;
              if (k.ArrowLeft)  rotateSubject(-step);
              if (k.ArrowRight) rotateSubject(step);

              // magnetic assist. Once the player is roughly facing the right
              // way the sample eases the rest of the way in by itself, so the
              // scene never turns into a precision contest.
              var a = angleToMatch();
              if (a > A.matchToleranceDeg && a <= A.assistWithinDeg) {
                subject.quaternion.rotateTowards(reference.quaternion, dt * 1.6);
                reportAlignment();
              }
            } else {
              // both samples turn together, in lockstep, once matched
              var q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, dt * 0.3, 0));
              subject.quaternion.multiply(q2);
              reference.quaternion.multiply(q2);
            }
          },

          onPointerDown: function (hit, ev) {
            if (stage !== "align" || !hit) return;
            dragging = true;
            lastPointer = { x: ev.clientX, y: ev.clientY };
          },

          onPointerMove: function (hit, ev) {
            if (!dragging || stage !== "align") {
              if (stage === "align") ctx.renderer.domElement.style.cursor = hit ? "grab" : "default";
              return;
            }
            ctx.renderer.domElement.style.cursor = "grabbing";
            if (lastPointer) rotateSubject(ev.clientX - lastPointer.x);
            lastPointer = { x: ev.clientX, y: ev.clientY };
          },

          onPointerUp: function () {
            dragging = false;
            lastPointer = null;
            if (ctx.renderer.domElement) ctx.renderer.domElement.style.cursor = "default";
          },

          onResize: function () {
            var cam = ctx.camera;
            var el = A.camera.elevationDeg * Math.PI / 180;
            var dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el)).normalize();
            var lookAt = new THREE.Vector3(A.camera.lookAt[0], A.camera.lookAt[1], A.camera.lookAt[2]);
            var box = new THREE.Box3();
            scene.traverse(function (o) { if (o.isMesh && o.visible) box.expandByObject(o); });
            if (box.isEmpty()) return;
            var corners = [];
            for (var i = 0; i < 8; i++) {
              corners.push(new THREE.Vector3(
                (i & 1) ? box.max.x : box.min.x,
                (i & 2) ? box.max.y : box.min.y,
                (i & 4) ? box.max.z : box.min.z));
            }
            var dist = box.getBoundingSphere(new THREE.Sphere()).radius * 2;
            for (var pass = 0; pass < 6; pass++) {
              cam.position.copy(lookAt).addScaledVector(dir, dist);
              cam.lookAt(lookAt); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
              var worst = 0;
              for (var c = 0; c < corners.length; c++) {
                var p = corners[c].clone().project(cam);
                worst = Math.max(worst, Math.abs(p.x), Math.abs(p.y));
              }
              if (worst < 0.0001) break;
              dist *= worst * A.camera.margin;
            }
            cam.position.copy(lookAt).addScaledVector(dir, dist);
            cam.lookAt(lookAt); cam.updateProjectionMatrix();
          },

          dispose: function () {
            disposables.forEach(function (d) { try { d.dispose(); } catch (e) {} });
          }
        };
      }
    });

    window.launchMolecule = function () { window.Interludes.play("molecule"); };

    // resume affordance for a player who skipped out; the primary path in
    // is the director launching the scene at the start of the term
    function injectResume() {
      var host = document.querySelector("#molecular-storyteller .bg-white.text-brandDark");
      if (!host || document.getElementById("btn-molecule")) return;
      var b = document.createElement("button");
      b.id = "btn-molecule";
      b.className = "il-enter";
      b.textContent = "Return to the synthesis bench";
      b.addEventListener("click", function () { window.launchMolecule(); });
      host.appendChild(b);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", injectResume);
    } else {
      injectResume();
    }
  });
})();
