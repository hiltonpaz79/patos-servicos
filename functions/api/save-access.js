// Cloudflare Pages Function  ->  responde em  /api/save-access
// Conta no máximo 1 acesso por visitante por dia (quem controla isso é o script.js).
// Aqui só somamos +1 na linha do dia/site da tabela acessos_diarios (banco D1, ligado como env.DB).
// Este arquivo é IGUAL no Patos e no Ita.

// Sites aceitos. Qualquer outro valor é recusado (evita lixo no banco).
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

// Resumo do erro, para achar o problema sem expor detalhes do banco
function codigoDoErro(error) {
  const msg = String((error && error.message) || error);
  if (/no such table/i.test(msg)) return 'sem_tabela';
  if (/no such column|has no column/i.test(msg)) return 'sem_coluna';
  if (/ON CONFLICT clause does not match/i.test(msg)) return 'sem_chave';
  if (/D1_ERROR/i.test(msg)) return 'd1_erro';
  return 'erro';
}

// Data de hoje no horário da Paraíba (AAAA-MM-DD), não no UTC do servidor
const hojeNaParaiba = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return json({ message: 'Método não permitido.' }, 405);

  let body = {};
  try { body = await request.json(); } catch { body = {}; }
  const site = body && body.site;
  if (!SITES.includes(site)) return json({ message: 'Site inválido.' }, 400);

  if (!env.DB) return json({ message: 'Banco não configurado.', codigo: 'sem_binding' }, 500);

  try {
    // Uma linha por dia e por site: cria com 1 acesso ou soma +1 se a linha já existe.
    await env.DB
      .prepare(
        `INSERT INTO acessos_diarios (data, site, total)
         VALUES (?1, ?2, 1)
         ON CONFLICT (data, site) DO UPDATE SET total = total + 1`
      )
      .bind(hojeNaParaiba(), site)
      .run();

    return json({ message: 'Acesso registrado!' });
  } catch (error) {
    console.error('Erro ao registrar acesso:', error);
    return json({ message: 'Erro ao registrar acesso.', codigo: codigoDoErro(error) }, 500);
  }
}
