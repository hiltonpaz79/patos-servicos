// Salvar como: functions/api/cards.js   (GET /api/cards) -> devolve os cards ativos do D1 no MESMO formato do cadastros.json
import { json, esc, contarPremium, LIMITE_PREMIUM, SITE_NOME, T } from '../../lib/util.js';

const fmtZap = (z) => { const n = z.slice(2); return `(${n.slice(0, 2)}) ${n.slice(2, n.length - 4)}-${n.slice(-4)}`; };

export async function onRequestGet({ request, env }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM ${T.cad} WHERE status='ativo' AND (expira_em IS NULL OR expira_em > ?) ORDER BY ativo_em DESC`
  ).bind(Date.now()).all();

  const cards = results.map(c => {
    const conteudo = [];
    if (c.descricao) c.descricao.split(/\n+/).filter(Boolean).forEach(p => conteudo.push({ tipo: 'texto', html: esc(p) }));
    conteudo.push({
      tipo: 'contato', rede: 'whatsapp', rotulo: fmtZap(c.whatsapp),
      url: `https://wa.me/${c.whatsapp}?text=Ol%C3%A1!%20Vim%20pelo%20Cat%C3%A1logo%20do%20${encodeURIComponent(SITE_NOME)}.`
    });
    if (c.instagram) conteudo.push({ tipo: 'contato', rede: 'instagram', rotulo: c.instagram, url: `https://www.instagram.com/${c.instagram}/` });
    conteudo.push({ tipo: 'contato', rede: 'compartilhar', rotulo: 'Cartão de Visita' });
    return {
      id: 'd1-' + c.id, ativo: true, secao: c.plano,     // 'premium' ganha o selo Destaque via CSS
      categorias: JSON.parse(c.categorias), cidades: JSON.parse(c.cidades),
      imagem: `/api/imagem/${c.imagem_id}`, alt: c.nome, nome: c.nome,
      ramo: c.slogan ? esc(c.slogan) : undefined, conteudo
    };
  });

  const usados = await contarPremium(env, request);
  return json({ cards, vagas_premium: Math.max(0, LIMITE_PREMIUM - usados) }, 200, { 'cache-control': 'public, max-age=60' });
}
