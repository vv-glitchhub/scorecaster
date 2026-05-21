import "./globals.css";
import MobileBottomNav from "@/app/components/ui/MobileBottomNav";

export const metadata = {
  title: "Scorecaster",
  description: "Vedonlyönnin analyysi- ja simulaatiotyötila",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fi">
      <body>
        {children}
        <MobileBottomNav />
      </body>
    </html>
  );
}
