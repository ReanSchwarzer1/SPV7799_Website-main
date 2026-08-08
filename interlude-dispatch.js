/* ============================================================
   interlude-dispatch.js — the record room (between modules 2 and 3)
   Condition B embodied layer.

   The player's own decisions read back to them as objects: six
   case files pinned to the wall of the record room, each stamped
   with the ruling they made, plus two standing gauges for Access
   and Innovation. Click a file to pull it forward and read what
   followed; click the plaque to move on to the next module.

   Nothing here is invented. Every line comes from the record the
   game kept while the player was ruling (window.GameRecord).
   ============================================================ */

(function () {
  "use strict";

  /* The record rooms present cards and meters, not physical objects. A hard
     key throws rectangles across walls that are already almost black, which
     reads as a rendering fault rather than as light. They get an even,
     presentational rig with no cast shadows. */
  var PRESENTATION_LIGHT = { hemi: 1.0, key: 0.55, rim: 0.26, shadows: false };

  function whenReady(fn) {
    if (window.Interludes) return fn();
    var n = 0, t = setInterval(function () {
      if (window.Interludes) { clearInterval(t); fn(); }
      else if (++n > 100) clearInterval(t);
    }, 30);
  }

  function wrapText(g, text, x, y, maxW, lh, maxLines) {
    var words = String(text || "").split(/\s+/), line = "", lines = 0;
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (g.measureText(test).width > maxW && line) {
        g.fillText(line, x, y); line = words[i]; y += lh; lines++;
        if (maxLines && lines >= maxLines) { return y; }
      } else line = test;
    }
    if (line) { g.fillText(line, x, y); y += lh; }
    return y;
  }

  whenReady(function () {

    window.Interludes.register("dispatch", {
      lighting: PRESENTATION_LIGHT,
      kicker: "The record room",
      title: "What you have done so far",
      step: "End of the first two modules",
      instructions: "Click a case file to read what followed. Then take the plaque to move on.",

      assets: {
        card:   { w: 2.9, h: 2.0, gap: 0.35 },
        gauge:  { w: 0.55, h: 4.2, access: 0x3fae6b, innov: 0x4f86c6 },
        wall:   { color: 0x141821 },
        plaque: { w: 4.6, h: 0.9, color: 0x2a3140, accent: 0xfffb00 },
        camera: { elevationDeg: 6, margin: 1.1, lookAt: [0, 0.2, 0] }
      },

      build: function (ctx) {
        var THREE = ctx.THREE, scene = ctx.scene, A = ctx.assets;
        var junk = [];
        function keep(o) { junk.push(o); return o; }

        var rec = (typeof window.GameRecord === "function") ? window.GameRecord() : null;
        var rulings = (rec && rec.rulings) || [];
        var access = rec ? Math.round(rec.access) : 0;
        var innov = rec ? Math.round(rec.innov) : 0;
        var opened = rulings.filter(function (r) { return !r.granted; }).length;
        var granted = rulings.length - opened;

        // ---------- back wall ----------
        var wall = new THREE.Mesh(
          keep(new THREE.PlaneGeometry(24, 16)),
          keep(new THREE.MeshStandardMaterial({ color: A.wall.color, roughness: 0.95 })));
        wall.position.set(0, 0, -1.6);
        scene.add(wall);

        // ---------- narrative header ----------
        function headerTexture() {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 1400, _H = 300;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = "rgba(10,12,18,0.94)"; g.fillRect(0, 0, _W, _H);
          g.strokeStyle = "#fffb00"; g.lineWidth = 6;
          g.beginPath(); g.moveTo(0, 3); g.lineTo(_W, 3); g.stroke();
          g.fillStyle = "#fffb00";
          g.font = "bold 30px system-ui, sans-serif";
          g.fillText("THE RECORD SO FAR", 44, 62);
          g.fillStyle = "#e6e9ee";
          g.font = "26px Georgia, serif";
          var line1 = rec && rec.viaMoleculeScene
            ? "You put the two samples together with your own hands: one molecule, imatinib, in both vials. "
              + "The same money bought one pill in the United States and about a hundred and twenty in India."
            : "Two prices for one molecule: imatinib sells for $179.93 a pill in the United States and around "
              + "$1.50 in India. The compound is identical in both markets.";
          var y = wrapText(g, line1, 44, 118, _W - 88, 36);
          var line2;
          if (rulings.length === 0) line2 = "No case has been decided yet.";
          else if (granted === 0) line2 = "Then six companies came before you, and you intervened every time.";
          else if (opened === 0) line2 = "Then six companies came before you, and you upheld the patent holder every time.";
          else line2 = "Then six companies came before you. You opened the market in " + opened +
                       " of " + rulings.length + " cases and let the monopoly stand in " + granted + ".";
          g.fillStyle = "#9aa6b4";
          g.font = "italic 25px Georgia, serif";
          wrapText(g, line2, 44, y + 16, _W - 88, 34);
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }
        var header = new THREE.Mesh(
          keep(new THREE.PlaneGeometry(10.5, 2.25)),
          keep(new THREE.MeshBasicMaterial({ map: headerTexture(), transparent: true })));
        header.position.set(0, 3.6, 0);
        scene.add(header);

        // ---------- case files ----------
        function cardTexture(r, expanded) {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = expanded ? 1100 : 580, _H = expanded ? 760 : 400;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = "#f4efe2"; g.fillRect(0, 0, _W, _H);
          var accent = r.granted ? "#b5402c" : "#1d6b3a";
          g.strokeStyle = accent; g.lineWidth = expanded ? 12 : 8;
          g.strokeRect(6, 6, _W - 12, _H - 12);
          var pad = expanded ? 52 : 34;
          g.fillStyle = "#8a1c1c";
          g.font = "bold " + (expanded ? 26 : 19) + "px Georgia, serif";
          g.fillText("CASE 00" + r.num, pad, expanded ? 74 : 52);
          g.fillStyle = "#15161a";
          g.font = "bold " + (expanded ? 40 : 27) + "px Georgia, serif";
          var y = wrapText(g, r.title, pad, expanded ? 128 : 92, _W - pad * 2,
                           expanded ? 46 : 32, expanded ? 3 : 2);
          g.fillStyle = "#3a4048";
          g.font = "italic " + (expanded ? 24 : 17) + "px Georgia, serif";
          y = wrapText(g, r.drug, pad, y + (expanded ? 16 : 8), _W - pad * 2,
                       expanded ? 30 : 22, 2);

          g.fillStyle = accent;
          g.font = "bold " + (expanded ? 28 : 20) + "px system-ui, sans-serif";
          y = wrapText(g, "YOU RULED: " + r.action.toUpperCase(), pad, y + (expanded ? 44 : 30),
                       _W - pad * 2, expanded ? 34 : 24, 2);

          if (expanded && r.outcome) {
            g.strokeStyle = "rgba(0,0,0,.15)"; g.lineWidth = 2;
            g.beginPath(); g.moveTo(pad, y + 18); g.lineTo(_W - pad, y + 18); g.stroke();
            g.fillStyle = "#7a6320";
            g.font = "bold 22px Georgia, serif";
            g.fillText("WHAT FOLLOWED", pad, y + 58);
            g.fillStyle = "#111318";
            g.font = "27px Georgia, serif";
            wrapText(g, r.outcome, pad, y + 96, _W - pad * 2, 35);
          } else if (!expanded) {
            g.fillStyle = "#7b828c";
            g.font = "italic 16px system-ui, sans-serif";
            g.fillText("click to read what followed", pad, _H - 34);
          }
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }

        var cards = [];
        var cols = 3;
        var startX = -(A.card.w + A.card.gap);
        for (var i = 0; i < rulings.length; i++) {
          var r = rulings[i];
          var col = i % cols, row = Math.floor(i / cols);
          var m = new THREE.Mesh(
            keep(new THREE.PlaneGeometry(A.card.w, A.card.h)),
            keep(new THREE.MeshBasicMaterial({ map: cardTexture(r, false), transparent: true })));
          m.position.set(startX + col * (A.card.w + A.card.gap),
                         1.15 - row * (A.card.h + A.card.gap), 0);
          m.userData = { ruling: r, home: m.position.clone(), expanded: false };
          scene.add(m);
          ctx.pickables.push(m);
          cards.push(m);
        }

        // ---------- gauges ----------
        function makeGauge(x, label, value, color) {
          var back = new THREE.Mesh(
            keep(ctx.roundedBox(A.gauge.w, A.gauge.h, 0.12)),
            keep(new THREE.MeshStandardMaterial({ color: 0x232a36, roughness: 0.8 })));
          back.position.set(x, 0.3, 0);
          scene.add(back);
          var h = Math.max(0.06, A.gauge.h * (Math.max(0, Math.min(100, value)) / 100));
          var fill = new THREE.Mesh(
            keep(ctx.roundedBox(A.gauge.w * 0.72, h, 0.16)),
            keep(new THREE.MeshStandardMaterial(
              { color: color, roughness: 0.4, emissive: color, emissiveIntensity: 0.35 })));
          fill.position.set(x, 0.3 - A.gauge.h / 2 + h / 2, 0.03);
          scene.add(fill);

          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 256, _H = 160;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.clearRect(0, 0, _W, _H);
          g.textAlign = "center";
          g.fillStyle = "#" + color.toString(16).padStart(6, "0");
          g.font = "bold 26px system-ui, sans-serif";
          g.fillText(label, _W / 2, 40);
          g.fillStyle = "#ffffff";
          g.font = "bold 74px system-ui, sans-serif";
          g.fillText(String(value), _W / 2, 116);
          var tag = new THREE.Mesh(
            keep(new THREE.PlaneGeometry(1.5, 0.94)),
            keep(new THREE.MeshBasicMaterial({ map: keep(ctx.tune(new THREE.CanvasTexture(c))), transparent: true })));
          tag.position.set(x, 0.3 + A.gauge.h / 2 + 0.62, 0.1);
          scene.add(tag);
        }
        makeGauge(-6.15, "ACCESS", access, A.gauge.access);
        makeGauge(6.15, "INNOVATION", innov, A.gauge.innov);

        // ---------- proceed plaque ----------
        function plaqueTexture() {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 900, _H = 180;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = "#1d2431"; g.fillRect(0, 0, _W, _H);
          g.strokeStyle = "#fffb00"; g.lineWidth = 7;
          g.strokeRect(5, 5, _W - 10, _H - 10);
          g.textAlign = "center"; g.fillStyle = "#fffb00";
          g.font = "bold 44px system-ui, sans-serif";
          g.fillText("PROCEED TO MODULE 3", _W / 2, 78);
          g.fillStyle = "#9aa6b4";
          g.font = "24px system-ui, sans-serif";
          g.fillText("the market your rulings created", _W / 2, 128);
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }
        var plaque = new THREE.Mesh(
          keep(new THREE.PlaneGeometry(A.plaque.w, A.plaque.h)),
          keep(new THREE.MeshBasicMaterial({ map: plaqueTexture(), transparent: true })));
        plaque.position.set(0, -3.15, 0);
        scene.add(plaque);
        ctx.pickables.push(plaque);

        // ---------- state ----------
        var expandedCard = null;
        var pulse = 0;

        ctx.setBrief(null);
        ctx.setStatus(rulings.length + " rulings on the record", true);
        ctx.complete();                       // reading is the objective
        ctx.setAction("Proceed to module 3", null);

        function expand(card) {
          if (expandedCard === card) { collapse(); return; }
          if (expandedCard) collapse();
          expandedCard = card;
          card.material.map = cardTexture(card.userData.ruling, true);
          card.material.needsUpdate = true;
          card.renderOrder = 10;
          card.material.depthTest = false;
          ctx.setHint("Click the file again to pin it back.");
        }
        function collapse() {
          if (!expandedCard) return;
          var c = expandedCard;
          c.material.map = cardTexture(c.userData.ruling, false);
          c.material.needsUpdate = true;
          c.renderOrder = 0;
          c.material.depthTest = true;
          expandedCard = null;
          ctx.setHint("Click a case file to read what followed.");
        }

        function fitCamera() {
          var cam = ctx.camera;
          var el = A.camera.elevationDeg * Math.PI / 180;
          var dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el)).normalize();
          var look = new THREE.Vector3().fromArray(A.camera.lookAt);
          var box = new THREE.Box3();
          scene.traverse(function (o) {
            if (o.isMesh && o.visible && o !== wall) box.expandByObject(o);
          });
          if (box.isEmpty()) return;
          var corners = [];
          for (var i2 = 0; i2 < 8; i2++) corners.push(new THREE.Vector3(
            (i2 & 1) ? box.max.x : box.min.x, (i2 & 2) ? box.max.y : box.min.y,
            (i2 & 4) ? box.max.z : box.min.z));
          var dist = box.getBoundingSphere(new THREE.Sphere()).radius * 2;
          for (var p = 0; p < 6; p++) {
            cam.position.copy(look).addScaledVector(dir, dist);
            cam.lookAt(look); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
            var worst = 0;
            for (var c2 = 0; c2 < corners.length; c2++) {
              var v = corners[c2].clone().project(cam);
              worst = Math.max(worst, Math.abs(v.x), Math.abs(v.y));
            }
            if (worst < 0.0001) break;
            dist *= worst * A.camera.margin;
          }
          cam.position.copy(look).addScaledVector(dir, dist);
          cam.lookAt(look); cam.updateProjectionMatrix();
        }

        ctx.setHint("Click a case file to read what followed.");

        return {
          update: function (dt) {
            pulse += dt;
            plaque.scale.setScalar(1 + Math.sin(pulse * 2.2) * 0.015);
            for (var i3 = 0; i3 < cards.length; i3++) {
              var c3 = cards[i3];
              var want = (c3 === expandedCard)
                ? new THREE.Vector3(0, 0.2, 2.4)
                : c3.userData.home;
              c3.position.lerp(want, Math.min(1, dt * 8));
              var ws = (c3 === expandedCard) ? 2.05 : 1;
              c3.scale.setScalar(c3.scale.x + (ws - c3.scale.x) * Math.min(1, dt * 8));
            }
          },
          onPointerDown: function (hit) {
            if (!hit) return;
            if (hit.object === plaque) { ctx.finish(); return; }
            if (cards.indexOf(hit.object) >= 0) expand(hit.object);
            else if (expandedCard) collapse();
          },
          onResize: fitCamera,
          dispose: function () { junk.forEach(function (d) { try { d.dispose(); } catch (e) {} }); }
        };
      }
    });

    window.launchDispatch = function () { window.Interludes.play("dispatch"); };

    /* ----------------------------------------------------------
       Second record room: what the market modules produced.
       Shown after modules 3 and 4, before module 5. Reads the live
       page state so every figure is the model's own, not a retelling.
       ---------------------------------------------------------- */
    window.Interludes.register("dispatch-market", {
      lighting: PRESENTATION_LIGHT,
      kicker: "The record room",
      title: "What the market did",
      step: "After the floor and the clearing house",
      instructions: "Click a card to read it in full. Then take the plaque to move on.",

      assets: {
        card: { w: 3.15, h: 2.3, gap: 0.4 },
        gauge: { w: 0.55, h: 4.2, access: 0x3fae6b, innov: 0x4f86c6 },
        camera: { elevationDeg: 6, margin: 1.1, lookAt: [0, 0.2, 0] }
      },

      build: function (ctx) {
        var THREE = ctx.THREE, scene = ctx.scene, A = ctx.assets;
        var junk = [];
        function keep(o) { junk.push(o); return o; }

        function num(id) {
          var e = document.getElementById(id);
          if (!e) return NaN;
          return parseFloat(String(e.value !== undefined && e.value !== "" ? e.value : e.textContent)
                            .replace(/[^0-9.\-]/g, ""));
        }
        var rec = (typeof window.GameRecord === "function") ? window.GameRecord() : {};
        var firms = num("slider-comp") || 1;
        var proc = num("slider-procure") || 1;
        var open = !!rec.marketOpen;
        var price = open ? 100 * Math.pow(firms, -0.75) : 100;
        var qty = (120 - price) * (1 + proc * 0.5);
        var producer = Math.max(0, (price - 5) * qty);
        var consumer = Math.max(0, 0.5 * (120 - price) * qty);
        var eqP = num("eq-price");
        var eqQ = num("eq-quantity");
        var procName = proc >= 3 ? "High" : proc === 2 ? "Medium" : "Low";

        var wall = new THREE.Mesh(
          keep(new THREE.PlaneGeometry(24, 16)),
          keep(new THREE.MeshStandardMaterial({ color: 0x141821, roughness: 0.95 })));
        wall.position.set(0, 0, -1.6);
        scene.add(wall);

        function headerTexture() {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 1400, _H = 300;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = "rgba(10,12,18,0.94)"; g.fillRect(0, 0, _W, _H);
          g.strokeStyle = "#fffb00"; g.lineWidth = 6;
          g.beginPath(); g.moveTo(0, 3); g.lineTo(_W, 3); g.stroke();
          g.fillStyle = "#fffb00"; g.font = "bold 30px system-ui, sans-serif";
          g.fillText("THE MARKET YOU RAN", 44, 62);
          g.fillStyle = "#e6e9ee"; g.font = "26px Georgia, serif";
          var l1 = open
            ? "You let " + Math.round(firms) + (Math.round(firms) === 1 ? " firm" : " firms") +
              " onto the floor and set procurement to " + procName + ". The price index fell from 100 to " +
              Math.round(price) + "."
            : "The gate stayed bolted, so one firm held the floor and the price index never moved off 100.";
          var y = wrapText(g, l1, 44, 118, _W - 88, 36);
          var l2 = consumer > producer
            ? "Most of the value the market produced now reaches patients rather than the producer."
            : "Most of the value the market produced still sits with the producer.";
          if (!isNaN(eqP)) l2 += " The market clears at $" + Math.round(eqP) + ".";
          g.fillStyle = "#9aa6b4"; g.font = "italic 25px Georgia, serif";
          wrapText(g, l2, 44, y + 16, _W - 88, 34);
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }
        var header = new THREE.Mesh(
          keep(new THREE.PlaneGeometry(10.5, 2.25)),
          keep(new THREE.MeshBasicMaterial({ map: headerTexture(), transparent: true })));
        header.position.set(0, 3.5, 0);
        scene.add(header);

        var CARDS = [
          { t: "FIRMS ADMITTED", v: open ? String(Math.round(firms)) : "1",
            s: open ? "generic manufacturers on the floor" : "gate bolted by your ruling",
            accent: "#d9a441",
            d: open
              ? "Every firm you admitted drove the price down along the decay relation the "
                + "artifact uses, P = P0 x N^-0.75. One extra entrant barely moves the price: "
                + "six bring it down by about three quarters, and it keeps falling from there. "
                + "This is a stylised curve, not the FDA's own table."
              : "You upheld the patent at the bench, so no competitor could enter. One firm "
                + "set the price and kept the surplus." },
          { t: "PRICE INDEX", v: String(Math.round(price)), s: "down from 100 at monopoly",
            accent: "#d4573f",
            d: "The price index is what the same medicine costs relative to its monopoly price. "
               + "Competition, not goodwill, is what moved it." },
          { t: "WHERE THE VALUE WENT",
            v: (consumer > producer ? "PATIENTS" : "PRODUCER"),
            s: "profit " + Math.round(producer) + "  ·  access " + Math.round(consumer),
            accent: consumer > producer ? "#3fae6b" : "#8892a4",
            d: "Producer surplus is (price - marginal cost) x quantity. Consumer surplus is the "
               + "gap between what patients would have paid and what they actually paid. Opening "
               + "the market transfers value from the first to the second." },
          { t: "CLEARING PRICE", v: isNaN(eqP) ? "--" : "$" + Math.round(eqP),
            s: isNaN(eqQ) ? "" : Math.round(eqQ) + " units reaching patients",
            accent: "#fffb00",
            d: "Where supply meets demand is where the market actually settles. Pushing supply "
               + "brings that price down; pushing procurement raises quantity but pushes the "
               + "price back up. Only one of those helps a patient who has to pay." }
        ];

        function cardTexture(cd, expanded) {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = expanded ? 1100 : 620, _H = expanded ? 720 : 460;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = "#f4efe2"; g.fillRect(0, 0, _W, _H);
          g.strokeStyle = cd.accent; g.lineWidth = expanded ? 12 : 9;
          g.strokeRect(6, 6, _W - 12, _H - 12);
          var pad = expanded ? 54 : 36;
          g.fillStyle = "#6b6250";
          g.font = "bold " + (expanded ? 26 : 21) + "px system-ui, sans-serif";
          g.fillText(cd.t, pad, expanded ? 76 : 62);
          g.fillStyle = "#15161a";
          g.font = "bold " + (expanded ? 92 : 84) + "px system-ui, sans-serif";
          g.fillText(cd.v, pad, expanded ? 182 : 168);
          g.fillStyle = "#3a4048";
          g.font = "italic " + (expanded ? 25 : 21) + "px Georgia, serif";
          var y = wrapText(g, cd.s, pad, expanded ? 234 : 218, _W - pad * 2,
                           expanded ? 32 : 27, 2);
          if (expanded) {
            g.strokeStyle = "rgba(0,0,0,.15)"; g.lineWidth = 2;
            g.beginPath(); g.moveTo(pad, y + 16); g.lineTo(_W - pad, y + 16); g.stroke();
            g.fillStyle = "#111318"; g.font = "27px Georgia, serif";
            wrapText(g, cd.d, pad, y + 62, _W - pad * 2, 35);
          } else {
            g.fillStyle = "#7b828c"; g.font = "italic 17px system-ui, sans-serif";
            g.fillText("click to read", pad, _H - 34);
          }
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }

        var cards = [];
        for (var i = 0; i < CARDS.length; i++) {
          var m = new THREE.Mesh(
            keep(new THREE.PlaneGeometry(A.card.w, A.card.h)),
            keep(new THREE.MeshBasicMaterial({ map: cardTexture(CARDS[i], false), transparent: true })));
          var col = i % 2, row = Math.floor(i / 2);
          m.position.set(-(A.card.w + A.card.gap) / 2 + col * (A.card.w + A.card.gap),
                         1.15 - row * (A.card.h + A.card.gap), 0);
          m.userData = { cd: CARDS[i], home: m.position.clone() };
          scene.add(m);
          ctx.pickables.push(m);
          cards.push(m);
        }

        function makeGauge(x, label, value, color) {
          var back = new THREE.Mesh(
            keep(ctx.roundedBox(A.gauge.w, A.gauge.h, 0.12)),
            keep(new THREE.MeshStandardMaterial({ color: 0x232a36, roughness: 0.8 })));
          back.position.set(x, 0.1, 0); scene.add(back);
          var h = Math.max(0.06, A.gauge.h * (Math.max(0, Math.min(100, value)) / 100));
          var fill = new THREE.Mesh(
            keep(ctx.roundedBox(A.gauge.w * 0.72, h, 0.16)),
            keep(new THREE.MeshStandardMaterial({ color: color, roughness: 0.4,
                  emissive: color, emissiveIntensity: 0.35 })));
          fill.position.set(x, 0.1 - A.gauge.h / 2 + h / 2, 0.03); scene.add(fill);
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 256, _H = 160;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.textAlign = "center";
          g.fillStyle = "#" + color.toString(16).padStart(6, "0");
          g.font = "bold 26px system-ui, sans-serif";
          g.fillText(label, _W / 2, 40);
          g.fillStyle = "#fff"; g.font = "bold 74px system-ui, sans-serif";
          g.fillText(String(Math.round(value)), _W / 2, 116);
          var tag = new THREE.Mesh(
            keep(new THREE.PlaneGeometry(1.5, 0.94)),
            keep(new THREE.MeshBasicMaterial({ map: keep(ctx.tune(new THREE.CanvasTexture(c))), transparent: true })));
          tag.position.set(x, 0.1 + A.gauge.h / 2 + 0.62, 0.1); scene.add(tag);
        }
        makeGauge(-5.6, "ACCESS", rec.access || 0, A.gauge.access);
        makeGauge(5.6, "INNOVATION", rec.innov || 0, A.gauge.innov);

        function plaqueTexture() {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 900, _H = 180;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = "#1d2431"; g.fillRect(0, 0, _W, _H);
          g.strokeStyle = "#fffb00"; g.lineWidth = 7; g.strokeRect(5, 5, _W - 10, _H - 10);
          g.textAlign = "center"; g.fillStyle = "#fffb00";
          g.font = "bold 44px system-ui, sans-serif";
          g.fillText("PROCEED TO MODULE 5", _W / 2, 78);
          g.fillStyle = "#9aa6b4"; g.font = "24px system-ui, sans-serif";
          g.fillText("what a fixed budget buys in years of life", _W / 2, 128);
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }
        var plaque = new THREE.Mesh(
          keep(new THREE.PlaneGeometry(4.6, 0.9)),
          keep(new THREE.MeshBasicMaterial({ map: plaqueTexture(), transparent: true })));
        plaque.position.set(0, -3.35, 0);
        scene.add(plaque);
        ctx.pickables.push(plaque);

        var expandedCard = null, pulse = 0;
        ctx.setBrief(null);
        ctx.setStatus("The market record is closed", true);
        ctx.complete();
        ctx.setAction("Proceed to module 5", null);
        ctx.setHint("Click a card to read it in full.");

        function expand(card) {
          if (expandedCard === card) { collapse(); return; }
          if (expandedCard) collapse();
          expandedCard = card;
          card.material.map = cardTexture(card.userData.cd, true);
          card.material.needsUpdate = true;
          card.renderOrder = 10; card.material.depthTest = false;
          ctx.setHint("Click the card again to put it back.");
        }
        function collapse() {
          if (!expandedCard) return;
          var c = expandedCard;
          c.material.map = cardTexture(c.userData.cd, false);
          c.material.needsUpdate = true;
          c.renderOrder = 0; c.material.depthTest = true;
          expandedCard = null;
          ctx.setHint("Click a card to read it in full.");
        }

        function fitCamera() {
          var cam = ctx.camera;
          var el = A.camera.elevationDeg * Math.PI / 180;
          var dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el)).normalize();
          var look = new THREE.Vector3().fromArray(A.camera.lookAt);
          var box = new THREE.Box3();
          scene.traverse(function (o) { if (o.isMesh && o.visible && o !== wall) box.expandByObject(o); });
          if (box.isEmpty()) return;
          var cs = [];
          for (var k = 0; k < 8; k++) cs.push(new THREE.Vector3(
            (k & 1) ? box.max.x : box.min.x, (k & 2) ? box.max.y : box.min.y,
            (k & 4) ? box.max.z : box.min.z));
          var dist = box.getBoundingSphere(new THREE.Sphere()).radius * 2;
          for (var p2 = 0; p2 < 6; p2++) {
            cam.position.copy(look).addScaledVector(dir, dist);
            cam.lookAt(look); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
            var worst = 0;
            for (var c3 = 0; c3 < cs.length; c3++) {
              var v = cs[c3].clone().project(cam);
              worst = Math.max(worst, Math.abs(v.x), Math.abs(v.y));
            }
            if (worst < 0.0001) break;
            dist *= worst * A.camera.margin;
          }
          cam.position.copy(look).addScaledVector(dir, dist);
          cam.lookAt(look); cam.updateProjectionMatrix();
        }

        return {
          update: function (dt) {
            pulse += dt;
            plaque.scale.setScalar(1 + Math.sin(pulse * 2.2) * 0.015);
            for (var i2 = 0; i2 < cards.length; i2++) {
              var c4 = cards[i2];
              var want = (c4 === expandedCard) ? new THREE.Vector3(0, 0.2, 2.4) : c4.userData.home;
              c4.position.lerp(want, Math.min(1, dt * 8));
              var ws = (c4 === expandedCard) ? 1.95 : 1;
              c4.scale.setScalar(c4.scale.x + (ws - c4.scale.x) * Math.min(1, dt * 8));
            }
          },
          onPointerDown: function (hit) {
            if (!hit) return;
            if (hit.object === plaque) { ctx.finish(); return; }
            if (cards.indexOf(hit.object) >= 0) expand(hit.object);
            else if (expandedCard) collapse();
          },
          onResize: fitCamera,
          dispose: function () { junk.forEach(function (d) { try { d.dispose(); } catch (e) {} }); }
        };
      }
    });

    window.launchDispatchMarket = function () { window.Interludes.play("dispatch-market"); };

    /* ----------------------------------------------------------
       Third record room: what the ward and the globe produced.
       Shown after modules 5 and 6. Same room, same rules: every
       number is read from the live page model.
       ---------------------------------------------------------- */
    window.Interludes.register("dispatch-reach", {
      lighting: PRESENTATION_LIGHT,
      kicker: "The record room",
      title: "What the medicine reached",
      step: "After the ward and the globe",
      instructions: "Click a card to read it in full. Then take the plaque to move on.",

      assets: {
        card: { w: 3.15, h: 2.3, gap: 0.4 },
        gauge: { w: 0.55, h: 4.2, access: 0x3fae6b, innov: 0x4f86c6 },
        camera: { elevationDeg: 6, margin: 1.1, lookAt: [0, 0.2, 0] }
      },

      build: function (ctx) {
        var THREE = ctx.THREE, scene = ctx.scene, A = ctx.assets;
        var junk = [];
        function keep(o) { junk.push(o); return o; }

        function txt(id) { var e = document.getElementById(id); return e ? e.textContent.trim() : ""; }
        function val(id) { var e = document.getElementById(id); return e ? parseFloat(e.value) : NaN; }

        var rec = (typeof window.GameRecord === "function") ? window.GameRecord() : {};
        var cost = val("slider-qaly-cost");
        var patients = txt("qaly-patients") || "--";
        var qalys = txt("qaly-total") || "--";
        var year = parseInt(txt("map-year-display"), 10);
        var exports = txt("export-volume") || "--";
        var pen = isNaN(year) ? 0 : 100 / (1 + Math.exp(-0.4 * (year - 2010)));

        var wall = new THREE.Mesh(
          keep(new THREE.PlaneGeometry(24, 16)),
          keep(new THREE.MeshStandardMaterial({ color: 0x141821, roughness: 0.95 })));
        wall.position.set(0, 0, -1.6);
        scene.add(wall);

        function headerTexture() {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 1400, _H = 300;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = "rgba(10,12,18,0.94)"; g.fillRect(0, 0, _W, _H);
          g.strokeStyle = "#fffb00"; g.lineWidth = 6;
          g.beginPath(); g.moveTo(0, 3); g.lineTo(_W, 3); g.stroke();
          g.fillStyle = "#fffb00"; g.font = "bold 30px system-ui, sans-serif";
          g.fillText("WHAT THE MEDICINE REACHED", 44, 62);
          g.fillStyle = "#e6e9ee"; g.font = "26px Georgia, serif";
          var l1 = "You brought the cost of a year of treatment to $" +
                   (isNaN(cost) ? "--" : cost.toLocaleString("en-US")) +
                   ", and the same fixed $10,000,000 went from a few hundred patients to " +
                   patients + ".";
          var y = wrapText(g, l1, 44, 118, _W - 88, 36);
          var l2 = isNaN(year)
            ? "The trade routes were left untraced."
            : "On the globe you ran the clock to " + year + ", by which point Indian exports stood at " +
              exports + " and the medicine had reached roughly " + Math.round(pen) +
              "% of the world it could serve.";
          g.fillStyle = "#9aa6b4"; g.font = "italic 25px Georgia, serif";
          wrapText(g, l2, 44, y + 16, _W - 88, 34);
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }
        var header = new THREE.Mesh(
          keep(new THREE.PlaneGeometry(10.5, 2.25)),
          keep(new THREE.MeshBasicMaterial({ map: headerTexture(), transparent: true })));
        header.position.set(0, 3.5, 0);
        scene.add(header);

        var CARDS = [
          { t: "PATIENTS TREATED", v: patients, s: "on the same $10,000,000", accent: "#fffb00",
            d: "The budget never grew. Only the price per patient fell, and the number of people "
               + "it could reach moved with it. Cost-effectiveness is not an abstraction here: it "
               + "is the difference between a few hundred people and a few thousand." },
          { t: "LIFE-YEARS GAINED", v: qalys, s: "5 QALYs per patient treated", accent: "#3fae6b",
            d: "A quality-adjusted life year is one year of life in full health. The artifact uses "
               + "roughly five per patient treated, taken from long-term imatinib survival data. "
               + "Same drug, same effect per person; only the reach changes." },
          { t: "YEAR REACHED", v: isNaN(year) ? "--" : String(year), s: "exports at " + exports,
            accent: "#d9a441",
            d: "Indian pharmaceutical exports grew from $1.5 billion in 2000 to $30.5 billion by "
               + "2024, on Pharmexcil figures. The steep middle of that climb follows the period "
               + "when patent challenges and compulsory licensing opened the major markets." },
          { t: "GLOBAL REACH", v: Math.round(pen) + "%", s: "of the addressable world",
            accent: "#4f86c6",
            d: "Diffusion follows a logistic curve, slow then sudden then flattening. Low prices "
               + "alone did not do it: the acceleration came when distribution networks existed "
               + "to carry the medicine, which is the complementary-assets argument." }
        ];

        function cardTexture(cd, expanded) {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = expanded ? 1100 : 620, _H = expanded ? 720 : 460;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = "#f4efe2"; g.fillRect(0, 0, _W, _H);
          g.strokeStyle = cd.accent; g.lineWidth = expanded ? 12 : 9;
          g.strokeRect(6, 6, _W - 12, _H - 12);
          var pad = expanded ? 54 : 36;
          g.fillStyle = "#6b6250";
          g.font = "bold " + (expanded ? 26 : 21) + "px system-ui, sans-serif";
          g.fillText(cd.t, pad, expanded ? 76 : 62);
          g.fillStyle = "#15161a";
          g.font = "bold " + (expanded ? 84 : 76) + "px system-ui, sans-serif";
          g.fillText(cd.v, pad, expanded ? 182 : 168);
          g.fillStyle = "#3a4048";
          g.font = "italic " + (expanded ? 25 : 21) + "px Georgia, serif";
          var y = wrapText(g, cd.s, pad, expanded ? 234 : 218, _W - pad * 2,
                           expanded ? 32 : 27, 2);
          if (expanded) {
            g.strokeStyle = "rgba(0,0,0,.15)"; g.lineWidth = 2;
            g.beginPath(); g.moveTo(pad, y + 16); g.lineTo(_W - pad, y + 16); g.stroke();
            g.fillStyle = "#111318"; g.font = "27px Georgia, serif";
            wrapText(g, cd.d, pad, y + 62, _W - pad * 2, 35);
          } else {
            g.fillStyle = "#7b828c"; g.font = "italic 17px system-ui, sans-serif";
            g.fillText("click to read", pad, _H - 34);
          }
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }

        var cards = [];
        for (var i = 0; i < CARDS.length; i++) {
          var m = new THREE.Mesh(
            keep(new THREE.PlaneGeometry(A.card.w, A.card.h)),
            keep(new THREE.MeshBasicMaterial({ map: cardTexture(CARDS[i], false), transparent: true })));
          var col = i % 2, row = Math.floor(i / 2);
          m.position.set(-(A.card.w + A.card.gap) / 2 + col * (A.card.w + A.card.gap),
                         1.15 - row * (A.card.h + A.card.gap), 0);
          m.userData = { cd: CARDS[i], home: m.position.clone() };
          scene.add(m); ctx.pickables.push(m); cards.push(m);
        }

        function makeGauge(x, label, value, color) {
          var back = new THREE.Mesh(
            keep(ctx.roundedBox(A.gauge.w, A.gauge.h, 0.12)),
            keep(new THREE.MeshStandardMaterial({ color: 0x232a36, roughness: 0.8 })));
          back.position.set(x, 0.1, 0); scene.add(back);
          var h = Math.max(0.06, A.gauge.h * (Math.max(0, Math.min(100, value)) / 100));
          var fill = new THREE.Mesh(
            keep(ctx.roundedBox(A.gauge.w * 0.72, h, 0.16)),
            keep(new THREE.MeshStandardMaterial({ color: color, roughness: 0.4,
                  emissive: color, emissiveIntensity: 0.35 })));
          fill.position.set(x, 0.1 - A.gauge.h / 2 + h / 2, 0.03); scene.add(fill);
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 256, _H = 160;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S); g.textAlign = "center";
          g.fillStyle = "#" + color.toString(16).padStart(6, "0");
          g.font = "bold 26px system-ui, sans-serif";
          g.fillText(label, _W / 2, 40);
          g.fillStyle = "#fff"; g.font = "bold 74px system-ui, sans-serif";
          g.fillText(String(Math.round(value)), _W / 2, 116);
          var tag = new THREE.Mesh(
            keep(new THREE.PlaneGeometry(1.5, 0.94)),
            keep(new THREE.MeshBasicMaterial({ map: keep(ctx.tune(new THREE.CanvasTexture(c))), transparent: true })));
          tag.position.set(x, 0.1 + A.gauge.h / 2 + 0.62, 0.1); scene.add(tag);
        }
        makeGauge(-5.6, "ACCESS", rec.access || 0, A.gauge.access);
        makeGauge(5.6, "INNOVATION", rec.innov || 0, A.gauge.innov);

        function plaqueTexture() {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 900, _H = 180;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = "#1d2431"; g.fillRect(0, 0, _W, _H);
          g.strokeStyle = "#fffb00"; g.lineWidth = 7; g.strokeRect(5, 5, _W - 10, _H - 10);
          g.textAlign = "center"; g.fillStyle = "#fffb00";
          g.font = "bold 44px system-ui, sans-serif";
          g.fillText("PROCEED TO MODULE 7", _W / 2, 78);
          g.fillStyle = "#9aa6b4"; g.font = "24px system-ui, sans-serif";
          g.fillText("what the price costs in days of work", _W / 2, 128);
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }
        var plaque = new THREE.Mesh(
          keep(new THREE.PlaneGeometry(4.6, 0.9)),
          keep(new THREE.MeshBasicMaterial({ map: plaqueTexture(), transparent: true })));
        plaque.position.set(0, -3.35, 0);
        scene.add(plaque); ctx.pickables.push(plaque);

        var expandedCard = null, pulse = 0;
        ctx.setBrief(null);
        ctx.setStatus("The reach record is closed", true);
        ctx.complete();
        ctx.setAction("Proceed to module 7", null);
        ctx.setHint("Click a card to read it in full.");

        function expand(card) {
          if (expandedCard === card) { collapse(); return; }
          if (expandedCard) collapse();
          expandedCard = card;
          card.material.map = cardTexture(card.userData.cd, true);
          card.material.needsUpdate = true;
          card.renderOrder = 10; card.material.depthTest = false;
          ctx.setHint("Click the card again to put it back.");
        }
        function collapse() {
          if (!expandedCard) return;
          var c = expandedCard;
          c.material.map = cardTexture(c.userData.cd, false);
          c.material.needsUpdate = true;
          c.renderOrder = 0; c.material.depthTest = true;
          expandedCard = null;
          ctx.setHint("Click a card to read it in full.");
        }

        function fitCamera() {
          var cam = ctx.camera;
          var el = A.camera.elevationDeg * Math.PI / 180;
          var dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el)).normalize();
          var look = new THREE.Vector3().fromArray(A.camera.lookAt);
          var box = new THREE.Box3();
          scene.traverse(function (o) { if (o.isMesh && o.visible && o !== wall) box.expandByObject(o); });
          if (box.isEmpty()) return;
          var cs = [];
          for (var k = 0; k < 8; k++) cs.push(new THREE.Vector3(
            (k & 1) ? box.max.x : box.min.x, (k & 2) ? box.max.y : box.min.y,
            (k & 4) ? box.max.z : box.min.z));
          var dist = box.getBoundingSphere(new THREE.Sphere()).radius * 2;
          for (var p2 = 0; p2 < 6; p2++) {
            cam.position.copy(look).addScaledVector(dir, dist);
            cam.lookAt(look); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
            var worst = 0;
            for (var c3 = 0; c3 < cs.length; c3++) {
              var v = cs[c3].clone().project(cam);
              worst = Math.max(worst, Math.abs(v.x), Math.abs(v.y));
            }
            if (worst < 0.0001) break;
            dist *= worst * A.camera.margin;
          }
          cam.position.copy(look).addScaledVector(dir, dist);
          cam.lookAt(look); cam.updateProjectionMatrix();
        }

        return {
          update: function (dt) {
            pulse += dt;
            plaque.scale.setScalar(1 + Math.sin(pulse * 2.2) * 0.015);
            for (var i2 = 0; i2 < cards.length; i2++) {
              var c4 = cards[i2];
              var want = (c4 === expandedCard) ? new THREE.Vector3(0, 0.2, 2.4) : c4.userData.home;
              c4.position.lerp(want, Math.min(1, dt * 8));
              var ws = (c4 === expandedCard) ? 1.95 : 1;
              c4.scale.setScalar(c4.scale.x + (ws - c4.scale.x) * Math.min(1, dt * 8));
            }
          },
          onPointerDown: function (hit) {
            if (!hit) return;
            if (hit.object === plaque) { ctx.finish(); return; }
            if (cards.indexOf(hit.object) >= 0) expand(hit.object);
            else if (expandedCard) collapse();
          },
          onResize: fitCamera,
          dispose: function () { junk.forEach(function (d) { try { d.dispose(); } catch (e) {} }); }
        };
      }
    });

    window.launchDispatchReach = function () { window.Interludes.play("dispatch-reach"); };

    /* ----------------------------------------------------------
       Fourth record room: the human price and the market structure.
       Shown after modules 7 and 8, before module 9.
       ---------------------------------------------------------- */
    window.Interludes.register("dispatch-power", {
      lighting: PRESENTATION_LIGHT,
      kicker: "The record room",
      title: "What the price cost, and who held it",
      step: "After the wage floor and the concentration room",
      instructions: "Click a card to read it in full. Then take the plaque to move on.",

      assets: {
        card: { w: 3.15, h: 2.3, gap: 0.4 },
        gauge: { w: 0.55, h: 4.2, access: 0x3fae6b, innov: 0x4f86c6 },
        camera: { elevationDeg: 6, margin: 1.1, lookAt: [0, 0.2, 0] }
      },

      build: function (ctx) {
        var THREE = ctx.THREE, scene = ctx.scene, A = ctx.assets;
        var junk = [];
        function keep(o) { junk.push(o); return o; }

        var rec = (typeof window.GameRecord === "function") ? window.GameRecord() : {};
        function sel(id) { var e = document.getElementById(id); return e ? e.value : ""; }
        function txt(id) { var e = document.getElementById(id); return e ? e.textContent.trim() : ""; }

        var PRICES = { patented: 5000, generic: 105 };
        var WAGES = { unskilled: 3.20, salaried: 15.00 };
        var WNAME = { unskilled: "a rural labourer on the MGNREGA wage",
                      salaried: "an urban salaried worker" };
        var MNAME = { patented: "the patented Nexavar", generic: "the post-licence generic" };
        var mk = sel("select-market-state") || "patented";
        var wg = sel("select-wage-profile") || "unskilled";
        var price = PRICES[mk], wage = WAGES[wg];
        var days = Math.round(price / wage);
        var lerner = (price - 20) / price;
        var firms = parseInt(sel("slider-hhi-firms"), 10) || 1;
        var hhi = txt("hhi-score-val") || "--";
        var innov = 100 * (firms / 5) * Math.exp(1 - firms / 5);
        var inZone = firms >= 3 && firms <= 8;

        var wall = new THREE.Mesh(
          keep(new THREE.PlaneGeometry(24, 16)),
          keep(new THREE.MeshStandardMaterial({ color: 0x141821, roughness: 0.95 })));
        wall.position.set(0, 0, -1.6);
        scene.add(wall);

        function headerTexture() {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 1400, _H = 300;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = "rgba(10,12,18,0.94)"; g.fillRect(0, 0, _W, _H);
          g.strokeStyle = "#fffb00"; g.lineWidth = 6;
          g.beginPath(); g.moveTo(0, 3); g.lineTo(_W, 3); g.stroke();
          g.fillStyle = "#fffb00"; g.font = "bold 30px system-ui, sans-serif";
          g.fillText("THE PRICE, MEASURED IN PEOPLE", 44, 62);
          g.fillStyle = "#e6e9ee"; g.font = "26px Georgia, serif";
          var l1 = "For " + WNAME[wg] + ", one month of " + MNAME[mk] + " costs " +
                   days.toLocaleString("en-US") + " days of work. The WHO calls a medicine " +
                   "affordable when it costs a single day's wage.";
          var y = wrapText(g, l1, 44, 118, _W - 88, 36);
          var l2 = inZone
            ? "You left the market with " + firms + " firms in it, inside the band where rivalry " +
              "still pays for research."
            : "You left the market with " + firms + (firms === 1 ? " firm" : " firms") +
              " in it, outside the band where competition and invention sit together.";
          g.fillStyle = "#9aa6b4"; g.font = "italic 25px Georgia, serif";
          wrapText(g, l2, 44, y + 16, _W - 88, 34);
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }
        var header = new THREE.Mesh(
          keep(new THREE.PlaneGeometry(10.5, 2.25)),
          keep(new THREE.MeshBasicMaterial({ map: headerTexture(), transparent: true })));
        header.position.set(0, 3.5, 0);
        scene.add(header);

        var CARDS = [
          { t: "DAYS OF LABOUR", v: days.toLocaleString("en-US"),
            s: "for one month of medicine", accent: days <= 90 ? "#3fae6b" : "#d4573f",
            d: "The WHO and Health Action International measure affordability as the cost of a "
               + "treatment course divided by the daily wage of the lowest-paid unskilled "
               + "government worker. A medicine is affordable at one day's wage. At the patented "
               + "price this drug sits over a thousand days above that line." },
          { t: "MONOPOLY POWER", v: lerner.toFixed(3),
            s: "Lerner index, 0 to 1", accent: "#d9a441",
            d: "L = (price - marginal cost) / price. At 0 the price equals the cost of making one "
               + "more unit; at 1 the price is almost entirely margin. Even the generic keeps a "
               + "margin here, because the Indian market is competitive but not perfectly so." },
          { t: "MARKET STRUCTURE", v: String(firms) + (firms === 1 ? " firm" : " firms"),
            s: "HHI " + hhi, accent: inZone ? "#3fae6b" : "#d4573f",
            d: "The Herfindahl-Hirschman Index squares every firm's market share and adds them up, "
               + "so a single dominant firm is punished heavily. Regulators treat anything above "
               + "2,500 as highly concentrated and worth their attention." },
          { t: "INNOVATION INTENSITY", v: Math.round(innov) + "%",
            s: inZone ? "on the summit" : "off the summit", accent: "#4f86c6",
            d: "Arrow argued a monopolist has little reason to invent, since a new drug only "
               + "replaces its own sales. Schumpeter argued only large firms can fund risky "
               + "research. Aghion and colleagues found both are right at different points, which "
               + "is why the curve is an inverted U rather than a straight line." }
        ];

        function cardTexture(cd, expanded) {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = expanded ? 1100 : 620, _H = expanded ? 720 : 460;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = "#f4efe2"; g.fillRect(0, 0, _W, _H);
          g.strokeStyle = cd.accent; g.lineWidth = expanded ? 12 : 9;
          g.strokeRect(6, 6, _W - 12, _H - 12);
          var pad = expanded ? 54 : 36;
          g.fillStyle = "#6b6250";
          g.font = "bold " + (expanded ? 26 : 21) + "px system-ui, sans-serif";
          g.fillText(cd.t, pad, expanded ? 76 : 62);
          g.fillStyle = "#15161a";
          g.font = "bold " + (expanded ? 84 : 74) + "px system-ui, sans-serif";
          g.fillText(cd.v, pad, expanded ? 182 : 168);
          g.fillStyle = "#3a4048";
          g.font = "italic " + (expanded ? 25 : 21) + "px Georgia, serif";
          var y = wrapText(g, cd.s, pad, expanded ? 234 : 218, _W - pad * 2,
                           expanded ? 32 : 27, 2);
          if (expanded) {
            g.strokeStyle = "rgba(0,0,0,.15)"; g.lineWidth = 2;
            g.beginPath(); g.moveTo(pad, y + 16); g.lineTo(_W - pad, y + 16); g.stroke();
            g.fillStyle = "#111318"; g.font = "27px Georgia, serif";
            wrapText(g, cd.d, pad, y + 62, _W - pad * 2, 35);
          } else {
            g.fillStyle = "#7b828c"; g.font = "italic 17px system-ui, sans-serif";
            g.fillText("click to read", pad, _H - 34);
          }
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }

        var cards = [];
        for (var i = 0; i < CARDS.length; i++) {
          var m = new THREE.Mesh(
            keep(new THREE.PlaneGeometry(A.card.w, A.card.h)),
            keep(new THREE.MeshBasicMaterial({ map: cardTexture(CARDS[i], false), transparent: true })));
          var col = i % 2, row = Math.floor(i / 2);
          m.position.set(-(A.card.w + A.card.gap) / 2 + col * (A.card.w + A.card.gap),
                         1.15 - row * (A.card.h + A.card.gap), 0);
          m.userData = { cd: CARDS[i], home: m.position.clone() };
          scene.add(m); ctx.pickables.push(m); cards.push(m);
        }

        function makeGauge(x, label, value, color) {
          var back = new THREE.Mesh(
            keep(ctx.roundedBox(A.gauge.w, A.gauge.h, 0.12)),
            keep(new THREE.MeshStandardMaterial({ color: 0x232a36, roughness: 0.8 })));
          back.position.set(x, 0.1, 0); scene.add(back);
          var h = Math.max(0.06, A.gauge.h * (Math.max(0, Math.min(100, value)) / 100));
          var fill = new THREE.Mesh(
            keep(ctx.roundedBox(A.gauge.w * 0.72, h, 0.16)),
            keep(new THREE.MeshStandardMaterial({ color: color, roughness: 0.4,
                  emissive: color, emissiveIntensity: 0.35 })));
          fill.position.set(x, 0.1 - A.gauge.h / 2 + h / 2, 0.03); scene.add(fill);
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 256, _H = 160;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S); g.textAlign = "center";
          g.fillStyle = "#" + color.toString(16).padStart(6, "0");
          g.font = "bold 26px system-ui, sans-serif";
          g.fillText(label, _W / 2, 40);
          g.fillStyle = "#fff"; g.font = "bold 74px system-ui, sans-serif";
          g.fillText(String(Math.round(value)), _W / 2, 116);
          var tag = new THREE.Mesh(
            keep(new THREE.PlaneGeometry(1.5, 0.94)),
            keep(new THREE.MeshBasicMaterial({ map: keep(ctx.tune(new THREE.CanvasTexture(c))), transparent: true })));
          tag.position.set(x, 0.1 + A.gauge.h / 2 + 0.62, 0.1); scene.add(tag);
        }
        makeGauge(-5.6, "ACCESS", rec.access || 0, A.gauge.access);
        makeGauge(5.6, "INNOVATION", rec.innov || 0, A.gauge.innov);

        function plaqueTexture() {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 900, _H = 180;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = "#1d2431"; g.fillRect(0, 0, _W, _H);
          g.strokeStyle = "#fffb00"; g.lineWidth = 7; g.strokeRect(5, 5, _W - 10, _H - 10);
          g.textAlign = "center"; g.fillStyle = "#fffb00";
          g.font = "bold 44px system-ui, sans-serif";
          g.fillText("PROCEED TO MODULE 9", _W / 2, 78);
          g.fillStyle = "#9aa6b4"; g.font = "24px system-ui, sans-serif";
          g.fillText("the patent race, and why both firms overspend", _W / 2, 128);
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }
        var plaque = new THREE.Mesh(
          keep(new THREE.PlaneGeometry(4.6, 0.9)),
          keep(new THREE.MeshBasicMaterial({ map: plaqueTexture(), transparent: true })));
        plaque.position.set(0, -3.35, 0);
        scene.add(plaque); ctx.pickables.push(plaque);

        var expandedCard = null, pulse = 0;
        ctx.setBrief(null);
        ctx.setStatus("The power record is closed", true);
        ctx.complete();
        ctx.setAction("Proceed to module 9", null);
        ctx.setHint("Click a card to read it in full.");

        function expand(card) {
          if (expandedCard === card) { collapse(); return; }
          if (expandedCard) collapse();
          expandedCard = card;
          card.material.map = cardTexture(card.userData.cd, true);
          card.material.needsUpdate = true;
          card.renderOrder = 10; card.material.depthTest = false;
          ctx.setHint("Click the card again to put it back.");
        }
        function collapse() {
          if (!expandedCard) return;
          var c = expandedCard;
          c.material.map = cardTexture(c.userData.cd, false);
          c.material.needsUpdate = true;
          c.renderOrder = 0; c.material.depthTest = true;
          expandedCard = null;
          ctx.setHint("Click a card to read it in full.");
        }

        function fitCamera() {
          var cam = ctx.camera;
          var el = A.camera.elevationDeg * Math.PI / 180;
          var dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el)).normalize();
          var look = new THREE.Vector3().fromArray(A.camera.lookAt);
          var box = new THREE.Box3();
          scene.traverse(function (o) { if (o.isMesh && o.visible && o !== wall) box.expandByObject(o); });
          if (box.isEmpty()) return;
          var cs = [];
          for (var k = 0; k < 8; k++) cs.push(new THREE.Vector3(
            (k & 1) ? box.max.x : box.min.x, (k & 2) ? box.max.y : box.min.y,
            (k & 4) ? box.max.z : box.min.z));
          var dist = box.getBoundingSphere(new THREE.Sphere()).radius * 2;
          for (var p2 = 0; p2 < 6; p2++) {
            cam.position.copy(look).addScaledVector(dir, dist);
            cam.lookAt(look); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
            var worst = 0;
            for (var c3 = 0; c3 < cs.length; c3++) {
              var v = cs[c3].clone().project(cam);
              worst = Math.max(worst, Math.abs(v.x), Math.abs(v.y));
            }
            if (worst < 0.0001) break;
            dist *= worst * A.camera.margin;
          }
          cam.position.copy(look).addScaledVector(dir, dist);
          cam.lookAt(look); cam.updateProjectionMatrix();
        }

        return {
          update: function (dt) {
            pulse += dt;
            plaque.scale.setScalar(1 + Math.sin(pulse * 2.2) * 0.015);
            for (var i2 = 0; i2 < cards.length; i2++) {
              var c4 = cards[i2];
              var want = (c4 === expandedCard) ? new THREE.Vector3(0, 0.2, 2.4) : c4.userData.home;
              c4.position.lerp(want, Math.min(1, dt * 8));
              var ws = (c4 === expandedCard) ? 1.95 : 1;
              c4.scale.setScalar(c4.scale.x + (ws - c4.scale.x) * Math.min(1, dt * 8));
            }
          },
          onPointerDown: function (hit) {
            if (!hit) return;
            if (hit.object === plaque) { ctx.finish(); return; }
            if (cards.indexOf(hit.object) >= 0) expand(hit.object);
            else if (expandedCard) collapse();
          },
          onResize: fitCamera,
          dispose: function () { junk.forEach(function (d) { try { d.dispose(); } catch (e) {} }); }
        };
      }
    });

    window.launchDispatchPower = function () { window.Interludes.play("dispatch-power"); };
  });
})();
