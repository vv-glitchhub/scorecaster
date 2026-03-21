export default function RootLayout({ children }) {
  return (
    <html lang="fi">
      <body style={{ margin: 0, background: "#07070f" }}>
        {children}
      </body>
    </html>
  );
}
