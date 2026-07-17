import "./globals.css";
import AppShell from "./components/AppShell";

export const metadata = {
  title: {
    default: "Scorecaster",
    template: "%s | Scorecaster"
  },
  description: "Urheiluanalyysi, riskinhallinta ja virtuaalinen paperiseuranta ilman oikean rahan vedonlyöntiä."
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#020617"
};

export default function RootLayout({ children }) {
  return (
    <html lang="fi">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
