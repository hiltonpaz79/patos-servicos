// Cloudflare Pages Function  ->  responde em  /api/track-click
// Conta cliques/cópias de links de WhatsApp e Instagram na tabela cliques (banco D1, env.DB).
// Este arquivo é IGUAL no Patos e no Ita: o site vem no corpo da chamada ("site").

const SITES = ['Patos', 'Ita'];

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

function codigoDoErro(error) {
  const msg = String((error && error.message) || error);
  if (/no such table/i.test(msg)) return 'sem_tabela';
  if (/no such column|has no column/i.test(msg)) return 'sem_coluna';
  if (/ON CONFLICT clause does not match/i.test(msg)) return 'sem_chave';
  if (/D1_ERROR/i.test(msg)) return 'd1_erro';
  return 'erro';
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return json({ message: 'Método não permitido.' }, 405);

  let body = {};
  try { body = await request.json(); } catch { body = {}; }
  const { site, link, action } = body || {};

  if (!SITES.includes(site)) return json({ message: 'Site inválido.' }, 400);
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

  if (!env.DB) return json({ message: 'Banco não configurado.', codigo: 'sem_binding' }, 500);

  try {
    // Incrementa o contador de cliques por link (e por site)
    await env.DB
      .prepare(
        `INSERT INTO cliques (site, link, total_clicks, last_click)
         VALUES (?1, ?2, 1, ?3)
         ON CONFLICT (site, link)
         DO UPDATE SET total_clicks = total_clicks + 1, last_click = ?3`
      )
      .bind(site, link, new Date().toISOString())
      .run();

    return json({ message: `Ação ${action} registrada com sucesso.`, link });
  } catch (error) {
    console.error('Erro ao registrar clique:', error);
    return json({ message: 'Erro ao registrar clique.', codigo: codigoDoErro(error) }, 500);
  }
}
