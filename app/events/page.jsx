import ProfessionalSurfaceRail from "../components/ProfessionalSurfaceRail";
import EventsClient from "./EventsClient";
import { Suspense } from "react";
import DeferredSection from "../components/DeferredSection";

export const metadata = {
  title: "Verified Events",
  description: "Open current Scorecaster events in the verified Event Detail view."
};

export default function EventsPage() {
  return (
    <div className="space-y-6">
      <Suspense><EventsClient /></Suspense>
      <DeferredSection title={{ fi: "Vertaa hintalähteitä", en: "Compare price sources", es: "Comparar fuentes de cuotas" }}>
        <ProfessionalSurfaceRail surface="events" />
      </DeferredSection>
    </div>
  );
}
