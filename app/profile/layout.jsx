import { ProfessionalProfileRail } from "../components/ProfessionalSurfaceRail";

export default function ProfileLayout({ children }) {
  return (
    <div className="space-y-8">
      <ProfessionalProfileRail />
      {children}
    </div>
  );
}
