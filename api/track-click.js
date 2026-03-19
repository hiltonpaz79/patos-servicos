import { Client } from "pg";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método não permitido." });
  }

  const { link, action } = req.body;

  if (!link) {
    return res.status(400).json({ message: "Link não fornecido." });
  }

  if (action !== "click" && action !== "copied") {
    return res.status(400).json({ message: "Ação inválida." });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Incrementa contador de cliques por link
    await client.query(
      `
      INSERT INTO click_stats (link, total_clicks, last_click)
      VALUES ($1, 1, NOW())
      ON CONFLICT (link)
      DO UPDATE SET
        total_clicks = click_stats.total_clicks + 1,
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
    return res.status(500).json({ message: "Erro ao registrar clique." });
  } finally {
    await client.end();
  }
}