import ContextEngineClient from "./ContextEngineClient";

export const metadata = {
  title: "Context Engine | Scorecaster",
  description: "Timestamped pre-match lineup, injury, rest, travel, weather and official evidence."
};

export default function ContextPage() {
  return <ContextEngineClient />;
}
