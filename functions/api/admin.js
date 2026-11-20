// Salvar como: functions/api/admin.js   (GET lista | POST ação)  — protegido por ADMIN_TOKEN
import { json, UM_ANO, T } from '../../lib/util.js';

const autorizado = (request, env) =>
  env.ADMIN_TOKEN && request.headers.get('Authorization') === `Bearer ${env.ADMIN_TOKEN}`;

export async function onRequestGet({ request, env }) {
  if (!autorizado(request, env)) return json({ erro: 'Não autorizado' }, 401);
  const status = new URL(request.url).searchParams.get('status') || 'em_analise';
  const { results } = await env.DB.prepare(
    `SELECT id,plano,status,nome,slogan,descricao,whatsapp,instagram,cidades,categorias,imagem_id,criado_em,pago_em,ativo_em,expira_em
     FROM ${T.cad} WHERE status=? ORDER BY criado_em ASC LIMIT 100`).bind(status).all();
  return json({ itens: results });
}

export async function onRequestPost({ request, env }) {
  if (!autorizado(request, env)) return json({ erro: 'Não autorizado' }, 401);
  const { id, acao, motivo } = await request.json();
  const agora = Date.now();
  const c = await env.DB.prepare(`SELECT plano,status FROM ${T.cad} WHERE id=?`).bind(id).first();
  if (!c) return json({ erro: 'Card não encontrado' }, 404);

  if (acao === 'aprovar') {
    // o ano dos planos pagos começa a contar AGORA (quando o card fica ativo)
    const expira = c.plano === 'gratis' ? null : agora + UM_ANO;
    await env.DB.prepare(`UPDATE ${T.cad} SET status='ativo', ativo_em=?, expira_em=?, motivo_recusa=NULL WHERE id=?`)
      .bind(agora, expira, id).run();
  } else if (acao === 'recusar' || acao === 'remover') {
    await env.DB.prepare(`UPDATE ${T.cad} SET status=?, motivo_recusa=? WHERE id=?`)
      .bind(acao === 'recusar' ? 'recusado' : 'removido', motivo || null, id).run();
  } else return json({ erro: 'Ação inválida' }, 400);
  return json({ ok: true });
}
