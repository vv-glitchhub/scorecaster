import Link from "next/link";
import AcceptanceValidationClient from "./AcceptanceValidationClient";

export const metadata = {
  title: "Acceptance & Validation",
  description: "Production acceptance, evidence accumulation and model-versus-market validation in one Scorecaster control surface."
};

export default function AcceptanceValidationPage() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--sc-brand-border)] bg-[var(--sc-brand-soft)] p-4 text-sm text-[var(--sc-text-secondary)]">
        <strong className="text-[var(--sc-text)]">Validation Runway V1</strong>{" "}
        näyttää seuraavan aidon pregame-validointi-ikkunan ja canonical-ID-kattavuuden ilman synteettistä backfillia.{" "}
        <Link href="/validation-runway" className="font-black text-[var(--sc-brand)] underline">Avaa validation runway</Link>
      </div>
      <AcceptanceValidationClient />
    </div>
  );
}