import "./globals.css";
import AppShell from "./components/AppShell";
import { LanguageProvider } from "./components/LanguageProvider";

export const metadata = {
  title: {
    default: "Scorecaster",
    template: "%s | Scorecaster"
  },
  description: "Sports decision intelligence, risk control and virtual paper tracking in Finnish, English and Spanish.",
  applicationName: "Scorecaster",
  category: "sports"
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7f1" },
    { media: "(prefers-color-scheme: dark)", color: "#07090f" }
  ]
};

const appearanceScript = `
  try {
    const stored = localStorage.getItem("scorecaster-theme");
    const preferred = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    document.documentElement.dataset.theme = stored === "light" || stored === "dark" ? stored : preferred;
  } catch (_) {
    document.documentElement.dataset.theme = "dark";
  }
`;

export default function RootLayout({ children }) {
  return (
    <html lang="fi" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: appearanceScript }} /></head>
      <body>
        <LanguageProvider>
          <AppShell>{children}</AppShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
