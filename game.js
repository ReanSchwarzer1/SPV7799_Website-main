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
    notes: {},          // per-module notes filed by the scenes
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
    // the reckoning scene closes the term; the old report card is retired
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

  // -------- pre-module briefing --------
  // Every module opens with the same card the term opened with: what this
  // place is, what you are trying to do, and which hand does it.
  var BRIEFINGS = {
    molecule: {
      kicker: "Module 1 · The comparison bench",
      title: "Two sealed samples",
      body: "One vial was bought in the United States, the other in India. Both are " +
            "labelled imatinib, the leukaemia drug. Before you can govern a price, " +
            "you need to know whether you are looking at the same medicine twice.",
      objective: "Put the two samples together, then find out what one banknote buys in each market.",
      controls: "<b>Drag</b> the red sample across onto the green one. Then <b>drag</b> the banknote into the slot.",
      cta: "Step up to the bench"
    },
    courtroom: {
      kicker: "Module 2 · The bench",
      title: "Six companies, six rulings",
      body: "You sit as the patent authority. Each company will put its claim to you, " +
            "and Indian law gives you a specific tool to answer with. What you decide " +
            "sets the market every later module inherits.",
      objective: "Rule on all six cases. Protecting access raises Access; granting monopolies raises Innovation and costs Access.",
      controls: "<b>Click the case file</b> on the bench to read the claim and the law. " +
                "<b>Click a ruling paper</b> to bring the gavel down on it.",
      cta: "Take the bench"
    },
    "market-floor": {
      kicker: "Module 3 · The market floor",
      title: "Who is allowed in",
      body: "This is the market your rulings created. A price column stands in the middle " +
            "of it, and the value the market produces collects in two tanks: what the " +
            "producer keeps, and what reaches patients.",
      objective: "Admit generic manufacturers until SOCIAL ACCESS stands taller than PRIVATE PROFIT.",
      controls: "<b>Drag the gold lever</b> along its rail to let firms in. " +
                "<b>Click the blue wheel</b> to raise government procurement.",
      cta: "Walk the floor"
    },
    ward: {
      kicker: "Module 5 · The ward",
      title: "What a budget buys",
      body: "A public budget of ten million dollars sits in this room and will not grow. " +
            "Facing it is a ward of empty beds. Between them stands a wheel that sets what " +
            "a year of treatment costs per patient, from the patented price down to the generic one.",
      objective: "Treat at least 2,000 patients on the fixed budget.",
      controls: "<b>Grab the gold wheel and turn it LEFT</b> (the white arrows show the way). The beds fill and the life-years tower climbs as the price falls.",
      cta: "Enter the ward"
    },
    wage: {
      kicker: "Module 7 · The wage floor",
      title: "What a month costs in days",
      body: "Prices have been index numbers until now. This room converts one into the only " +
            "unit that matters to the person paying it: how many days they must work to afford " +
            "a single month of medicine. A line on the floor marks where the WHO says a medicine " +
            "stops being affordable, at one day's wage.",
      objective: "Bring the cost down to 90 days of labour or fewer.",
      controls: "<b>Click the two gold switches</b> on the bench: one changes who is buying, " +
                "the other changes which market they buy in.",
      cta: "Stand on the wage floor"
    },
    antitrust: {
      kicker: "Module 8 · The concentration room",
      title: "How much competition invents most",
      body: "Two economists disagreed for decades. Arrow said a monopolist has no reason to " +
            "invent, since a new drug only cannibalises its own sales. Schumpeter said only a " +
            "firm with fat margins can fund risky research. The curve in this room is what " +
            "happens when both are right: a hill, with a summit somewhere in the middle.",
      objective: "Park the market between 3 and 8 firms, on the summit of the curve.",
      controls: "<b>Click ADD FIRM and REMOVE FIRM.</b> The ball rolls to wherever the market " +
                "sits on the curve, and the concentration bar re-splits below.",
      cta: "Enter the room"
    },
    race: {
      kicker: "Module 9 · The war room",
      title: "One patent, two firms",
      body: "You are the CEO now, not the minister. A new disease has appeared and there is one " +
            "patent to win, worth a thousand million. Your rival is deciding at the same moment, " +
            "in a sealed envelope, and neither of you can see the other's hand.",
      objective: "Commit your R&D budget and run the race. Then try the other stack.",
      controls: "<b>Click a chip stack</b> to shove it into the commit slot: the tall red stack " +
                "is $400M of High R&D, the short blue one is $100M of Low.",
      cta: "Enter the war room"
    },
    oecd: {
      kicker: "Module 10 · The hall of systems",
      title: "The generic paradox",
      body: "Seven health systems, each on its own pedestal, each with two towers. The yellow " +
            "tower is how much of the prescribing is generic. The grey one is how much of the " +
            "money generics take. In most systems the two do not match, and the mismatch is the " +
            "whole case for the industry you have spent your term governing.",
      objective: "Find the system where the gap between the two towers is widest, and lock it in.",
      controls: "<b>Click a pedestal</b> to inspect that system. <b>Click the plaque</b> to lock " +
                "in your answer. A wrong answer costs nothing but another look.",
      cta: "Walk the hall"
    },
    globe: {
      kicker: "Module 6 · The trade globe",
      title: "Where the medicine went",
      body: "Cheap medicine is worth nothing where it cannot arrive. This globe runs from 2000 " +
            "to 2024, and the routes out of India open one by one as the years pass: Africa " +
            "first, then Europe, then North America.",
      objective: "Run the timeline to 2012 or later, and inspect one destination market.",
      controls: "<b>Drag the yellow handle</b> along the timeline. <b>Click a glowing marker</b> " +
                "on the globe to inspect that market. Drag empty space to spin the globe, and " +
                "click the switch on the left to reveal where India's raw ingredients come from.",
      cta: "Spin up the globe"
    },
    equilibrium: {
      kicker: "Module 4 · The clearing house",
      title: "Where the price settles",
      body: "Supply and demand are two beams laid across a graph. Where they cross is the " +
            "price the market actually settles at, and the number of patients it reaches. " +
            "One of those beams brings the price down. The other does not.",
      objective: "Push the beams until the clearing price falls to $70 or lower.",
      controls: "<b>Grab the glowing blue handle</b> on the SUPPLY beam and drag it right. " +
                "The green DEMAND handle moves the same way, but watch what it does to the price.",
      cta: "Open the floor"
    }
  };

  // What the player is walking in carrying, stated before they walk in.
  // Only real inherited state appears here, never filler.
  var INHERITS = {
    "market-floor": function (h) {
      return h.marketOpen
        ? "Your rulings left this market <b>open</b>, so the gate will lift."
        : "Your rulings left this market <b>closed</b>. The gate is bolted and no firm can enter.";
    },
    equilibrium: function (h) {
      if (!h.marketOpen || h.firmsAdmitted <= 1) return null;
      return "The <b>" + h.firmsAdmitted + " firms</b> you admitted on the floor arrive here as " +
             "supply already in the market. The beam starts part of the way across.";
    },
    ward: function (h) {
      if (h.clearingPrice == null) return null;
      return "The market you left clears at <b>$" + Math.round(h.clearingPrice) + "</b>. That is " +
             "what this budget has to pay, so the wheel starts where you left the price.";
    },
    wage: function (h) {
      if (!h.licenceRuled) return null;
      return h.genericExists
        ? "You granted the compulsory licence in the Bayer case, so <b>Natco's generic exists</b> " +
          "and can be switched to here."
        : "You upheld Bayer's patent, so <b>there is no Natco generic</b>. The switch to the " +
          "cheaper market is welded shut for the rest of your term.";
    }
  };

  function showBriefing(id, onStart) {
    var b = BRIEFINGS[id];
    if (!b) { onStart(); return; }
    var inheritNote = null;
    if (INHERITS[id] && typeof window.GameInherit === "function") {
      try { inheritNote = INHERITS[id](window.GameInherit()); } catch (e) {}
    }
    var m = document.createElement("div");
    m.className = "game-modal";
    m.id = "game-briefing";
    m.innerHTML =
      '<div class="panel">' +
        '<p class="kicker">' + b.kicker + '</p>' +
        '<h2>' + b.title + '</h2>' +
        '<p>' + b.body + '</p>' +
        (inheritNote
          ? '<div class="carried"><b>Carried forward:</b> ' + inheritNote + '</div>' : '') +
        '<div class="obj"><b>Objective:</b> ' + b.objective + '</div>' +
        '<div class="ctrl"><b>Controls:</b> ' + b.controls + '</div>' +
        '<button class="start" id="briefing-start">' + (b.cta || "Begin") + '</button>' +
      '</div>';
    document.body.appendChild(m);
    $("briefing-start").addEventListener("click", function () {
      m.remove();
      onStart();
    });
  }

  // Enter a 3D scene, waiting for the module layer to arrive. The 3D files
  // load as ES modules and can lag behind this script, so poll before
  // concluding the layer is unavailable.
  function enterScene(opts) {
    if (opts.doneCheck()) return;
    if (document.querySelector(".il-overlay")) return;   // a scene is already open
    if ($("game-briefing")) return;                      // already briefing
    var waited = 0;
    (function attempt() {
      if (opts.doneCheck() || document.querySelector(".il-overlay")) return;
      var launch = window[opts.launcher];
      if (typeof launch === "function") {
        // brief the player, then open the scene when they are ready
        showBriefing(opts.briefing, function () {
          if (!document.querySelector(".il-overlay")) launch();
        });
        return;
      }
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
    enterScene({ launcher: "launchMolecule", briefing: "molecule", fallbackSection: 0,
                 doneCheck: function () { return !!g.done[0]; } });
  }

  function enterCourtroom() {
    enterScene({ launcher: "launchCourtroom", briefing: "courtroom", fallbackSection: 1,
                 doneCheck: function () { return !!g.done[1]; } });
  }

  function enterDispatch() {
    enterScene({ launcher: "launchDispatch", fallbackSection: 2,
                 doneCheck: function () { return false; } });
  }

  function enterDispatchMarket() {
    enterScene({ launcher: "launchDispatchMarket", fallbackSection: 4,
                 doneCheck: function () { return false; } });
  }

  function enterWard() {
    enterScene({ launcher: "launchWard", briefing: "ward", fallbackSection: 4,
                 doneCheck: function () { return !!g.done[4]; } });
  }

  function enterGlobe() {
    enterScene({ launcher: "launchGlobe", briefing: "globe", fallbackSection: 5,
                 doneCheck: function () { return !!g.done[5]; } });
  }

  function enterDispatchReach() {
    enterScene({ launcher: "launchDispatchReach", fallbackSection: 6,
                 doneCheck: function () { return false; } });
  }

  function enterWage() {
    enterScene({ launcher: "launchWage", briefing: "wage", fallbackSection: 6,
                 doneCheck: function () { return !!g.done[6]; } });
  }

  function enterAntitrust() {
    enterScene({ launcher: "launchAntitrust", briefing: "antitrust", fallbackSection: 7,
                 doneCheck: function () { return !!g.done[7]; } });
  }

  function enterDispatchPower() {
    enterScene({ launcher: "launchDispatchPower", fallbackSection: 8,
                 doneCheck: function () { return false; } });
  }

  function enterRace() {
    enterScene({ launcher: "launchRace", briefing: "race", fallbackSection: 8,
                 doneCheck: function () { return !!g.done[8]; } });
  }

  function enterOecd() {
    enterScene({ launcher: "launchOecd", briefing: "oecd", fallbackSection: 9,
                 doneCheck: function () { return !!g.done[9]; } });
  }

  function enterReckoning() {
    enterScene({ launcher: "launchReckoning", fallbackSection: 9,
                 doneCheck: function () { return false; } });
  }

  function enterMarketFloor() {
    enterScene({ launcher: "launchMarketFloor", briefing: "market-floor", fallbackSection: 2,
                 doneCheck: function () { return !!g.done[2]; } });
  }

  function enterEquilibrium() {
    enterScene({ launcher: "launchEquilibrium", briefing: "equilibrium", fallbackSection: 3,
                 doneCheck: function () { return !!g.done[3]; } });
  }

  // Scenes drive the page widgets, which fire the normal completion checks.
  // This is the escape hatch for outcomes those checks cannot express, such
  // as a market the player themselves closed at the bench.
  window.GameComplete = function (idx, dA, dI, msg) {
    completeLevel(idx, dA, dI, msg);
  };

  // Scenes file a short note about what the player actually did, so the
  // final reckoning can read the whole term back rather than guess at it.
  window.GameNote = function (key, value) { g.notes[key] = value; };

  // -------- what each module inherits from the ones before it --------
  // These are real causal links, not decoration. A patent upheld at the bench
  // means the generic never exists downstream; competitors admitted on the
  // floor arrive as supply in the clearing house; the price the market
  // settled at is the price the health budget has to pay.
  window.GameInherit = function () {
    var cl = g.rulings[3];                     // case 3 is Bayer v Natco, the licence
    var lbl = $("val-monopoly-status");
    var sc = $("slider-comp");
    var eq = $("eq-price");
    var eqP = eq ? parseFloat(eq.textContent.replace(/[^0-9.]/g, "")) : NaN;
    return {
      // a denied compulsory licence means there is no Natco generic to switch to
      genericExists: !(cl && cl.granted),
      licenceRuled: !!cl,
      licenceGranted: !!(cl && !cl.granted),
      marketOpen: !!(lbl && /REJECT|CL|OPEN/i.test(lbl.textContent)),
      firmsAdmitted: sc ? (parseInt(sc.value, 10) || 1) : 1,
      clearingPrice: isNaN(eqP) ? null : eqP
    };
  };

  // Everything the player decided, module by module, assembled from the notes
  // the scenes filed and the live state of the page model.
  window.GameFullRecord = function () {
    function txt(id) { var e = $(id); return e ? e.textContent.trim() : ""; }
    function val(id) { var e = $(id); return e ? e.value : ""; }
    var rulings = [];
    for (var i = 1; i <= 6; i++) if (g.rulings[i]) rulings.push(g.rulings[i]);
    var opened = rulings.filter(function (r) { return !r.granted; }).length;
    var lbl = $("val-monopoly-status");
    var marketOpen = !!(lbl && /REJECT|CL|OPEN/i.test(lbl.textContent));
    var firms = parseInt(val("slider-comp"), 10) || 1;
    var price = marketOpen ? 100 * Math.pow(firms, -0.75) : 100;
    var hhiFirms = parseInt(val("slider-hhi-firms"), 10) || 1;
    var PRICES = { patented: 5000, generic: 105 }, WAGES = { unskilled: 3.20, salaried: 15.0 };
    var mk = val("select-market-state") || "patented", wg = val("select-wage-profile") || "unskilled";
    var days = Math.round(PRICES[mk] / WAGES[wg]);
    var year = parseInt(txt("map-year-display"), 10);

    return {
      access: Math.round(g.access), innov: Math.round(g.innov),
      levels: levelsDone(),
      rulings: rulings, opened: opened, granted: rulings.length - opened,
      marketOpen: marketOpen,
      modules: [
        { n: 1, name: "The comparison bench",
          did: g.done[0] ? "Proved the two samples were one compound" : "Left the samples sealed",
          out: g.done[0] ? "$179.93 a pill against about $1.50, for the same molecule" : "—",
          ok: !!g.done[0] },
        { n: 2, name: "The bench",
          did: rulings.length ? "Ruled on " + rulings.length + " cases" : "Ruled on nothing",
          out: rulings.length
                ? "Opened the market in " + opened + ", upheld monopoly in " + (rulings.length - opened)
                : "—",
          ok: !!g.done[1] },
        { n: 3, name: "The market floor",
          did: marketOpen ? "Admitted " + firms + (firms === 1 ? " firm" : " firms") : "Kept the gate bolted",
          out: "Price index fell to " + Math.round(price),
          ok: !!g.done[2] },
        { n: 4, name: "The clearing house",
          did: "Pushed supply and demand",
          out: "Market cleared at " + (txt("eq-price") || "—") + " on " + (txt("eq-quantity") || "—"),
          ok: !!g.done[3] },
        { n: 5, name: "The ward",
          did: "Set treatment at $" + (parseInt(val("slider-qaly-cost"), 10) || 0).toLocaleString("en-US") + " a patient",
          out: (txt("qaly-patients") || "—") + " treated, " + (txt("qaly-total") || "—") + " life-years",
          ok: !!g.done[4] },
        { n: 6, name: "The trade globe",
          did: isNaN(year) ? "Left the routes untraced" : "Ran the clock to " + year,
          out: "Exports at " + (txt("export-volume") || "—"),
          ok: !!g.done[5] },
        { n: 7, name: "The wage floor",
          did: (mk === "generic" ? "Post-licence generic" : "Patented price") + " for " +
               (wg === "unskilled" ? "a rural labourer" : "an urban worker"),
          out: days.toLocaleString("en-US") + " days of labour for one month",
          ok: !!g.done[6] },
        { n: 8, name: "The concentration room",
          did: "Left " + hhiFirms + (hhiFirms === 1 ? " firm" : " firms") + " in the market",
          out: "HHI " + (txt("hhi-score-val") || "—") +
               ", innovation " + Math.round(100 * (hhiFirms / 5) * Math.exp(1 - hhiFirms / 5)) + "%",
          ok: !!g.done[7] },
        { n: 9, name: "The patent race",
          did: g.notes.raceChoice || "Made no call",
          out: g.notes.raceOutcome || "—",
          ok: !!g.done[8] },
        { n: 10, name: "The generic paradox",
          did: g.notes.oecdChoice || "Named no country",
          out: g.notes.oecdOutcome || "—",
          ok: !!g.done[9] }
      ]
    };
  };

  // the record the dispatch scene reads back to the player
  window.GameRecord = function () {
    var list = [];
    for (var i = 1; i <= 6; i++) if (g.rulings[i]) list.push(g.rulings[i]);
    var lbl = $("val-monopoly-status");
    return {
      rulings: list,
      access: g.access,
      innov: g.innov,
      viaMoleculeScene: g.viaMoleculeScene,
      marketOpen: !!(lbl && /REJECT|CL|OPEN/i.test(lbl.textContent))
    };
  };

  // The term dispatch is a 3D scene now (interlude-dispatch.js). Condition B
  // never renders page UI, so the old in-page recap panel was removed.


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
        setTimeout(enterDispatch, 600);
      }
    }
    // Levels 3-10 have no scene yet. Their page widgets still drive the model
    // and the score, but the player never sees the page, so there is nothing
    // to walk them to until those modules are built.
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
          toast("The samples are still sealed.");
          setTimeout(enterMolecule, 4500);   // the game keeps leading back
        }
        return;
      }

      if (ev.detail.id === "courtroom") {
        if (g.done[1]) {
          // both embodied modules are behind them: read the term back, in 3D
          toast("Your rulings are on the record.");
          setTimeout(enterDispatch, 600);
        } else {
          toast("The bench will wait. Return when you are ready.");
          setTimeout(enterCourtroom, 4500);
        }
        return;
      }

      if (ev.detail.id === "dispatch") {
        toast("Down to the market floor.");
        setTimeout(enterMarketFloor, 600);
        return;
      }

      if (ev.detail.id === "market-floor") {
        if (g.done[2]) {
          toast("Now find where the market actually clears.");
          setTimeout(enterEquilibrium, 700);
        } else {
          setTimeout(enterMarketFloor, 4500);
        }
        return;
      }

      if (ev.detail.id === "equilibrium") {
        if (g.done[3]) {
          toast("The market record is ready.");
          setTimeout(enterDispatchMarket, 600);
        } else {
          setTimeout(enterEquilibrium, 4500);
        }
        return;
      }

      if (ev.detail.id === "dispatch-market") {
        toast("To the ward.");
        setTimeout(enterWard, 600);
        return;
      }

      if (ev.detail.id === "ward") {
        if (g.done[4]) {
          toast("Cheap medicine still has to travel.");
          setTimeout(enterGlobe, 700);
        } else {
          setTimeout(enterWard, 4500);
        }
        return;
      }

      if (ev.detail.id === "globe") {
        if (g.done[5]) {
          toast("The reach record is ready.");
          setTimeout(enterDispatchReach, 600);
        } else {
          setTimeout(enterGlobe, 4500);
        }
        return;
      }

      if (ev.detail.id === "dispatch-reach") {
        toast("Down to the wage floor.");
        setTimeout(enterWage, 600);
        return;
      }

      if (ev.detail.id === "wage") {
        if (g.done[6]) {
          toast("Now: how much competition invents most.");
          setTimeout(enterAntitrust, 700);
        } else {
          setTimeout(enterWage, 4500);
        }
        return;
      }

      if (ev.detail.id === "antitrust") {
        if (g.done[7]) {
          toast("The power record is ready.");
          setTimeout(enterDispatchPower, 600);
        } else {
          setTimeout(enterAntitrust, 4500);
        }
        return;
      }

      if (ev.detail.id === "dispatch-power") {
        toast("Into the war room.");
        setTimeout(enterRace, 600);
        return;
      }

      if (ev.detail.id === "race") {
        if (g.done[8]) {
          toast("One last hall.");
          setTimeout(enterOecd, 700);
        } else {
          setTimeout(enterRace, 4500);
        }
        return;
      }

      if (ev.detail.id === "oecd") {
        if (g.done[9]) {
          toast("Your term is over. The reckoning is ready.");
          setTimeout(enterReckoning, 900);
        } else {
          setTimeout(enterOecd, 4500);
        }
        return;
      }

      if (ev.detail.id === "reckoning") {
        toast("Term closed. Thank you, minister.", 7000);
      }
    });

    // No scroll observers: the page is never shown in Condition B, so hidden
    // sections can never intersect. The scene chain above is the only flow.
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
