import type { Metadata, Viewport } from 'next';
import { APP_NAME, APP_TAGLINE, isMockMode } from '@/lib/config';
import './globals.css';

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const mock = isMockMode();
  return (
    <html lang="pt-BR">
      <body>
        {mock && (
          <div className="demo-banner" role="note">
            🧪 Modo demonstração — dados simulados de fornecedores fictícios. Conecte a
            chave de API no <code>.env</code> para pesquisar fornecedores reais.
          </div>
        )}
        <header className="site-header">
          <a className="brand" href="/">
            {APP_NAME}
          </a>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
