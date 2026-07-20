import OperationsClient from "./OperationsClient";

export const metadata = {
  title: "Operations | Scorecaster",
  description: "Authenticated Scorecaster worker, queue and launch-readiness overview."
};

export default function OperationsPage() {
  return <OperationsClient />;
}
