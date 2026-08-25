import ZeroCostFootballLabClient from "./ZeroCostFootballLabClient";

export const metadata = {
  title: "Zero-Cost Football Model Lab | Scorecaster",
  description: "Research-only football xG challenger evaluation against a historical no-vig market benchmark."
};

export default function ZeroCostFootballLabPage() {
  return <ZeroCostFootballLabClient />;
}
