/* ============================================================
   game.js — Condition B gamification layer (study artifact)
   Loaded AFTER script.js. Adds the four study mechanics on top
   of the unchanged explorable:
     1. persistent role (Health Minister of India)
     2. explicit goals + win-states (one per section)
     3. cross-section consequences (rulings open/lock later levels)
     4. scoring (Access + Innovation meters -> policy report card)

   It does not modify any economic model or widget. It wraps the
   existing global click handlers and adds its own listeners so
   Condition A (index.html) and Condition B share identical content.
   ============================================================ */
(function () {
  "use strict";

  // -------- game state --------
  var ACCESS_START = 10, INNOV_START = 50;
  var g = {
    access: ACCESS_START,
    innov: INNOV_START,
    done: {},            // levelIndex -> true
    ruledCases: {},      // caseNumber -> 'open'|'monopoly'
    regionVisited: false,
    started: false
  };

  // level config, indexed to the 10 <section> elements in order
  var LEVELS = [
    { t: "Read the price, not the chemistry",
      g: "Toggle the market to <b>Indian Generic</b> and watch the same molecule's price collapse." },
    { t: "Rule as the Patent Authority",
      g: "Decide all <b>6</b> cases. Protecting access raises Access; granting monopolies raises Innovation but costs Access." },
    { t: "Shift value to patients",
      g: "Set competitors and procurement so <b>Social Access &gt; Private Profit</b> in the value chart. (Needs an open market from your rulings.)" },
    { t: "Break the monopoly price",
      g: "Raise competitive <b>supply</b> (and keep procurement low) until the equilibrium price falls to <b>$70 or lower</b>." },
    { t: "Stretch the health budget",
      g: "Lower the drug cost until the $10M budget treats <b>at least 2,000 patients</b>." },
    { t: "Trace the diffusion",
      g: "Advance the timeline to <b>2012 or later</b> and click a region node to inspect its market." },
    { t: "Make it affordable",
      g: "Choose a market and patient so the drug costs <b>90 days of labor or fewer</b>." },
    { t: "Find the innovation sweet spot",
      g: "Set the market to <b>3&ndash;8 firms</b>, where the Aghion curve says innovation peaks." },
    { t: "Run the patent race",
      g: "Make your call as CEO and see why both firms are forced to overspend." },
    { t: "See the global payoff",
      g: "Review the OECD generic paradox to close your term." }
  ];

  function clamp(v) { return Math.max(0, Math.min(100, v)); }
  function $(id) { return document.getElementById(id); }

  // -------- HUD --------
  function buildHUD() {
    var hud = document.createElement("div");
    hud.id = "game-hud";
    hud.innerHTML =
      '<div class="role">Health Minister of India<small>Your term</small></div>' +
      '<div class="meters">' +
        '<div class="meter access"><div class="lbl"><span>Access</span><b id="m-access">10</b></div><div class="track"><div class="fill" id="f-access"></div></div></div>' +
        '<div class="meter innov"><div class="lbl"><span>Innovation</span><b id="m-innov">50</b></div><div class="track"><div class="fill" id="f-innov"></div></div></div>' +
      '</div>' +
      '<div class="progress">Levels <b id="m-prog">0</b>/10</div>' +
      '<div class="score"><small>Score</small><b id="m-score">60</b></div>';
    document.body.appendChild(hud);
    document.body.classList.add("gamified");
    updateHUD();
  }

  function levelsDone() {
    var n = 0; for (var k in g.done) if (g.done[k]) n++; return n;
  }

  function updateHUD() {
    var a = Math.round(g.access), i = Math.round(g.innov);
    if ($("m-access")) $("m-access").textContent = a;
    if ($("m-innov")) $("m-innov").textContent = i;
    if ($("f-access")) $("f-access").style.width = a + "%";
    if ($("f-innov")) $("f-innov").style.width = i + "%";
    if ($("m-prog")) $("m-prog").textContent = levelsDone();
    if ($("m-score")) $("m-score").textContent = a + i;
  }

  // -------- goal cards --------
  function buildGoalCards() {
    var sections = document.querySelectorAll("main > section");
    sections.forEach(function (sec, idx) {
      if (!LEVELS[idx]) return;
      var card = document.createElement("div");
      card.className = "goal-card";
      card.id = "goal-card-" + idx;
      card.innerHTML =
        '<span class="tag">Level ' + (idx + 1) + '</span>' +
        '<div class="body">' +
          '<p class="t">' + LEVELS[idx].t + '</p>' +
          '<p class="g">' + LEVELS[idx].g + '</p>' +
          '<p class="fb" id="goal-fb-' + idx + '"></p>' +
        '</div>' +
        '<div class="state"><span class="pending">Goal</span><span class="check">✓ Done</span></div>';
      // place the card just under the section heading: after the intro
      // <p> when there is one (sections 2-9), otherwise right after the <h3>
      var heading = sec.querySelector("h3");
      var anchor = heading;
      if (heading) {
        var next = heading.nextElementSibling;
        if (next && next.tagName === "P") anchor = next;
        anchor.insertAdjacentElement("afterend", card);
      } else {
        sec.insertBefore(card, sec.firstChild);
      }

      // the final level completes passively on scroll (observer below),
      // but also on click so the finale is always reachable
      if (idx === 9) {
        card.style.cursor = "pointer";
        card.title = "Click to review and finish your term";
        card.addEventListener("click", function () {
          completeLevel(9, 2, 0, "The generic paradox: high volume, low spend. Your term is complete.");
        });
      }
    });
  }

  function completeLevel(idx, dA, dI, feedback) {
    if (g.done[idx]) return;        // idempotent
    g.done[idx] = true;
    g.access = clamp(g.access + (dA || 0));
    g.innov = clamp(g.innov + (dI || 0));
    var card = $("goal-card-" + idx);
    if (card) card.classList.add("done");
    var fb = $("goal-fb-" + idx);
    if (fb && feedback) fb.innerHTML = feedback;
    updateHUD();
    if (levelsDone() === 10) setTimeout(showReport, 600);
  }

  // -------- consequence helpers (read from the DOM, not internals) --------
  function marketOpen() {
    var lbl = $("val-monopoly-status");
    return !!(lbl && /REJECT|CL|OPEN/i.test(lbl.textContent));
  }
  function numVal(id) {
    var el = $(id); if (!el) return NaN;
    return parseFloat(String(el.textContent).replace(/[^0-9.\-]/g, ""));
  }

  // -------- wrap existing global click handlers --------
  function wrapGlobals() {
    // L1: synthesis toggle
    if (typeof window.setSynthesis === "function") {
      var _syn = window.setSynthesis;
      window.setSynthesis = function (route) {
        _syn.apply(this, arguments);
        if (route === "alternative") {
          completeLevel(0, 5, 0, "You saw it: the molecule is identical. The ~99% price gap is law and market power, not cost.");
        }
      };
    }

    // L2: legal rulings (per case, scored once each)
    if (typeof window.makeRuling === "function") {
      var _rule = window.makeRuling;
      window.makeRuling = function (isGrant) {
        _rule.apply(this, arguments);
        var num = numVal("case-number");           // 1..6 shown on screen
        if (isNaN(num)) return;
        if (!g.ruledCases[num]) {
          g.ruledCases[num] = isGrant ? "monopoly" : "open";
          if (isGrant) { g.access = clamp(g.access - 3); g.innov = clamp(g.innov + 5); }
          else { g.access = clamp(g.access + 7); g.innov = clamp(g.innov - 1); }
          updateHUD();
        }
        var ruled = Object.keys(g.ruledCases).length;
        if (ruled >= 6 && !g.done[1]) {
          var opened = 0, mono = 0, k;
          for (k in g.ruledCases) (g.ruledCases[k] === "open") ? opened++ : mono++;
          completeLevel(1, 0, 0,
            "Term verdict: you opened the market in " + opened + " of 6 cases and upheld monopoly in " +
            mono + ". Those rulings set the market the next levels inherit.");
        }
      };
    }

    // L6: region inspection (combined with timeline below)
    if (typeof window.selectRegion === "function") {
      var _sel = window.selectRegion;
      window.selectRegion = function () {
        _sel.apply(this, arguments);
        g.regionVisited = true;
        checkDiffusion();
      };
    }

    // L9: patent race
    if (typeof window.playPatentRace === "function") {
      var _race = window.playPatentRace;
      window.playPatentRace = function (choice) {
        _race.apply(this, arguments);
        completeLevel(8, 0, 0,
          "High R&D is the dominant strategy, so both firms overspend and duplicate research. " +
          "Individually rational, collectively wasteful.");
      };
    }
  }

  // -------- supplementary listeners for slider-driven levels --------
  function checkMacro() {
    if (g.done[2]) return;
    var comp = numVal("val-comp"); var proc = numVal("val-procure"); // proc text is Low/Med/High
    var procSlider = $("slider-procure");
    var procurement = procSlider ? parseInt(procSlider.value, 10) : 1;
    var competitors = isNaN(comp) ? 1 : comp;
    var basePrice = 100;
    var price = marketOpen() ? basePrice * Math.pow(competitors, -0.75) : basePrice;
    var maxWilling = 120, mc = 5;
    var demandMult = 1 + (procurement * 0.5);
    var qty = (maxWilling - price) * demandMult;
    var producer = Math.max(0, (price - mc) * qty);
    var consumer = Math.max(0, 0.5 * (maxWilling - price) * qty);
    if (consumer > producer) {
      completeLevel(2, 6, 0, "Value tipped toward patients: consumer surplus now exceeds producer profit.");
    }
  }

  function checkSD() {
    if (g.done[3]) return;
    var p = numVal("eq-price");
    if (!isNaN(p) && p <= 70) {
      completeLevel(3, 6, 0, "Competition drove the equilibrium price down to $" + p.toFixed(0) + ", well below the monopoly level. Notice procurement (demand) pushes price the other way.");
    }
  }

  function checkQALY() {
    if (g.done[4]) return;
    var pats = numVal("qaly-patients");
    if (!isNaN(pats) && pats >= 2000) {
      completeLevel(4, 6, 0, "Generic pricing stretched the fixed budget to treat " + pats.toLocaleString() + " patients.");
    }
  }

  function checkDiffusion() {
    if (g.done[5]) return;
    var yr = numVal("map-year-display");
    if (!isNaN(yr) && yr >= 2012 && g.regionVisited) {
      completeLevel(5, 4, 0, "You reached the post-2012 acceleration and inspected a destination market.");
    }
  }

  function checkAfford() {
    if (g.done[6]) return;
    var ms = $("select-market-state"), wp = $("select-wage-profile");
    if (!ms || !wp) return;
    var price = ms.value === "generic" ? 105 : 5000;
    var wage = wp.value === "salaried" ? 15.0 : 3.20;
    var days = Math.round(price / wage);
    if (days <= 90) {
      completeLevel(6, 6, 0, "Affordable: " + days + " days of labor for a 30-day course, within reach of the WHO threshold.");
    }
  }

  function checkHHI() {
    if (g.done[7]) return;
    var s = $("slider-hhi-firms");
    if (!s) return;
    var n = parseInt(s.value, 10);
    if (n >= 3 && n <= 8) {
      completeLevel(7, 0, 12, "Sweet spot: with " + n + " firms, rivalry drives R&D (Aghion's escape-competition effect).");
    }
  }

  function attachListeners() {
    var bind = function (id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); };
    bind("slider-comp", "input", checkMacro);
    bind("slider-procure", "input", checkMacro);
    bind("slider-supply-shift", "input", checkSD);
    bind("slider-demand-shift", "input", checkSD);
    bind("slider-qaly-cost", "input", checkQALY);
    bind("slider-map-year", "input", checkDiffusion);
    bind("select-market-state", "change", checkAfford);
    bind("select-wage-profile", "change", checkAfford);
    bind("slider-hhi-firms", "input", checkHHI);

    // L10: complete when the OECD section scrolls into view
    var sections = document.querySelectorAll("main > section");
    var last = sections[9];
    if (last && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            completeLevel(9, 2, 0, "The generic paradox: high volume, low spend. Your term is complete.");
            io.disconnect();
          }
        });
      }, { threshold: 0.1 });
      io.observe(last);
    }
  }

  // -------- intro + report modals --------
  function showIntro() {
    var m = document.createElement("div");
    m.className = "game-modal"; m.id = "game-intro";
    m.innerHTML =
      '<div class="panel">' +
      '<p class="kicker">Your appointment</p>' +
      '<h2>You are the Health Minister of India</h2>' +
      '<p>The same medicines cost a fortune abroad and pennies at home. Over ten decisions you will set the law and the market that decide who gets treated.</p>' +
      '<div class="obj"><b>Your mandate:</b> push <b>Access</b> as high as you can without letting <b>Innovation</b> collapse. Every ruling carries forward.</div>' +
      '<button class="start" id="game-start">Begin your term</button>' +
      '</div>';
    document.body.appendChild(m);
    $("game-start").addEventListener("click", function () {
      m.setAttribute("hidden", "");
      m.remove();
      g.started = true;
    });
  }

  function showReport() {
    var a = Math.round(g.access), i = Math.round(g.innov), total = a + i;
    var balanced = a >= 50 && i >= 40;
    var bonus = balanced ? 20 : 0;
    var grade, verdict;
    if (balanced && total + bonus >= 130) { grade = "A"; verdict = "You widened access and kept invention alive. The balance most policy actually struggles to find."; }
    else if (a >= 60 && i < 40) { grade = "B"; verdict = "Access soared, but you left little incentive to invent the next drug. A real and contested trade-off."; }
    else if (i >= 55 && a < 45) { grade = "C"; verdict = "You protected innovation and pricing power, but most patients stayed priced out."; }
    else { grade = "B"; verdict = "A mixed term. The levers pulled against each other, which is the point."; }

    var open = 0, mono = 0, k;
    for (k in g.ruledCases) (g.ruledCases[k] === "open") ? open++ : mono++;

    var m = document.createElement("div");
    m.className = "game-modal"; m.id = "game-report";
    m.innerHTML =
      '<div class="panel">' +
      '<p class="kicker">End of term</p>' +
      '<h2>Policy report card</h2>' +
      '<div class="grade">' + grade + '</div>' +
      '<div class="report-grid">' +
        '<div class="stat access"><div class="k">Access</div><div class="v">' + a + '</div></div>' +
        '<div class="stat innov"><div class="k">Innovation</div><div class="v">' + i + '</div></div>' +
      '</div>' +
      '<p><b>Total score ' + (total + bonus) + '</b>' + (bonus ? ' (incl. +20 balance bonus)' : '') + '. ' + verdict + '</p>' +
      '<p style="font-size:13px;color:#6b7280">Your rulings: opened the market in ' + open + ' of 6 cases, upheld monopoly in ' + mono + '. Those choices set every downstream level.</p>' +
      '<button class="start" id="report-close">Close</button>' +
      '</div>';
    document.body.appendChild(m);
    $("report-close").addEventListener("click", function () { m.remove(); });
  }

  // -------- init (runs after script.js DOMContentLoaded init) --------
  function init() {
    buildHUD();
    buildGoalCards();
    wrapGlobals();
    attachListeners();
    showIntro();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
