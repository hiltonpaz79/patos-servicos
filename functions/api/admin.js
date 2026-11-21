// Salvar como: functions/api/admin.js   (GET lista | POST ação)  — protegido por ADMIN_TOKEN
import { json, UM_ANO, T, GITHUB_REPO, cardParaJson, lerArquivoEstatico, limparNome, nomeValido, resolverFiltro } from '../../lib/util.js';

const autorizado = (request, env) =>
  env.ADMIN_TOKEN && request.headers.get('Authorization') === `Bearer ${env.ADMIN_TOKEN}`;

const b64ParaTexto = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), ch => ch.charCodeAt(0)));

const LOTE_MAX = 20;   // limite de subrequisições por chamada no plano grátis da Cloudflare

const ghApi = (env, caminho, init = {}) =>
  fetch(`https://api.github.com/repos/${GITHUB_REPO}/${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'guia-servicos-admin', 'content-type': 'application/json'
    }
  });

async function ghJson(env, caminho, init) {
  const r = await ghApi(env, caminho, init);
  if (!r.ok) throw new Error(`GitHub ${r.status} em ${caminho}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

// Arquiva vários cards num ÚNICO commit: imagens em imagens_cards/ + inserção no cadastros.json.
// Só apaga as imagens do D1 depois que o commit foi aceito.
async function arquivarLote(env, cards) {
  if (!env.GITHUB_TOKEN) throw new Error('Falta o secret GITHUB_TOKEN no projeto Pages.');
  const prontos = [];
  for (const c of cards) {
    if (c.status !== 'ativo' || !c.imagem_id) continue;
    const img = await env.DB.prepare(`SELECT tipo, dados_b64 FROM ${T.img} WHERE id=?`).bind(c.imagem_id).first();
    if (!img) continue;
    const ext = /png/.test(img.tipo) ? 'png' : /webp/.test(img.tipo) ? 'webp' : 'jpg';
    prontos.push({ c, img, caminho: `imagens_cards/${c.id}.${ext}` });
  }
  if (!prontos.length) throw new Error('Nenhum card ativo com imagem para arquivar.');

  const repo = await ghJson(env, '');
  const ref = await ghJson(env, `git/ref/heads/${repo.default_branch}`);
  const baseCommit = ref.object.sha;
  const base = await ghJson(env, `git/commits/${baseCommit}`);

  // cadastros.json atual (texto) + inserção dos novos cards no começo da lista
  const arq = await ghJson(env, 'contents/cadastros.json');
  let texto = b64ParaTexto(arq.content);
  const novos = prontos.filter(p => !texto.includes(`"id": "d1-${p.c.id}"`));
  const blocos = novos.map(p => {
    const card = cardParaJson(p.c, p.caminho);
    card.cadastro = new Date(p.c.ativo_em).toISOString().slice(0, 10);
    return JSON.stringify(card, null, 2).split('\n').map(l => '    ' + l).join('\n') + ',';
  });
  if (blocos.length) {
    const novo = texto.replace(/("cadastros"\s*:\s*\[)/, (m) => `${m}\n${blocos.join('\n')}`);
    if (novo === texto) throw new Error('Não achei a lista "cadastros" no cadastros.json.');
    JSON.parse(novo);                                   // JSON inválido? aborta antes de gravar
    texto = novo;
  }

  // cidades/categorias novas dos cards arquivados passam a constar no filtros.json
  let filtrosTexto = null;
  const pend = { cidades: [], categorias: [] };
  for (const p of prontos) {
    try {
      const fn = JSON.parse(p.c.filtros_novos || 'null');
      if (fn) for (const t of ['cidades', 'categorias']) (fn[t] || []).forEach(i => pend[t].push(i));
    } catch (_) {}
  }
  if (pend.cidades.length || pend.categorias.length) {
    const fa = await ghJson(env, 'contents/filtros.json');
    const fo = JSON.parse(b64ParaTexto(fa.content));
    let mudou = false;
    for (const t of ['cidades', 'categorias']) {
      for (const i of pend[t]) {
        if (!(fo[t] || []).some(x => x.valor === i.valor)) { (fo[t] = fo[t] || []).push({ valor: i.valor, nome: i.nome }); mudou = true; }
      }
    }
    if (mudou) filtrosTexto = JSON.stringify(fo, null, 2);
  }

  // blobs -> árvore -> commit -> branch
  const arvore = [];
  for (const p of prontos) {
    const bl = await ghJson(env, 'git/blobs', { method: 'POST', body: JSON.stringify({ content: p.img.dados_b64, encoding: 'base64' }) });
    arvore.push({ path: p.caminho, mode: '100644', type: 'blob', sha: bl.sha });
  }
  const blJson = await ghJson(env, 'git/blobs', { method: 'POST', body: JSON.stringify({ content: texto, encoding: 'utf-8' }) });
  arvore.push({ path: 'cadastros.json', mode: '100644', type: 'blob', sha: blJson.sha });
  if (filtrosTexto) {
    const blF = await ghJson(env, 'git/blobs', { method: 'POST', body: JSON.stringify({ content: filtrosTexto, encoding: 'utf-8' }) });
    arvore.push({ path: 'filtros.json', mode: '100644', type: 'blob', sha: blF.sha });
  }

  const tree = await ghJson(env, 'git/trees', { method: 'POST', body: JSON.stringify({ base_tree: base.tree.sha, tree: arvore }) });
  const nomes = prontos.map(p => p.c.nome).join(', ');
  const commit = await ghJson(env, 'git/commits', { method: 'POST', body: JSON.stringify({
    message: `Arquivar ${prontos.length} card(s) do D1: ${nomes}`.slice(0, 200), tree: tree.sha, parents: [baseCommit] }) });
  await ghJson(env, `git/refs/heads/${repo.default_branch}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });

  // commit aceito: agora enxuga o D1 (a linha fica como 'arquivado'; a imagem é apagada)
  await env.DB.batch(prontos.flatMap(p => [
    env.DB.prepare(`UPDATE ${T.cad} SET status='arquivado', imagem_id=NULL WHERE id=?`).bind(p.c.id),
    env.DB.prepare(`DELETE FROM ${T.img} WHERE id=?`).bind(p.c.imagem_id)
  ]));
  return prontos.length;
}

export async function onRequestGet({ request, env }) {
  if (!autorizado(request, env)) return json({ erro: 'Não autorizado' }, 401);
  const status = new URL(request.url).searchParams.get('status') || 'em_analise';
  const { results } = await env.DB.prepare(
    `SELECT id,plano,status,nome,slogan,descricao,whatsapp,instagram,cidades,categorias,filtros_novos,imagem_id,criado_em,pago_em,ativo_em,expira_em
     FROM ${T.cad} WHERE status=? ORDER BY criado_em ASC LIMIT 100`).bind(status).all();
  return json({ itens: results });
}

export async function onRequestPost({ request, env }) {
  if (!autorizado(request, env)) return json({ erro: 'Não autorizado' }, 401);
  const { id, acao, motivo } = await request.json();

  if (acao === 'arquivar_todos') {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ${T.cad} WHERE status='ativo' AND imagem_id IS NOT NULL ORDER BY ativo_em ASC`).all();
    if (!results.length) return json({ erro: 'Não há cards ativos no D1 para arquivar.' }, 400);
    try {
      const n = await arquivarLote(env, results.slice(0, LOTE_MAX));
      const resta = results.length - n;
      return json({ ok: true, aviso: `${n} card(s) enviados ao GitHub em 1 commit.` + (resta > 0 ? ` Restam ${resta}: clique de novo para o próximo lote.` : '') + ' O deploy leva ~1 minuto.' });
    } catch (e) { return json({ erro: String(e.message || e) }, 500); }
  }
  const agora = Date.now();
  const c = await env.DB.prepare(`SELECT * FROM ${T.cad} WHERE id=?`).bind(id).first();
  if (!c) return json({ erro: 'Card não encontrado' }, 404);

  if (acao === 'aprovar') {
    // o ano dos planos pagos começa a contar AGORA (quando o card fica ativo)
    const expira = c.plano === 'gratis' ? null : agora + UM_ANO;
    await env.DB.prepare(`UPDATE ${T.cad} SET status='ativo', ativo_em=?, expira_em=?, motivo_recusa=NULL WHERE id=?`)
      .bind(agora, expira, id).run();
  } else if (acao === 'recusar' || acao === 'remover') {
    await env.DB.prepare(`UPDATE ${T.cad} SET status=?, motivo_recusa=? WHERE id=?`)
      .bind(acao === 'recusar' ? 'recusado' : 'removido', motivo || null, id).run();
  } else if (acao === 'editar') {
    if (c.status === 'arquivado') return json({ erro: 'Card já arquivado: edite direto no cadastros.json.' }, 400);
    const corpo = await request.clone().json();
    const nome = limparNome(corpo.nome ?? c.nome).slice(0, 60) || c.nome;
    const corta = (v, n, atual) => v === undefined ? atual : (String(v).trim().slice(0, n) || null);
    const slogan = c.plano === 'gratis' ? null : corta(corpo.slogan, 80, c.slogan);
    const descricao = c.plano === 'gratis' ? null : corta(corpo.descricao, 600, c.descricao);

    const filtros = await lerArquivoEstatico(env, request, 'filtros.json');
    const cidades = JSON.parse(c.cidades), categorias = JSON.parse(c.categorias);
    const fn = { cidades: [], categorias: [] };
    for (const [tipo, lista, arr] of [['cidades', filtros.cidades, cidades], ['categorias', filtros.categorias, categorias]]) {
      for (const item of (corpo[tipo + '_novas'] || [])) {
        const i = arr.indexOf(item.valor);
        if (i < 0) continue;
        const txt = limparNome(item.nome);
        if (!nomeValido(txt)) return json({ erro: `Nome inválido: "${txt}"` }, 400);
        const r = resolverFiltro(lista, txt);          // se já existir um filtro igual, usa o existente
        arr[i] = r.valor;
        if (r.novo && !fn[tipo].some(n => n.valor === r.valor)) fn[tipo].push({ valor: r.valor, nome: r.nome });
      }
    }
    const unicos = (a) => [...new Set(a)];
    await env.DB.prepare(`UPDATE ${T.cad} SET nome=?, slogan=?, descricao=?, cidades=?, categorias=?, filtros_novos=? WHERE id=?`)
      .bind(nome, slogan, descricao, JSON.stringify(unicos(cidades)), JSON.stringify(unicos(categorias)),
        (fn.cidades.length || fn.categorias.length) ? JSON.stringify(fn) : null, id).run();
  } else if (acao === 'arquivar') {
    try { await arquivarLote(env, [c]); }
    catch (e) { return json({ erro: String(e.message || e) }, 500); }
    return json({ ok: true, aviso: 'Card enviado ao GitHub. Em ~1 minuto o deploy termina e ele volta ao catálogo (vindo do cadastros.json).' });
  } else return json({ erro: 'Ação inválida' }, 400);
  return json({ ok: true });
}
