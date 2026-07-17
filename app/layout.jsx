import "./globals.css";
import AppShell from "./components/AppShell";
import { LanguageProvider } from "./components/LanguageProvider";

export const metadata = {
  title: {
    default: "Scorecaster",
    template: "%s | Scorecaster"
  },
  description: "Sports analysis, risk control and virtual paper tracking in Finnish, English and Spanish."
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#020617"
};

export default function RootLayout({ children }) {
  return (
    <html lang="fi" suppressHydrationWarning>
      <body>
        <LanguageProvider>
          <AppShell>{children}</AppShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
