import "./globals.css";
import AppShellNav from "@/app/components/AppShellNav";

export const metadata = {
  title: "Scorecaster",
  description: "Betting analytics and simulation app",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#08111f] text-white">
        <AppShellNav />
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
