"use client";

import { useEffect, useState } from "react";
import UnifiedDataLedger from "../../components/UnifiedDataLedger";
import UnifiedDataHistoryClient from "../../data-layer/UnifiedDataHistoryClient";
import { EmptyState } from "../../components/ProductUI";
import { useLanguage } from "../../components/LanguageProvider";
import EventModelAuditPanel from "./EventModelAuditPanel";
import EventAdvancedSignalReadinessPanel from "./EventAdvancedSignalReadinessPanel";
import EventNhlXgGoaliePanel from "./EventNhlXgGoaliePanel";
import EventSoccerXgPoissonPanel from "./EventSoccerXgPoissonPanel";
import EventBasketballEfficiencyPanel from "./EventBasketballEfficiencyPanel";
import EventMlbPitchingOffensePanel from "./EventMlbPitchingOffensePanel";
import EventUncertaintyPanel from "./EventUncertaintyPanel";

export default function EventDataAuditClient({ eventId, sport }) {
  const { tr } = useLanguage();
  const [state, setState] = useState({ loading: true, row: null, error: "" });

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const query = new URLSearchParams({ eventId });
        if (sport) query.set("sports", sport);
        const response = await fetch(`/api/data-layer?${query}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Data audit unavailable");
        if (active) setState({ loading: false, row: payload.data?.[0] || null, error: "" });
      } catch (error) {
        if (active) setState({ loading: false, row: null, error: error instanceof Error ? error.message : "Data audit unavailable" });
      }
    }
    void load();
    return () => { active = false; };
  }, [eventId, sport]);

  if (state.loading) return <div className="sc-surface rounded-[1.5rem] p-6 text-sm text-[var(--sc-muted)]">{tr({ fi: "Kootaan AI:n data-auditointia…", en: "Building the AI data audit…", es: "Preparando la auditoría de datos…" })}</div>;
  if (!state.row?.ledger) return <EmptyState title={tr({ fi: "Yhdistettyä data-auditointia ei ole saatavilla", en: "Unified data audit is unavailable", es: "La auditoría unificada no está disponible" })} description={state.error || tr({ fi: "Puuttuvaa provider-dataa ei korvata arvauksilla.", en: "Missing provider data is not replaced with guesses.", es: "Los datos faltantes no se sustituyen con suposiciones." })} />;

  return (
    <div className="space-y-8">
      <UnifiedDataLedger ledger={state.row.ledger} />
      <EventUncertaintyPanel row={state.row} />
      <EventModelAuditPanel row={state.row} />
      <EventNhlXgGoaliePanel row={state.row} />
      <EventSoccerXgPoissonPanel row={state.row} />
      <EventBasketballEfficiencyPanel row={state.row} />
      <EventMlbPitchingOffensePanel row={state.row} />
      <EventAdvancedSignalReadinessPanel row={state.row} />
      <UnifiedDataHistoryClient compact eventId={eventId} selection={state.row.selection || ""} />
    </div>
  );
}
