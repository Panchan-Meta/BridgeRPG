import "./globals.css";

export const metadata = {
  title: "PGirls Bridge",
  description: "Bridge ETH ↔ PGirls",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
