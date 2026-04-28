import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kelyo — Espace Commerçant',
  description: 'Gérez vos paiements, QR codes et liens de paiement Kelyo.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
