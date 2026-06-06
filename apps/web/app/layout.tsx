import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Personal App Platform',
  description: 'Managed-first personal platform for web and Android.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
