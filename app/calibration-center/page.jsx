import CalibrationCenterV2Client from "./CalibrationCenterV2Client";

export const metadata = {
  title: "Calibration Center V2 | Scorecaster",
  description: "Consumer process-health view over real paper closing-line, calibration and model-slice evidence."
};

export default function CalibrationCenterV2Page() {
  return <CalibrationCenterV2Client />;
}
