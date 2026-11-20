// Salvar como: functions/api/cards.js   (GET /api/cards) -> devolve os cards ativos do D1 no MESMO formato do cadastros.json
import { json, contarPremium, LIMITE_PREMIUM, cardParaJson, T } from '../../lib/util.js';

export async function onRequestGet({ request, env }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM ${T.cad} WHERE status='ativo' AND (expira_em IS NULL OR expira_em > ?) ORDER BY ativo_em DESC`
  ).bind(Date.now()).all();

  const cards = results.map(c => cardParaJson(c, `/api/imagem/${c.imagem_id}`));
  const usados = await contarPremium(env, request);
  return json({ cards, vagas_premium: Math.max(0, LIMITE_PREMIUM - usados) }, 200, { 'cache-control': 'public, max-age=60' });
}
