// Salvar como: functions/api/imagem/[id].js   (GET /api/imagem/:id)
// Pública só se o card estiver ativo. Cards em análise só aparecem para o admin (?t=TOKEN).
import { T } from '../../../lib/util.js';

export async function onRequestGet({ params, request, env }) {
  const t = new URL(request.url).searchParams.get('t');
  const admin = env.ADMIN_TOKEN && t === env.ADMIN_TOKEN;
  const row = await env.DB.prepare(
    `SELECT i.tipo, i.dados_b64 FROM ${T.img} i LEFT JOIN ${T.cad} c ON c.imagem_id = i.id
     WHERE i.id = ? AND (? = 1 OR c.status = 'ativo')`
  ).bind(params.id, admin ? 1 : 0).first();
  if (!row) return new Response('Não encontrada', { status: 404 });

  const bin = atob(row.dados_b64);
  const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
  return new Response(bytes, {
    headers: { 'content-type': row.tipo, 'cache-control': admin ? 'no-store' : 'public, max-age=86400' }
  });
}
