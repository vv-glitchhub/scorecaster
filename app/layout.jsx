import "./globals.css";
import AppShell from "./components/AppShell";

export const metadata = {
  title: "Scorecaster",
  description: "AI-powered sports intelligence platform"
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
