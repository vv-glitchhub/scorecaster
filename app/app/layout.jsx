export const metadata = {
  title: "Scorecaster",
  description: "AI-powered sports analytics"
};

export default function RootLayout({ children }) {
  return (
    <html lang="fi">
      <body style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
