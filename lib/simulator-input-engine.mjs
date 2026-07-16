function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function boundedNumber(value, fallback, min, max) {
  const normalized = String(value ?? "").replace(",", ".");
  const number = Number(normalized);
  if (!Number.isFinite(number)) return { value: fallback, valid: false };
  return { value: clamp(number, min, max), valid: number >= min && number <= max };
}

export function parseSimulatorFixtures(text = "", options = {}) {
  const maximumRows = Math.max(1, Math.min(Number(options.maximumRows || 32), 100));
  const lines = String(text).split(/\r?\n/);
  const fixtures = [];
  const errors = [];
  const warnings = [];

  lines.slice(0, maximumRows).forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;

    const parts = line.split(",").map((item) => item.trim());
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      errors.push(`Rivi ${lineNumber}: koti- ja vierasjoukkue tarvitaan.`);
      return;
    }

    const homeTeam = parts[0].slice(0, 80);
    const awayTeam = parts[1].slice(0, 80);
    if (homeTeam.toLowerCase() === awayTeam.toLowerCase()) {
      errors.push(`Rivi ${lineNumber}: joukkueet eivät voi olla samat.`);
      return;
    }

    const fields = [
      ["homeBaseRating", parts[2], 55, 0, 100],
      ["awayBaseRating", parts[3], 55, 0, 100],
      ["homeForm", parts[4], 0, -10, 10],
      ["awayForm", parts[5], 0, -10, 10],
      ["homeInjuries", parts[6], 0, 0, 10],
      ["awayInjuries", parts[7], 0, 0, 10],
      ["homeFatigue", parts[8], 0, 0, 10],
      ["awayFatigue", parts[9], 0, 0, 10],
      ["homeAdvantage", parts[10], 3, -15, 15]
    ];

    const fixture = { homeTeam, awayTeam };
    for (const [key, raw, fallback, min, max] of fields) {
      const parsed = boundedNumber(raw === undefined || raw === "" ? fallback : raw, fallback, min, max);
      fixture[key] = parsed.value;
      if (!parsed.valid) warnings.push(`Rivi ${lineNumber}: ${key} rajattiin välille ${min}–${max}.`);
    }

    fixture.seed = `${lineNumber}:${homeTeam}:${awayTeam}:${fixture.homeBaseRating}:${fixture.awayBaseRating}`;
    fixtures.push(fixture);
  });

  if (lines.length > maximumRows) {
    warnings.push(`Vain ensimmäiset ${maximumRows} riviä käsiteltiin.`);
  }

  return {
    fixtures,
    errors,
    warnings,
    valid: errors.length === 0 && fixtures.length > 0,
    rowCount: fixtures.length
  };
}
