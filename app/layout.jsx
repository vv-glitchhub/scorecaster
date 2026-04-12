import "./globals.css";
import AppShellNav from "@/app/components/AppShellNav";

export const metadata = {
  title: "Scorecaster",
  description: "Betting analytics and simulation app",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppShellNav />
        <main
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "24px 20px",
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
