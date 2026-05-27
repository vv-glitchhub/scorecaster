import "./globals.css";
import AppShell from "./components/AppShell";

export const metadata = {
  title: "Scorecaster",
  description: "AI-powered sports intelligence platform"
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
