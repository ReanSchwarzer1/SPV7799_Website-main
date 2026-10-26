// --- STATE MANAGEMENT ---
let invertedUChart, sCurveChart, pipelineChart;
let barChart, lineChart, qalyChart;

let state = {
    synthesisRoute: 'patented',
    patentActive: true,
    competitors: 1,
    procurement: 1,
    rulings: {},            // case index -> true (claim upheld) | false (intervened)
    raceStage: 0,           // index into RACE.stages
    raceTried: {},          // stage index -> true once a choice was made there
    chartsInitialized: false
};

let glViewer = null;

// --- 1. MOLECULE: IMATINIB (GLEEVEC) ---
/* Price comparison basis, stated once so every view uses the same figures.
   Both prices are for imatinib 400 mg once daily, the standard dose Hill et al.
   (2016) assume, converted from a price per person-year to a price per day
   (divide by 365). US: $107,799 per person-year, stated in the Discussion of
   Hill et al. (2016). India: $803 per person-year, the lowest available
   Indian generic price in Hill et al. (2016), Figure 3A, panel A ("India
   (generic)" $803; checked against the published figure image, saved in
   Doc/evidence). The value is not printed in the article text. */
const PRICE_BASIS = {
    usPerYear: 107799,
    indiaPerYear: 803,
    usPerDay: 107799 / 365,      // 295.34
    indiaPerDay: 803 / 365       // 2.20
};

function initWebGLViewer() {
    let container = document.getElementById("molecule-container");
    // Skip when the container is not laid out. In Condition B the page is
    // hidden and the molecule is a 3D scene instead, so building a viewer
    // here would render into a zero-size canvas and spam WebGL errors.
    if (!container || container.offsetParent === null) return;
    glViewer = $3Dmol.createViewer(container, { backgroundColor: "transparent" });

    // CID 5291 is imatinib (Gleevec in the US, Glivec elsewhere)
    $3Dmol.download("cid:5291", glViewer, { onAll: function() {
        // Default to the expensive/monopoly red visualization
        glViewer.setStyle({}, {stick: {radius: 0.15, colorscheme: 'redCarbon'}});
        glViewer.zoomTo();
        glViewer.render();
    }});
}

/* Section 1 only changes what is displayed. It no longer opens or closes the
   market in section 4: that is set by the court's ruling on imatinib itself
   (Novartis v. Union of India), so the two sections cannot disagree. */
function setSynthesis(route) {
    state.synthesisRoute = route;
    const btnPat = document.getElementById('btn-patented');
    const btnAlt = document.getElementById('btn-alternative');
    const cost = document.getElementById('api-cost');

    btnPat.classList.remove('border-brandDark', 'bg-white');
    btnAlt.classList.remove('border-brandDark', 'bg-white');
    btnPat.classList.add('border-transparent');
    btnAlt.classList.add('border-transparent');

    if(route === 'patented') {
        btnPat.classList.remove('border-transparent');
        btnPat.classList.add('border-brandDark', 'bg-white');
        cost.innerText = "$" + PRICE_BASIS.usPerDay.toFixed(2);
        cost.className = "text-5xl font-bold text-scrollRed font-mono transition-colors duration-300";
        if(glViewer) {
            glViewer.setStyle({}, {stick: {radius: 0.15, colorscheme: 'redCarbon'}});
            glViewer.render();
        }
    } else {
        btnAlt.classList.remove('border-transparent');
        btnAlt.classList.add('border-brandDark', 'bg-white');
        cost.innerText = "$" + PRICE_BASIS.indiaPerDay.toFixed(2);
        cost.className = "text-5xl font-bold text-green-500 font-mono transition-colors duration-300";
        if(glViewer) {
            glViewer.setStyle({}, {
                stick: {radius: 0.1, colorscheme: 'greenCarbon'},
                sphere: {scale: 0.3, colorscheme: 'greenCarbon'}
            });
            glViewer.render();
        }
    }
}

// --- 2. THE PIPELINE: WHY PATENTS EXIST ---
/* Every figure here is sourced; the formula is the only modelling choice.
   successRate: oncology programmes in clinical trials that reached approval,
     3.4%, Wong, Siah & Lo (2019), Biostatistics 20(2):273-286.
   costPerApproval: median capitalized R&D investment per approved
     antineoplastic and immunomodulating agent, $2,771.6M in 2018 US dollars,
     Wouters, McKee & Luyten (2020), JAMA 323(9):844-853, as corrected in
     JAMA 2022;328(11):1111. The capitalized figure already includes the cost
     of failed programmes and a 10.5% annual cost of capital.
   costOfCapital: 10.5% per year, the rate used in that estimate.
   requiredRevenue(T): the constant net revenue per year of exclusivity whose
     present value at 10.5% equals the capitalized cost,
     R = C * r / (1 - (1 + r)^-T). Illustrative: it ignores revenue ramp-up,
     sales after generic entry, and taxes. */
const RD = {
    successRate: 0.034,
    costPerApproval: 2771.6,     // $M, 2018 USD
    costPerApprovalAll: 1141.7,  // $M, median across all 63 drugs, same study
    costOfCapital: 0.105,
    patentTermYears: 20          // TRIPS Article 33: at least 20 years from filing
};

function requiredRevenue(years) {
    const r = RD.costOfCapital;
    return RD.costPerApproval * r / (1 - Math.pow(1 + r, -years));
}

function updatePipeline() {
    const nEl = document.getElementById('slider-rd-candidates');
    const tEl = document.getElementById('slider-rd-years');
    if (!nEl || !tEl) return;
    const n = parseInt(nEl.value, 10);
    const years = parseInt(tEl.value, 10);
    const expected = n * RD.successRate;
    const fail = n - expected;
    const rev = requiredRevenue(years);

    const set = (id, v) => { const e = document.getElementById(id); if (e) e.innerText = v; };
    set('val-rd-candidates', n);
    set('val-rd-years', years + (years === 1 ? ' year' : ' years'));
    set('rd-expected', expected.toFixed(2));
    set('rd-failed', fail.toFixed(2));
    set('rd-revenue', '$' + Math.round(rev).toLocaleString('en-US') + 'M');
    set('rd-revenue-20', '$' + Math.round(requiredRevenue(20)).toLocaleString('en-US') + 'M');

    if (pipelineChart) {
        pipelineChart.data.datasets[1].data = [{ x: years, y: rev }];
        pipelineChart.update();
    }
    const c = document.getElementById('pipelineChart');
    if (c) c.setAttribute('aria-label', `Net revenue needed per year of exclusivity. At ${years} years it is $${Math.round(rev)} million a year.`);
}

// --- 3. LEGAL LABYRINTH ---
/* No ruling is marked right or wrong. Each case records what actually
   happened, the patent holder's case and the access case, so the player
   weighs both. Order: the voluntary-licence case first (the patent system
   working with access), then evergreening, compulsory licensing, injunctions,
   inventive step, and last the one case that involves no patent at all.
   Case 2 (Novartis, imatinib) sets whether the imatinib market in section 4 is
   open. Case 3 (Bayer) decides whether Natco's generic exists in section 7. */
const legalCases = [
    {
        title: "Gilead Sciences vs. Generic Manufacturers",
        drug: "Sofosbuvir (Sovaldi) - Hepatitis C",
        claim: "We hold the patent for this breakthrough cure. To address affordability, we will offer 'Voluntary Licenses' to Indian generic firms to sell it cheaply in developing nations.",
        context: "Pricing strategy, pre-grant opposition, and voluntary licensing. Under a voluntary licence the patent holder chooses which firms may copy the drug and where they may sell it.",
        grantAction: "Uphold the Patent",
        rejectAction: "Intervene / Force Market Open",
        actual: "On 15 September 2014 Gilead licensed seven Indian manufacturers to make generic sofosbuvir for 91 developing countries. The licensees set their own prices and pay Gilead a royalty on sales.",
        holderCase: "A voluntary licence keeps the patent, and the high-income prices that pay for research, while low-cost firms supply poorer countries. Danzon and Towse (2003) argue that this kind of tiered pricing can fund R&D and widen access at once.",
        accessCase: "The patent holder, not a public authority, decides which countries the licence covers. Patients in countries outside it still face the patented price.",
        citation: `Source: <a href="https://www.gilead.com/news/news-details/2014/gilead-announces-generic-licensing-agreements-to-increase-access-to-hepatitis-c-treatments-in-developing-countries" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">Gilead Sciences press release (15 September 2014)</a>. On tiered pricing: <a href="https://faculty.wharton.upenn.edu/wp-content/uploads/2014/10/differential-pricing_3.pdf" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">Danzon & Towse (2003)</a>.`
    },
    {
        title: "Novartis AG vs. Union of India",
        drug: "Imatinib Mesylate (Gleevec) - Leukemia",
        claim: "We have developed a beta-crystalline form of our existing drug, imatinib. It has better flow properties and thermodynamic stability. We request a patent.",
        context: "Section 3(d) of the 1970 Patent Act prevents 'evergreening': patenting a new form of a known substance unless it shows significantly enhanced therapeutic efficacy.",
        grantAction: "Grant the Patent",
        rejectAction: "Apply Sec 3(d)",
        actual: "In 2013 the Supreme Court of India refused the patent under Section 3(d), and generic imatinib stayed on the Indian market. A month of the generic cost about US$200; the branded drug cost up to about US$5,000 a month in the United States (Gabble & Kohler, 2014).",
        holderCase: "Novartis argued that the new crystal form was more stable and flowed better. Refusing patents on improvements lowers the reward for incremental research, which is how many medicines are refined after launch.",
        accessCase: "Section 3(d) asks for better therapeutic efficacy, not only a new form. Without that test, small changes to a known molecule could extend exclusivity again and again (Sampat & Shadlen, 2018).",
        citation: `Citation: <a href="https://indiankanoon.org/doc/165776436/" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">Novartis AG v. Union of India, Supreme Court of India (2013)</a>; <a href="https://doi.org/10.1186/1744-8603-10-3" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">Gabble & Kohler (2014)</a>. Also see: <a href="https://www.ipindia.gov.in/writereaddata/Portal/IPOAct/1_113_1_The_Patents_Act__1970___incorporating_all_amendments_till_1-08-2024.pdf" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">India Patents Act §3(d) (Official Text)</a>.`
    },
    {
        title: "Bayer Corp. vs. Natco Pharma",
        drug: "Sorafenib Tosylate (Nexavar) - Kidney Cancer",
        claim: "Our patented drug costs Rs 2.8 lakh (about US$5,500) a month. A generic company wants to make it because Indians cannot afford our price.",
        context: "Section 84 allows a compulsory licence if a patented drug is not available to the public at a reasonably affordable price.",
        grantAction: "Refuse the Licence",
        rejectAction: "Grant Compulsory License",
        actual: "In 2012 India granted Natco a compulsory licence. Natco priced its sorafenib at Rs 8,800 (US$171) a month, about 97% below Bayer's Rs 2.8 lakh, and pays Bayer a royalty of 6% of net sales (Knowledge at Wharton, 2012).",
        holderCase: "A compulsory licence lets a rival sell the invention for a 6% royalty, far below what exclusivity would earn. Where prices are pushed down, firms launch later or not at all: in 25 major markets in the 1990s only about 55% of potential launches happened (Danzon, Wang & Wang, 2005).",
        accessCase: "At Bayer's price one month of treatment cost more than most Indian patients could pay. Section 84 exists for exactly that case.",
        citation: `Citation: <a href="https://indiankanoon.org/doc/28519340/" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">Bayer Corp. v. Union of India (IPAB, 2013 / Bombay HC, 2014)</a>; prices: <a href="https://knowledge.wharton.upenn.edu/article/sparring-over-sorafenib-how-will-natcos-move-against-bayer-affect-pharma-licensing/" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">Knowledge at Wharton (2012)</a>.`
    },
    {
        title: "F. Hoffmann-La Roche Ltd. vs. Cipla",
        drug: "Erlotinib (Tarceva) - Lung Cancer",
        claim: "Cipla is selling Erlocip, a generic version of our patented drug Tarceva. We demand an interim injunction to stop them.",
        context: "Public interest and balance of convenience in granting injunctions for life-saving drugs under the Patents Act.",
        grantAction: "Grant the Injunction",
        rejectAction: "Deny Injunction",
        actual: "The Delhi High Court refused Roche an interim injunction. On 24 April 2009 a Division Bench upheld that refusal, finding that Cipla had raised a credible challenge to the patent's validity. Cipla put Tarceva's price at Rs 4,800 a tablet and Erlocip's at Rs 1,600.",
        holderCase: "If a generic may be sold while a patent dispute is pending, the patent holder loses sales it cannot recover even if it later wins.",
        accessCase: "An injunction would have removed the cheaper version for as long as the case ran, while the patent's validity was in doubt.",
        citation: `Citation: <a href="https://indiankanoon.org/doc/131401110/" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">F. Hoffmann-La Roche Ltd. v. Cipla Ltd., Delhi High Court, Division Bench (24 April 2009)</a>. FAO (OS) 188/2008.`
    },
    {
        title: "Pfizer vs. Generic Challengers",
        drug: "Sunitinib (Sutent) - Kidney Cancer",
        claim: "We hold the patent, but generic companies claim our molecule lacks an 'inventive step' and is structurally obvious from prior art.",
        context: "Section 2(1)(j) regarding inventive step and post-grant opposition.",
        grantAction: "Uphold the Patent",
        rejectAction: "Revoke Patent",
        actual: "In October 2012 the Indian Patent Office revoked Pfizer's sunitinib patent after a post-grant opposition by Cipla and Natco, holding that it did not involve an inventive step. Pfizer had launched Sutent at Rs 1.96 lakh for a 45-day treatment and said it would appeal (Balakrishnan, 2012).",
        holderCase: "Revoking a patent after launch removes protection the firm relied on when it decided to bring the drug to India.",
        accessCase: "A patent that fails the inventive-step test should not have been granted. Keeping it would block generics without rewarding an invention.",
        citation: `Citation: <a href="https://www.business-standard.com/article/companies/cipla-wins-patent-opposition-against-pfizer-s-cancer-drug-112100400199_1.html" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">Balakrishnan, Business Standard (4 October 2012)</a>; <a href="https://spicyip.com/2013/06/the-sunitinib-saga-continues-third.html" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">Vishwanathan, SpicyIP (2013)</a>.`
    },
    {
        title: "Turing Pharmaceuticals vs. Free Market",
        drug: "Pyrimethamine (Daraprim) - Toxoplasmosis",
        claim: "This drug is off-patent, but we bought the only approved manufacturer. By putting it in a 'closed distribution system,' generic companies cannot buy the physical sample pills they legally need to run bioequivalence tests. We now have a de facto monopoly and will raise the price 5,400%.",
        context: "Not a patent case: the drug was off-patent. The question is whether a firm may use control of distribution to keep rivals out. India's Competition Act, 2002 (Section 4) prohibits abuse of a dominant position, including denying market access.",
        grantAction: "Allow the Scheme",
        rejectAction: "Apply Competition Law",
        actual: "This happened in the United States, where Turing raised the price from $13.50 to $750 a pill (Gallant, 2015). The FTC and seven states sued in January 2020; on 14 January 2022 a federal court banned Martin Shkreli from the pharmaceutical industry for life, and the Second Circuit affirmed in January 2024.",
        holderCase: "Turing held no patent. Its argument was commercial: it owned the only approved supply and could choose its distributors.",
        accessCase: "Restricting samples kept generic makers from proving bioequivalence, so the price rise was protected by blocked competition, not by an invention.",
        citation: `Real case: <a href="https://www.ftc.gov/legal-library/browse/cases-proceedings/161-0001-vyera-pharmaceuticals-llc" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">FTC v. Vyera Pharmaceuticals, LLC</a>; <a href="https://doi.org/10.1093/ofid/ofv177" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">Gallant (2015)</a>; Indian law: <a href="https://www.cci.gov.in/antitrust" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">Competition Commission of India</a>.`
    }
];

// index of the case that governs the imatinib market in section 4
const IMATINIB_CASE = 1;
// index of the case that decides whether Natco's generic exists in section 7
const LICENCE_CASE = 2;

let currentCaseIndex = 0;

function isMarketOpen() {
    // open only if the court refused the imatinib patent (Section 3(d) applied)
    return state.rulings[IMATINIB_CASE] === false;
}

function applyMarketStatus(fromRuling) {
    const open = isMarketOpen();
    state.patentActive = !open;
    const compSlider = document.getElementById('slider-comp');
    const compNote = document.getElementById('comp-note');
    const statusLabel = document.getElementById('val-monopoly-status');
    if (compSlider) {
        compSlider.disabled = !open;
        if (!open) compSlider.value = 1;
        else if (fromRuling && parseInt(compSlider.value, 10) === 1) compSlider.value = 15;
    }
    if (compNote) {
        compNote.innerText = open ? "Market open. Adjust competitors." : "Locked by the imatinib patent.";
        compNote.className = open ? "text-xs text-green-600 mt-1 font-bold" : "text-xs text-red-500 mt-1 font-bold";
    }
    if (statusLabel) {
        statusLabel.innerText = open ? "OPEN" : "ACTIVE";
        statusLabel.className = open ? "text-green-600 font-bold" : "text-red-600 font-bold";
    }
    if (state.chartsInitialized) updateCharts();
}

function renderCase() {
    const c = legalCases[currentCaseIndex];
    document.getElementById('case-number').innerText = `00${currentCaseIndex + 1}`;
    const totalSpan = document.getElementById('total-cases');
    if (totalSpan) totalSpan.innerText = `00${legalCases.length}`;

    document.getElementById('case-title').innerText = c.title;
    document.getElementById('case-drug').innerText = `Drug: ${c.drug}`;
    document.getElementById('case-claim').innerText = `"${c.claim}"`;
    document.getElementById('case-context').innerText = `Context: ${c.context}`;
    document.getElementById('case-citation').innerHTML = c.citation;
    document.getElementById('btn-reject').innerText = c.rejectAction;
    const g = document.getElementById('btn-grant');
    if (g) g.innerText = c.grantAction;

    // Show the earlier ruling on this case, if there is one. Browsing cases no
    // longer resets the market: only a ruling on case 2 changes it.
    if (state.rulings[currentCaseIndex] !== undefined) showOutcome(state.rulings[currentCaseIndex]);
    else document.getElementById('ruling-outcome').classList.add('hidden');
}

function prevCase() {
    currentCaseIndex = (currentCaseIndex > 0) ? currentCaseIndex - 1 : legalCases.length - 1;
    renderCase();
}

function nextCase() {
    currentCaseIndex = (currentCaseIndex < legalCases.length - 1) ? currentCaseIndex + 1 : 0;
    renderCase();
}

function showOutcome(isGrant) {
    const c = legalCases[currentCaseIndex];
    const outcomeDiv = document.getElementById('ruling-outcome');
    outcomeDiv.classList.remove('hidden');
    const ruled = isGrant ? c.grantAction : c.rejectAction;
    outcomeDiv.innerHTML =
        `<span class='font-bold ${isGrant ? "text-red-400" : "text-voxYellow"}'>Your ruling: ${ruled}.</span> ` +
        `<span class='block mt-2'><b>What happened:</b> ${c.actual}</span>` +
        `<span class='block mt-2'><b>The patent holder's case:</b> ${c.holderCase}</span>` +
        `<span class='block mt-2'><b>The access case:</b> ${c.accessCase}</span>`;
    outcomeDiv.className = "mt-8 w-full p-4 rounded bg-gray-800 text-sm font-serif border-l-4 text-white text-left " +
        (isGrant ? "border-scrollRed" : "border-voxYellow");
}

function makeRuling(isGrant) {
    state.rulings[currentCaseIndex] = !!isGrant;
    showOutcome(!!isGrant);
    if (currentCaseIndex === IMATINIB_CASE) applyMarketStatus(true);
}

// --- 3, 4, 5. CHART.JS LOGIC WITH ARIA INJECTION ---

function updateCharts() {
    if(!state.chartsInitialized) return;
    state.competitors = parseInt(document.getElementById('slider-comp').value);
    state.procurement = parseInt(document.getElementById('slider-procure').value);
    document.getElementById('val-comp').innerText = state.competitors;
    document.getElementById('val-procure').innerText = state.procurement === 1 ? 'Low' : (state.procurement === 2 ? 'Medium' : 'High');

    const basePrice = 100; 
    let currentPrice = state.patentActive ? basePrice : basePrice * Math.pow(state.competitors, -0.75);
    const maxWillingPrice = 120;
    const marginalCost = 5; 
    const demandMultiplier = 1 + (state.procurement * 0.5); 
    let quantity = (maxWillingPrice - currentPrice) * demandMultiplier;

    let producerSurplus = Math.max(0, (currentPrice - marginalCost) * quantity);
    let consumerSurplus = Math.max(0, 0.5 * (maxWillingPrice - currentPrice) * quantity);

    barChart.data.datasets[0].data = [Math.round(producerSurplus), Math.round(consumerSurplus)];
    barChart.update();
    
    document.getElementById('barChart').setAttribute('aria-label', `Value Distribution Chart. Producer Surplus is $${Math.round(producerSurplus).toLocaleString()}, and Consumer Surplus is $${Math.round(consumerSurplus).toLocaleString()}.`);

    let priceData = [];
    for (let year = 1; year <= 10; year++) {
        if (state.patentActive) priceData.push(basePrice); 
        else {
            let activeCompetitorsInYear = 1 + ((state.competitors - 1) * (year / 10));
            priceData.push((basePrice * Math.pow(activeCompetitorsInYear, -0.75)).toFixed(2));
        }
    }
    lineChart.data.datasets[0].data = priceData;
    lineChart.data.datasets[0].borderColor = state.patentActive ? '#d92525' : '#22c55e';
    lineChart.data.datasets[0].backgroundColor = state.patentActive ? 'rgba(217, 37, 37, 0.1)' : 'rgba(34, 197, 94, 0.1)';
    lineChart.update();
    
    document.getElementById('lineChart').setAttribute('aria-label', `Price Decay Chart over 10 years. Current Patent Status is ${state.patentActive ? 'Active Monopoly' : 'Rejected, allowing generic competition'}.`);
}

function updateQALYChart() {
    if(!state.chartsInitialized) return;
    const costPerPatient = parseInt(document.getElementById('slider-qaly-cost').value);
    const fixedBudget = 10000000; 
    const qalyMultiplier = 7.34; 

    const patientsTreated = Math.floor(fixedBudget / costPerPatient);
    const totalQALYs = Math.round(patientsTreated * qalyMultiplier);

    document.getElementById('qaly-patients').innerText = patientsTreated.toLocaleString();
    document.getElementById('qaly-total').innerText = totalQALYs.toLocaleString();

    qalyChart.data.datasets[0].data = [patientsTreated, totalQALYs];
    qalyChart.update();
    
    document.getElementById('qalyChart').setAttribute('aria-label', `Quality-adjusted life years chart. At a drug cost of $${costPerPatient.toLocaleString()} per patient per year, the $10 million budget treats ${patientsTreated.toLocaleString()} patients, who live ${totalQALYs.toLocaleString()} quality-adjusted life years over 10 years (7.34 each). These are QALYs lived on treatment, not QALYs gained over a comparator.`);
}

// --- 6. DYNAMIC MAP INTERACTIVITY WITH REAL DATA ---
const historicalExportData = {
    2003: 3.0, 2004: 3.5,
    2005: 4.2, 2006: 5.0, 2007: 6.1, 2008: 7.2, 2009: 8.5,
    2010: 9.8, 2011: 11.2, 2012: 13.0, 2013: 14.6, 2014: 15.2,
    2015: 16.4, 2016: 16.8, 2017: 17.3, 2018: 19.1, 2019: 20.6,
    2020: 24.4, 2021: 24.6, 2022: 25.3, 2023: 27.0, 2024: 30.47
};

/* Regional figures. Export shares: Pharmexcil, Handbook (14 June 2025),
   Table 2 "Region wise Pharma Exports", FY2024-25, share of US$30,466.85M;
   NAFTA 37.63%, Europe 18.93%, Africa 12.91%. Supply facts: Department of
   Pharmaceuticals, Annual Report 2025-26, Section 1.1, p. 3. Earlier figures
   (34/19/16%, "600 FDA sites", "80% of ARVs") had no source and were replaced. */
const DOP_AR = '<a href="https://pharma-dept.gov.in/sites/default/files/Annual%20Report%202025-26_0.pdf" target="_blank" rel="noopener" class="underline">Dept. of Pharmaceuticals, Annual Report 2025-26, p. 3</a>';
const PHARMEXCIL = '<a href="https://pharmexcil.com/uploadfile/Hand_Book_14_06_2025_final.pdf" target="_blank" rel="noopener" class="underline">Pharmexcil Handbook (2025), Table 2</a>';
const regionalData = {
    'India': { share: "~20%", metric: "Share of global generic supply", short: "of global generic supply", color: "text-brandDark",
               detail: "India is the largest supplier of generic medicines, with about 20% of global supply. Total pharmaceutical exports were US$30.47bn in FY2024-25.",
               source: DOP_AR + "; " + PHARMEXCIL },
    'USA': { share: "37.6%", metric: "Share of India's pharma exports (NAFTA), FY2024-25", short: "of India's exports, FY2024-25", color: "text-red-600",
             detail: "The largest destination region. India meets nearly 40% of generic demand in the US.",
             source: PHARMEXCIL + "; " + DOP_AR },
    'Africa': { share: "12.9%", metric: "Share of India's pharma exports, FY2024-25", short: "of India's exports, FY2024-25", color: "text-green-500",
                detail: "India supplies over 50% of Africa's requirement for generics, and over 70% of the global supply of antiretroviral drugs.",
                source: PHARMEXCIL + "; " + DOP_AR },
    'Europe': { share: "18.9%", metric: "Share of India's pharma exports, FY2024-25", short: "of India's exports, FY2024-25", color: "text-yellow-600",
                detail: "India supplies approximately 25% of all medicine in the UK.",
                source: PHARMEXCIL + "; " + DOP_AR }
};

function selectRegion(regionKey) {
    const data = regionalData[regionKey];
    const panel = document.getElementById('region-info-panel');
    
    document.getElementById('region-title').innerText = regionKey === 'USA' ? 'North America' : regionKey;
    const shareEl = document.getElementById('region-share');
    shareEl.innerText = data.share;
    shareEl.className = `text-4xl font-mono font-bold ${data.color}`;
    
    document.getElementById('region-detail').innerText = data.detail;
    const metricEl = document.getElementById('region-share-label');
    if (metricEl) metricEl.innerText = data.metric;
    document.getElementById('region-therapy').innerHTML = `Source: ${data.source}`;
    document.getElementById('region-therapy').dataset.short = data.short;
    
    panel.classList.remove('hidden');
    
    const instruct = document.getElementById('map-instruction');
    if(instruct) instruct.style.display = 'none';
}

function updateMap() {
    const year = parseInt(document.getElementById('slider-map-year').value);
    const showAPI = document.getElementById('toggle-api').checked;
    document.getElementById('map-year-display').innerText = year;

    const svg = document.getElementById('dynamic-map-lines');
    const chinaNode = document.getElementById('node-china');
    
    const exportVolume = historicalExportData[year];
    let contextText = "Pre-2005: Market is heavily restricted by TRIPS compliance transition.";
    
    if (year >= 2005) contextText = "2005 Patents Act amended. Generic scaling rapidly accelerates for Africa/EU.";
    if (year >= 2012) contextText = "Compulsory Licensing and patent invalidations open major US and Global South markets.";
    if (year >= 2020) contextText = "India solidifies role as 'Pharmacy of the World' during COVID-19 and global supply shortages.";

    document.getElementById('export-volume').innerText = `$${exportVolume.toFixed(1)} Billion`;
    
    const exportContextEl = document.getElementById('export-context');
    if (exportContextEl) exportContextEl.innerText = contextText;

    const rect = svg.getBoundingClientRect();
    const w = rect.width || 800; 
    const h = rect.height || 550;

    const pt = (xPct, yPct) => `${(xPct / 100) * w} ${(yPct / 100) * h}`;
    const baseWidth = (exportVolume / 5); 
    let paths = '';
    
    if (year >= 2001) paths += `<path d="M ${pt(68, 45)} Q ${pt(60, 60)} ${pt(52, 60)}" fill="none" stroke="#22c55e" stroke-width="${baseWidth}" class="flow-line opacity-80" />`;
    if (year >= 2003) paths += `<path d="M ${pt(68, 45)} Q ${pt(60, 30)} ${pt(50, 30)}" fill="none" stroke="#eab308" stroke-width="${baseWidth * 0.8}" class="flow-line opacity-80" />`;
    if (year >= 2006) paths += `<path d="M ${pt(68, 45)} Q ${pt(45, 20)} ${pt(22, 35)}" fill="none" stroke="#dc2626" stroke-width="${baseWidth * 1.3}" class="flow-line opacity-80" />`;

    if (showAPI) {
        chinaNode.classList.remove('hidden');
        paths += `<path d="M ${pt(75, 40)} Q ${pt(72, 42)} ${pt(68, 45)}" fill="none" stroke="#991b1b" stroke-width="3" stroke-dasharray="8 6" class="flow-line-reverse opacity-90" />`;
    } else {
        chinaNode.classList.add('hidden');
    }
    
    svg.innerHTML = paths;

    // --- Update S-Curve Chart ---
    if (sCurveChart) {
        document.getElementById('scurve-year-display').innerText = year;
        
        // Logistic (S-shaped) diffusion curve. Illustrative: the midpoint (2010)
        // and slope (0.4) were chosen, not fitted to the export series.
        let penetration = 100 / (1 + Math.exp(-0.4 * (year - 2010)));
        
        sCurveChart.data.datasets[1].data = [{x: year, y: penetration}];
        sCurveChart.update();

        let phaseText = "Pre-2005: High uncertainty and lack of complementary infrastructure constrain the diffusion of affordable generics.";
        if (year >= 2005 && year <= 2015) {
            phaseText = "Post-TRIPS Acceleration: distribution networks act as complementary assets, and adoption moves onto the steep middle of the S-curve.";
        } else if (year > 2015) {
            phaseText = "Approaching Saturation: The technology reaches the limits of current global absorptive capacity and infrastructure.";
        }
        
        const phaseTextEl = document.getElementById('scurve-phase-text');
        if (phaseTextEl) phaseTextEl.innerText = phaseText;
    }
}

// --- 7. HUMAN METRIC: AFFORDABILITY & LERNER INDEX ---
const affordabilityData = {
    drugs: {
        // Prices: Knowledge at Wharton (2012): Rs 2.8 lakh (about US$5,500) and
        // Rs 8,800 (US$171) a month. Marginal cost: $74.18 a month, Hill et al.
        // (2016), Table 1, sorafenib 400 mg twice daily, full cost before the
        // 50% mark-up (cost per month plus bottle, packaging, shipping, duties).
        // price (US$) feeds the Lerner index; priceInr (rupees, same source)
        // feeds days of labour, so wage and price are in one currency and year.
        patented: { price: 5500, priceInr: 280000, mc: 74.18, name: "Bayer's Nexavar (Sorafenib)" },
        generic: { price: 171, priceInr: 8800, mc: 74.18, name: "Natco's Sorafenib (Compulsory License)" }
    },
    wages: {
        // Rupees per day, in force when the licence was granted (9 March 2012).
        // Unskilled: MGNREGA notified wage for Uttar Pradesh, Rs 120, effective
        // 1 January 2011 under S.O. 82(E); a revision took effect on
        // 1 April 2012 (Lok Sabha Unstarred Q. 3591, 26 April 2012).
        // Salaried: average daily earnings of a male regular wage/salaried
        // employee in the urban informal sector, 2011-12, Rs 258 (NSS 68th
        // round, as reported by Business Standard, 8 September 2014).
        unskilled: { daily: 120, name: "Unskilled Laborer (MGNREGA, Uttar Pradesh)" },
        salaried: { daily: 258, name: "Urban Salaried Worker (informal sector, male)" }
    }
};

function updateAffordabilityWidget() {
    const marketState = document.getElementById('select-market-state').value;
    const wageProfile = document.getElementById('select-wage-profile').value;
    
    const drug = affordabilityData.drugs[marketState];
    const wage = affordabilityData.wages[wageProfile];
    
    document.getElementById('market-price-display').innerText = `Market Price: Rs ${drug.priceInr.toLocaleString('en-IN')} / month (about $${drug.price.toLocaleString()})`;
    document.getElementById('wage-display').innerText = `Daily Wage: Rs ${wage.daily} / day`;
    
    const daysRequired = Math.round(drug.priceInr / wage.daily);
    
    animateValue("days-worked-val", 0, daysRequired, 800);
    
    document.getElementById('calc-pat-p').innerText = affordabilityData.drugs.patented.price;
    document.getElementById('calc-pat-p2').innerText = affordabilityData.drugs.patented.price;
    document.getElementById('calc-gen-p').innerText = affordabilityData.drugs.generic.price;
    document.getElementById('calc-gen-p2').innerText = affordabilityData.drugs.generic.price;
    const lerner = (d) => ((d.price - d.mc) / d.price).toFixed(3);
    const setT = (id, v) => { const e = document.getElementById(id); if (e) e.innerText = v; };
    setT('calc-pat-l', lerner(affordabilityData.drugs.patented));
    setT('calc-gen-l', lerner(affordabilityData.drugs.generic));
    setT('calc-mc', affordabilityData.drugs.patented.mc.toFixed(2));
    setT('calc-mc2', affordabilityData.drugs.patented.mc.toFixed(2));

    renderLaborGrid(daysRequired);
}

function renderLaborGrid(days) {
    const container = document.getElementById('labor-grid-container');
    container.innerHTML = ''; 
    
    const visualCap = 2500; 
    const renderCount = Math.min(days, visualCap);
    
    const fragment = document.createDocumentFragment();
    
    const medContainer = document.createElement('div');
    medContainer.className = "flex flex-wrap gap-1 mb-6 pb-4 border-b border-gray-300 w-full";
    medContainer.innerHTML = `<div class="w-full text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">Supply: 30 Days of Medicine</div>`;
    for(let i=0; i<30; i++) {
        const medBlock = document.createElement('div');
        medBlock.className = "w-3 h-3 border border-gray-400 rounded-sm";
        medContainer.appendChild(medBlock);
    }
    fragment.appendChild(medContainer);

    const laborContainer = document.createElement('div');
    laborContainer.className = "flex flex-wrap gap-1 w-full";
    laborContainer.innerHTML = `<div class="w-full text-xs font-bold text-scrollRed mb-1 uppercase tracking-wide">Cost: ${days.toLocaleString()} Days of Labor</div>`;
    
    for(let i=0; i<renderCount; i++) {
        const block = document.createElement('div');
        block.className = "labor-block w-3 h-3 bg-scrollRed rounded-sm shadow-sm opacity-0";
        if (i < 200) {
            block.style.animation = `fadeInBlock 0.1s ease forwards ${i * 2}ms`;
        } else {
            block.style.opacity = '1';
        }
        laborContainer.appendChild(block);
    }
    
    if(days > visualCap) {
        const overflowText = document.createElement('div');
        overflowText.className = "w-full text-xs font-bold text-gray-500 mt-2 italic";
        overflowText.innerText = `... + ${(days - visualCap).toLocaleString()} more days not shown.`;
        laborContainer.appendChild(overflowText);
    }
    
    fragment.appendChild(laborContainer);
    container.appendChild(fragment);
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    
    if (obj.animationId) window.cancelAnimationFrame(obj.animationId);
    
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start).toLocaleString();
        if (progress < 1) {
            obj.animationId = window.requestAnimationFrame(step);
        }
    };
    obj.animationId = window.requestAnimationFrame(step);
}

// --- 8. ANTITRUST & MARKET CONCENTRATION (HHI) ---
function updateHHIWidget() {
    const numFirms = parseInt(document.getElementById('slider-hhi-firms').value);
    
    let shares = [];
    if (numFirms === 1) {
        shares.push(100);
    } else {
        const originatorShare = Math.max(5, 100 - (numFirms * 7));
        shares.push(originatorShare);
        
        const remainingShare = 100 - originatorShare;
        const genericShare = remainingShare / (numFirms - 1);
        for(let i=0; i < numFirms - 1; i++) {
            shares.push(genericShare);
        }
    }
    
    let hhi = 0;
    shares.forEach(s => {
        hhi += Math.pow(s, 2); 
    });
    hhi = Math.round(hhi);
    
    const scoreVal = document.getElementById('hhi-score-val');
    const badge = document.getElementById('hhi-status-badge');
    
    scoreVal.innerText = hhi.toLocaleString();
    
    if (hhi > 2500) {
        scoreVal.className = "text-5xl font-mono font-bold mb-2 transition-colors duration-300 text-red-500";
        badge.innerText = "Highly Concentrated";
        badge.className = "text-sm font-bold tracking-widest uppercase py-1 px-3 rounded inline-block mt-2 bg-red-900 text-red-200 border border-red-500";
    } else if (hhi >= 1500) {
        scoreVal.className = "text-5xl font-mono font-bold mb-2 transition-colors duration-300 text-yellow-400";
        badge.innerText = "Moderately Concentrated";
        badge.className = "text-sm font-bold tracking-widest uppercase py-1 px-3 rounded inline-block mt-2 bg-yellow-900 text-yellow-200 border border-yellow-500";
    } else {
        scoreVal.className = "text-5xl font-mono font-bold mb-2 transition-colors duration-300 text-green-400";
        badge.innerText = "Unconcentrated (Competitive)";
        badge.className = "text-sm font-bold tracking-widest uppercase py-1 px-3 rounded inline-block mt-2 bg-green-900 text-green-200 border border-green-500";
    }

    renderHHIBlocks(shares);

    if (!invertedUChart) return; 

    // Mathematical representation of the Aghion Inverted-U curve
    let currentN = numFirms;
    let currentInnovation = 100 * (currentN/5) * Math.exp(1 - currentN/5);
    
    invertedUChart.data.datasets[1].data = [{x: currentN, y: currentInnovation}];
    
    // Change dot color based on where it is on the curve
    let dotColor = '#d92525'; 
    if (currentN >= 3 && currentN <= 8) dotColor = '#22c55e'; 
    else if (currentN > 8) dotColor = '#eab308'; 
    
    invertedUChart.data.datasets[1].backgroundColor = dotColor;
    invertedUChart.update();
}

function renderHHIBlocks(shares) {
    const container = document.getElementById('hhi-visual-container');
    container.innerHTML = '';
    
    shares.forEach((share, index) => {
        const block = document.createElement('div');
        block.style.width = `${share}%`;
        block.style.height = '100%';
        block.className = `flex flex-col justify-center items-center border-r border-white transition-all duration-500 overflow-hidden ${index === 0 ? 'bg-brandDark text-white' : 'bg-gray-300 text-brandDark'}`;
        
        // BUG FIX: Only render text if the segment is wide enough to hold it on mobile screens
        if (share > 10) {
            block.innerHTML = `<span class="font-bold text-xs sm:text-sm md:text-lg">${Math.round(share)}%</span>
                               <span class="text-[8px] md:text-[10px] uppercase font-mono tracking-tighter opacity-70 hidden sm:inline">${index === 0 ? 'Originator' : 'Generic'}</span>`;
        } else if (share > 5) {
            block.innerHTML = `<span class="font-bold text-[10px] sm:text-xs">${Math.round(share)}%</span>`;
        }
        
        container.appendChild(block);
    });
}

// --- 9. GAME THEORY: THE PATENT RACE, WITH SENSITIVITY ---
/* Two firms race for one patent. A firm can invest High ($400M), Low ($100M)
   or stay Out. The higher spender wins the patent; equal spenders split it on
   a coin toss (expected value V/2). A firm that is the only one investing wins
   outright. Costs are sunk whether or not the firm wins.

   Sensitivity: the prize V shrinks as generic entry comes earlier. Holding
   annual profit fixed and discounting at the same 10.5% cost of capital used
   in section 2, a patent that yields 20 years of exclusivity is worth
   $1,000M; one that yields T years is worth
       V(T) = 1000 * (1 - 1.105^-T) / (1 - 1.105^-20).
   The $1,000M, $400M and $100M are the artifact's illustrative figures; the
   stages show how the equilibrium moves as V falls, not a forecast. */
const RACE = {
    highCost: 400, lowCost: 100, fullValue: 1000, fullYears: 20, r: 0.105,
    stages: [20, 10, 5, 1, 0.5],          // years of exclusivity before generic entry
    strategies: ['high', 'low', 'out'],
    names: { high: 'High R&D', low: 'Low R&D', out: 'Stay out' }
};

function raceValue(years) {
    const f = (t) => 1 - Math.pow(1 + RACE.r, -t);
    return RACE.fullValue * f(years) / f(RACE.fullYears);
}

function racePayoff(mine, theirs, V) {
    const cost = { high: RACE.highCost, low: RACE.lowCost, out: 0 };
    if (mine === 'out') return 0;
    if (theirs === 'out') return V - cost[mine];
    const rank = { low: 1, high: 2 };
    if (rank[mine] > rank[theirs]) return V - cost[mine];
    if (rank[mine] < rank[theirs]) return -cost[mine];
    return V / 2 - cost[mine];
}

// pure-strategy Nash equilibria of the symmetric 3x3 game
function raceEquilibria(V) {
    const S = RACE.strategies, eq = [];
    S.forEach(a => S.forEach(b => {
        const aBest = S.every(x => racePayoff(a, b, V) >= racePayoff(x, b, V) - 1e-9);
        const bBest = S.every(y => racePayoff(b, a, V) >= racePayoff(y, a, V) - 1e-9);
        if (aBest && bBest) eq.push([a, b]);
    }));
    return eq;
}

function raceRegime(V) {
    const eq = raceEquilibria(V);
    const key = eq.map(e => e.join('-')).join(',');
    if (key === 'high-high') return { id: 'race', short: 'Both go High: a wasteful race', text: 'Both firms invest High. Each would do better if both chose Low, but neither can trust the other to hold back: a wasteful race.' };
    if (key === 'low-low') return { id: 'low', short: 'Both go Low: the race stops', text: 'Both firms invest Low. The prize is too small to justify outspending the rival, so the duplicated spending stops.' };
    if (eq.length === 0) return { id: 'none', short: 'No stable choice', text: 'No stable pair of choices. If the rival goes High you would rather stay out; if it stays out you would rather go High. Firms keep second-guessing each other.' };
    if (eq.every(e => e.includes('out')) && eq.some(e => !(e[0] === 'out' && e[1] === 'out')))
        return { id: 'one', short: 'Room for only one firm', text: 'Only one firm can invest profitably. The prize no longer covers two research programmes.' };
    if (key === 'out-out') return { id: 'nobody', short: 'Nobody invests: no drug', text: 'Nobody invests. The prize no longer covers even the cheapest research programme, so the drug is not developed.' };
    return { id: 'other', short: key, text: 'Equilibria: ' + key };
}

function setRaceStage(i) {
    state.raceStage = Math.max(0, Math.min(RACE.stages.length - 1, i));
    renderRace();
}

function renderRace(choice) {
    const years = RACE.stages[state.raceStage];
    const V = raceValue(years);
    const eq = raceEquilibria(V);
    const isEq = (a, b) => eq.some(e => e[0] === a && e[1] === b);
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.innerHTML = v; };

    set('race-years', years >= 1 ? years + (years === 1 ? ' year' : ' years') : 'six months');
    set('race-value', '$' + Math.round(V).toLocaleString('en-US') + 'M');
    const reg = raceRegime(V);
    set('race-regime', reg.text);

    document.querySelectorAll('[data-race-stage]').forEach(b => {
        const on = parseInt(b.getAttribute('data-race-stage'), 10) === state.raceStage;
        b.classList.toggle('bg-brandDark', on); b.classList.toggle('text-white', on);
    });

    const box = document.getElementById('race-matrix');
    if (box) {
        const S = RACE.strategies;
        let h = '<table class="w-full text-center text-xs sm:text-sm border-collapse"><thead><tr><th class="p-2"></th>';
        S.forEach(b => { h += `<th class="p-2 font-bold">Firm B: ${RACE.names[b]}</th>`; });
        h += '</tr></thead><tbody>';
        S.forEach(a => {
            h += `<tr><th class="p-2 font-bold text-left">You: ${RACE.names[a]}</th>`;
            S.forEach(b => {
                const pa = racePayoff(a, b, V), pb = racePayoff(b, a, V);
                const fmt = (v) => (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US') + 'M';
                const lit = choice && a === choice;
                h += `<td id="cell-${a}-${b}" class="p-2 border ${isEq(a, b) ? 'border-green-500 border-2' : 'border-gray-200'} ${lit ? 'bg-yellow-200' : 'bg-gray-50'}">` +
                     `<span class="font-mono font-bold">${fmt(pa)}</span>, <span class="font-mono">${fmt(pb)}</span>` +
                     (isEq(a, b) ? '<span class="block text-[10px] text-green-700 font-bold uppercase">equilibrium</span>' : '') + '</td>';
            });
            h += '</tr>';
        });
        h += '</tbody></table>';
        box.innerHTML = h;
        box.setAttribute('aria-label', `Payoff matrix at ${years} years of exclusivity, patent worth $${Math.round(V)} million. ${reg.text}`);
    }
}

// Moved to the global scope so inline HTML onclick handlers can find it
function playPatentRace(userChoice) {
    const years = RACE.stages[state.raceStage];
    const V = raceValue(years);
    state.raceTried[state.raceStage] = true;
    renderRace(userChoice);

    const fmt = (v) => (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US') + 'M';
    const row = RACE.strategies.map(b => `${RACE.names[b]}: ${fmt(racePayoff(userChoice, b, V))}`).join(' · ');
    const best = RACE.strategies.map(b => {
            const br = RACE.strategies.reduce((m, a) => racePayoff(a, b, V) > racePayoff(m, b, V) ? a : m, 'out');
            return `if Firm B plays ${RACE.names[b]}, your best reply is ${RACE.names[br]}`;
        }).join('; ');
    const resultBox = document.getElementById('game-result-box');
    if (resultBox) {
        resultBox.innerHTML =
            `<strong class="text-scrollRed block mb-1">You chose ${RACE.names[userChoice]} with generic entry after ${years >= 1 ? years + ' years' : 'six months'} (patent worth ${fmt(V)}).</strong>` +
            `Your payoff against each rival choice: ${row}.<br><br>` +
            `Best replies: ${best}.<br><br>${raceRegime(V).text}`;
        resultBox.classList.remove('hidden');
    }
    ['high', 'low', 'out'].forEach(k => {
        const b = document.getElementById('btn-play-' + k);
        if (b) { b.classList.toggle('selected', k === userChoice); b.classList.toggle('unselected', k !== userChoice); }
    });
}

// --- 10. OECD SERIES (single source for the chart and the 3D hall) ---
/* Generic share of the pharmaceutical market, 2021, as printed in OECD (2023)
   Health at a Glance 2023, Figure 9.7 (data labels are whole percentages).
   Market coverage differs by country (figure notes): Germany = reimbursed
   market; Chile and United Kingdom = community pharmacy market; Switzerland =
   total market. OECD Avg = the figure's OECD26 average. Checked against the
   published figure image on 25 Oct 2026. The live OECD database
   (HEALTH_PHMC@DF_GEN_MRKT) matches for Germany (83.4/29.2), Chile (89.4/64.5)
   and Switzerland (22.7/18.5), but has since revised the UK community-pharmacy
   series (70.0/27.8 for 2021), so the published figure is the citable source. */
const OECD_SYSTEMS = [
    { label: 'Chile', volume: 90, value: 65 },
    { label: 'Germany', volume: 83, value: 29 },
    { label: 'UK', volume: 80, value: 54 },
    { label: 'OECD Avg', volume: 54, value: 25 },
    { label: 'Switzerland', volume: 23, value: 19 }
];

// --- SHARED MODEL: one place every view reads its numbers from ---
/* Condition B's scenes and record rooms read these instead of keeping their
   own copies, so the two conditions cannot drift apart on the numbers. */
window.ModelData = {
    priceBasis: PRICE_BASIS,
    rd: RD,
    requiredRevenue: requiredRevenue,
    affordability: null,           // filled below, after affordabilityData exists
    race: RACE,
    raceValue: raceValue,
    racePayoff: racePayoff,
    raceEquilibria: raceEquilibria,
    raceRegime: raceRegime,
    oecd: OECD_SYSTEMS,
    imatinibCase: IMATINIB_CASE + 1,     // case numbers as displayed (1-based)
    licenceCase: LICENCE_CASE + 1,
    marketOpen: function () { return isMarketOpen(); },
    priceIndex: function () {
        const n = parseInt((document.getElementById('slider-comp') || {}).value, 10) || 1;
        return isMarketOpen() ? 100 * Math.pow(n, -0.75) : 100;
    },
    innovation: function (n) { return 100 * (n / 5) * Math.exp(1 - n / 5); },
    raceState: function () { return { stage: state.raceStage, tried: Object.keys(state.raceTried).length }; }
};
window.ModelData.affordability = affordabilityData;

// --- GLOBAL INITIALIZATION ---
document.addEventListener("DOMContentLoaded", function() {
    initWebGLViewer();
    renderCase();

    // 1. Initialize S-Curve Chart (Section 6)
    const sCurveCtx = document.getElementById('sCurveChart').getContext('2d');
    const sData = [];
    for(let y=2003; y<=2024; y++) {
        let penetration = 100 / (1 + Math.exp(-0.4 * (y - 2010)));
        sData.push({x: y, y: penetration});
    }

    sCurveChart = new Chart(sCurveCtx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Diffusion Trajectory',
                    data: sData,
                    borderColor: '#3b82f6', // blue-500
                    showLine: true,
                    pointRadius: 0,
                    borderWidth: 3,
                    tension: 0.4
                },
                {
                    label: 'Current Year',
                    data: [{x: 2003, y: 100 / (1 + Math.exp(-0.4 * (2003 - 2010)))}],
                    backgroundColor: '#d92525',
                    borderColor: '#fffb00',
                    borderWidth: 2,
                    pointRadius: 8,
                    pointHoverRadius: 12
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 26, 0.95)',
                    titleFont: { size: 14, family: "'Work Sans', sans-serif" },
                    bodyFont: { size: 12, family: "monospace" },
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) return null;
                            let y = context.parsed.x;
                            let phase = y < 2005 ? "Slow Initial Uptake" : (y <= 2015 ? "Rapid Acceleration" : "Approaching Saturation");
                            return [`Year: ${y}`, `Penetration: ${context.parsed.y.toFixed(1)}%`, `Phase: ${phase}`];
                        }
                    }
                }
            },
            scales: {
                x: { 
                    type: 'linear', 
                    title: { display: false }, 
                    min: 2003, 
                    max: 2024,
                    grid: { display: false },
                    ticks: { callback: function(value) { return value; } }
                },
                y: { 
                    type: 'linear', 
                    title: { display: false }, 
                    min: 0, 
                    max: 105,
                    ticks: { display: false },
                    grid: { display: false }
                }
            }
        }
    });

    // 2. Initialize Inverted-U Chart (Section 8)
    const invUCtx = document.getElementById('invertedUChart').getContext('2d');
    const uCurveData = [];
    for(let n=1; n<=15; n+=0.5) {
        let innovation = 100 * (n/5) * Math.exp(1 - n/5);
        uCurveData.push({x: n, y: innovation});
    }

    invertedUChart = new Chart(invUCtx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Theoretical Innovation Curve',
                    data: uCurveData,
                    borderColor: '#9ca3af', 
                    showLine: true,
                    pointRadius: 0,
                    borderDash: [5, 5],
                    tension: 0.4
                },
                {
                    label: 'Current Market State',
                    data: [], 
                    backgroundColor: '#d92525',
                    borderColor: '#fffb00',
                    borderWidth: 2,
                    pointRadius: 8,
                    pointHoverRadius: 12
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 26, 0.95)',
                    titleFont: { size: 14, family: "'Work Sans', sans-serif" },
                    bodyFont: { size: 12, family: "monospace" },
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) return null;
                            const firms = context.parsed.x;
                            let analysis = "";
                            if (firms <= 2) analysis = "Low Innovation: Arrow's 'Replacement Effect' causes complacency.";
                            else if (firms >= 3 && firms <= 8) analysis = "High Innovation: Aghion's 'Escape-Competition Effect' drives R&D.";
                            else analysis = "Low Innovation: Schumpeterian Effect erodes profits needed to fund R&D.";
                            
                            return [
                                `Firms: ${firms}`,
                                `Innovation Intensity: ${context.parsed.y.toFixed(0)}%`,
                                `--------------------------------`,
                                analysis
                            ];
                        }
                    }
                }
            },
            scales: {
                x: { 
                    type: 'linear',
                    title: { display: true, text: 'Degree of Competition (Number of Firms)' }, 
                    min: 1, 
                    max: 15,
                    grid: { display: false }
                },
                y: { 
                    type: 'linear',
                    title: { display: false }, 
                    min: 0, 
                    max: 110,
                    ticks: { display: false },
                    grid: { display: false }
                }
            }
        }
    });

    // 3. Initialize OECD Comparison Chart (Section 10)
    // Data: OECD (2023) Health at a Glance 2023, Figure 9.7 (see OECD_SYSTEMS).
// USA and Japan were removed: their values were not in the verified table and
// had no source. Every bar here matches a row of the table on the page.
const oecdLabels = OECD_SYSTEMS.map(s => s.label);
const volumeData = OECD_SYSTEMS.map(s => s.volume);
const valueData = OECD_SYSTEMS.map(s => s.value);

const compCtx = document.getElementById('comparisonChart').getContext('2d');
new Chart(compCtx, {
    type: 'bar',
    data: {
        labels: oecdLabels,
        datasets: [
            {
                label: 'Share by Volume (%)',
                data: volumeData,
                backgroundColor: '#d92525', // Brand Red
                borderRadius: 4
            },
            {
                label: 'Share by Value (%)',
                data: valueData,
                backgroundColor: '#94a3b8', // Slate Gray
                borderRadius: 4
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: {
                callbacks: {
                    footer: (items) => 'Source: OECD Health Statistics 2023'
                }
            },
            legend: { position: 'bottom' }
        },
        scales: {
            y: { 
                beginAtZero: true, 
                max: 100,
                title: { display: true, text: 'Percentage (%)' }
            }
        }
    }
});

    const barCtx = document.getElementById('barChart').getContext('2d');
    const lineCtx = document.getElementById('lineChart').getContext('2d');
    const qalyCtx = document.getElementById('qalyChart').getContext('2d');

    barChart = new Chart(barCtx, { type: 'bar', data: { labels: ['Private Profit', 'Social Access'], datasets: [{ label: 'Economic Value', backgroundColor: ['#1a1a1a', '#fffb00'], data: [0, 0] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, suggestedMax: 3500 } } } });
    lineChart = new Chart(lineCtx, { type: 'line', data: { labels: ['Yr1', 'Yr2', 'Yr3', 'Yr4', 'Yr5', 'Yr6', 'Yr7', 'Yr8', 'Yr9', 'Yr10'], datasets: [{ label: 'Price Index (%)', borderColor: '#d92525', backgroundColor: 'rgba(217, 37, 37, 0.1)', fill: true, data: [], tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 110 } } } });
    qalyChart = new Chart(qalyCtx, { 
        type: 'bar', 
        data: { 
            labels: ['Patients Treated', 'QALYs lived (10 years)'], 
            datasets: [{ label: 'Volume', backgroundColor: ['#fffb00', '#4ade80'], data: [0, 0] }] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 26, 0.95)',
                    titleFont: { size: 14, family: "'Work Sans', sans-serif" },
                    bodyFont: { size: 12, family: "monospace" },
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            const costPerPatient = parseInt(document.getElementById('slider-qaly-cost').value);
                            const fixedBudget = 10000000;
                            const patients = Math.floor(fixedBudget / costPerPatient);
                            
                            let lines = [
                                `Fixed Public Budget: $10,000,000`,
                                `Drug Cost Per Patient: $${costPerPatient.toLocaleString()}`,
                                `---------------------------------`
                            ];
                            
                            if (context.dataIndex === 0) {
                                lines.push(`Math: $10M ÷ $${costPerPatient.toLocaleString()}`);
                                lines.push(`Result: ${patients.toLocaleString()} lives treated.`);
                            } else {
                                const qalys = Math.round(patients * 7.34);
                                lines.push(`Math: ${patients.toLocaleString()} patients × 7.34 QALYs`);
                                lines.push(`Result: ${qalys.toLocaleString()} QALYs lived over 10 years.`);
                                lines.push(``);
                                lines.push(`These are QALYs lived on imatinib, not`);
                                lines.push(`QALYs gained over a comparator, so this`);
                                lines.push(`is not an ICER. See the coverage rule below.`);
                            }
                            return lines;
                        }
                    }
                }
            }, 
            scales: { 
                y: { beginAtZero: true, max: 25000 } 
            } 
        } 
    });

    // Section 2: net revenue needed per year of exclusivity
    const pipeCanvas = document.getElementById('pipelineChart');
    if (pipeCanvas) {
        const curve = [];
        for (let t = 1; t <= 20; t++) curve.push({ x: t, y: requiredRevenue(t) });
        pipelineChart = new Chart(pipeCanvas.getContext('2d'), {
            type: 'scatter',
            data: { datasets: [
                { label: 'Net revenue needed per year ($M)', data: curve, showLine: true, borderColor: '#1a1a1a', pointRadius: 0, borderWidth: 2 },
                { label: 'Your exclusivity period', data: [], backgroundColor: '#d92525', borderColor: '#fffb00', borderWidth: 2, pointRadius: 8 }
            ] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false },
                    tooltip: { callbacks: { label: (c) => `${c.parsed.x} years: $${Math.round(c.parsed.y).toLocaleString('en-US')}M a year` } } },
                scales: {
                    x: { type: 'linear', min: 1, max: 20, title: { display: true, text: 'Years of exclusivity before generics enter' } },
                    y: { beginAtZero: true, title: { display: true, text: 'Net revenue needed per year ($M, 2018 USD)' } }
                }
            }
        });
    }

    state.chartsInitialized = true;
    
    // Bind all event listeners
    document.getElementById('slider-comp').addEventListener('input', updateCharts);
    document.getElementById('slider-procure').addEventListener('input', updateCharts);
    document.getElementById('slider-qaly-cost').addEventListener('input', updateQALYChart);
    document.getElementById('slider-map-year').addEventListener('input', updateMap);
    document.getElementById('toggle-api').addEventListener('change', updateMap);
    document.getElementById('select-market-state').addEventListener('change', updateAffordabilityWidget);
    document.getElementById('select-wage-profile').addEventListener('change', updateAffordabilityWidget);
    document.getElementById('slider-hhi-firms').addEventListener('input', updateHHIWidget);
    ['slider-rd-candidates', 'slider-rd-years'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updatePipeline);
    });
    
    window.addEventListener('resize', () => {
        if (state.chartsInitialized) updateMap();
    });
    
    // Initialize all widgets
    updateCharts();
    updateQALYChart();
    updateMap();
    updateAffordabilityWidget();
    updateHHIWidget();
    updatePipeline();
    renderRace();
    applyMarketStatus(false);
});