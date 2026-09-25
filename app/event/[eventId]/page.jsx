import ProfessionalExplanationCard from "../../components/ProfessionalExplanationCard";
import EventContextPanel from "./EventContextPanel";
import EventDataAuditClient from "./EventDataAuditClient";
import EventDetailClient from "./EventDetailClient";
import EventJourneyOverview from "./EventJourneyOverview";
import EventMarketMicrostructurePanel from "./EventMarketMicrostructurePanel";
import EventVerifiedLiveMonitorPanel from "./EventVerifiedLiveMonitorPanel";
import FootballIndependentEvidencePanel from "./FootballIndependentEvidencePanel";
import MatchCenterV5 from "./MatchCenterV5";
import DeferredSection from "../../components/DeferredSection";
import { safeNextPath } from "../../../lib/auth-navigation.mjs";

export const metadata = {
  title: "Otteluanalyysi | Scorecaster",
  description: "Ottelun kertoimet, päätöstuki, seuranta, markkinahistoria ja varmennetut lisätiedot yhdessä näkymässä."
};

export default async function EventDetailPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const eventId = String(resolvedParams?.eventId || "");
  const sport = String(resolvedSearch?.sport || "");
  const selection = String(resolvedSearch?.selection || "");
  const returnTo = safeNextPath(resolvedSearch?.returnTo, "/events");
  const encodedEvent = encodeURIComponent(eventId);
  const encodedSport = encodeURIComponent(sport);
  const encodedSelection = encodeURIComponent(selection);
  const gamePlanHref = `/match-intelligence?eventId=${encodedEvent}&sport=${encodedSport}${selection ? `&selection=${encodedSelection}` : ""}`;
  const recommendationJourneyHref = `/journey?eventId=${encodedEvent}${selection ? `&selection=${encodedSelection}` : ""}`;

  return (
    <div className="space-y-7">
      <EventDetailClient eventId={eventId} sport={sport} initialSelection={selection} returnTo={returnTo} />

      <DeferredSection
        title={{ fi: "Ottelukeskus: vire, kokoonpanot ja kertoimet", en: "Match center: form, lineups and odds", es: "Centro del partido: forma, alineaciones y cuotas" }}
        description={{ fi: "Avaa, kun haluat tarkistaa ottelun taustatiedot päätöksen lisäksi.", en: "Open when you want match context beyond the main decision view.", es: "Abre para ver el contexto del partido además de la decisión principal." }}
      >
        <MatchCenterV5 eventId={eventId} sport={sport} selection={selection} />
      </DeferredSection>

      <DeferredSection
        title={{ fi: "Ottelun ja suosituksen historia", en: "Match and recommendation history", es: "Historial del partido y de la recomendación" }}
        description={{ fi: "Seuraa, miten kerroin, konteksti ja oma paperiseuranta muuttuvat ajan mukana.", en: "Follow how price, context and your paper tracking change over time.", es: "Sigue cómo cambian la cuota, el contexto y tu seguimiento simulado." }}
      >
        <EventJourneyOverview gamePlanHref={gamePlanHref} recommendationJourneyHref={recommendationJourneyHref} />
      </DeferredSection>

      <DeferredSection
        title={{ fi: "Lisätiedot ja syväanalyysi", en: "More details and deep analysis", es: "Más detalles y análisis profundo" }}
        description={{
          fi: "Uutiset, markkinahistoria, live-tila, riippumattomat mallit ja datan auditointi on koottu tänne, jotta varsinainen ottelupäätös pysyy selkeänä.",
          en: "News, market history, live status, independent models and data audit live here so the main match decision stays focused.",
          es: "Noticias, historial de mercado, estado en directo, modelos independientes y auditoría están aquí para mantener clara la decisión principal."
        }}
      >
        <div className="space-y-4">
          <DeferredSection title={{ fi: "Uutiset ja taustatiedot", en: "News and context", es: "Noticias y contexto" }}>
            <EventContextPanel eventId={eventId} sport={sport} />
          </DeferredSection>
          <DeferredSection title={{ fi: "Kertoimien historia", en: "Odds history", es: "Historial de cuotas" }}>
            <EventMarketMicrostructurePanel eventId={eventId} />
          </DeferredSection>
          <DeferredSection title={{ fi: "Live-tilanne", en: "Live status", es: "Estado en directo" }}>
            <EventVerifiedLiveMonitorPanel eventId={eventId} />
          </DeferredSection>
          <DeferredSection title={{ fi: "Arvion tarkka selitys", en: "Detailed explanation", es: "Explicación detallada" }}>
            <ProfessionalExplanationCard eventId={eventId} />
          </DeferredSection>
          <DeferredSection title={{ fi: "Riippumaton mallinäyttö", en: "Independent model evidence", es: "Evidencia del modelo independiente" }}>
            <FootballIndependentEvidencePanel eventId={eventId} sport={sport} selection={selection} />
          </DeferredSection>
          <DeferredSection title={{ fi: "Datan lähteet ja tekninen tarkistus", en: "Data sources and technical audit", es: "Fuentes de datos y auditoría técnica" }}>
            <EventDataAuditClient eventId={eventId} sport={sport} />
          </DeferredSection>
        </div>
      </DeferredSection>
    </div>
  );
}
