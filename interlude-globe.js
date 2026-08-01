/* ============================================================
   interlude-globe.js — diffusion and global trade (module 6)
   Condition B embodied layer.

   A globe you can spin with your hand, and a timeline you drag
   from 2000 to 2024. As the years run, shipping arcs climb out of
   India and reach Africa, then Europe, then North America, each
   thickening with the real export volume of that year, each with
   consignments running along it.

   Objective: reach 2012 or later and inspect a destination market.

   Region positions are real latitude and longitude, not drawn
   coastlines, so nothing here is invented geography. Export
   volumes, market shares and therapy areas are the artifact's own
   Pharmexcil-sourced figures, read from the page. Penetration
   follows the page's logistic curve, 100 / (1 + e^(-0.4(year-2010))).
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

    window.Interludes.register("globe", {
      kicker: "The trade globe",
      title: "Where the medicine went",
      step: "Technological diffusion, 2000 to 2024",
      instructions: "Drag the timeline forward. Click a destination to inspect its market.",

      assets: {
        globe:  { r: 3.1, color: 0x16202e, grid: 0x2f4358, glow: 0x1d3247 },
        source: { key: "India", lat: 20.6, lng: 78.9, color: 0xfffb00 },
        dests: [
          { key: "Africa", label: "AFRICA",        lat: 0.0,  lng: 20.0,  from: 2001, color: 0x3fae6b },
          { key: "Europe", label: "EUROPE",        lat: 50.0, lng: 10.0,  from: 2003, color: 0xd9a441 },
          { key: "USA",    label: "NORTH AMERICA", lat: 40.0, lng: -100.0, from: 2006, color: 0xd4573f }
        ],
        china:  { lat: 35.0, lng: 103.0, color: 0x8b2f2f },
        rail:   { x: [-6.4, 6.4], y: -4.55, z: 2.2, knob: 0.4, color: 0xfffb00 },
        yearMin: 2000, yearMax: 2024, targetYear: 2012,
        camera: { elevationDeg: 10, margin: 1.14, lookAt: [0, 0.1, 0] }
      },

      build: function (ctx) {
        var THREE = ctx.THREE, scene = ctx.scene, A = ctx.assets;
        var junk = [];
        function keep(o) { junk.push(o); return o; }
        function mat(o) { return keep(new THREE.MeshStandardMaterial(o)); }

        function toVec(lat, lng, r) {
          var phi = (90 - lat) * Math.PI / 180;
          var theta = (lng + 180) * Math.PI / 180;
          return new THREE.Vector3(
            -r * Math.sin(phi) * Math.cos(theta),
             r * Math.cos(phi),
             r * Math.sin(phi) * Math.sin(theta));
        }

        var labelTex = ctx.labelTexture;
        var makeLabel = ctx.makeLabel;

        // ---------- globe ----------
        var globe = new THREE.Group();
        scene.add(globe);
        var ball = new THREE.Mesh(
          keep(new THREE.SphereGeometry(A.globe.r, 48, 32)),
          mat({ color: A.globe.color, roughness: 0.95, metalness: 0.05 }));
        globe.add(ball);
        var halo = new THREE.Mesh(
          keep(new THREE.SphereGeometry(A.globe.r * 1.035, 32, 24)),
          mat({ color: A.globe.glow, roughness: 1, transparent: true, opacity: 0.18,
                side: THREE.BackSide }));
        globe.add(halo);

        // latitude / longitude wires: real graticule, no invented coastlines
        var wireMat = keep(new THREE.MeshBasicMaterial({ color: A.globe.grid, transparent: true, opacity: 0.5 }));
        for (var la = -60; la <= 60; la += 30) {
          var rr = A.globe.r * Math.cos(la * Math.PI / 180);
          var ring = new THREE.Mesh(keep(new THREE.TorusGeometry(rr, 0.012, 6, 72)), wireMat);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = A.globe.r * Math.sin(la * Math.PI / 180);
          globe.add(ring);
        }
        for (var lo = 0; lo < 180; lo += 30) {
          var mer = new THREE.Mesh(keep(new THREE.TorusGeometry(A.globe.r, 0.012, 6, 72)), wireMat);
          mer.rotation.y = lo * Math.PI / 180;
          globe.add(mer);
        }

        // ---------- markers ----------
        function makeMarker(lat, lng, color, big) {
          var m = new THREE.Mesh(
            keep(new THREE.SphereGeometry(big ? 0.2 : 0.16, 16, 12)),
            mat({ color: color, roughness: 0.3, emissive: color, emissiveIntensity: 0.8 }));
          m.position.copy(toVec(lat, lng, A.globe.r * 1.01));
          globe.add(m);
          var halo2 = new THREE.Mesh(
            keep(new THREE.TorusGeometry(big ? 0.34 : 0.28, 0.028, 8, 26)),
            mat({ color: color, roughness: 0.4, emissive: color, emissiveIntensity: 0.6 }));
          halo2.position.copy(m.position);
          halo2.lookAt(0, 0, 0);
          globe.add(halo2);
          // generous invisible hit target
          var hit = new THREE.Mesh(
            keep(new THREE.SphereGeometry(0.52, 10, 8)),
            keep(new THREE.MeshBasicMaterial({ visible: false })));
          hit.position.copy(m.position);
          globe.add(hit);
          return { dot: m, ring: halo2, hit: hit };
        }

        var srcMarker = makeMarker(A.source.lat, A.source.lng, A.source.color, true);

        var arcs = [];
        A.dests.forEach(function (d) {
          var mk = makeMarker(d.lat, d.lng, d.color, false);
          ctx.pickables.push(mk.hit);

          var from = toVec(A.source.lat, A.source.lng, A.globe.r * 1.01);
          var to = toVec(d.lat, d.lng, A.globe.r * 1.01);
          var mid = from.clone().add(to).multiplyScalar(0.5)
                        .normalize().multiplyScalar(A.globe.r * (1.28 + from.distanceTo(to) * 0.035));
          var curve = new THREE.QuadraticBezierCurve3(from, mid, to);
          var tube = new THREE.Mesh(
            keep(new THREE.TubeGeometry(curve, 44, 0.05, 8, false)),
            mat({ color: d.color, roughness: 0.4, emissive: d.color, emissiveIntensity: 0.55,
                  transparent: true, opacity: 0.9 }));
          tube.visible = false;
          globe.add(tube);

          // a consignment that runs the route
          var ship = new THREE.Mesh(
            keep(new THREE.SphereGeometry(0.11, 12, 10)),
            mat({ color: 0xffffff, roughness: 0.2,
                  emissive: 0xffffff, emissiveIntensity: 0.9 }));
          ship.visible = false;
          globe.add(ship);

          arcs.push({ def: d, marker: mk, tube: tube, curve: curve, ship: ship, t: Math.random() });
        });

        // China / API dependence, revealed by the switch
        var chinaMarker = makeMarker(A.china.lat, A.china.lng, A.china.color, false);
        var cFrom = toVec(A.china.lat, A.china.lng, A.globe.r * 1.01);
        var cTo = toVec(A.source.lat, A.source.lng, A.globe.r * 1.01);
        var cMid = cFrom.clone().add(cTo).multiplyScalar(0.5).normalize()
                        .multiplyScalar(A.globe.r * 1.2);
        var apiTube = new THREE.Mesh(
          keep(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(cFrom, cMid, cTo), 32, 0.035, 6, false)),
          mat({ color: A.china.color, roughness: 0.5, emissive: A.china.color,
                emissiveIntensity: 0.5, transparent: true, opacity: 0.85 }));
        globe.add(apiTube);
        chinaMarker.dot.visible = chinaMarker.ring.visible = apiTube.visible = false;

        // ---------- timeline ----------
        var railL = A.rail.x[0], railR = A.rail.x[1];
        var rail = new THREE.Mesh(
          keep(new THREE.BoxGeometry(railR - railL, 0.1, 0.24)),
          mat({ color: 0x2a3140, roughness: 0.75 }));
        rail.position.set(0, A.rail.y, A.rail.z);
        scene.add(rail);
        var knob = new THREE.Mesh(
          keep(new THREE.SphereGeometry(A.rail.knob, 18, 12)),
          mat({ color: A.rail.color, roughness: 0.3,
                emissive: A.rail.color, emissiveIntensity: 0.45 }));
        knob.position.set(railL, A.rail.y + 0.28, A.rail.z);
        scene.add(knob);
        ctx.pickables.push(knob);

        var yearLabel = makeLabel(0, A.rail.y + 1.45, A.rail.z,
          { top: "YEAR", big: "2000", sub: "drag the handle forward",
            accent: "#fffb00", box: true, bigSize: 78 }, 2.75, 1.38);
        var exportLabel = makeLabel(-6.9, 2.9, 0,
          { top: "INDIAN PHARMA EXPORTS", big: "$1.5B", sub: "Pharmexcil, annual",
            accent: "#3fae6b", box: true, bigSize: 70 }, 3.01, 1.50);
        var penLabel = makeLabel(6.9, 2.9, 0,
          { top: "GLOBAL PENETRATION", big: "2%", sub: "logistic diffusion",
            accent: "#4f86c6", box: true, bigSize: 78 }, 3.01, 1.50);
        var regionLabel = makeLabel(6.9, -1.1, 0,
          { top: "DESTINATION", sub: "click a marker on the globe",
            accent: "#9aa6b4", box: true }, 3.01, 1.50);

        // ---------- API switch ----------
        var apiSwitch = new THREE.Mesh(
          keep(new THREE.BoxGeometry(1.5, 0.42, 0.42)),
          mat({ color: 0x39404e, roughness: 0.6 }));
        apiSwitch.position.set(-6.0, -0.4, 0);
        scene.add(apiSwitch);
        ctx.pickables.push(apiSwitch);
        var apiLabel = makeLabel(-6.9, 0.75, 0,
          { top: "API SUPPLY LINE", sub: "OFF · click to reveal",
            accent: "#8b2f2f", box: true }, 2.75, 1.38);

        // ---------- state ----------
        var year = A.yearMin;
        var apiOn = false;
        var dragging = null;
        var lastPointer = null;
        var visited = false;
        var won = false;
        var railPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -A.rail.z);
        var hitPt = new THREE.Vector3();

        function penetration(y) { return 100 / (1 + Math.exp(-0.4 * (y - 2010))); }

        function pushToPage() {
          var sl = document.getElementById("slider-map-year");
          if (sl) { sl.value = year; sl.dispatchEvent(new Event("input", { bubbles: true })); }
        }

        function exportsFor() {
          // the page holds the Pharmexcil series; read it after syncing the year
          var e = document.getElementById("export-volume");
          return e ? e.textContent.trim() : "";
        }

        function refresh() {
          yearLabel.material.map = labelTex(
            { top: "YEAR", big: String(year),
              sub: year >= A.targetYear ? "compulsory licensing era" : "drag the handle forward",
              accent: "#fffb00", box: true, bigSize: 78 });
          yearLabel.material.needsUpdate = true;

          exportLabel.material.map = labelTex(
            { top: "INDIAN PHARMA EXPORTS", big: exportsFor() || "--",
              sub: "Pharmexcil, annual", accent: "#3fae6b", box: true, bigSize: 70 });
          exportLabel.material.needsUpdate = true;

          var pen = penetration(year);
          penLabel.material.map = labelTex(
            { top: "GLOBAL PENETRATION", big: Math.round(pen) + "%",
              sub: year < 2005 ? "slow uptake" : year <= 2015 ? "rapid acceleration" : "approaching saturation",
              accent: "#4f86c6", box: true, bigSize: 78 });
          penLabel.material.needsUpdate = true;

          // arcs appear at their real first-flow year and thicken with volume
          var vol = parseFloat((exportsFor() || "0").replace(/[^0-9.]/g, "")) || 1.5;
          arcs.forEach(function (a) {
            var live = year >= a.def.from;
            a.tube.visible = live;
            a.ship.visible = live;
            var s = 0.6 + (vol / 30.5) * 2.2;
            a.tube.scale.set(1, 1, 1);
            a.tube.material.opacity = live ? 0.55 + Math.min(0.45, vol / 30.5) : 0;
            a.marker.dot.scale.setScalar(live ? 1 + Math.min(0.9, vol / 30.5) * 0.5 : 0.7);
            a.thickness = s;
          });
        }

        function inspect(key) {
          var d = null;
          for (var i = 0; i < A.dests.length; i++) if (A.dests[i].key === key) d = A.dests[i];
          if (typeof window.selectRegion === "function") {
            try { window.selectRegion(key); } catch (e) {}
          }
          visited = true;
          // read the page's own regional figures back out
          var share = document.getElementById("region-share");
          var therapy = document.getElementById("region-therapy");
          regionLabel.material.map = labelTex(
            { top: d ? d.label : key,
              big: share ? share.textContent.trim() : "",
              sub: therapy ? therapy.textContent.replace(/^Primary Focus:\s*/i, "").slice(0, 42) : "",
              accent: d ? "#" + d.color.toString(16).padStart(6, "0") : "#9aa6b4",
              box: true, bigSize: 66 });
          regionLabel.material.needsUpdate = true;
          check();
        }

        function check() {
          if (won) return;
          if (year >= A.targetYear && visited) {
            won = true;
            ctx.setStatus("Traced the diffusion to " + year, true);
            ctx.setHint("Cheap medicine only travelled once someone built the route it travelled on.");
            ctx.setAction("Leave the globe", null);
            ctx.complete();
          } else if (year >= A.targetYear) {
            ctx.setStatus("Now inspect a destination market", false);
          } else if (visited) {
            ctx.setStatus("Now run the timeline to " + A.targetYear + " or later", false);
          } else {
            ctx.setStatus("Year " + year + " — reach " + A.targetYear + " and inspect a market", false);
          }
        }

        ctx.setBrief(null);
        ctx.setHint("Drag the timeline forward. Click a destination to inspect its market.");
        pushToPage();
        refresh();
        check();

        function pointerOnRail() {
          ctx.raycaster.setFromCamera(ctx.pointer, ctx.camera);
          return ctx.raycaster.ray.intersectPlane(railPlane, hitPt) ? hitPt.clone() : null;
        }

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

        var spin = 0;
        return {
          update: function (dt) {
            if (dragging !== "globe") spin += dt * 0.12;
            globe.rotation.y = spin;
            srcMarker.ring.rotation.z += dt * 1.2;
            // consignments run the live routes
            arcs.forEach(function (a) {
              if (!a.tube.visible) return;
              a.t = (a.t + dt * 0.28) % 1;
              a.curve.getPoint(a.t, a.ship.position);
            });
          },

          onPointerDown: function (h, ev) {
            if (!h) {
              dragging = "globe";
              lastPointer = ev ? { x: ev.clientX } : null;
              return;
            }
            if (h.object === knob) { dragging = "rail"; return; }
            if (h.object === apiSwitch) {
              apiOn = !apiOn;
              chinaMarker.dot.visible = chinaMarker.ring.visible = apiTube.visible = apiOn;
              var tg = document.getElementById("toggle-api");
              if (tg) { tg.checked = apiOn; tg.dispatchEvent(new Event("change", { bubbles: true })); }
              apiLabel.material.map = labelTex(
                { top: "API SUPPLY LINE",
                  sub: apiOn ? "ON · India buys ingredients from China" : "OFF · click to reveal",
                  accent: "#8b2f2f", box: true });
              apiLabel.material.needsUpdate = true;
              return;
            }
            for (var i = 0; i < arcs.length; i++) {
              if (h.object === arcs[i].marker.hit) { inspect(arcs[i].def.key); return; }
            }
          },

          onPointerMove: function (h, ev) {
            if (!dragging) {
              ctx.renderer.domElement.style.cursor = h ? "pointer" : "grab";
              return;
            }
            if (dragging === "rail") {
              var w = pointerOnRail();
              if (!w) return;
              var x = Math.max(railL, Math.min(railR, w.x));
              knob.position.x = x;
              var t = (x - railL) / (railR - railL);
              var y2 = Math.round(A.yearMin + t * (A.yearMax - A.yearMin));
              if (y2 !== year) { year = y2; pushToPage(); refresh(); check(); }
            } else if (dragging === "globe" && ev && lastPointer) {
              spin += (ev.clientX - lastPointer.x) * 0.006;
              lastPointer = { x: ev.clientX };
            }
          },

          onPointerUp: function () {
            dragging = null; lastPointer = null;
            ctx.renderer.domElement.style.cursor = "default";
          },

          onResize: fitCamera,
          dispose: function () { junk.forEach(function (d) { try { d.dispose(); } catch (e) {} }); }
        };
      }
    });

    window.launchGlobe = function () { window.Interludes.play("globe"); };
  });
})();
