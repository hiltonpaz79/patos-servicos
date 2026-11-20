// Salvar como: functions/api/cadastro.js   (POST /api/cadastro)
import { PLANOS, LIMITE_PREMIUM, TERMOS_VERSAO, SITE_NOME, json, paraBase64, lerArquivoEstatico, contarPremium, T } from '../../lib/util.js';

const MAX_IMG = 700 * 1024;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

async function hashIp(request) {
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + 'patos-salt'));
  return [...new Uint8Array(d)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
  const f = await request.formData();
  if (f.get('website')) return json({ ok: true });                       // honeypot anti-robô

  const plano = f.get('plano');
  if (!PLANOS[plano]) return json({ erro: 'Plano inválido.' }, 400);
  if (f.get('termos') !== 'on') return json({ erro: 'É preciso aceitar os Termos e Condições.' }, 400);

  const nome = String(f.get('nome') || '').trim();
  if (nome.length < 2 || nome.length > 60) return json({ erro: 'Informe o nome (até 60 caracteres).' }, 400);

  let zap = String(f.get('whatsapp') || '').replace(/\D/g, '');
  if (zap.length >= 12 && zap.startsWith('55')) zap = zap.slice(2);
  if (zap.length < 10 || zap.length > 11) return json({ erro: 'WhatsApp inválido. Use DDD + número.' }, 400);
  zap = '55' + zap;

  // cidades e categorias: só valores que existem no filtros.json
  const filtros = await lerArquivoEstatico(env, request, 'filtros.json');
  const okCid = new Set(filtros.cidades.map(c => c.valor));
  const okCat = new Set(filtros.categorias.map(c => c.valor));
  const cidades = [...new Set(f.getAll('cidade'))].filter(v => okCid.has(v)).slice(0, 3);
  const categorias = [...new Set(f.getAll('categoria'))].filter(v => okCat.has(v)).slice(0, 3);
  if (!cidades.length || !categorias.length) return json({ erro: 'Escolha ao menos uma cidade e um ramo.' }, 400);

  // campos extras só valem nos planos pagos
  let slogan = null, descricao = null, instagram = null;
  if (plano !== 'gratis') {
    slogan = String(f.get('slogan') || '').trim().slice(0, 80) || null;
    descricao = String(f.get('descricao') || '').trim().slice(0, 600) || null;
    let ig = String(f.get('instagram') || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '');
    if (ig && !/^[A-Za-z0-9._]{1,30}$/.test(ig)) return json({ erro: 'Instagram inválido.' }, 400);
    instagram = ig || null;
  }

  const img = f.get('imagem');
  if (!img || typeof img === 'string') return json({ erro: 'Envie a foto do card.' }, 400);
  if (!TIPOS.includes(img.type) || img.size > MAX_IMG) return json({ erro: 'Foto inválida (JPG, PNG ou WebP até 700 KB).' }, 400);

  if (plano === 'premium' && await contarPremium(env, request) >= LIMITE_PREMIUM) {
    return json({ erro: 'As vagas Premium estão esgotadas no momento. Escolha o Básico ou fale conosco.' }, 409);
  }

  // limite simples por IP: 5 cadastros em 24h
  const ipHash = await hashIp(request);
  const { results: rl } = await env.DB.prepare(`SELECT COUNT(*) n FROM ${T.cad} WHERE ip_hash=? AND criado_em>?`)
    .bind(ipHash, Date.now() - 86400000).all();
  if (rl[0].n >= 5) return json({ erro: 'Muitos cadastros por hoje. Tente novamente amanhã.' }, 429);

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const imagemId = crypto.randomUUID().replace(/-/g, '');
  const agora = Date.now();
  const status = plano === 'gratis' ? 'em_analise' : 'aguardando_pagamento';

  await env.DB.batch([
    env.DB.prepare(`INSERT INTO ${T.img} (id,tipo,dados_b64,criado_em) VALUES (?,?,?,?)`)
      .bind(imagemId, img.type, paraBase64(await img.arrayBuffer()), agora),
    env.DB.prepare(`INSERT INTO ${T.cad} (id,plano,status,nome,slogan,descricao,whatsapp,instagram,cidades,categorias,
        imagem_id,termos_versao,termos_aceite_em,ip_hash,criado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, plano, status, nome, slogan, descricao, zap, instagram, JSON.stringify(cidades), JSON.stringify(categorias),
        imagemId, TERMOS_VERSAO, agora, ipHash, agora)
  ]);

  if (plano === 'gratis') return json({ ok: true, id, pago: false });

  // ---- Mercado Pago (Checkout Pro: Pix + cartão) ----
  const origem = new URL(request.url).origin;
  const retorno = (r) => `${origem}/pagina-cadastro.html?retorno=${r}&id=${id}`;
  const valor = PLANOS[plano].preco.toFixed(2);          // a API de Ordens exige o valor como texto: "39.90"
  const r = await fetch('https://api.mercadopago.com/v1/orders', {   // API de Ordens (Checkout Pro)
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
      'content-type': 'application/json',
      'X-Idempotency-Key': crypto.randomUUID()
    },
    body: JSON.stringify({
      type: 'online',
      processing_mode: 'manual',                          // valor obrigatório para Checkout Pro
      total_amount: valor,
      external_reference: id,
      description: `${SITE_NOME} - Plano ${PLANOS[plano].nome} (12 meses)`,
      items: [{ title: `${SITE_NOME} - Plano ${PLANOS[plano].nome} (12 meses)`, unit_price: valor, quantity: 1 }],
      config: {
        online: {
          success_url: retorno('sucesso'),
          pending_url: retorno('pendente'),
          failure_url: retorno('falha'),
          auto_return: 'approved'
        },
        payment_method: { not_allowed_types: ['ticket', 'debit_card'] }   // fica Pix + cartão de crédito (+ saldo MP)
      }
    })
  });
  if (!r.ok) {
    console.error('MP order', r.status, await r.text());
    return json({ erro: 'Não foi possível abrir o pagamento agora. Tente novamente em instantes.' }, 502);
  }
  const ordem = await r.json();
  // guarda o ID da ordem: o webhook só confirma se a ordem notificada for esta
  await env.DB.prepare(`UPDATE ${T.cad} SET pagamento_id=? WHERE id=?`).bind(ordem.id, id).run();
  return json({ ok: true, id, pago: true, url_pagamento: ordem.checkout_url });
}
