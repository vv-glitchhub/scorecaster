export const dictionaries = {
  en: {
    brandTagline: "Betting analytics & simulation workspace",

    navDashboard: "Dashboard",
    navBetting: "Betting",
    navSimulator: "Simulator",
    navAbout: "About",

    switchToEnglish: "English",
    switchToFinnish: "Finnish",

    dashboardEyebrow: "Scorecaster Dashboard",
    dashboardTitle:
      "Clearer home view, dedicated betting workspace, dedicated simulator.",
    dashboardDescription:
      "The dashboard shows only the most important things quickly. Heavy analysis lives on the betting page and simulations on the simulator page.",
    openBettingWorkspace: "Open Betting Workspace",
    openSimulator: "Open Simulator",

    topPicks: "Top Picks",
    topPicksDescription: "Best backend-ranked value spots right now.",
    noTopPicks: "No top picks available.",

    dataSourceStatus: "Data Source Status",
    dataSourceStatusDescription: "Quick source and cache visibility.",
    oddsSource: "Odds source",
    cacheStatus: "Cache status",
    matchesLoaded: "Matches loaded",

    simulatorPreview: "Simulator Preview",
    simulatorPreviewDescription: "Quick look before opening the simulator.",
    nextStep: "Next step",
    simulatorPreviewText: "Run tournament / season simulations separately",
    simulatorPreviewSubtext:
      "Keep simulation logic isolated so betting workspace stays focused.",
    goToSimulator: "Go to simulator",

    matchPreview: "Match Preview",
    matchPreviewDescription: "Lightweight preview on the dashboard.",
    noMatchPreview: "No match preview available.",
    bestOdds: "Best odds",
    home: "Home",
    draw: "Draw",
    away: "Away",

    sourceLabel: "SOURCE",
    statusLabel: "STATUS",
    sourceUnknown: "UNKNOWN",
    sourceApi: "API",
    sourceFallback: "FALLBACK",
    statusFresh: "FRESH",
    statusCache: "CACHE",

    live: "LIVE",
    updating: "UPDATING",
    updatedAt: "Updated",
    refreshNow: "Refresh now",

    bettingEyebrow: "Betting Workspace",
    bettingTitle: "Full betting analysis, odds comparison and value bet workflow.",
    bettingDescription:
      "Live-refresh, market tabs, EV, edge, fair odds and Kelly preview in one view.",

    filters: "Filters",
    filtersDescription: "Sport / league / market controls can expand here.",
    sport: "Sport",
    league: "League",
    market: "Market",
    iceHockey: "Ice Hockey",

    onlyValueBets: "Only Value Bets",
    showingPositiveOnly: "Showing positive EV only",
    showingAllRows: "Showing all rows",

    matches: "Matches",
    matchesDescription: "Tap a match to update the analysis instantly.",
    noMatches: "No matches found.",
    selected: "Selected",
    openAnalysis: "Open analysis",

    selectedMatchAnalysis: "Selected Match Analysis",
    selectedMatchAnalysisDescription:
      "Main match view, market odds and model output.",
    noSelectedMatch: "No selected match.",
    bestBetRightNow: "Best Bet Right Now",

    modelHome: "Model Home",
    modelDraw: "Model Draw",
    modelAway: "Model Away",
    modelOver: "Model Over",
    modelUnder: "Model Under",
    spreadHome: "Spread Home",
    spreadAway: "Spread Away",
    confidence: "Confidence",

    valueBets: "Value Bets",
    valueBetsDescription: "Model edge versus current market odds.",
    noValueBets: "No value bet rows available.",
    bookmaker: "Bookmaker",
    implied: "Implied",
    fair: "Fair",
    edge: "Edge",
    ev: "EV",
    stake: "Stake",

    backendTopPicks: "Backend Top Picks",
    backendTopPicksDescription:
      "Ranked value opportunities across loaded matches.",
    noBackendPicks: "No backend picks available.",

    bankroll: "Bankroll",
    bankrollDescription: "Quarter Kelly stake preview.",
    stakingModel: "Staking model",
    kellyFraction: "Kelly fraction",
    refreshInterval: "Refresh interval",
    quarterKelly: "Quarter Kelly",

    h2h: "H2H",
    totals: "Totals",
    handicap: "Handicap",

    simulatorEyebrow: "Simulator Workspace",
    simulatorTitle:
      "Dedicated area for tournament and season simulations.",
    simulatorDescription:
      "This page keeps all simulation logic separate from betting so the betting workspace stays faster and cleaner.",

    simulationSetup: "Simulation Setup",
    simulationSetupDescription:
      "Competition, model and iteration settings.",
    competition: "Competition",
    iterations: "Iterations",
    mode: "Mode",
    worldCupLeague: "World Cup / League",
    monteCarlo: "Monte Carlo",

    outcomePreview: "Outcome Preview",
    outcomePreviewDescription:
      "Example result cards for future simulation output.",
    winTitle: "Win title",
    reachFinal: "Reach final",
    top4: "Top 4",

    plannedExtensions: "Planned Extensions",
    plannedExtensionsDescription:
      "Features that belong here, not on the betting page.",
    ext1: "tournament brackets",
    ext2: "season table simulations",
    ext3: "top 4 / top 8 probabilities",
    ext4: "final and champion probabilities",
    ext5: "scenario comparison",

    dataStatus: "Data Status",
    marketSelection: "Market Selection",

    aboutEyebrow: "About Scorecaster",
    aboutTitle:
      "What the app does, how the calculations work, and what is already available.",
    aboutDescription:
      "This page explains what Scorecaster does, how the main numbers are formed, what data status means, and which features are already available in the current version.",

    aboutWhatTitle: "What Scorecaster does",
    aboutWhatDescription:
      "Scorecaster is a betting analysis and simulation tool. It loads match data, displays market odds, highlights interesting spots, supports stake planning and tracks saved bets.",
    aboutWhat1: "shows a lightweight dashboard for key information",
    aboutWhat2: "separates betting and simulation into dedicated pages",
    aboutWhat3: "loads odds and displays market rows clearly",
    aboutWhat4: "supports manual stake planning and Kelly-style suggestions",
    aboutWhat5: "tracks saved bets, results, profit and ROI",

    aboutNowTitle: "Available now",
    aboutNowDescription:
      "These features are already available in the current version.",
    aboutNow1: "dashboard with top picks and source status",
    aboutNow2: "separate betting workspace and simulator view",
    aboutNow3: "market tabs for H2H, totals and handicap",
    aboutNow4: "manual stake and Kelly-style stake suggestion",
    aboutNow5: "bet history, ROI and profit tracking",

    aboutCalcTitle: "How the calculations work",
    aboutCalcDescription:
      "The application follows a transparent calculation flow. The key betting terms are visible to the user.",

    aboutCalc1Title: "1. Market odds",
    aboutCalc1Text:
      "The app loads decimal odds from the selected source and normalizes them into a common match structure for the interface.",

    aboutCalc2Title: "2. Implied probability",
    aboutCalc2Text:
      "Odds are converted into implied probability. This tells what probability the market is pricing in.",

    aboutCalc3Title: "3. Model probability",
    aboutCalc3Text:
      "The app creates a simple model estimate for the selected market. This model can later be improved.",

    aboutCalc4Title: "4. Fair odds",
    aboutCalc4Text:
      "Fair odds are calculated from the model probability. This creates a model-based price for comparison.",

    aboutCalc5Title: "5. Edge and expected value",
    aboutCalc5Text:
      "Edge compares model probability with implied probability. Expected value helps evaluate whether the offered odds are attractive.",

    aboutCalc6Title: "6. Kelly suggestion",
    aboutCalc6Text:
      "If Kelly mode is enabled, the stake suggestion is calculated from probability, odds, bankroll and Kelly fraction.",

    aboutFormulaTitle: "Main formulas",
    aboutFormulaDescription:
      "These formulas describe the core calculation logic shown in the app.",
    formulaImplied: "Implied probability = 1 / odds",
    formulaFair: "Fair odds = 1 / model probability",
    formulaEdge:
      "Edge (%) = (model probability - implied probability) × 100",
    formulaEv:
      "Expected value (%) = ((odds × model probability) - 1) × 100",
    formulaKelly:
      "Kelly fraction f* = (b × p - q) / b, where b = odds - 1, p = probability, q = 1 - p",
    formulaStake:
      "Stake = bankroll × Kelly fraction × selected Kelly share",

    aboutExampleTitle: "Example calculation",
    aboutExampleDescription:
      "Below is a simplified example of how a single row can be evaluated.",
    exampleInputTitle: "Example input",
    exampleInputText:
      "Suppose the market offers odds 2.55 for a home win, and the model estimates the true win probability at 40%.",
    exampleStep1: "Implied probability = 1 / 2.55 = 0.3922 = 39.22%",
    exampleStep2: "Model probability = 40.00%",
    exampleStep3: "Fair odds = 1 / 0.40 = 2.50",
    exampleStep4: "Edge = (0.40 - 0.3922) × 100 = 0.78%",
    exampleStep5: "EV = ((2.55 × 0.40) - 1) × 100 = 2.00%",
    exampleStep6:
      "If bankroll is €1,000 and quarter Kelly is used, the stake is calculated from the Kelly formula and then reduced to 25% of full Kelly.",

    aboutStatusTitle: "Data, refresh and transparency",
    aboutStatusDescription:
      "The app tries to show source and refresh information openly instead of hiding it.",
    aboutStatus1: "SOURCE tells whether the data comes from API or fallback mode.",
    aboutStatus2: "STATUS tells whether the view is using cached or fresh data.",
    aboutStatus3:
      "LIVE and Updated labels show when the data was last refreshed.",
    aboutStatus4:
      "The betting workspace can refresh data repeatedly during usage.",

    aboutLimitsTitle: "Current limitations",
    aboutLimitsDescription:
      "The app is still under development, so it is important to state clearly what is not yet fully built.",
    aboutLimit1:
      "the model is currently simple and not yet a final predictive engine",
    aboutLimit2:
      "live betting tools do not yet form a full real-time workflow",
    aboutLimit3:
      "player-level and injury-level modeling is not yet broadly integrated",
    aboutLimit4:
      "bet history is currently stored primarily locally instead of as a full cloud account system",
    aboutLimit5:
      "the app is an analysis tool and does not guarantee profitable betting",

    aboutUpdatesTitle: "Latest updates",
    aboutUpdatesDescription:
      "This page can be updated as the application evolves.",
    aboutUpdate1:
      "dashboard, betting workspace and simulator separated into dedicated pages",
    aboutUpdate2: "bilingual user interface added",
    aboutUpdate3:
      "market tabs added for H2H, totals and handicap markets",
    aboutUpdate4:
      "bet history together with ROI and profit tracking added",
    aboutUpdate5: "profit chart and stake flow added",

    aboutNextTitle: "What comes next",
    aboutNextDescription:
      "Likely next development steps inside Scorecaster.",
    aboutNext1: "pending bets preview for the dashboard",
    aboutNext2: "bankroll curve and daily breakdown",
    aboutNext3: "deeper match analysis and confidence breakdown",
    aboutNext4: "stronger live refresh and market movement tracking",
  },

  fi: {
    brandTagline: "Vedonlyönnin analyysi- ja simulaatiotyötila",

    navDashboard: "Etusivu",
    navBetting: "Vedonlyönti",
    navSimulator: "Simulaattori",
    navAbout: "Tietoa",

    switchToEnglish: "English",
    switchToFinnish: "Suomi",

    dashboardEyebrow: "Scorecaster Etusivu",
    dashboardTitle:
      "Selkeämpi etusivu, erillinen vedonlyöntityöpöytä ja oma simulaattori.",
    dashboardDescription:
      "Etusivu näyttää tärkeimmät asiat nopeasti. Laajempi analyysi löytyy vedonlyöntisivulta ja simulaatiot omalta sivultaan.",
    openBettingWorkspace: "Avaa vedonlyöntityöpöytä",
    openSimulator: "Avaa simulaattori",

    topPicks: "Parhaat kohteet",
    topPicksDescription: "Backendin kiinnostavimmat value-kohteet juuri nyt.",
    noTopPicks: "Parhaita kohteita ei ole saatavilla.",

    dataSourceStatus: "Datalähteen tila",
    dataSourceStatusDescription: "Nopea näkymä lähteeseen ja välimuistin tilaan.",
    oddsSource: "Kertoimien lähde",
    cacheStatus: "Välimuistin tila",
    matchesLoaded: "Ladatut ottelut",

    simulatorPreview: "Simulaattorin esikatselu",
    simulatorPreviewDescription: "Nopea katsaus ennen simulaattorin avaamista.",
    nextStep: "Seuraava askel",
    simulatorPreviewText: "Aja turnaus- ja kausisimulaatiot erikseen",
    simulatorPreviewSubtext:
      "Simulaatiologiikka pidetään erillään, jotta vedonlyöntityöpöytä pysyy selkeänä.",
    goToSimulator: "Siirry simulaattoriin",

    matchPreview: "Otteluesikatselu",
    matchPreviewDescription: "Kevyt otteluesikatselu etusivulla.",
    noMatchPreview: "Otteluesikatselua ei ole saatavilla.",
    bestOdds: "Parhaat kertoimet",
    home: "Koti",
    draw: "Tasapeli",
    away: "Vieras",

    sourceLabel: "LÄHDE",
    statusLabel: "TILA",
    sourceUnknown: "TUNTEMATON",
    sourceApi: "API",
    sourceFallback: "FALLBACK",
    statusFresh: "TUORE",
    statusCache: "VÄLIMUISTI",

    live: "LIVE",
    updating: "PÄIVITTYY",
    updatedAt: "Päivitetty",
    refreshNow: "Päivitä nyt",

    bettingEyebrow: "Vedonlyöntityöpöytä",
    bettingTitle:
      "Vedonlyöntianalyysi, kertoimien vertailu ja value-työkalu yhdessä näkymässä.",
    bettingDescription:
      "Sama näkymä kokoaa markkinat, panokset, odotusarvon, edun ja tallennetut vedot yhteen.",

    filters: "Suodattimet",
    filtersDescription: "Laji-, liiga- ja markkinavalinnat löytyvät täältä.",
    sport: "Laji",
    league: "Liiga",
    market: "Markkina",
    iceHockey: "Jääkiekko",

    onlyValueBets: "Vain arvovedot",
    showingPositiveOnly: "Näytetään vain positiivinen EV",
    showingAllRows: "Näytetään kaikki rivit",

    matches: "Ottelut",
    matchesDescription: "Valitse ottelu päivittääksesi analyysin.",
    noMatches: "Otteluita ei löytynyt.",
    selected: "Valittu",
    openAnalysis: "Avaa analyysi",

    selectedMatchAnalysis: "Valitun ottelun analyysi",
    selectedMatchAnalysisDescription:
      "Ottelun päänäkymä, markkinakertoimet ja mallin arvio.",
    noSelectedMatch: "Valittua ottelua ei ole.",
    bestBetRightNow: "Paras veto juuri nyt",

    modelHome: "Mallin koti",
    modelDraw: "Mallin tasapeli",
    modelAway: "Mallin vieras",
    modelOver: "Mallin over",
    modelUnder: "Mallin under",
    spreadHome: "Tasoitus koti",
    spreadAway: "Tasoitus vieras",
    confidence: "Luottamus",

    valueBets: "Arvovedot",
    valueBetsDescription: "Mallin arvio verrattuna markkinan kertoimiin.",
    noValueBets: "Arvovetorivejä ei ole saatavilla.",
    bookmaker: "Vedonvälittäjä",
    implied: "Implisiittinen todennäköisyys",
    fair: "Reilu kerroin",
    edge: "Edge",
    ev: "EV",
    stake: "Panos",

    backendTopPicks: "Backendin parhaat kohteet",
    backendTopPicksDescription:
      "Ladattujen otteluiden kiinnostavimmat kohteet järjestyksessä.",
    noBackendPicks: "Backend-kohteita ei ole saatavilla.",

    bankroll: "Pelikassa",
    bankrollDescription: "Panosesikatselu valitulla staking-mallilla.",
    stakingModel: "Panostusmalli",
    kellyFraction: "Kelly-osuus",
    refreshInterval: "Päivitysväli",
    quarterKelly: "Quarter Kelly",

    h2h: "H2H",
    totals: "Totals",
    handicap: "Handicap",

    simulatorEyebrow: "Simulaattorityöpöytä",
    simulatorTitle: "Oma alue turnaus- ja kausisimulaatioille.",
    simulatorDescription:
      "Tämä sivu pitää kaiken simulaatiologiikan erillään vedonlyönnistä, jotta vedonlyöntisivu pysyy nopeampana ja selkeämpänä.",

    simulationSetup: "Simulaation asetukset",
    simulationSetupDescription:
      "Kilpailu, malli ja iteraatioasetukset.",
    competition: "Kilpailu",
    iterations: "Iteraatiot",
    mode: "Tila",
    worldCupLeague: "MM / Liiga",
    monteCarlo: "Monte Carlo",

    outcomePreview: "Tulosesikatselu",
    outcomePreviewDescription:
      "Esimerkkikortit tulevaa simulaatiotulosta varten.",
    winTitle: "Voittaa mestaruuden",
    reachFinal: "Pääsee finaaliin",
    top4: "Top 4",

    plannedExtensions: "Suunnitellut laajennukset",
    plannedExtensionsDescription:
      "Ominaisuuksia, jotka kuuluvat tänne eivätkä vedonlyöntisivulle.",
    ext1: "turnauskaaviot",
    ext2: "sarjataulukon simulaatiot",
    ext3: "top 4 / top 8 todennäköisyydet",
    ext4: "finaali- ja mestaruustodennäköisyydet",
    ext5: "skenaariovertailu",

    dataStatus: "Datan tila",
    marketSelection: "Markkinan valinta",

    aboutEyebrow: "Tietoa Scorecasterista",
    aboutTitle:
      "Mitä sovellus tekee, miten laskenta toimii ja mitä ominaisuuksia on jo käytössä.",
    aboutDescription:
      "Tämä sivu kertoo, mitä Scorecaster tekee, miten tärkeimmät luvut muodostuvat, mitä datan tila tarkoittaa ja mitkä ominaisuudet ovat käytössä nykyisessä versiossa.",

    aboutWhatTitle: "Mitä Scorecaster tekee",
    aboutWhatDescription:
      "Scorecaster on vedonlyönnin analyysi- ja simulaatiotyökalu. Se hakee otteludataa, näyttää markkinakertoimia, nostaa esiin kiinnostavia kohteita, tukee panospäätöksiä ja seuraa tallennettuja vetoja.",
    aboutWhat1: "näyttää kevyen etusivun tärkeimmille tiedoille",
    aboutWhat2: "erottaa vedonlyönnin ja simulaation omille sivuilleen",
    aboutWhat3: "hakee kertoimia ja näyttää markkinarivejä selkeästi",
    aboutWhat4: "tukee panossuunnittelua ja Kelly-tyylisiä panosehdotuksia",
    aboutWhat5: "seuraa tallennettuja vetoja, tuloksia, voittoa ja ROI:ta",

    aboutNowTitle: "Käytössä nyt",
    aboutNowDescription:
      "Nämä ominaisuudet ovat käytössä nykyisessä versiossa.",
    aboutNow1: "etusivu, jossa näkyvät top picks ja datan tila",
    aboutNow2: "erillinen vedonlyöntityöpöytä ja simulaattorinäkymä",
    aboutNow3: "markkinavälilehdet H2H-, totals- ja handicap-markkinoille",
    aboutNow4: "manuaalinen panos ja Kelly-tyylinen panosehdotus",
    aboutNow5: "vetohistoria sekä ROI- ja profit-seuranta",

    aboutCalcTitle: "Miten laskenta toimii",
    aboutCalcDescription:
      "Sovellus käyttää avointa ja helposti ymmärrettävää laskentalinjaa. Tärkeimmät vedonlyöntitermit näytetään käyttäjälle näkyvästi.",

    aboutCalc1Title: "1. Markkinakertoimet",
    aboutCalc1Text:
      "Sovellus hakee desimaalikertoimet valitusta datalähteestä ja muuntaa ne yhtenäiseen ottelurakenteeseen käyttöliittymää varten.",

    aboutCalc2Title: "2. Implisiittinen todennäköisyys",
    aboutCalc2Text:
      "Kertoimet muunnetaan implisiittiseksi todennäköisyydeksi. Tämä kertoo, millaisella todennäköisyydellä markkina hinnoittelee kohteen.",

    aboutCalc3Title: "3. Mallin todennäköisyys",
    aboutCalc3Text:
      "Sovellus muodostaa yksinkertaisen malliarvion todennäköisyydestä valitulle markkinalle. Tätä mallia voidaan myöhemmin kehittää tarkemmaksi.",

    aboutCalc4Title: "4. Reilu kerroin",
    aboutCalc4Text:
      "Reilu kerroin lasketaan mallin todennäköisyydestä. Sen avulla voidaan verrata markkinahintaa mallin arvioon.",

    aboutCalc5Title: "5. Edge ja odotusarvo",
    aboutCalc5Text:
      "Edge vertaa mallin arviota markkinan implisiittiseen todennäköisyyteen. Odotusarvo auttaa arvioimaan, onko tarjottu kerroin kiinnostava.",

    aboutCalc6Title: "6. Kelly-ehdotus",
    aboutCalc6Text:
      "Jos Kelly-tila on käytössä, panosehdotus lasketaan todennäköisyyden, kertoimen, pelikassan ja valitun Kelly-osuuden perusteella.",

    aboutFormulaTitle: "Keskeiset kaavat",
    aboutFormulaDescription:
      "Nämä kaavat kuvaavat sovelluksen keskeistä laskentalogiikkaa.",
    formulaImplied: "Implisiittinen todennäköisyys = 1 / kerroin",
    formulaFair: "Reilu kerroin = 1 / mallin todennäköisyys",
    formulaEdge:
      "Edge (%) = (mallin todennäköisyys - implisiittinen todennäköisyys) × 100",
    formulaEv:
      "Odotusarvo (%) = ((kerroin × mallin todennäköisyys) - 1) × 100",
    formulaKelly:
      "Kellyn kaava f* = (b × p - q) / b, missä b = kerroin - 1, p = todennäköisyys, q = 1 - p",
    formulaStake:
      "Panos = pelikassa × Kellyn osuus × valittu Kelly-kerroin",

    aboutExampleTitle: "Esimerkkilasku",
    aboutExampleDescription:
      "Alla on yksinkertaistettu esimerkki siitä, miten yksittäinen rivi voidaan arvioida.",
    exampleInputTitle: "Esimerkin lähtötiedot",
    exampleInputText:
      "Oletetaan, että markkina tarjoaa kotivoitolle kertoimen 2.55 ja malli arvioi todelliseksi voittotodennäköisyydeksi 40%.",
    exampleStep1: "Implisiittinen todennäköisyys = 1 / 2.55 = 0.3922 = 39.22%",
    exampleStep2: "Mallin todennäköisyys = 40.00%",
    exampleStep3: "Reilu kerroin = 1 / 0.40 = 2.50",
    exampleStep4: "Edge = (0.40 - 0.3922) × 100 = 0.78%",
    exampleStep5: "EV = ((2.55 × 0.40) - 1) × 100 = 2.00%",
    exampleStep6:
      "Jos pelikassa on 1 000 € ja käytössä on quarter Kelly, panos lasketaan Kellyn kaavalla ja siitä käytetään 25 %.",

    aboutStatusTitle: "Data, päivitys ja avoimuus",
    aboutStatusDescription:
      "Sovellus näyttää datan lähteen ja päivitystilan avoimesti sen sijaan, että ne piilotettaisiin käyttäjältä.",
    aboutStatus1: "LÄHDE kertoo, tuleeko data API:sta vai fallback-tilasta.",
    aboutStatus2: "TILA kertoo, käyttääkö näkymä välimuistia vai tuoretta dataa.",
    aboutStatus3:
      "LIVE- ja Päivitetty-merkinnät näyttävät, milloin data on viimeksi päivitetty.",
    aboutStatus4:
      "Vedonlyöntityötila pystyy päivittämään dataa toistuvasti käytön aikana.",

    aboutLimitsTitle: "Nykyiset rajoitteet",
    aboutLimitsDescription:
      "Sovellus on edelleen kehitysvaiheessa, joten on tärkeää kertoa avoimesti, mitä ei ole vielä toteutettu valmiiksi asti.",
    aboutLimit1:
      "malli on tällä hetkellä yksinkertainen eikä vielä lopullinen ennustemoottori",
    aboutLimit2:
      "live betting -toiminnot eivät vielä muodosta täyttä reaaliaikaista työkalua",
    aboutLimit3:
      "pelaaja- ja loukkaantumistason mallinnus ei ole vielä mukana laajasti",
    aboutLimit4:
      "vetohistoria tallennetaan tällä hetkellä ensisijaisesti paikallisesti eikä täytenä pilvipalveluna",
    aboutLimit5:
      "sovellus on analyysityökalu eikä takaa voitollista vedonlyöntiä",

    aboutUpdatesTitle: "Viimeisimmät päivitykset",
    aboutUpdatesDescription:
      "Tätä sivua päivitetään sovelluksen kehittyessä.",
    aboutUpdate1:
      "etusivu, vedonlyöntityöpöytä ja simulaattori erotettu omille sivuilleen",
    aboutUpdate2: "kaksikielinen käyttöliittymä lisätty",
    aboutUpdate3:
      "markkinavälilehdet lisätty H2H-, totals- ja handicap-markkinoille",
    aboutUpdate4:
      "vetohistoria sekä ROI- ja profit-seuranta lisätty",
    aboutUpdate5: "profit chart sekä panosvalinta lisätty",

    aboutNextTitle: "Mitä seuraavaksi",
    aboutNextDescription:
      "Todennäköisiä seuraavia kehitysaskeleita Scorecasterissa.",
    aboutNext1: "avoimien vetojen esikatselu etusivulle",
    aboutNext2: "bankroll-käyrä ja päiväkohtainen erittely",
    aboutNext3: "syvempi otteluanalyysi ja confidence breakdown",
    aboutNext4: "vahvempi live-päivitys ja markkinaliikkeiden seuranta",
  },
};

export function normalizeLang(lang) {
  return lang === "fi" ? "fi" : "en";
}

export function getDictionary(lang = "en") {
  return dictionaries[normalizeLang(lang)];
}
