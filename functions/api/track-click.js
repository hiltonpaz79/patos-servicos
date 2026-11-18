// Cloudflare Pages Function  ->  responde em  /api/track-click
// Conta cliques/cópias de links de WhatsApp e Instagram na tabela cliques_patos.
// (Este arquivo é igual no Ita; só muda o nome da tabela nas duas consultas abaixo.)
import { neon } from '@neondatabase/serverless';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (dados, status = 200) =>
  new Response(JSON.stringify(dados), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return json({ message: 'Método não permitido.' }, 405);

  let body = {};
  try { body = await request.json(); } catch { body = {}; }
  const { link, action } = body || {};

  if (typeof link !== 'string' || !link.trim()) {
    return json({ message: 'Link não fornecido.' }, 400);
  }

  // Só aceita ações conhecidas e links de WhatsApp/Instagram de tamanho razoável.
  // (evita que alguém encha a tabela com textos aleatórios)
  if (action !== 'click' && action !== 'copied') {
    return json({ message: 'Ação inválida.' }, 400);
  }
  if (link.length > 500 || !/wa\.me|instagram\.com/i.test(link)) {
    return json({ message: 'Link inválido.' }, 400);
  }

  try {
    const sql = neon(env.DATABASE_URL);

    // Incrementa o contador de cliques por link
    await sql`
      INSERT INTO cliques_patos (link, total_clicks, last_click)
      VALUES (${link}, 1, NOW())
      ON CONFLICT (link)
      DO UPDATE SET
        total_clicks = cliques_patos.total_clicks + 1,
        last_click = NOW()
    `;

    return json({ message: `Ação ${action} registrada com sucesso.`, link });
  } catch (error) {
    console.error('Erro ao registrar clique:', error);
    return json({ message: 'Erro ao registrar clique.', codigo: error.code || null }, 500);
  }
}
