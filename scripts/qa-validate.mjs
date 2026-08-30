// QA: validação profunda do JSON final do ranking (mock mode).
const id = process.argv[2];
const res = await fetch(`http://localhost:3000/api/rankings/${id}`);
const r = await res.json();
const out = [];
const ok = (nome, cond, ev = '') => out.push(`${cond ? 'PASS' : 'FAIL'} | ${nome}${ev ? ' | ' + ev : ''}`);

const cands = r.categorias.flatMap((c) => c.candidatos);
ok('mock=true', r.mock === true);
ok('status concluida', r.status === 'concluida');
ok('10+ candidatos', cands.length >= 10, `n=${cands.length}`);

// Guardrail: todo achado tem evidenciaUrl OU status nao_verificavel
let semEvidencia = [];
for (const c of cands) for (const a of c.achados ?? []) {
  if (a.status !== 'nao_verificavel' && !a.evidenciaUrl) semEvidencia.push(`${c.nome}/${a.criterio}`);
}
ok('nenhum achado sem evidência (exceto nao_verificavel)', semEvidencia.length === 0, semEvidencia.slice(0,3).join(','));

// Coerência score×tier
let incoerentes = [];
for (const c of cands.filter((x) => x.status === 'concluido')) {
  if (c.score == null || c.tier == null) { incoerentes.push(`${c.nome}:sem score/tier`); continue; }
  if (c.score < 0 || c.score > 100) incoerentes.push(`${c.nome}:score ${c.score}`);
  if (c.eliminatoria && c.tier !== 'EVITAR') incoerentes.push(`${c.nome}:eliminatoria sem EVITAR`);
  if (!c.eliminatoria) {
    const baixaPegada = (c.flags ?? []).includes('pegada_digital_baixa');
    const semCnpj = (c.flags ?? []).includes('cnpj_nao_localizado');
    if (c.score >= 75 && c.tier !== 'VERIFICADO' && !semCnpj) incoerentes.push(`${c.nome}:${c.score} devia VERIFICADO`);
    if (c.score >= 50 && c.score < 75 && c.tier !== 'ATENCAO') incoerentes.push(`${c.nome}:${c.score} devia ATENCAO`);
    if (c.score < 50 && c.tier === 'EVITAR' && (baixaPegada || semCnpj)) incoerentes.push(`${c.nome}:EVITAR com ausência (regra de justiça)`);
  }
}
ok('scores coerentes com tiers e regra de justiça', incoerentes.length === 0, incoerentes.slice(0,5).join(' ; '));

const evitar = cands.filter((c) => c.tier === 'EVITAR');
ok('1+ EVITAR com eliminatória completa', evitar.some((c) => c.eliminatoria?.criterio && c.eliminatoria?.motivo && c.eliminatoria?.evidenciaUrl), evitar.map((c)=>`${c.nome}: ${c.eliminatoria?.motivo}`).join(' ; '));
const adjetivos = /(péssim|horrível|terrível|ruim demais|golpista|desonest|picaret)/i;
ok('linguagem factual no EVITAR (sem adjetivos)', !evitar.some((c) => adjetivos.test(c.eliminatoria?.motivo ?? '') || adjetivos.test(c.justificativa ?? '')));

ok('1+ doCache', cands.some((c) => c.doCache === true), `n=${cands.filter((c)=>c.doCache).length}`);
ok('1+ refinado', cands.some((c) => c.refinado === true), `n=${cands.filter((c)=>c.refinado).length}`);
ok('1+ nao_verificado', cands.some((c) => c.status === 'nao_verificado'));
const semCnpjCase = cands.find((c) => (c.flags ?? []).includes('cnpj_nao_localizado'));
ok('cnpj_nao_localizado → ATENCAO + mensagemAcao', !!semCnpjCase && semCnpjCase.tier === 'ATENCAO' && !!semCnpjCase.mensagemAcao, semCnpjCase?.nome);
ok('naoVerificavel[] presente em concluídos', cands.filter((c)=>c.status==='concluido').every((c) => Array.isArray(c.naoVerificavel)));
ok('justificativa presente e curta', cands.filter((c)=>c.status==='concluido').every((c) => c.justificativa && c.justificativa.length < 400));

// LGPD: nomes de pessoa física — heurística: procurar padrões "sócio", "Sr.", "Sra.", CPF
const json = JSON.stringify(r);
ok('LGPD: sem menção a sócio/CPF/nome de pessoa', !/s[oó]ci[oa]|CPF|\bSr\.|\bSra\./i.test(json));

// Nomes fictícios: conferir contra o seed
const fs = await import('node:fs');
const seed = JSON.parse(fs.readFileSync('seed/fornecedores.json', 'utf8'));
const seedNomes = new Set(Object.values(seed).flat().map((f) => (typeof f === 'string' ? f : f.nome)));
const foraDoSeed = cands.filter((c) => !seedNomes.has(c.nome));
ok('nomes vêm do seed fictício (ou gerador)', foraDoSeed.length === 0 || foraDoSeed.length < cands.length, `fora do seed: ${foraDoSeed.length}`);

// Determinismo: 2 GETs idênticos
const a = await (await fetch(`http://localhost:3000/api/rankings/${id}`)).text();
const b = await (await fetch(`http://localhost:3000/api/rankings/${id}`)).text();
ok('determinismo: 2 GETs idênticos pós-conclusão', a === b);

console.log(out.join('\n'));
console.log(`\nRESUMO: ${out.filter((l) => l.startsWith('PASS')).length} PASS / ${out.filter((l) => l.startsWith('FAIL')).length} FAIL`);
