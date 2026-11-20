// Salvar como: lib/util.js  (na raiz do repositório, fora da pasta functions)
export const PLANOS = {
  gratis:  { nome: 'Grátis',  preco: 0 },
  basico:  { nome: 'Básico',  preco: 39.9 },
  premium: { nome: 'Premium', preco: 99.9 }
};
export const LIMITE_PREMIUM = 16;
export const TERMOS_VERSAO = '2026-11';
// Tabelas deste site no banco guia-servicos. No Ita Serviços: cadastros_ita / imagens_ita
export const T = { cad: 'cadastros_patos', img: 'imagens_patos' };
export const SITE_NOME = 'Patos Serviços';   // no Ita Serviços: trocar aqui

export const json = (o, status = 200, extra = {}) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...extra } });

// Todo texto de usuário que vai para innerHTML no script.js passa por aqui (evita XSS)
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function paraBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function lerArquivoEstatico(env, request, nome) {
  const r = await env.ASSETS.fetch(new URL('/' + nome, request.url));
  return r.json();
}

// Vagas Premium: conta os cards premium do cadastros.json + os do D1
export async function contarPremium(env, request) {
  const cad = await lerArquivoEstatico(env, request, 'cadastros.json');
  const fixos = (cad.cadastros || []).filter(c => c.ativo !== false && c.secao === 'premium' && (!c.expira_em || c.expira_em > Date.now())).length;
  const agora = Date.now();
  const { results } = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM ${T.cad} WHERE plano='premium' AND (
       status='em_analise' OR (status='ativo' AND expira_em > ?) OR (status='aguardando_pagamento' AND criado_em > ?))`
  ).bind(agora, agora - 86400000).all();
  return fixos + results[0].n;
}

export const UM_ANO = 365 * 86400000;
export const GITHUB_REPO = 'hiltonpaz79/patos-servicos';   // repositório que recebe os cards arquivados

export const fmtZap = (z) => { const n = z.slice(2); return `(${n.slice(0, 2)}) ${n.slice(2, n.length - 4)}-${n.slice(-4)}`; };

// Linha do D1 -> objeto no MESMO formato do cadastros.json (usado por /api/cards e pelo arquivamento)
export function cardParaJson(c, imagem) {
  const conteudo = [];
  if (c.descricao) c.descricao.split(/\n+/).filter(Boolean).forEach(p => conteudo.push({ tipo: 'texto', html: esc(p) }));
  conteudo.push({
    tipo: 'contato', rede: 'whatsapp', rotulo: fmtZap(c.whatsapp),
    url: `https://wa.me/${c.whatsapp}?text=Ol%C3%A1!%20Vim%20pelo%20Cat%C3%A1logo%20do%20${encodeURIComponent(SITE_NOME)}.`
  });
  if (c.instagram) conteudo.push({ tipo: 'contato', rede: 'instagram', rotulo: c.instagram, url: `https://www.instagram.com/${c.instagram}/` });
  conteudo.push({ tipo: 'contato', rede: 'compartilhar', rotulo: 'Cartão de Visita' });
  const card = {
    id: 'd1-' + c.id, ativo: true, secao: c.plano,
    categorias: JSON.parse(c.categorias), cidades: JSON.parse(c.cidades),
    imagem, alt: c.nome, nome: c.nome,
    ramo: c.slogan ? esc(c.slogan) : undefined, conteudo
  };
  if (c.expira_em) card.expira_em = c.expira_em;     // o script.js esconde o card quando o plano vence
  return card;
}
