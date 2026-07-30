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
    rulings: {},         // caseNumber -> full record, for the term dispatch
    viaMoleculeScene: false,
    regionVisited: false,
    started: false
  };

  // level config, indexed to the 10 <section> elements in order
  var LEVELS = [
    { t: "Prove the two samples are one drug",
      g: "At the synthesis bench, rotate the US sample until it superimposes on the Indian generic. Identical molecule, and then look at the two prices." },
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
    directorAdvance(idx);
    if (levelsDone() === 10) setTimeout(showReport, 600);
  }

  // -------- director: linear flow between objectives --------
  // The game leads: finishing an objective moves the player to the next one.
  // Modules 1 and 2 ARE 3D scenes, entered directly rather than opted into.
  function toast(msg, ms) {
    var t = $("game-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "game-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._hide);
    t._hide = setTimeout(function () { t.classList.remove("show"); }, ms || 3200);
  }

  function goToSection(n) {
    var secs = document.querySelectorAll("main > section");
    var sec = secs[n];
    if (!sec) return;
    sec.scrollIntoView({ behavior: "smooth", block: "start" });
    var card = $("goal-card-" + n);
    if (card) {
      card.classList.add("flash");
      setTimeout(function () { card.classList.remove("flash"); }, 2600);
    }
  }

  // Enter a 3D scene, waiting for the module layer to arrive. The 3D files
  // load as ES modules (plus three.js from a CDN) and can lag behind this
  // script, so poll before concluding the layer is unavailable.
  function enterScene(opts) {
    if (opts.doneCheck()) return;
    if (document.querySelector(".il-overlay")) return;   // a scene is already open
    var waited = 0;
    (function attempt() {
      if (opts.doneCheck() || document.querySelector(".il-overlay")) return;
      var launch = window[opts.launcher];
      if (typeof launch === "function") { launch(); return; }
      if (waited >= 6000) {
        console.warn("[game] 3D layer unavailable; falling back to the page for " + opts.launcher);
        toast("3D scenes could not load. Continuing on the page — run the site through a local server (run-game.cmd) for the full game.", 5200);
        goToSection(opts.fallbackSection);
        return;
      }
      waited += 300;
      setTimeout(attempt, 300);
    })();
  }

  function enterMolecule() {
    enterScene({ launcher: "launchMolecule", fallbackSection: 0,
                 doneCheck: function () { return !!g.done[0]; } });
  }

  function enterCourtroom() {
    enterScene({ launcher: "launchCourtroom", fallbackSection: 1,
                 doneCheck: function () { return !!g.done[1]; } });
  }

  // -------- the term dispatch --------
  // After the two embodied modules, the player reads back what they did and
  // what it produced, in the site's own voice, then chooses to walk on. Built
  // as a <div> (not a <section>) so the module indexing stays untouched.
  function buildDispatch() {
    if ($("term-dispatch")) return $("term-dispatch");
    var secs = document.querySelectorAll("main > section");
    if (!secs[1]) return null;

    var rulings = [];
    for (var i = 1; i <= 6; i++) if (g.rulings[i]) rulings.push(g.rulings[i]);
    var opened = rulings.filter(function (r) { return !r.granted; }).length;
    var granted = rulings.length - opened;

    var openingLine = g.viaMoleculeScene
      ? "Your term began at the synthesis bench. Two sealed vials, one bought in the United States " +
        "at $179.93 a pill and one made in India for around $1.50. You turned one until it lay in the " +
        "same orientation as the other and saw the thing for yourself: one molecule, imatinib, in both " +
        "hands. Nothing in the chemistry accounted for the gap."
      : "Your term began with two prices for one molecule. Imatinib sells at $179.93 a pill in the " +
        "United States and around $1.50 in India, and the compound is identical in both markets. " +
        "Nothing in the chemistry accounted for the gap.";

    var verdictLine;
    if (rulings.length === 0) {
      verdictLine = "No case has been decided yet.";
    } else if (granted === 0) {
      verdictLine = "You intervened every time. In all " + rulings.length + " cases you refused the " +
        "monopoly and let competitors in, which is the most access-forward term the bench allows.";
    } else if (opened === 0) {
      verdictLine = "You upheld the patent holder every time. All " + rulings.length + " monopolies " +
        "stand, and the incentive to invent is intact, but almost no one downstream can pay.";
    } else {
      verdictLine = "You opened the market in " + opened + " of " + rulings.length + " cases and let " +
        "the monopoly stand in " + (granted === 1 ? "one" : granted) + ". That mix is the trade-off " +
        "this office actually lives with: every ruling bought access somewhere and cost incentive " +
        "somewhere else.";
    }

    var marketOpen = /REJECT|CL|OPEN/i.test((($("val-monopoly-status") || {}).textContent || ""));
    var standingLine = marketOpen
      ? "The market you are handing on is open. Generic manufacturers can enter it, and the sections " +
        "ahead will price it accordingly."
      : "The market you are handing on is closed. One firm sets the price in it, and the sections " +
        "ahead will price it accordingly.";

    var ledger = rulings.map(function (r) {
      return '<li class="mb-4 pb-4 border-b border-gray-700 last:border-0">' +
        '<div class="flex flex-wrap items-baseline gap-x-3 mb-1">' +
          '<span class="font-mono text-[10px] sm:text-xs text-gray-500">CASE 00' + r.num + '</span>' +
          '<span class="font-bold text-sm sm:text-base">' + esc(r.title) + '</span>' +
        '</div>' +
        '<div class="font-mono text-[10px] sm:text-xs text-gray-500 mb-2">' + esc(r.drug) + '</div>' +
        '<div class="text-xs sm:text-sm font-sans mb-2">' +
          '<span class="uppercase tracking-wide font-bold ' +
            (r.granted ? 'text-scrollRed' : 'text-voxYellow') + '">' +
            'You ruled: ' + esc(r.action) + '</span>' +
        '</div>' +
        (r.outcome ? '<p class="font-serif text-xs sm:text-sm text-gray-300 leading-relaxed">' +
          esc(r.outcome) + '</p>' : '') +
      '</li>';
    }).join("");

    var wrap = document.createElement("div");
    wrap.id = "term-dispatch";
    wrap.className = "mb-16 sm:mb-24";
    wrap.innerHTML =
      '<h3 class="text-2xl sm:text-3xl font-bold font-sans mb-2">Dispatch: the record so far</h3>' +
      '<p class="text-base sm:text-lg font-serif text-gray-600 mb-6 sm:mb-8">' +
        'Before the economics catches up with you, read what you have actually done.</p>' +
      '<div class="bg-brandDark text-white p-5 sm:p-8 rounded-xl shadow-2xl border-l-8 border-voxYellow">' +
        '<p class="font-serif text-base sm:text-lg text-gray-200 leading-relaxed mb-4">' +
          openingLine + '</p>' +
        '<p class="font-serif text-base sm:text-lg text-gray-200 leading-relaxed mb-6">' +
          'Then six companies came before you.</p>' +
        '<h4 class="font-bold text-[10px] sm:text-xs uppercase tracking-widest text-gray-500 mb-4 ' +
          'border-b border-gray-700 pb-2">Your rulings</h4>' +
        '<ul class="list-none p-0 m-0 mb-6">' + ledger + '</ul>' +
        '<p class="font-serif text-base sm:text-lg text-gray-200 leading-relaxed mb-3">' +
          verdictLine + '</p>' +
        '<p class="font-serif text-base sm:text-lg text-gray-200 leading-relaxed mb-6">' +
          standingLine + '</p>' +
        '<div class="grid grid-cols-2 gap-4 sm:gap-6 mb-6">' +
          '<div class="bg-gray-900 rounded-lg p-3 sm:p-4 border border-gray-700">' +
            '<div class="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Access</div>' +
            '<div class="text-3xl sm:text-4xl font-mono font-bold text-green-400" ' +
              'id="dispatch-access">' + Math.round(g.access) + '</div></div>' +
          '<div class="bg-gray-900 rounded-lg p-3 sm:p-4 border border-gray-700">' +
            '<div class="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Innovation</div>' +
            '<div class="text-3xl sm:text-4xl font-mono font-bold text-blue-400" ' +
              'id="dispatch-innov">' + Math.round(g.innov) + '</div></div>' +
        '</div>' +
        '<button id="dispatch-next" class="w-full py-3 sm:py-4 bg-voxYellow text-brandDark font-bold ' +
          'uppercase tracking-wide text-sm sm:text-base rounded hover:bg-yellow-300 transition">' +
          'Walk out to the market floor &rarr;</button>' +
      '</div>';

    secs[1].insertAdjacentElement("afterend", wrap);
    $("dispatch-next").addEventListener("click", function () {
      toast("Level 3: shift the value toward patients.");
      goToSection(2);
    });
    return wrap;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function showDispatch() {
    var d = buildDispatch();
    if (!d) return;
    d.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function directorAdvance(idx) {
    if (idx === 0) {
      // module 1 done. If the player is still inside the molecule scene, the
      // handoff happens when that scene closes (interlude:end); otherwise
      // (2D fallback path) walk them to the bench from here.
      if (!document.querySelector(".il-overlay")) {
        toast("Objective met. The bench awaits…");
        setTimeout(enterCourtroom, 900);
      }
    } else if (idx === 1) {
      // all six cases ruled. Inside the courtroom the handoff waits for the
      // scene to close; on the 2D fallback path, go straight to the dispatch.
      if (!document.querySelector(".il-overlay")) {
        toast("Your rulings are on the record.");
        setTimeout(showDispatch, 600);
      }
    } else if (idx >= 2 && idx <= 8) {
      // on-page objectives: walk the player to the next section
      toast("Objective met. Next: level " + (idx + 2) + ".");
      setTimeout(function () { goToSection(idx + 1); }, 700);
    }
    // idx 9 ends in the report card.
  }

  function directorInit() {
    // when a 3D scene closes, decide where the player goes next
    document.addEventListener("interlude:end", function (ev) {
      if (!ev.detail) return;

      if (ev.detail.id === "molecule") {
        if (g.done[0]) {
          g.viaMoleculeScene = true;   // the dispatch narrates it in first person
          // identity proven -> the law is what set that price, so: the bench
          toast("Chemistry settled. Now the law that set the price.");
          setTimeout(enterCourtroom, 800);
        } else {
          toast("The samples are still sealed. Return to the bench when ready.");
          goToSection(0);
        }
        return;
      }

      if (ev.detail.id === "courtroom") {
        if (g.done[1]) {
          // both embodied modules are behind them: read the term back first
          toast("Your rulings are on the record.");
          setTimeout(showDispatch, 500);
        } else {
          toast("The bench will wait. Return when you are ready.");
        }
      }
    });

    // if the player scrolls into a 3D module's section with its objective
    // still open, the game re-enters that scene once (a later skip sticks)
    var secs = document.querySelectorAll("main > section");
    function reopenOnScroll(sectionIdx, levelIdx, enter) {
      var used = false;
      if (!secs[sectionIdx] || !("IntersectionObserver" in window)) return;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting || used) return;
          if (g.started && !g.done[levelIdx] && !document.querySelector(".il-overlay")) {
            used = true;
            enter();
          }
        });
      }, { threshold: 0.3 });
      io.observe(secs[sectionIdx]);
    }
    reopenOnScroll(0, 0, enterMolecule);
    reopenOnScroll(1, 1, enterCourtroom);
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
          // keep a record of the decision so the term can be narrated back
          var txt = function (id) { var e = $(id); return e ? e.textContent.trim() : ""; };
          g.rulings[num] = {
            num: num,
            title: txt("case-title"),
            drug: txt("case-drug").replace(/^Drug:\s*/i, ""),
            granted: isGrant,
            action: isGrant ? "Granted the monopoly" : txt("btn-reject"),
            outcome: txt("ruling-outcome")
          };
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
      // the game leads from the first moment, and it opens in 3D: two sealed
      // samples on the synthesis bench rather than a control to fiddle with
      toast("First objective: two samples. Prove they are the same drug.");
      setTimeout(enterMolecule, 500);
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
    directorInit();
    showIntro();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
