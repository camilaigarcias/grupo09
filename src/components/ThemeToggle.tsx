'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'ap-theme';

// Toggle de tema (DS §3.2): dark é o principal (:root); light é opt-in via
// data-theme="light" no <html>. O script anti-FOUC no layout aplica o tema
// salvo antes do paint; aqui só alternamos e persistimos.
export default function ThemeToggle() {
  const [tema, setTema] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // Sincroniza com o que o script anti-FOUC já aplicou no <html>.
    const atual = document.documentElement.getAttribute('data-theme');
    if (atual === 'light') setTema('light');
  }, []);

  function alternar() {
    const novo = tema === 'dark' ? 'light' : 'dark';
    setTema(novo);
    if (novo === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    try {
      localStorage.setItem(STORAGE_KEY, novo);
    } catch {
      // Sem localStorage (modo privado etc.): o toggle segue funcionando na sessão.
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={alternar}
      aria-label="Alternar tema claro/escuro"
      aria-pressed={tema === 'light'}
    >
      <span aria-hidden="true">{tema === 'dark' ? '☀' : '🌙'}</span>
    </button>
  );
}
