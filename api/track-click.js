import { Client } from "pg";

// Tabela de cliques DESTE site (a única linha que muda entre Patos e Ita)
const TABELA = "cliques_patos";

export default async function handler(req, res) {
  // Permite chamar a API a partir de outro endereço (app/APK, domínio próprio) e
  // responde ao "preflight" que o navegador faz antes do POST com JSON.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método não permitido." });
  }

  // O corpo normalmente já chega como objeto; se vier como texto, converte.
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { link, action } = body || {};

  if (typeof link !== "string" || !link.trim()) {
    return res.status(400).json({ message: "Link não fornecido." });
  }

  // Só aceita ações conhecidas e links de WhatsApp/Instagram de tamanho razoável.
  // (evita que alguém encha a tabela com textos aleatórios)
  if (action !== "click" && action !== "copied") {
    return res.status(400).json({ message: "Ação inválida." });
  }
  if (link.length > 500 || !/wa\.me|instagram\.com/i.test(link)) {
    return res.status(400).json({ message: "Link inválido." });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Incrementa o contador de cliques por link
    await client.query(
      `
      INSERT INTO ${TABELA} (link, total_clicks, last_click)
      VALUES ($1, 1, NOW())
      ON CONFLICT (link)
      DO UPDATE SET
        total_clicks = ${TABELA}.total_clicks + 1,
        last_click = NOW();
      `,
      [link]
    );

    return res.status(200).json({
      message: `Ação ${action} registrada com sucesso.`,
      link
    });
  } catch (error) {
    console.error("Erro ao registrar clique:", error);
    return res.status(500).json({ message: "Erro ao registrar clique.", codigo: error.code || null });
  } finally {
    await client.end().catch(() => {});
  }
}
