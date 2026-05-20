import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // 1. Configura a conexão com o Neon (usando sua variável de ambiente)
  const sql = neon(process.env.DATABASE_URL);

  if (req.method === 'POST') {
    const { site } = req.body; // Pega se é 'Patos' ou 'Ita'

    try {
      // 2. Escolha a tabela certa baseada no site
      const tabela = site === 'Patos' ? 'acessos_ita' : 'acessos_patos';

      // 3. Executa o comando SQL (o nosso INSERT do Portugol)
      await sql(`INSERT INTO ${tabela} (cidade) VALUES ($1)`, [site]);

      return res.status(200).json({ message: 'Acesso registrado!' });
    } catch (error) {
      console.error('Erro no Neon:', error);
      return res.status(500).json({ error: 'Erro ao salvar no banco' });
    }
  } else {
    // Se alguém tentar entrar no link pelo navegador (GET) em vez de POST
    return res.status(405).json({ message: 'Método não permitido' });
  }
}