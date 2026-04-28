export const dictionaries = {
  en: {
    brandTagline: "Betting analytics and simulation workspace",
    navDashboard: "Dashboard",
    navBetting: "Betting",
    navSimulator: "Simulator",
    navAbout: "About",
    switchToEnglish: "English",
    switchToFinnish: "Finnish",

    dashboardEyebrow: "Scorecaster Dashboard",
    dashboardTitle:
      "Cleaner home view, dedicated betting workspace and a separate simulator.",
    dashboardDescription:
      "The home page shows the most important information quickly. More detailed analysis is available on the betting page, and simulations are available on their own page.",
    openBettingWorkspace: "Open betting workspace",
    openSimulator: "Open simulator",

    disclaimerTitle: "Disclaimer",
    disclaimerDescription: "Important information about using the app.",
    disclaimerText:
      "Scorecaster is a betting analysis and tracking tool. The app does not guarantee profitable betting outcomes and does not provide financial or legal advice. All betting decisions are made at the user’s own risk.",

    topPicks: "Top Picks",
    topPicksDescription:
      "The most interesting value opportunities from the backend right now.",
    noTopPicks: "No top picks available.",
    selection: "Selection",
    edge: "Edge",
    confidence: "Confidence",
    openAnalysis: "Open analysis",

    dataSourceStatus: "Data Source Status",
    dataSourceStatusDescription:
      "Quick view of the source, freshness and match availability.",
    oddsSource: "Odds source",
    cacheStatus: "Cache status",
    matchesLoaded: "Matches loaded",
    dataReason: "Data note",

    simulatorPreview: "Simulator Preview",
    simulatorPreviewDescription: "A quick look before opening the simulator.",
    nextStep: "Next step",
    simulatorPreviewText: "Run tournament and season simulations separately",
    simulatorPreviewSubtext:
      "Simulation logic is kept separate so the betting workspace stays focused and clear.",
    goToSimulator: "Go to simulator",

    matchPreview: "Match Preview",
    matchPreviewDescription: "Lightweight match preview on the home page.",
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

    h2h: "H2H",
    totals: "Totals",
    handicap: "Handicap",

    confidenceBreakdown: "Confidence Breakdown",
    riskFlags: "Risk Flags",
    noRiskFlags: "No major risk flags detected.",
    positive: "Positive",
    negative: "Negative",

    homeWin: "Home Win",
    drawResult: "Draw",
    awayWin: "Away Win",

    savedPicks: "Saved Picks",
    noSavedPicks: "No saved picks yet.",
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
      "Etusivu näyttää tärkeimmät asiat nopeasti. Tarkempi analyysi löytyy vedonlyöntisivulta ja simulaatiot omalta sivultaan.",
    openBettingWorkspace: "Avaa vedonlyöntityöpöytä",
    openSimulator: "Avaa simulaattori",

    disclaimerTitle: "Vastuuvapaus",
    disclaimerDescription: "Tärkeä huomio sovelluksen käytöstä.",
    disclaimerText:
      "Scorecaster on vedonlyönnin analyysi- ja seurantatyökalu. Sovellus ei takaa voitollista vedonlyöntiä eikä anna taloudellista tai juridista neuvontaa. Kaikki vedonlyöntipäätökset tehdään käyttäjän omalla vastuulla.",

    topPicks: "Parhaat kohteet",
    topPicksDescription: "Backendin kiinnostavimmat value-kohteet juuri nyt.",
    noTopPicks: "Parhaita kohteita ei ole saatavilla.",
    selection: "Valinta",
    edge: "Edge",
    confidence: "Luottamus",
    openAnalysis: "Avaa analyysi",

    dataSourceStatus: "Datan tila",
    dataSourceStatusDescription:
      "Nopea näkymä datalähteeseen, tuoreuteen ja ottelumäärään.",
    oddsSource: "Kertoimien lähde",
    cacheStatus: "Välimuistin tila",
    matchesLoaded: "Ladatut ottelut",
    dataReason: "Huomio datasta",

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

    h2h: "H2H",
    totals: "Totals",
    handicap: "Handicap",

    confidenceBreakdown: "Luottamuksen erittely",
    riskFlags: "Riskiliput",
    noRiskFlags: "Merkittäviä riskilippuja ei havaittu.",
    positive: "Positiivinen",
    negative: "Negatiivinen",

    homeWin: "Kotivoitto",
    drawResult: "Tasapeli",
    awayWin: "Vierasvoitto",

    savedPicks: "Tallennetut kohteet",
    noSavedPicks: "Tallennettuja kohteita ei vielä ole.",
  },
};

export function normalizeLang(lang) {
  return lang === "fi" ? "fi" : "en";
}

export function getDictionary(lang = "en") {
  return dictionaries[normalizeLang(lang)];
}
