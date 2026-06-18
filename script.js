// --- STATE MANAGEMENT ---
let invertedUChart, sCurveChart; 
let barChart, lineChart, sdChart, qalyChart;

let state = {
    synthesisRoute: 'patented',
    patentActive: true,
    competitors: 1,
    procurement: 1,
    chartsInitialized: false
};

let glViewer = null;

// --- 1. SYNTHESIS LOGIC & WEBGL MOLECULE (Gleevac) ---
function initWebGLViewer() {
    let container = document.getElementById("molecule-container");
    glViewer = $3Dmol.createViewer(container, { backgroundColor: "transparent" });

    // CID 5291 is Imanitib (Gleevac)
    $3Dmol.download("cid:5291", glViewer, { onAll: function() {
        // Default to the expensive/monopoly red visualization
        glViewer.setStyle({}, {stick: {radius: 0.15, colorscheme: 'redCarbon'}});
        glViewer.zoomTo();
        glViewer.render();
    }});
}

function setSynthesis(route) {
    state.synthesisRoute = route;
    const btnPat = document.getElementById('btn-patented');
    const btnAlt = document.getElementById('btn-alternative');
    const cost = document.getElementById('api-cost');
    
    // UI Connections for cross-section syncing
    const compSlider = document.getElementById('slider-comp');
    const compNote = document.getElementById('comp-note');
    const statusLabel = document.getElementById('val-monopoly-status');

    btnPat.classList.remove('border-brandDark', 'bg-white');
    btnAlt.classList.remove('border-brandDark', 'bg-white');
    btnPat.classList.add('border-transparent');
    btnAlt.classList.add('border-transparent');
    
    if(route === 'patented') {
        btnPat.classList.remove('border-transparent');
        btnPat.classList.add('border-brandDark', 'bg-white');
        cost.innerText = "$179.93"; 
        cost.className = "text-5xl font-bold text-scrollRed font-mono transition-colors duration-300";
        state.patentActive = true; 
        
        if (compSlider) { compSlider.disabled = true; compSlider.value = 1; }
        if (compNote) { compNote.innerText = "Locked by Patent."; compNote.className = "text-xs text-red-500 mt-1 font-bold"; }
        if (statusLabel) { statusLabel.innerText = "ACTIVE"; statusLabel.className = "text-red-600 font-bold"; }
        
        if(glViewer) {
            glViewer.setStyle({}, {stick: {radius: 0.15, colorscheme: 'redCarbon'}});
            glViewer.render();
        }
    } else {
        btnAlt.classList.remove('border-transparent');
        btnAlt.classList.add('border-brandDark', 'bg-white');
        cost.innerText = "~$1.50"; 
        cost.className = "text-5xl font-bold text-green-500 font-mono transition-colors duration-300";
        state.patentActive = false; 
        
        if (compSlider) { compSlider.disabled = false; compSlider.value = 15; }
        if (compNote) { compNote.innerText = "Market open! Adjust competitors."; compNote.className = "text-xs text-green-600 mt-1 font-bold"; }
        if (statusLabel) { statusLabel.innerText = "REJECTED / CL GRANTED"; statusLabel.className = "text-green-600 font-bold"; }
        
        if(glViewer) {
            glViewer.setStyle({}, {
                stick: {radius: 0.1, colorscheme: 'greenCarbon'}, 
                sphere: {scale: 0.3, colorscheme: 'greenCarbon'}
            });
            glViewer.render();
        }
    }
    if(state.chartsInitialized) updateCharts();
}

// --- 2. LEGAL LABYRINTH ---
const legalCases = [
    {
        title: "Turing Pharmaceuticals vs. Free Market",
        drug: "Pyrimethamine (Daraprim) - Toxoplasmosis",
        claim: "This drug is off-patent, but we bought the only approved manufacturer. By putting it in a 'closed distribution system,' generic companies cannot buy the physical sample pills they legally need to run bioequivalence tests. We now have a de facto monopoly and will raise the price 5,400%.",
        context: "Regulatory Loophole vs. Antitrust: In the US, exploiting restricted distribution blocked generic entry. Under Indian law (Competition Act, 2002), artificially restricting supply to stifle competition is an illegal abuse of dominance.",
        rejectAction: "Apply Antitrust / Fine",
        resultReject: "Correct. The Competition Commission of India (CCI) penalizes 'refusal to deal' tactics. The artificial monopoly is broken, allowing generic manufacturers (like IPCA) to supply the market at ~$0.10 per pill.",
        resultGrant: "Incorrect. Allowing closed distribution loopholes results in catastrophic price hikes (from $13.50 to $750/pill) for essential, off-patent medicines.",
        citation: `Real Case: <a href="https://www.ftc.gov/legal-library/browse/cases-proceedings/161-0001-vyera-pharmaceuticals-llc" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">FTC v. Vyera Pharmaceuticals, LLC (2022)</a>. US regulators eventually sued to stop this exact scheme, but the loophole delayed generic entry for years.`
    },
    {
        title: "Novartis AG vs. Union of India",
        drug: "Imatinib Mesylate (Gleevac) - Leukemia",
        claim: "We have developed a beta-crystalline form of our existing drug, imatinib. It has better flow properties and thermodynamic stability. We request a patent.",
        context: "Section 3(d) of the 1970 Patent Act prevents 'evergreening'—patenting minor tweaks to existing drugs without significantly enhanced therapeutic efficacy.",
        rejectAction: "Apply Sec 3(d)",
        resultReject: "Correct. The Supreme Court rejected the patent in 2013 under Section 3(d). The generic market remained open, dropping patient costs from ~$2,666/month down to ~$177/month.",
        resultGrant: "Incorrect in reality. Granting this would have allowed 'evergreening' and locked out affordable Indian generics.",
        citation: `Citation: <a href="https://indiankanoon.org/doc/165776436/" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">Novartis AG v. Union of India, Supreme Court of India (2013)</a>. Also see: <a href="https://www.ipindia.gov.in/writereaddata/Portal/IPOAct/1_113_1_The_Patents_Act__1970___incorporating_all_amendments_till_1-08-2024.pdf" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">India Patents Act §3(d) (Official Text)</a>.`
    },
    {
        title: "Bayer Corp. vs. Natco Pharma",
        drug: "Sorafenib Tosylate (Nexavar) - Kidney Cancer",
        claim: "Our patented drug costs ₹2.8 lakh ($5,000)/month. A generic company wants to make it because Indians cannot afford our price.",
        context: "Section 84 allows 'Compulsory Licensing' (CL) if a patented drug is not available at a reasonably affordable price.",
        rejectAction: "Grant Compulsory License",
        resultReject: "Correct. In 2012, India granted its first CL to Natco. Natco sold the generic for ₹8,800/month (a 97% price drop) while paying Bayer a 6% royalty.",
        resultGrant: "If denied, 99% of Indian patients requiring this life-saving drug would have been entirely priced out.",
        citation: `Citation: <a href="https://indiankanoon.org/doc/28519340/" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">Bayer Corp. v. Union of India (IPAB, 2012 / Bombay HC, 2014)</a>. Full IPAB ruling: <a href="https://unctad.org/ippcaselaw/sites/default/files/ippcaselaw/2020-12/Bayer%20Corporation%20Vs.%20Union%20of%20India%20and%20Others%20IPAB%202013.pdf" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">UNCTAD PDF</a>.`
    },
    {
        title: "F. Hoffmann-La Roche Ltd. vs. Cipla",
        drug: "Erlotinib (Tarceva) - Lung Cancer",
        claim: "Cipla is selling Erlocip, a generic version of our patented drug Tarceva. We demand an interim injunction to stop them.",
        context: "Public interest and balance of convenience in granting injunctions for life-saving drugs under the Patents Act.",
        rejectAction: "Deny Injunction",
        resultReject: "Correct. The Delhi High Court denied the injunction in 2009. Roche's drug cost Rs 4,800/pill, while Cipla's generic cost Rs 1,600/pill. The court prioritized public access to life-saving drugs over IP enforcement.",
        resultGrant: "Granting the injunction would have prioritized intellectual property over immediate public health access.",
        citation: `Citation: <a href="https://indiankanoon.org/doc/131401110/" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">F. Hoffmann-La Roche Ltd. v. Cipla Ltd., Delhi High Court (2009)</a>. FAO (OS) 188/2008.`
    },
    {
        title: "Gilead Sciences vs. Generic Manufacturers",
        drug: "Sofosbuvir (Sovaldi) - Hepatitis C",
        claim: "We hold the patent for this breakthrough cure. To address affordability, we will offer 'Voluntary Licenses' to Indian generic firms to sell it cheaply in developing nations.",
        context: "Pricing strategy, Pre-grant opposition, and Voluntary Licensing.",
        rejectAction: "Intervene / Force Market Open",
        resultReject: "Correct. Following patent oppositions, Gilead issued voluntary licenses to 11 Indian manufacturers. The US price was $84,000/course; the generic Indian price dropped to ~$300-$900/course for 101 developing nations.",
        resultGrant: "A strict monopoly without voluntary licensing would have severely restricted global Hep C eradication.",
        citation: `Data Source: <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC4946692/" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">Hill A. et al., 'Rapid reductions in prices for generic sofosbuvir and daclatasvir...', PMC4946692 (2016)</a>. Open access.`
    },
    {
        title: "Pfizer vs. Generic Challengers",
        drug: "Sunitinib (Sutent) - Kidney Cancer",
        claim: "We hold the patent, but generic companies claim our molecule lacks an 'inventive step' and is structurally obvious from prior art.",
        context: "Section 2(1)(j) regarding inventive step and post-grant opposition.",
        rejectAction: "Revoke Patent",
        resultReject: "Correct. The Indian Patent Office revoked the patent in 2012 for lacking an inventive step. Pfizer's price was Rs 1.96 lakh/course; Cipla offered generics at a fraction of the cost.",
        resultGrant: "Upholding weak, structurally obvious patents stifles the 'Alternative Synthesis' ecosystem.",
        citation: `Citation: Post-grant opposition by Cipla/Natco against Patent IN209251 (2012). See also: <a href="https://ipindia.gov.in/" target="_blank" rel="noopener" class="text-blue-600 underline hover:text-blue-800">Indian Patent Office (IP India)</a>.`
    }
];

let currentCaseIndex = 0;

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
    
    document.getElementById('ruling-outcome').classList.add('hidden');
    state.patentActive = true; 
    
    const compSlider = document.getElementById('slider-comp');
    const compNote = document.getElementById('comp-note');
    const statusLabel = document.getElementById('val-monopoly-status');

    if (compSlider) {
        compSlider.disabled = true;
        compSlider.value = 1;
    }
    if (compNote) {
        compNote.innerText = "Locked by Patent.";
        compNote.className = "text-xs text-red-500 mt-1 font-bold";
    }
    if (statusLabel) {
        statusLabel.innerText = "ACTIVE";
        statusLabel.className = "text-red-600 font-bold";
    }
    
    if(state.chartsInitialized) updateCharts();
}

function prevCase() { 
    currentCaseIndex = (currentCaseIndex > 0) ? currentCaseIndex - 1 : legalCases.length - 1; 
    renderCase(); 
}

function nextCase() { 
    currentCaseIndex = (currentCaseIndex < legalCases.length - 1) ? currentCaseIndex + 1 : 0; 
    renderCase(); 
}

function makeRuling(isGrant) {
    const c = legalCases[currentCaseIndex];
    const outcomeDiv = document.getElementById('ruling-outcome');
    outcomeDiv.classList.remove('hidden');
    
    const compSlider = document.getElementById('slider-comp');
    const compNote = document.getElementById('comp-note');
    const statusLabel = document.getElementById('val-monopoly-status');

    if(isGrant) {
        state.patentActive = true;
        outcomeDiv.innerHTML = `<span class='text-red-400 font-bold'>Monopoly Granted.</span> ${c.resultGrant}`;
        outcomeDiv.className = "mt-8 w-full p-4 rounded bg-gray-800 text-sm font-serif border-l-4 border-scrollRed text-white";
        
        compSlider.disabled = true;
        compSlider.value = 1;
        compNote.innerText = "Locked by Patent.";
        compNote.className = "text-xs text-red-500 mt-1 font-bold";
        statusLabel.innerText = "ACTIVE";
        statusLabel.className = "text-red-600 font-bold";
    } else {
        state.patentActive = false;
        outcomeDiv.innerHTML = `<span class='text-voxYellow font-bold'>Market Intervened.</span> ${c.resultReject}`;
        outcomeDiv.className = "mt-8 w-full p-4 rounded bg-gray-800 text-sm font-serif border-l-4 border-voxYellow text-white";
        
        compSlider.disabled = false;
        compSlider.value = 15; 
        compNote.innerText = "Market open! Adjust competitors.";
        compNote.className = "text-xs text-green-600 mt-1 font-bold";
        statusLabel.innerText = "REJECTED / CL GRANTED";
        statusLabel.className = "text-green-600 font-bold";
    }
    if(state.chartsInitialized) updateCharts();
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

function updateSDChart() {
    if(!state.chartsInitialized) return;
    const sShift = parseInt(document.getElementById('slider-supply-shift').value);
    const dShift = parseInt(document.getElementById('slider-demand-shift').value);
    const a = 120 + dShift; const b = 0.5; const c = 80 - sShift; const d = 0.5; 
    const eqQ = (a - c) / (b + d); const eqP = a - (b * eqQ);

    sdChart.data.datasets[0].data = [{ x: 0, y: c }, { x: 200, y: c + (d * 200) }];
    sdChart.data.datasets[1].data = [{ x: 0, y: a }, { x: 200, y: a - (b * 200) }];
    sdChart.data.datasets[2].data = [{ x: eqQ, y: eqP }]; 
    sdChart.update();

    document.getElementById('eq-price').innerText = `$${eqP.toFixed(2)}`;
    document.getElementById('eq-quantity').innerText = `${eqQ.toFixed(0)} Units`;
    
    let economicAnalysis = (sShift === 0 && dShift === 0) ? "Market is in strict monopoly restricting access." : "Market shifted due to competitive supply or public demand.";
    document.getElementById('sdChart').setAttribute('aria-label', `Supply and Demand Chart. Current Equilibrium Price is $${eqP.toFixed(2)} and Quantity is ${eqQ.toFixed(0)} units. ${economicAnalysis}`);
}

function updateQALYChart() {
    if(!state.chartsInitialized) return;
    const costPerPatient = parseInt(document.getElementById('slider-qaly-cost').value);
    const fixedBudget = 10000000; 
    const qalyMultiplier = 5; 

    const patientsTreated = Math.floor(fixedBudget / costPerPatient);
    const totalQALYs = patientsTreated * qalyMultiplier;

    document.getElementById('qaly-patients').innerText = patientsTreated.toLocaleString();
    document.getElementById('qaly-total').innerText = totalQALYs.toLocaleString();

    qalyChart.data.datasets[0].data = [patientsTreated, totalQALYs];
    qalyChart.update();
    
    let icerAnalysis = costPerPatient <= 5000 ? "This generic pricing is highly cost-effective." : "This monopoly pricing destroys life-years and is not cost-effective.";
    document.getElementById('qalyChart').setAttribute('aria-label', `Quality Adjusted Life Years Bar Chart. At a drug cost of $${costPerPatient.toLocaleString()} per patient, the $10 Million budget treats ${patientsTreated.toLocaleString()} patients, yielding ${totalQALYs.toLocaleString()} total QALYs gained. ${icerAnalysis}`);
}

// --- 6. DYNAMIC MAP INTERACTIVITY WITH REAL DATA ---
const historicalExportData = {
    2000: 1.5, 2001: 1.9, 2002: 2.3, 2003: 2.8, 2004: 3.5,
    2005: 4.2, 2006: 5.0, 2007: 6.1, 2008: 7.2, 2009: 8.5,
    2010: 9.8, 2011: 11.2, 2012: 13.0, 2013: 14.6, 2014: 15.2,
    2015: 16.4, 2016: 16.8, 2017: 17.3, 2018: 19.1, 2019: 20.6,
    2020: 24.4, 2021: 24.6, 2022: 25.3, 2023: 27.9, 2024: 30.5
};

const regionalData = {
    'India': { share: "100%", color: "text-brandDark", therapy: "API Synthesis & Formulation", detail: "The 'Pharmacy of the World'. India accounts for 20% of global generic exports by volume, operating over 600 FDA-approved manufacturing sites." },
    'USA': { share: "34%", color: "text-red-600", therapy: "Cardiovascular, CNS, Anti-Diabetic", detail: "The largest single export destination. Indian manufacturers hold over 40% of the generic market share in the US, drastically lowering healthcare costs." },
    'Africa': { share: "19%", color: "text-green-500", therapy: "Antiretrovirals (HIV), Antimalarials, Vaccines", detail: "A lifeline for public health. Indian generics supply over 80% of all Antiretroviral (ARV) drugs used globally to combat HIV/AIDS." },
    'Europe': { share: "16%", color: "text-yellow-600", therapy: "Complex Generics, Injectables, Oncology", detail: "A highly regulated market. India is a critical supplier to the UK's NHS and various EU public health systems during shortages." }
};

function selectRegion(regionKey) {
    const data = regionalData[regionKey];
    const panel = document.getElementById('region-info-panel');
    
    document.getElementById('region-title').innerText = regionKey === 'USA' ? 'North America' : regionKey;
    const shareEl = document.getElementById('region-share');
    shareEl.innerText = data.share;
    shareEl.className = `text-4xl font-mono font-bold ${data.color}`;
    
    document.getElementById('region-detail').innerText = data.detail;
    document.getElementById('region-therapy').innerText = `Primary Focus: ${data.therapy}`;
    
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
        
        // Epidemic-style transmission equation generating the logistic curve
        let penetration = 100 / (1 + Math.exp(-0.4 * (year - 2010)));
        
        sCurveChart.data.datasets[1].data = [{x: year, y: penetration}];
        sCurveChart.update();

        let phaseText = "Pre-2005: High uncertainty and lack of complementary infrastructure constrain the diffusion of affordable generics.";
        if (year >= 2005 && year <= 2015) {
            phaseText = "Post-TRIPS Acceleration: Global NGO distribution networks (PEPFAR) act as complementary assets, triggering rapid epidemic-style diffusion.";
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
        patented: { price: 5000, mc: 20, name: "Bayer's Nexavar (Sorafenib)" },
        generic: { price: 105, mc: 20, name: "Natco's Sorafenib (Compulsory License)" }
    },
    wages: {
        unskilled: { daily: 3.20, name: "Unskilled Laborer (MGNREGA)" },
        salaried: { daily: 15.00, name: "Average Urban Salaried Worker" }
    }
};

function updateAffordabilityWidget() {
    const marketState = document.getElementById('select-market-state').value;
    const wageProfile = document.getElementById('select-wage-profile').value;
    
    const drug = affordabilityData.drugs[marketState];
    const wage = affordabilityData.wages[wageProfile];
    
    document.getElementById('market-price-display').innerText = `Market Price: $${drug.price.toLocaleString()} / month`;
    document.getElementById('wage-display').innerText = `Daily Wage: $${wage.daily.toFixed(2)} / day`;
    
    const daysRequired = Math.round(drug.price / wage.daily);
    
    animateValue("days-worked-val", 0, daysRequired, 800);
    
    document.getElementById('calc-pat-p').innerText = affordabilityData.drugs.patented.price;
    document.getElementById('calc-pat-p2').innerText = affordabilityData.drugs.patented.price;
    document.getElementById('calc-gen-p').innerText = affordabilityData.drugs.generic.price;
    document.getElementById('calc-gen-p2').innerText = affordabilityData.drugs.generic.price;

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

// --- 9. GAME THEORY PATENT RACE LOGIC ---
// Moved to the global scope so inline HTML onclick handlers can find it
function playPatentRace(userChoice) {
    const cells = ['cell-high-high', 'cell-high-low', 'cell-low-high', 'cell-low-low'];
    cells.forEach(id => {
        const el = document.getElementById(id);
        el.classList.remove('bg-yellow-200', 'border-yellow-400', 'ring-4', 'ring-yellow-400', 'scale-105', 'z-10');
        el.classList.add('bg-gray-50', 'border-gray-200');
    });

    // In this game model, a rational Firm B will ALWAYS play its dominant strategy: High R&D.
    const rivalChoice = 'high'; 
    let activeCellId = '';
    let resultHTML = '';

    if (userChoice === 'high') {
        activeCellId = 'cell-high-high';
        resultHTML = `
            <strong class="text-scrollRed block mb-1">Result: Symmetric Over-Investment</strong>
            You chose <strong>High R&D</strong> to try and capture the monopoly. However, because this is a dominant strategy, your rival <i>also</i> chose High R&D.<br><br>
            You both spent $400M, giving you each a 50% chance at the $1000M patent. Your expected net profit is <strong>$100M</strong>. You both lost out on the $400M you could have made by cooperating on Low R&D.
        `;
        
        document.getElementById('btn-play-high').classList.replace('unselected', 'selected');
        document.getElementById('btn-play-low').classList.replace('selected', 'unselected');
        
    } else {
        activeCellId = 'cell-low-high';
        resultHTML = `
            <strong class="text-scrollRed block mb-1">Result: The Sunk Cost Trap</strong>
            You chose to save money with <strong>Low R&D</strong>. However, your rival played their dominant strategy (High R&D).<br><br>
            Because they outspent you, they win the patent outright. They net <strong>$600M</strong>, while you lose your $100M investment and get nothing. This is why firms are forced to over-invest.
        `;
        
        document.getElementById('btn-play-low').classList.replace('unselected', 'selected');
        document.getElementById('btn-play-high').classList.replace('selected', 'unselected');
    }

    const targetCell = document.getElementById(activeCellId);
    targetCell.classList.remove('bg-gray-50', 'border-gray-200');
    targetCell.classList.add('bg-yellow-200', 'border-yellow-400', 'ring-4', 'ring-yellow-400', 'scale-105', 'z-10');

    const resultBox = document.getElementById('game-result-box');
    resultBox.innerHTML = resultHTML;
    resultBox.classList.remove('hidden');
}


// --- GLOBAL INITIALIZATION ---
document.addEventListener("DOMContentLoaded", function() {
    initWebGLViewer();
    renderCase();

    // 1. Initialize S-Curve Chart (Section 6)
    const sCurveCtx = document.getElementById('sCurveChart').getContext('2d');
    const sData = [];
    for(let y=2000; y<=2024; y++) {
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
                    data: [{x: 2000, y: 100 / (1 + Math.exp(-0.4 * (2000 - 2010)))}],
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
                    min: 2000, 
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
    // Verification: Data sourced from w74906.xlsx (OECD Health Statistics 2023)
const oecdLabels = ['Chile', 'Germany', 'UK', 'USA', 'Japan', 'OECD Avg', 'Switzerland'];
const volumeData = [82.3, 80.3, 78.4, 91.0, 47.7, 52.3, 22.1];
const valueData = [67.2, 15.5, 34.3, 18.0, 15.4, 24.5, 14.1];

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
    const sdCtx = document.getElementById('sdChart').getContext('2d');
    const qalyCtx = document.getElementById('qalyChart').getContext('2d');

    barChart = new Chart(barCtx, { type: 'bar', data: { labels: ['Private Profit', 'Social Access'], datasets: [{ label: 'Economic Value', backgroundColor: ['#1a1a1a', '#fffb00'], data: [0, 0] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, suggestedMax: 3500 } } } });
    lineChart = new Chart(lineCtx, { type: 'line', data: { labels: ['Yr1', 'Yr2', 'Yr3', 'Yr4', 'Yr5', 'Yr6', 'Yr7', 'Yr8', 'Yr9', 'Yr10'], datasets: [{ label: 'Price Index (%)', borderColor: '#d92525', backgroundColor: 'rgba(217, 37, 37, 0.1)', fill: true, data: [], tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 110 } } } });
    sdChart = new Chart(sdCtx, { 
        type: 'scatter', 
        data: { 
            datasets: [
                { label: 'Supply (S)', borderColor: '#1d4ed8', backgroundColor: '#1d4ed8', showLine: true, fill: false, tension: 0, data: [] }, 
                { label: 'Demand (D)', borderColor: '#15803d', backgroundColor: '#15803d', showLine: true, fill: false, tension: 0, data: [] }, 
                { label: 'Equilibrium (E)', backgroundColor: '#d92525', pointRadius: 8, pointHoverRadius: 12, data: [] }
            ] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 26, 0.95)',
                    titleFont: { size: 14, family: "'Work Sans', sans-serif" },
                    bodyFont: { size: 12, family: "monospace" },
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        title: function(context) {
                            if (context[0].datasetIndex === 2) return "Market Equilibrium";
                            return context[0].dataset.label;
                        },
                        label: function(context) {
                            if (context.datasetIndex === 2) {
                                const sShift = parseInt(document.getElementById('slider-supply-shift').value);
                                const dShift = parseInt(document.getElementById('slider-demand-shift').value);
                                
                                let lines = [
                                    `Price:    $${context.parsed.y.toFixed(2)}`,
                                    `Quantity: ${context.parsed.x.toFixed(0)} Units`,
                                    `-------------------------`
                                ];

                                if (sShift === 0 && dShift === 0) {
                                    lines.push(`Status: Strict Monopoly`);
                                    lines.push(`Analysis: High price limits access to only`);
                                    lines.push(`those with maximum willingness to pay.`);
                                } else {
                                    if (sShift > 0) {
                                        lines.push(`Supply Effect: Generic competitors entered,`);
                                        lines.push(`driving the price down toward marginal cost.`);
                                    }
                                    if (dShift > 0) {
                                        lines.push(`Demand Effect: Public procurement shifted`);
                                        lines.push(`the curve outward, increasing total volume.`);
                                    }
                                }
                                return lines;
                            }
                            return `Q: ${context.parsed.x.toFixed(0)}, P: $${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            }, 
            scales: { 
                x: { type: 'linear', position: 'bottom', title: { display: true, text: 'Quantity (Q)' }, min: 0, max: 200 }, 
                y: { title: { display: true, text: 'Price (P)' }, min: 0, max: 150 } 
            } 
        } 
    });
    qalyChart = new Chart(qalyCtx, { 
        type: 'bar', 
        data: { 
            labels: ['Patients Treated', 'Total QALYs Gained'], 
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
                                const qalys = patients * 5;
                                lines.push(`Math: ${patients.toLocaleString()} patients × 5 added years`);
                                lines.push(`Result: ${qalys.toLocaleString()} total years of life saved.`);
                                lines.push(``); 
                                
                                if (costPerPatient <= 5000) {
                                    lines.push(`ICER Analysis: Highly cost-effective.`);
                                    lines.push(`Generic pricing maximizes public health utility.`);
                                } else {
                                    lines.push(`ICER Analysis: Low cost-effectiveness.`);
                                    lines.push(`Monopoly pricing actively destroys life-years.`);
                                }
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

    state.chartsInitialized = true;
    
    // Bind all event listeners
    document.getElementById('slider-comp').addEventListener('input', updateCharts);
    document.getElementById('slider-procure').addEventListener('input', updateCharts);
    document.getElementById('slider-supply-shift').addEventListener('input', updateSDChart);
    document.getElementById('slider-demand-shift').addEventListener('input', updateSDChart);
    document.getElementById('slider-qaly-cost').addEventListener('input', updateQALYChart);
    document.getElementById('slider-map-year').addEventListener('input', updateMap);
    document.getElementById('toggle-api').addEventListener('change', updateMap);
    document.getElementById('select-market-state').addEventListener('change', updateAffordabilityWidget);
    document.getElementById('select-wage-profile').addEventListener('change', updateAffordabilityWidget);
    document.getElementById('slider-hhi-firms').addEventListener('input', updateHHIWidget);
    
    window.addEventListener('resize', () => {
        if (state.chartsInitialized) updateMap();
    });
    
    // Initialize all widgets
    updateCharts();
    updateSDChart();
    updateQALYChart();
    updateMap();
    updateAffordabilityWidget();
    updateHHIWidget();
});