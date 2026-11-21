// Salvar como: functions/api/cards.js   (GET /api/cards) -> devolve os cards ativos do D1 no MESMO formato do cadastros.json
import { json, contarPremium, LIMITE_PREMIUM, cardParaJson, T } from '../../lib/util.js';

export async function onRequestGet({ request, env }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM ${T.cad} WHERE status='ativo' AND (expira_em IS NULL OR expira_em > ?) ORDER BY ativo_em DESC`
  ).bind(Date.now()).all();

  const cards = results.map(c => cardParaJson(c, `/api/imagem/${c.imagem_id}`));
  // cidades/categorias novas (digitadas pelo cliente e já aprovadas) entram nos filtros automaticamente
  const novos = { cidades: new Map(), categorias: new Map() };
  for (const c of results) {
    if (!c.filtros_novos) continue;
    try {
      const fn = JSON.parse(c.filtros_novos);
      for (const tipo of ['cidades', 'categorias']) (fn[tipo] || []).forEach(i => { if (!novos[tipo].has(i.valor)) novos[tipo].set(i.valor, { valor: i.valor, nome: i.nome }); });
    } catch (_) {}
  }
  const filtros_novos = { cidades: [...novos.cidades.values()], categorias: [...novos.categorias.values()] };

  const usados = await contarPremium(env, request);
  return json({ cards, filtros_novos, vagas_premium: Math.max(0, LIMITE_PREMIUM - usados) }, 200, { 'cache-control': 'public, max-age=60' });
}
