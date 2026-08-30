import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Sora } from 'next/font/google';
import { APP_NAME, APP_TAGLINE, isMockMode } from '@/lib/config';
import AmbientBackground from '@/components/AmbientBackground';
import ThemeToggle from '@/components/ThemeToggle';
import './globals.css';

// Tipografia do DS (§2.3): Sora (display) + Inter (corpo) + JetBrains Mono
// (dados). São fontes variáveis — next/font baixa e serve local, sem <link>.
const sora = Sora({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

// Anti-FOUC (DS §3.1): aplica o tema salvo ANTES do primeiro paint.
// Dark é o default (:root) — só precisamos estampar o light salvo.
const themeInitScript = `(function(){try{if(localStorage.getItem('ap-theme')==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const mock = isMockMode();
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${sora.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <AmbientBackground />
        {mock && (
          <div className="demo-banner" role="note">
            ✨ Modo demonstração — dados simulados de fornecedores fictícios. Conecte a
            chave de API no <code>.env</code> para pesquisar fornecedores reais.
          </div>
        )}
        <header className="site-header">
          <a className="brand" href="/">
            {APP_NAME}
          </a>
          <ThemeToggle />
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
