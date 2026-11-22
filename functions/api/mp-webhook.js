// Salvar como: functions/api/mp-webhook.js
// O Mercado Pago chama esta URL (evento "Order (Mercado Pago)") quando uma ordem muda de status.
import { PLANOS, T, notificar } from '../../lib/util.js';

export async function onRequest({ request, env, waitUntil }) {
  const url = new URL(request.url);
  let tipo = url.searchParams.get('type');
  let ordemId = url.searchParams.get('data.id');
  if (request.method === 'POST' && !ordemId) {
    try { const b = await request.json(); ordemId = b?.data?.id; tipo = tipo || b?.type; } catch (_) {}
  }
  if (tipo !== 'order' || !ordemId) return new Response('ok');

  // Nunca confiamos no corpo da notificação: consultamos a ordem direto no Mercado Pago
  const r = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(ordemId)}`, {
    headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` }
  });
  if (!r.ok) return new Response('retry', { status: 502 });       // o MP tenta de novo mais tarde
  const o = await r.json();

  const pago = o.status === 'processed' && o.status_detail === 'accredited';
  if (pago && o.external_reference) {
    const card = await env.DB.prepare(`SELECT plano, status, pagamento_id, nome FROM ${T.cad} WHERE id=?`)
      .bind(o.external_reference).first();
    if (card && card.status === 'aguardando_pagamento'
        && card.pagamento_id === o.id                              // é a ordem criada para este cadastro
        && parseFloat(o.total_paid_amount) >= PLANOS[card.plano].preco) {
      const res = await env.DB.prepare(`UPDATE ${T.cad} SET status='em_analise', pago_em=? WHERE id=? AND status='aguardando_pagamento'`)
        .bind(Date.now(), o.external_reference).run();
      if (res.meta?.changes) {          // só avisa uma vez, mesmo que o Mercado Pago repita a notificação
        waitUntil(notificar(env, `💰 Pagamento confirmado! Card ${PLANOS[card.plano].nome.toUpperCase()} para analisar: ${card.nome}\nAprove em: ${new URL(request.url).origin}/admin.html`));
      }
    }
  }
  return new Response('ok');
}
