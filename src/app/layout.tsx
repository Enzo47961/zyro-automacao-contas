import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';

const titulo = Space_Grotesk({ subsets: ['latin'], variable: '--fonte-titulo', display: 'swap' });
const texto = Inter({ subsets: ['latin'], variable: '--fonte-texto', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Quita · Contas a pagar no automático', template: '%s · Quita' },
  description:
    'Mande o boleto, a conta ou o XML da nota fiscal no Telegram: o Quita confere o código, lê valor e vencimento, evita lançamento duplicado e lembra antes de vencer.',
  applicationName: 'Quita',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#0a2c1c', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${titulo.variable} ${texto.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
