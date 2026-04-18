import "./globals.css";
import AppShellNavClient from "./components/AppShellNavClient";
import { cookies } from "next/headers";
import { normalizeLang } from "@/lib/i18n";

export const metadata = {
  title: "Scorecaster",
  description: "Betting analytics and simulation workspace",
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("scorecaster_lang")?.value || "fi");

  return (
    <html lang={lang}>
      <body
        style={{
          margin: 0,
          background: "linear-gradient(180deg, #020617 0%, #001233 100%)",
          color: "#ffffff",
          minHeight: "100vh",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          overflowX: "hidden",
        }}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <AppShellNavClient lang={lang} />

          <main
            style={{
              flex: 1,
              width: "100%",
              maxWidth: "1280px",
              margin: "0 auto",
              padding: "20px 16px 40px",
              boxSizing: "border-box",
              overflowX: "hidden",
            }}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
