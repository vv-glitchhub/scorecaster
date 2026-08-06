import ProductionEvidenceClient from "./ProductionEvidenceClient";

export const metadata = {
  title: "Production Evidence | Scorecaster",
  description: "Reproducible provider, worker, fixture identity and closing-line evidence by sport and league."
};

export default function ProductionEvidencePage() {
  return <ProductionEvidenceClient />;
}
