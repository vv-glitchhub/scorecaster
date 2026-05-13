function pct(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function movementText(movement) {
  if (!movement) return null;

  const direction =
    movement.direction === "down"
      ? "laskenut"
      : movement.direction === "up"
      ? "noussut"
      : "pysynyt samana";

  return `Kerroin ${direction} ${movement.first?.toFixed(2)} → ${movement.latest?.toFixed(2)}`;
}

function confidenceFromEdge(edge = 0) {
  if (edge >= 0.08) {
    return {
      level: "Korkea",
      message: "Mahdollinen päivän pääkohde.",
    };
  }

  if (edge >= 0.05) {
    return {
      level: "Hyvä",
      message: "Positiivinen edge markkinaan nähden.",
    };
  }

  if (edge >= 0.03) {
    return {
      level: "Kohtalainen",
      message: "Pieni value-veto mahdollinen.",
    };
  }

  return {
    level: "Heikko",
    message: "Edge liian pieni vahvaan suositukseen.",
  };
}

export function generateReasoning({
  pick,
  match,
  movement = null,
}) {
  if (!pick || !match) {
    return {
      title: "Ei analyysiä",
      confidence: "Tuntematon",
      summary: "Data puuttuu.",
      bullets: [],
    };
  }

  const confidence = confidenceFromEdge(Number(pick.edge || 0));

  const bullets = [];

  bullets.push(
    `Malli arvioi todennäköisyydeksi ${pct(pick.modelProb)}`
  );

  bullets.push(
    `Markkina arvioi ${pct(pick.marketProb)}`
  );

  bullets.push(
    `Edge ${pct(pick.edge)}`
  );

  bullets.push(
    `EV ${Number(pick.ev || 0).toFixed(2)}`
  );

  if (pick.bookmaker) {
    bullets.push(
      `Paras kerroin löytyi bookkerilta ${pick.bookmaker}`
    );
  }

  if (movement) {
    const text = movementText(movement);

    if (text) {
      bullets.push(text);
    }

    if (movement.direction === "down") {
      bullets.push(
        "Markkina liikkuu tämän puolen suuntaan."
      );
    }

    if (movement.direction === "up") {
      bullets.push(
        "Markkina antaa nyt paremman hinnan kuin aiemmin."
      );
    }
  }

  if (pick.odds >= 5) {
    bullets.push(
      "Korkea kerroin kasvattaa varianssia."
    );
  }

  if (pick.odds <= 2.2) {
    bullets.push(
      "Kyseessä melko vakaa suosikkikohde."
    );
  }

  if (pick.risk?.level) {
    bullets.push(
      `Riskitaso: ${pick.risk.level}`
    );
  }

  return {
    title: `${pick.label} analyysi`,
    confidence: confidence.level,
    summary: confidence.message,
    bullets,
  };
}
