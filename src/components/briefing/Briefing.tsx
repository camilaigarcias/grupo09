'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CATEGORIAS,
  FAMILIAS,
  TIPOS_EVENTO,
  categoriaLabel,
  mapearCategorias,
  type ChecklistRespostas,
  type TipoEvento,
} from '@/lib/categorias';
import { DEFAULT_CITY } from '@/lib/config';
import type { CriarRankingBody, CriarRankingResponse } from '@/lib/types';
import Paywall from './Paywall';

type Modo = 'intro' | 'checklist' | 'atalho' | 'revisao';

interface Estado {
  tipo: TipoEvento | null;
  pessoas: ChecklistRespostas['pessoas'] | null;
  local: ChecklistRespostas['local'] | null;
  formato: ChecklistRespostas['formato'] | null;
  comida: ChecklistRespostas['comida'];
  semComida: boolean;
  veg: boolean;
  bebidaMusica: ChecklistRespostas['bebidaMusica'];
  palco: boolean;
  estrangeiro: boolean;
  pcd: boolean;
  marcaRegistro: ChecklistRespostas['marcaRegistro'];
  logistica: ChecklistRespostas['logistica'];
  inclusos: string[];
}

const ESTADO_INICIAL: Estado = {
  tipo: null,
  pessoas: null,
  local: null,
  formato: null,
  comida: [],
  semComida: false,
  veg: true,
  bebidaMusica: [],
  palco: false,
  estrangeiro: false,
  pcd: false,
  marcaRegistro: [],
  logistica: [],
  inclusos: [],
};

const TOTAL_PASSOS = 10;

// Pergunta 10: o que o espaço costuma incluir (desliga categorias — não cotar em dobro).
const OPCOES_INCLUSOS: Array<{ id: string; label: string }> = [
  { id: 'limpeza', label: 'Limpeza' },
  { id: 'seguranca', label: 'Segurança' },
  { id: 'audio_video', label: 'Som e projetor' },
  { id: 'mobiliario', label: 'Mobiliário' },
  { id: 'buffet', label: 'O espaço exige o buffet da casa' },
];

export default function Briefing() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>('intro');
  const [passo, setPasso] = useState(1);
  const [e, setE] = useState<Estado>(ESTADO_INICIAL);
  const [cidade, setCidade] = useState(DEFAULT_CITY);
  const [desligadas, setDesligadas] = useState<Set<string>>(new Set());
  const [catDireta, setCatDireta] = useState('buffet');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Etapa paywall: pesquisa "travada" aguardando o desbloqueio (pagamento
  // simulado). O POST /api/rankings só acontece depois do onPagar.
  const [paywallPendente, setPaywallPendente] = useState<{
    categorias: string[];
    avisos: string[];
  } | null>(null);

  const respostas: ChecklistRespostas | null = useMemo(() => {
    if (!e.tipo || !e.pessoas || !e.local || !e.formato) return null;
    return {
      tipo: e.tipo,
      pessoas: e.pessoas,
      local: e.local,
      formato: e.formato,
      comida: e.semComida ? [] : e.comida,
      bebidaMusica: e.bebidaMusica,
      palco: e.palco,
      publicoEstrangeiro: e.estrangeiro,
      acessibilidade: e.pcd,
      marcaRegistro: e.marcaRegistro,
      logistica: e.logistica,
      inclusosNoEspaco: e.inclusos,
    };
  }, [e]);

  const mapeamento = useMemo(
    () => (respostas ? mapearCategorias(respostas) : null),
    [respostas],
  );
  // Categorias que ENTRARIAM mas foram desligadas pela P10 (aparecem riscadas).
  const riscadasPelaP10 = useMemo(() => {
    if (!respostas) return [];
    const cheio = mapearCategorias({ ...respostas, inclusosNoEspaco: [] });
    return cheio.categorias.filter((c) => !mapeamento!.categorias.includes(c));
  }, [respostas, mapeamento]);

  const selecionadas = useMemo(
    () => (mapeamento ? mapeamento.categorias.filter((c) => !desligadas.has(c)) : []),
    [mapeamento, desligadas],
  );

  function toggle<T extends string>(lista: T[], item: T): T[] {
    return lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item];
  }

  function podeAvancar(): boolean {
    switch (passo) {
      case 1: return e.tipo != null;
      case 2: return e.pessoas != null;
      case 3: return e.local != null;
      case 4: return e.formato != null;
      case 5: return e.semComida || e.comida.length > 0;
      default: return true; // 6–10 são opcionais
    }
  }

  async function pesquisar(categorias: string[], avisos: string[]) {
    if (categorias.length === 0 || !cidade.trim()) {
      // Nunca deve acontecer (CTAs validam antes do paywall) — mas se um
      // refactor quebrar isso, sinaliza em vez de travar o paywall em silêncio.
      setErro('Escolha ao menos uma categoria e informe a cidade antes de pesquisar.');
      setPaywallPendente(null);
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const body: CriarRankingBody = { cidade: cidade.trim(), categorias, avisos };
      const res = await fetch('/api/rankings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as CriarRankingResponse;
      router.push(`/pesquisa/${json.id}`);
    } catch {
      setErro('Não conseguimos iniciar a pesquisa. Verifique a conexão e tente de novo.');
      setEnviando(false);
      // Falhou depois do "pagamento": volta para a tela anterior com o aviso.
      setPaywallPendente(null);
    }
  }

  function abrirPaywallDoChecklist() {
    if (!mapeamento) return;
    const avisos = [...mapeamento.avisos];
    if (e.veg && !e.semComida && e.comida.length > 0) {
      avisos.push(
        'Briefing alimentar: incluir opção vegetariana/vegana ao cotar — praticamente obrigatório em evento corporativo.',
      );
    }
    setErro(null);
    setPaywallPendente({ categorias: selecionadas, avisos });
  }

  /* ---------- telas ---------- */

  if (paywallPendente) {
    const pendente = paywallPendente;
    return (
      <div className="container">
        <Paywall
          cidade={cidade.trim()}
          categoriasLabels={pendente.categorias.map((c) => categoriaLabel(c))}
          onPagar={() => void pesquisar(pendente.categorias, pendente.avisos)}
          onVoltar={() => setPaywallPendente(null)}
        />
      </div>
    );
  }

  if (modo === 'intro') {
    return (
      <div className="container">
        <h1>Monte a lista certa de fornecedores para seu evento</h1>
        <p className="lede">
          Responda 10 perguntas rápidas. Nós pesquisamos, verificamos a reputação de cada
          fornecedor em fontes públicas e entregamos um ranking com evidências — pronto
          para anexar à sua política de compras.
        </p>
        <button
          className="btn btn-primary btn-block"
          onClick={() => {
            setModo('checklist');
            setPasso(1);
          }}
        >
          Começar pelo meu evento
        </button>
        <button className="btn-link" onClick={() => setModo('atalho')}>
          Já sei a categoria que preciso →
        </button>
      </div>
    );
  }

  if (modo === 'atalho') {
    return (
      <div className="container">
        <h1>Pesquisa rápida por categoria</h1>
        <p className="lede">
          Escolha uma categoria e a cidade — nós descobrimos e verificamos os
          fornecedores.
        </p>
        <label htmlFor="cat-direta" style={{ fontWeight: 600 }}>
          Categoria
        </label>
        <select
          id="cat-direta"
          className="card"
          style={{ width: '100%', minHeight: 44, margin: '8px 0 16px', font: 'inherit' }}
          value={catDireta}
          onChange={(ev) => setCatDireta(ev.target.value)}
        >
          {Object.entries(FAMILIAS).map(([fam, famLabel]) => (
            <optgroup key={fam} label={famLabel}>
              {CATEGORIAS.filter((c) => c.familia === fam).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <CampoCidade cidade={cidade} setCidade={setCidade} />
        {erro && <p className="note note-warn" role="alert">{erro}</p>}
        <div className="step-footer">
          <button className="btn" onClick={() => setModo('intro')}>
            ← Voltar
          </button>
          <button
            className="btn btn-primary"
            disabled={enviando || !cidade.trim()}
            onClick={() => {
              setErro(null);
              setPaywallPendente({ categorias: [catDireta], avisos: [] });
            }}
          >
            🔎 Pesquisar fornecedores
          </button>
        </div>
      </div>
    );
  }

  if (modo === 'revisao' && mapeamento) {
    const resumo = [
      TIPOS_EVENTO.find((t) => t.id === e.tipo)?.label,
      e.pessoas === 'ate50' ? 'até 50 pessoas' : e.pessoas === '50a200' ? '50–200 pessoas' : 'mais de 200 pessoas',
    ]
      .filter(Boolean)
      .join(' · ');
    const familiasComCategoria = Object.entries(FAMILIAS).filter(([fam]) =>
      mapeamento.categorias.some((c) => CATEGORIAS.find((x) => x.id === c)?.familia === fam),
    );
    return (
      <div className="container">
        <h1>
          Seu evento aciona {mapeamento.categorias.length}{' '}
          {mapeamento.categorias.length === 1 ? 'categoria' : 'categorias'}
        </h1>
        <p className="lede">{resumo}</p>
        {mapeamento.avisos.map((a) => (
          <p key={a} className="note note-warn">
            ⚠ {a}
          </p>
        ))}
        {familiasComCategoria.map(([fam, famLabel]) => (
          <section key={fam}>
            <h2 className="familia-heading">{famLabel}</h2>
            <div>
              {mapeamento.categorias
                .filter((c) => CATEGORIAS.find((x) => x.id === c)?.familia === fam)
                .map((c) => {
                  const ligada = !desligadas.has(c);
                  return (
                    <button
                      key={c}
                      className="chip"
                      aria-pressed={ligada}
                      onClick={() =>
                        setDesligadas((prev) => {
                          const nova = new Set(prev);
                          if (nova.has(c)) nova.delete(c);
                          else nova.add(c);
                          return nova;
                        })
                      }
                    >
                      {ligada ? '✔' : '—'} {categoriaLabel(c)}
                    </button>
                  );
                })}
              {riscadasPelaP10
                .filter((c) => CATEGORIAS.find((x) => x.id === c)?.familia === fam)
                .map((c) => (
                  <span key={c} className="chip chip-struck" title="O espaço já inclui">
                    {categoriaLabel(c)} — o espaço já inclui
                  </span>
                ))}
            </div>
          </section>
        ))}
        <p className="privado" style={{ marginTop: 16 }}>
          Toque numa categoria para tirar ou devolver à pesquisa.
        </p>
        <CampoCidade cidade={cidade} setCidade={setCidade} />
        {erro && <p className="note note-warn" role="alert">{erro}</p>}
        <div className="step-footer">
          <button className="btn" onClick={() => setModo('checklist')}>
            ← Voltar
          </button>
          <button
            className="btn btn-primary"
            disabled={enviando || selecionadas.length === 0 || !cidade.trim()}
            onClick={abrirPaywallDoChecklist}
          >
            {`🔎 Pesquisar fornecedores (${selecionadas.length} ${selecionadas.length === 1 ? 'categoria' : 'categorias'} · ${cidade.trim() || '—'})`}
          </button>
        </div>
      </div>
    );
  }

  /* ---------- checklist: 1 pergunta por vez ---------- */
  return (
    <div className="container">
      <div className="stepper-top">
        <span>
          Pergunta {passo} de {TOTAL_PASSOS}
        </span>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={TOTAL_PASSOS}
          aria-valuenow={passo}
          aria-label={`Pergunta ${passo} de ${TOTAL_PASSOS}`}
        >
          <div className="progress-fill" style={{ width: `${(passo / TOTAL_PASSOS) * 100}%` }} />
        </div>
      </div>

      {passo === 1 && (
        <Pergunta titulo="Que tipo de evento é?">
          {TIPOS_EVENTO.map((t) => (
            <Radio
              key={t.id}
              name="tipo"
              checked={e.tipo === t.id}
              onChange={() => setE({ ...e, tipo: t.id })}
              label={t.label}
            />
          ))}
          {e.tipo === 'feira_expositor' && (
            <p className="note note-warn">
              ⚠ <b>Feira funciona diferente.</b> Energia, internet, limpeza e mobiliário
              você contrata do <b>próprio organizador da feira</b>, pelo portal do
              expositor — não de fornecedor aberto. E a montadora do estande, ART/laudos
              de engenharia e o seguro passam a ser <b>obrigatórios</b>. Ajustamos sua
              lista por isso.
            </p>
          )}
        </Pergunta>
      )}

      {passo === 2 && (
        <Pergunta titulo="Quantas pessoas, mais ou menos?">
          <Radio name="pessoas" checked={e.pessoas === 'ate50'} onChange={() => setE({ ...e, pessoas: 'ate50' })} label="Até 50" />
          <Radio name="pessoas" checked={e.pessoas === '50a200'} onChange={() => setE({ ...e, pessoas: '50a200' })} label="De 50 a 200" />
          <Radio name="pessoas" checked={e.pessoas === '200mais'} onChange={() => setE({ ...e, pessoas: '200mais' })} label="Mais de 200" />
        </Pergunta>
      )}

      {passo === 3 && (
        <Pergunta titulo="Onde vai ser o evento?">
          <Radio
            name="local"
            checked={e.local === 'proprio'}
            onChange={() => setE({ ...e, local: 'proprio' })}
            label="No nosso escritório ou espaço da empresa"
          />
          <Radio
            name="local"
            checked={e.local === 'alugado_licenciado'}
            onChange={() => setE({ ...e, local: 'alugado_licenciado' })}
            label="Num espaço alugado que já funciona para eventos"
            hint="hotel, casa de eventos, auditório"
          />
          <Radio
            name="local"
            checked={e.local === 'externo_nao_licenciado'}
            onChange={() => setE({ ...e, local: 'externo_nao_licenciado' })}
            label="Ao ar livre ou num lugar que não é de eventos"
            hint="galpão, sítio, praça — pode exigir alvará, gerador e brigadista"
          />
        </Pergunta>
      )}

      {passo === 4 && (
        <Pergunta titulo="Presencial, online ou os dois?">
          <Radio name="formato" checked={e.formato === 'presencial'} onChange={() => setE({ ...e, formato: 'presencial' })} label="Presencial" />
          <Radio name="formato" checked={e.formato === 'online'} onChange={() => setE({ ...e, formato: 'online' })} label="Online" />
          <Radio
            name="formato"
            checked={e.formato === 'hibrido'}
            onChange={() => setE({ ...e, formato: 'hibrido' })}
            label="Híbrido"
            hint="presencial + transmissão"
          />
        </Pergunta>
      )}

      {passo === 5 && (
        <Pergunta titulo="Vai ter comida? De que tipo?">
          <Check checked={e.comida.includes('coffee')} disabled={e.semComida} onChange={() => setE({ ...e, comida: toggle(e.comida, 'coffee') })} label="Coffee break" />
          <Check checked={e.comida.includes('almoco_jantar')} disabled={e.semComida} onChange={() => setE({ ...e, comida: toggle(e.comida, 'almoco_jantar') })} label="Almoço ou jantar completo" />
          <Check checked={e.comida.includes('coquetel')} disabled={e.semComida} onChange={() => setE({ ...e, comida: toggle(e.comida, 'coquetel') })} label="Coquetel / finger food" />
          <Check checked={e.comida.includes('churrasco')} disabled={e.semComida} onChange={() => setE({ ...e, comida: toggle(e.comida, 'churrasco') })} label="Churrasco ou food truck" />
          <Check checked={e.semComida} onChange={() => setE({ ...e, semComida: !e.semComida, comida: [] })} label="Sem comida" />
          {!e.semComida && e.comida.length > 0 && (
            <Check
              checked={e.veg}
              onChange={() => setE({ ...e, veg: !e.veg })}
              label="Precisamos de opção vegetariana/vegana"
              hint="entra no briefing da cotação"
            />
          )}
        </Pergunta>
      )}

      {passo === 6 && (
        <Pergunta titulo="Bebida alcoólica? Música?">
          <Check checked={e.bebidaMusica.includes('open_bar')} onChange={() => setE({ ...e, bebidaMusica: toggle(e.bebidaMusica, 'open_bar') })} label="Open bar / bartender" />
          <Check checked={e.bebidaMusica.includes('musica')} onChange={() => setE({ ...e, bebidaMusica: toggle(e.bebidaMusica, 'musica') })} label="DJ, banda ou atração" />
          {e.bebidaMusica.includes('musica') && (
            <p className="note">
              💡 Música em evento corporativo gera taxa do <b>ECAD</b> (direitos
              autorais). Não é um fornecedor — é uma guia a pagar. Vamos lembrar você no
              relatório.
            </p>
          )}
        </Pergunta>
      )}

      {passo === 7 && (
        <Pergunta titulo="Vai ter palco ou apresentações?">
          <Check checked={e.palco} onChange={() => setE({ ...e, palco: !e.palco })} label="Palestras / apresentações" hint="som, telão, iluminação, palestrante" />
          <Check checked={e.estrangeiro} onChange={() => setE({ ...e, estrangeiro: !e.estrangeiro })} label="Público estrangeiro" hint="tradução simultânea" />
          <Check checked={e.pcd} onChange={() => setE({ ...e, pcd: !e.pcd })} label="Participantes PCD" hint="intérprete de Libras / acessibilidade" />
        </Pergunta>
      )}

      {passo === 8 && (
        <Pergunta titulo="Marca e registro do evento?">
          <Check checked={e.marcaRegistro.includes('cenografia')} onChange={() => setE({ ...e, marcaRegistro: toggle(e.marcaRegistro, 'cenografia') })} label="Decoração / cenografia" hint="backdrop, sinalização" />
          <Check checked={e.marcaRegistro.includes('brindes')} onChange={() => setE({ ...e, marcaRegistro: toggle(e.marcaRegistro, 'brindes') })} label="Brindes para os participantes" />
          <Check checked={e.marcaRegistro.includes('foto_video')} onChange={() => setE({ ...e, marcaRegistro: toggle(e.marcaRegistro, 'foto_video') })} label="Fotografia / vídeo" />
        </Pergunta>
      )}

      {passo === 9 && (
        <Pergunta titulo="Logística de pessoas?">
          <Check checked={e.logistica.includes('recepcao')} onChange={() => setE({ ...e, logistica: toggle(e.logistica, 'recepcao') })} label="Recepção / check-in" />
          <Check checked={e.logistica.includes('transporte')} onChange={() => setE({ ...e, logistica: toggle(e.logistica, 'transporte') })} label="Transporte dos participantes" />
          <Check checked={e.logistica.includes('mais_de_um_dia')} onChange={() => setE({ ...e, logistica: toggle(e.logistica, 'mais_de_um_dia') })} label="Evento de mais de 1 dia" hint="hospedagem" />
          <Check checked={e.logistica.includes('estacionamento')} onChange={() => setE({ ...e, logistica: toggle(e.logistica, 'estacionamento') })} label="Estacionamento / valet" />
        </Pergunta>
      )}

      {passo === 10 && (
        <Pergunta titulo="O que o espaço escolhido já inclui?">
          <p className="lede" style={{ fontSize: 14 }}>
            Marcamos como “já incluso” para você não cotar em dobro.
          </p>
          {OPCOES_INCLUSOS.map((o) => (
            <Check
              key={o.id}
              checked={e.inclusos.includes(o.id)}
              onChange={() => setE({ ...e, inclusos: toggle(e.inclusos, o.id) })}
              label={o.label}
            />
          ))}
        </Pergunta>
      )}

      <div className="step-footer">
        <button
          className="btn"
          onClick={() => (passo === 1 ? setModo('intro') : setPasso(passo - 1))}
        >
          ← Voltar
        </button>
        <button
          className="btn btn-primary"
          disabled={!podeAvancar()}
          onClick={() => {
            if (passo < TOTAL_PASSOS) setPasso(passo + 1);
            else {
              setDesligadas(new Set());
              setModo('revisao');
            }
          }}
        >
          {passo < TOTAL_PASSOS ? 'Continuar →' : 'Ver categorias →'}
        </button>
      </div>
    </div>
  );
}

/* ---------- blocos auxiliares ---------- */

function Pergunta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
      <legend>
        <h1 style={{ marginTop: 8 }}>{titulo}</h1>
      </legend>
      {children}
    </fieldset>
  );
}

function Radio({
  name,
  checked,
  onChange,
  label,
  hint,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="option-card">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span>
        <span className="option-label">{label}</span>
        {hint && <span className="option-hint"> ({hint})</span>}
      </span>
    </label>
  );
}

function Check({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="option-card" style={disabled ? { opacity: 0.5 } : undefined}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span>
        <span className="option-label">{label}</span>
        {hint && <span className="option-hint"> ({hint})</span>}
      </span>
    </label>
  );
}

function CampoCidade({ cidade, setCidade }: { cidade: string; setCidade: (c: string) => void }) {
  return (
    <p style={{ margin: '16px 0' }}>
      <label htmlFor="cidade" style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>
        Em que cidade?
      </label>
      <input
        id="cidade"
        className="card"
        style={{ width: '100%', minHeight: 44, font: 'inherit' }}
        value={cidade}
        onChange={(ev) => setCidade(ev.target.value)}
        placeholder="ex.: Curitiba"
        autoComplete="address-level2"
      />
    </p>
  );
}
