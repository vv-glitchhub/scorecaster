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
    aboutTitle: "What the app does, how it calculates, and what is already live.",
    aboutDescription:
      "This page explains the purpose of the application, how the main numbers are formed, what data status means, and what features are already available.",
    aboutWhatTitle: "What Scorecaster does",
    aboutWhatDescription:
      "Scorecaster is a betting analysis and simulation workspace. It loads match data, compares market prices, highlights interesting spots, supports stake decisions, and tracks saved bets.",
    aboutWhat1: "shows a lightweight dashboard",
    aboutWhat2: "separates betting and simulation into dedicated pages",
    aboutWhat3: "loads odds and highlights market rows",
    aboutWhat4: "supports stake planning and Kelly-style suggestions",
    aboutWhat5: "tracks saved bets, profit and ROI",

    aboutCalcTitle: "How the calculations work",
    aboutCalcDescription:
      "The app uses a transparent pipeline. It does not hide the main betting terms.",
    aboutCalc1Title: "1. Market odds",
    aboutCalc1Text:
      "The app loads decimal odds from the configured source and keeps a normalized match structure for the UI.",
    aboutCalc2Title: "2. Implied probability",
    aboutCalc2Text:
      "Odds are converted into implied probability. This tells what probability the market is pricing in.",
    aboutCalc3Title: "3. Model probability",
    aboutCalc3Text:
      "The app creates a simple model probability estimate per market. This can later be replaced with a stronger model.",
    aboutCalc4Title: "4. Fair odds",
    aboutCalc4Text:
      "Fair odds are calculated from the model probability. This gives a model-based price for comparison.",
    aboutCalc5Title: "5. Edge and EV",
    aboutCalc5Text:
      "Edge compares model probability against implied probability. Expected value estimates whether the price is favorable.",
    aboutCalc6Title: "6. Kelly suggestion",
    aboutCalc6Text:
      "If Kelly mode is enabled, the stake suggestion is derived from probability, odds, bankroll and Kelly fraction.",

    aboutStatusTitle: "Data, refresh and transparency",
    aboutStatusDescription:
      "The app tries to make source and refresh status visible instead of hiding it.",
    aboutStatus1: "SOURCE tells whether the data comes from API or fallback mode.",
    aboutStatus2: "STATUS tells whether the view is using cached or fresh data.",
    aboutStatus3: "LIVE / Updated labels indicate refresh timing in the interface.",
    aboutStatus4: "The current betting workspace can refresh data repeatedly over time.",

    aboutLimitsTitle: "Current limitations",
    aboutLimitsDescription:
      "The app is still evolving, so it is better to be open about what is not fully built yet.",
    aboutLimit1: "the model is still simple and not a final predictive engine",
    aboutLimit2: "live betting is not yet a full real-time trading-style workflow",
    aboutLimit3: "player-level or injury-level modeling is not fully integrated",
    aboutLimit4: "saved bet history is currently local-first, not a full cloud account system",
    aboutLimit5: "the app is an analysis tool, not a guarantee of profitable betting",

    aboutUpdatesTitle: "Latest updates",
    aboutUpdatesDescription:
      "This page can be updated as the app evolves.",
    aboutUpdate1: "dashboard, betting workspace and simulator separated",
    aboutUpdate2: "bilingual UI support added",
    aboutUpdate3: "market tabs added for H2H, Totals and Handicap",
    aboutUpdate4: "bet history, ROI and profit tracking added",
    aboutUpdate5: "profit chart and stake flow added",

    aboutNextTitle: "What comes next",
    aboutNextDescription:
      "Likely next product steps inside Scorecaster.",
    aboutNext1: "pending bets preview on dashboard",
    aboutNext2: "bankroll curve and daily breakdown",
    aboutNext3: "deeper match analysis and confidence breakdown",
    aboutNext4: "stronger live refresh and market movement handling",
  },

  fi: {
    brandTagline: "Vedonlyönnin analyysi- ja simulaatiotyötila",

    navDashboard: "Etusivu",
    navBetting: "Vedonlyönti",
    navSimulator: "Simulaattori",
    navAbout: "Tietoa",

    switchToEnglish: "English",
    switchToFinnish: "Finnish",

    dashboardEyebrow: "Scorecaster Etusivu",
    dashboardTitle:
      "Selkeämpi etusivu, erillinen vedonlyöntityöpöytä, erillinen simulaattori.",
    dashboardDescription:
      "Etusivu näyttää vain tärkeimmät asiat nopeasti. Raskas analyysi on vedonlyöntisivulla ja simulaatiot simulaattorisivulla.",
    openBettingWorkspace: "Avaa vedonlyöntityöpöytä",
    openSimulator: "Avaa simulaattori",

    topPicks: "Parhaat kohteet",
    topPicksDescription: "Backendin parhaat value-kohteet juuri nyt.",
    noTopPicks: "Parhaita kohteita ei ole saatavilla.",

    dataSourceStatus: "Datalähteen tila",
    dataSourceStatusDescription: "Nopea näkymä lähteeseen ja välimuistiin.",
    oddsSource: "Kertoimien lähde",
    cacheStatus: "Välimuistin tila",
    matchesLoaded: "Ladatut ottelut",

    simulatorPreview: "Simulaattorin esikatselu",
    simulatorPreviewDescription: "Nopea katsaus ennen simulaattorin avaamista.",
    nextStep: "Seuraava askel",
    simulatorPreviewText: "Aja turnaus- / kausisimulaatiot erikseen",
    simulatorPreviewSubtext:
      "Pidä simulaatiologiikka erillään, jotta vedonlyöntityöpöytä pysyy fokusoituna.",
    goToSimulator: "Siirry simulaattoriin",

    matchPreview: "Otteluesikatselu",
    matchPreviewDescription: "Kevyt esikatselu etusivulla.",
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
    statusCache: "CACHE",

    live: "LIVE",
    updating: "PÄIVITTYY",
    updatedAt: "Päivitetty",
    refreshNow: "Päivitä nyt",

    bettingEyebrow: "Vedonlyöntityöpöytä",
    bettingTitle: "Täysi vedonlyöntianalyysi, kertoimien vertailu ja value-työnkulku.",
    bettingDescription:
      "Live-päivitys, market-välilehdet, EV, edge, fair odds ja Kelly-esikatselu samassa näkymässä.",

    filters: "Suodattimet",
    filtersDescription: "Laji / liiga / market-ohjaukset voivat laajentua tähän.",
    sport: "Laji",
    league: "Liiga",
    market: "Markkina",
    iceHockey: "Jääkiekko",

    onlyValueBets: "Vain arvovedot",
    showingPositiveOnly: "Näytetään vain positiivinen EV",
    showingAllRows: "Näytetään kaikki rivit",

    matches: "Ottelut",
    matchesDescription: "Napauta ottelua päivittääksesi analyysin heti.",
    noMatches: "Otteluita ei löytynyt.",
    selected: "Valittu",
    openAnalysis: "Avaa analyysi",

    selectedMatchAnalysis: "Valitun ottelun analyysi",
    selectedMatchAnalysisDescription:
      "Ottelun päänäkymä, markkinakertoimet ja mallin tulos.",
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
    valueBetsDescription: "Mallin etu verrattuna nykyisiin markkinakertoimiin.",
    noValueBets: "Arvovetorivejä ei ole saatavilla.",
    bookmaker: "Vedonvälittäjä",
    implied: "Implisiittinen",
    fair: "Reilu",
    edge: "Etu",
    ev: "EV",
    stake: "Panos",

    backendTopPicks: "Backendin top-kohteet",
    backendTopPicksDescription:
      "Arvokkaimmat kohteet ladattujen otteluiden joukosta.",
    noBackendPicks: "Backend-kohteita ei ole saatavilla.",

    bankroll: "Kassa",
    bankrollDescription: "Quarter Kelly -panosesikatselu.",
    stakingModel: "Panostusmalli",
    kellyFraction: "Kelly-osuus",
    refreshInterval: "Päivitysväli",
    quarterKelly: "Quarter Kelly",

    h2h: "H2H",
    totals: "Totalit",
    handicap: "Tasoitus",

    simulatorEyebrow: "Simulaattorityöpöytä",
    simulatorTitle:
      "Oma alue turnaus- ja kausisimulaatioille.",
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
    aboutTitle: "Mitä sovellus tekee, miten se laskee ja mitä on jo käytössä.",
    aboutDescription:
      "Tämä sivu selittää sovelluksen tarkoituksen, miten tärkeimmät luvut muodostuvat, mitä datastatus tarkoittaa ja mitä ominaisuuksia on jo käytössä.",
    aboutWhatTitle: "Mitä Scorecaster tekee",
    aboutWhatDescription:
      "Scorecaster on vedonlyönnin analyysi- ja simulaatiotyötila. Se lataa otteludataa, vertaa markkinahintoja, nostaa esiin kiinnostavia rivejä, tukee panospäätöksiä ja seuraa tallennettuja vetoja.",
    aboutWhat1: "näyttää kevyen dashboardin",
    aboutWhat2: "erottaa vedonlyönnin ja simulaation omille sivuilleen",
    aboutWhat3: "lataa kertoimia ja nostaa markkinarivejä näkyviin",
    aboutWhat4: "tukee panossuunnittelua ja Kelly-tyyppisiä ehdotuksia",
    aboutWhat5: "seuraa tallennettuja vetoja, voittoa ja ROI:ta",

    aboutCalcTitle: "Miten laskenta toimii",
    aboutCalcDescription:
      "Sovellus käyttää avointa pipelinea. Se ei piilota tärkeimpiä vedonlyöntitermejä.",
    aboutCalc1Title: "1. Markkinakertoimet",
    aboutCalc1Text:
      "Sovellus lataa desimaalikertoimet määritetystä lähteestä ja pitää normalisoidun ottelurakenteen käyttöliittymää varten.",
    aboutCalc2Title: "2. Implisiittinen todennäköisyys",
    aboutCalc2Text:
      "Kertoimet muunnetaan implisiittiseksi todennäköisyydeksi. Tämä kertoo, millaista todennäköisyyttä markkina hinnoittelee.",
    aboutCalc3Title: "3. Mallin todennäköisyys",
    aboutCalc3Text:
      "Sovellus luo yksinkertaisen malliarvion todennäköisyydestä markkinaa kohden. Tämä voidaan myöhemmin korvata vahvemmalla mallilla.",
    aboutCalc4Title: "4. Reilu kerroin",
    aboutCalc4Text:
      "Reilu kerroin lasketaan mallin todennäköisyydestä. Tämä antaa mallipohjaisen hinnan vertailua varten.",
    aboutCalc5Title: "5. Edge ja EV",
    aboutCalc5Text:
      "Edge vertaa mallin todennäköisyyttä implisiittiseen todennäköisyyteen. Odotusarvo arvioi, onko hinta edullinen.",
    aboutCalc6Title: "6. Kelly-ehdotus",
    aboutCalc6Text:
      "Jos Kelly-tila on käytössä, panosehdotus johdetaan todennäköisyydestä, kertoimesta, kassasta ja Kelly-osuudesta.",

    aboutStatusTitle: "Data, päivitys ja avoimuus",
    aboutStatusDescription:
      "Sovellus yrittää näyttää lähteen ja päivitystilan näkyvästi sen sijaan että ne piilotettaisiin.",
    aboutStatus1: "LÄHDE kertoo tuleeko data API:sta vai fallback-tilasta.",
    aboutStatus2: "TILA kertoo käyttääkö näkymä välimuistia vai tuoretta dataa.",
    aboutStatus3: "LIVE / Päivitetty -merkinnät näyttävät päivityksen ajoitusta käyttöliittymässä.",
    aboutStatus4: "Nykyinen vedonlyöntityöpöytä pystyy päivittämään dataa toistuvasti ajan kuluessa.",

    aboutLimitsTitle: "Nykyiset rajoitteet",
    aboutLimitsDescription:
      "Sovellus kehittyy edelleen, joten on parempi kertoa avoimesti mitä ei ole vielä täysin rakennettu.",
    aboutLimit1: "malli on edelleen yksinkertainen eikä vielä lopullinen ennustemoottori",
    aboutLimit2: "live betting ei ole vielä täysi reaaliaikainen trading-tyylinen workflow",
    aboutLimit3: "pelaaja- tai loukkaantumistason mallinnus ei ole vielä täysin integroituna",
    aboutLimit4: "tallennettu vetohistoria on tällä hetkellä local-first eikä täysi pilvipohjainen käyttäjäjärjestelmä",
    aboutLimit5: "sovellus on analyysityökalu, ei tae voitollisesta vedonlyönnistä",

    aboutUpdatesTitle: "Viimeisimmät päivitykset",
    aboutUpdatesDescription:
      "Tätä sivua voidaan päivittää sovelluksen kehittyessä.",
    aboutUpdate1: "dashboard, vedonlyöntityöpöytä ja simulaattori erotettu toisistaan",
    aboutUpdate2: "kaksikielinen käyttöliittymä lisätty",
    aboutUpdate3: "market-välilehdet lisätty H2H-, Totals- ja Handicap-markkinoille",
    aboutUpdate4: "vetohistoria, ROI ja profit-seuranta lisätty",
    aboutUpdate5: "profit chart ja panosflow lisätty",

    aboutNextTitle: "Mitä seuraavaksi",
    aboutNextDescription:
      "Todennäköisiä seuraavia tuoteaskelia Scorecasterin sisällä.",
    aboutNext1: "pending bets -esikatselu dashboardille",
    aboutNext2: "bankroll curve ja daily breakdown",
    aboutNext3: "syvempi otteluanalyysi ja confidence breakdown",
    aboutNext4: "vahvempi live refresh ja markkinaliikkeiden käsittely",
  },
};

export function normalizeLang(lang) {
  return lang === "fi" ? "fi" : "en";
}

export function getDictionary(lang = "en") {
  return dictionaries[normalizeLang(lang)];
}
