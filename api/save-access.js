import { neon } from '@neondatabase/serverless';

// Sites aceitos. Qualquer outro valor é recusado (evita lixo no banco).
const SITES = ['Patos', 'Ita'];

export default async function handler(req, res) {
  // Permite chamar a API a partir de outro endereço (app/APK, domínio próprio) e
  // responde ao "preflight" que o navegador faz antes do POST com JSON.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

  // O corpo normalmente já chega como objeto; se vier como texto, converte.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const site = body && body.site;
  if (!SITES.includes(site)) return res.status(400).json({ error: 'Site inválido' });

  try {
    const sql = neon(process.env.DATABASE_URL);

    // Uma linha por dia e por site: cria com 1 acesso ou soma +1 se a linha já existe.
    // O "dia" segue o horário da Paraíba (e não o UTC do servidor).
    await sql`
      INSERT INTO acessos_diarios (data, site, total)
      VALUES ((now() AT TIME ZONE 'America/Fortaleza')::date, ${site}, 1)
      ON CONFLICT (data, site) DO UPDATE SET total = acessos_diarios.total + 1
    `;

    return res.status(200).json({ message: 'Acesso registrado!' });
  } catch (error) {
    console.error('Erro no Neon:', error);
    return res.status(500).json({ error: 'Erro ao salvar no banco' });
  }
}
