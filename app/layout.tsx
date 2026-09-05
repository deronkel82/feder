import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Feder · Schreibatelier',
  description: 'Dein offenes Schreibatelier für Bücher, Figuren und Ideen.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
