import CalibrationLabClient from "./CalibrationLabClient";

export const metadata = {
  title: "CLV & Calibration Lab | Scorecaster",
  description: "Chronology-safe closing-line value, Brier score, log loss, reliability bins and model slices for settled paper decisions."
};

export default function CalibrationPage() {
  return <CalibrationLabClient />;
}
