import SimulatorClient from "./SimulatorClient";

export const metadata = {
  title: "Simulaattori",
  description: "Toistettava ja validoitu ottelusimulaattori epävarmuusväleineen."
};

export default function SimulatorPage() {
  return <SimulatorClient />;
}
