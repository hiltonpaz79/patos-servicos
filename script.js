/* =====================================================================
   GUIA DE SERVIÇOS — script.js (igual no Patos e no Ita; só o CONFIG muda)
   1. Configuração
   2. Carregamento (cadastros.json e filtros.json) e renderização dos cards
   3. Filtros, busca e paginação
   4. Barra de filtros fixa e botão voltar ao topo
   5. Rastreamento (cliques, cópias e visitas)
   6. Cartão de visita (compartilhar)
   7. Banner rotativo (com bolinhas)
   8. Instalar app
   9. Inicialização
===================================================================== */

/* =========================
   1. CONFIGURAÇÃO
========================= */
const CONFIG = {
    cadastrosUrl: 'cadastros.json',
    filtrosUrl: 'filtros.json',   // lista de cidades e categorias dos filtros
    // ---- dados próprios de cada site (a única parte que muda entre Patos e Ita) ----
    siteNome: 'Patos Serviços',
    siteUrl: 'https://patosservicos.vercel.app',
    apiBase: '',  // vazio = a API fica no mesmo endereço do site (funciona na Vercel, na Cloudflare e em qualquer domínio)
    siteId: 'Patos',
    instaPadrao: 'patosservicos_pb',             // usado no cartão de visita se o card não tiver Instagram
    fundoCartao: 'imagens_icons/background-patos.png', // fundo do cartão de visita
    // ---- ajustes gerais ----
    itensPorPagina: 10,
    textoLongo: 90,         // parágrafos maiores que isso ficam alinhados à esquerda
    corteTolerancia: 40     // só recorta a descrição se o excesso passar de ~40px (a altura máxima fica em --corpo-max, no CSS)
};

const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Modelos de contato: no JSON basta informar "rede", "url" e "rotulo".
// Qualquer campo informado no próprio contato sobrescreve o modelo.
// alt vazio ('') = ícone decorativo: o texto do botão já diz o que ele faz.
const REDES = {
    instagram:    { classe: 'social-link instagram',   icone: '/imagens_icons/instagram.png',    alt: 'Instagram' },
    whatsapp:     { classe: 'social-link whatsapp',    icone: '/imagens_icons/whatsapp.png',     alt: 'WhatsApp' },
    compartilhar: { classe: 'social-link share-card',  icone: '/imagens_icons/compartilhar.png', alt: '', botao: true },
    link:         { classe: 'social-link' }
};

const $ = (id) => document.getElementById(id);
const filtroCategoria = $('categoryFilter');
const filtroCidade    = $('cityFilter');
const campoBusca      = $('searchBar');
const feedback        = $('feedback');
const catalogo        = $('catalog');
const btnExibirMais   = $('loadMore');
const contadorCopias  = $('copyCount');
const btnLimpar       = $('clearFilters');
const semResultados   = $('noResults');
const semResultadosTx = $('noResultsText');
const btnSemResLimpar = $('noResultsClear');
const barraFiltros    = $('filtrosBarra');
const sentinela       = $('filtrosSentinela');
const btnTopo         = $('backToTop');

let cards = [];                       // [{ dados, el, busca }]
let limiteVisivel = CONFIG.itensPorPagina;
let copyCount = 0;
let opcoesCategoria = [];             // <option> originais, já em ordem alfabética
let macros = [];                      // macrocategorias (vêm do filtros.json): { valor, nome, icone }
let macroAtual = 'all';               // macrocategoria selecionada nos ícones
const MACRO_DE = new Map();           // categoria -> macrocategoria (categoria sem macro cai em 'outros')
const macroDe = (cat) => MACRO_DE.get(cat) || 'outros';

const normalizar = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/* =========================
   2. CARREGAR E RENDERIZAR
========================= */
async function carregarJson(url) {
    const resp = await fetch(url, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`${url}: HTTP ${resp.status}`);
    return resp.json();
}

// Ordem dos cards: Premium primeiro, depois Básico, Grátis e (por último) os cards de "vagas"
const RANK = { premium: 0, basico: 1, gratis: 2, vagas: 3 };

async function carregarDados() {
    const [cad, filtros, d1] = await Promise.all([
        carregarJson(CONFIG.cadastrosUrl),
        carregarJson(CONFIG.filtrosUrl),
        carregarJson(`${CONFIG.apiBase}/api/cards`).catch(() => ({ cards: [] }))   // cards criados pelo formulário (D1); se falhar, o site segue só com o JSON
    ]);
    const agora = Date.now();
    const todos = [...(cad.cadastros || []), ...(d1.cards || [])]
        .filter(c => c.ativo !== false && (!c.expira_em || c.expira_em > agora))   // expira_em: fim do plano pago
        .sort((a, b) => (RANK[a.secao] ?? 1) - (RANK[b.secao] ?? 1));              // sort é estável: mantém a ordem dentro de cada plano
    // cidades/categorias novas vindas dos cards do formulário (já aprovados) entram nos filtros
    const extra = d1.filtros_novos || {};
    const unir = (base, novos) => {
        const tem = new Set(base.map(i => i.valor));
        return [...base, ...(novos || []).filter(i => !tem.has(i.valor))];
    };
    return {
        cadastros: todos,
        cidades: unir(filtros.cidades || [], extra.cidades),
        categorias: unir(filtros.categorias || [], extra.categorias),
        macros: filtros.macros || []
    };
}

// Acrescenta as opções do JSON ao <select> (a opção "Todas..." já está no HTML)
function preencherSelect(select, lista) {
    const frag = document.createDocumentFragment();
    lista.forEach(item => {
        const o = document.createElement('option');
        o.value = item.valor;
        o.textContent = item.nome;
        frag.appendChild(o);
    });
    select.appendChild(frag);
}

function criar(tag, classe) {
    const n = document.createElement(tag);
    if (classe) n.className = classe;
    return n;
}

function criarBloco(e) {
    if (e.tipo === 'texto_solto') {
        const t = document.createElement('template');
        t.innerHTML = e.html;
        return t.content;
    }
    const n = criar(e.tag || 'p', e.classe);
    if (e.html != null) n.innerHTML = e.html;
    if (n.tagName === 'P' && n.textContent.length > CONFIG.textoLongo) n.classList.add('texto-longo');
    return n;
}

function criarContato(c) {
    const p = { ...REDES[c.rede || 'link'], ...c };
    const wrap = criar('div', 'social');

    if (c.tipo === 'social_html') { wrap.innerHTML = c.html; return wrap; }

    const raiz = criar(p.botao ? 'button' : 'a', p.classe);
    if (!p.botao) {
        raiz.setAttribute('href', p.url);
        raiz.setAttribute('target', p.target ?? '_blank');
    }
    if (p.icone) {
        const img = criar('img', 'social-icon');
        img.setAttribute('src', p.icone);
        if (p.alt != null) img.setAttribute('alt', p.alt);
        raiz.appendChild(img);
    }
    const span = document.createElement('span');
    span.textContent = p.rotulo;
    raiz.appendChild(span);
    wrap.appendChild(raiz);
    return wrap;
}

/* ---- Card compacto (padrão) <-> completo ---- */
const NOMES_CATEGORIA = new Map();   // valor -> nome: serve de "ramo" quando o card não tem slogan

// Estrelas: só aparecem se o card tiver "nota" (e, opcionalmente, "avaliacoes") no JSON/banco. Ex.: "nota": 4.8, "avaliacoes": 124
function criarEstrelas(d) {
    const nota = Number(d.nota);
    if (d.nota == null || !isFinite(nota)) return null;
    const n = Math.max(0, Math.min(5, nota));
    const box = criar('div', 'estrelas');
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', `Nota ${n.toFixed(1).replace('.', ',')} de 5`);
    const icones = criar('span', 'estrelas-icones');
    icones.textContent = '★★★★★';
    icones.style.setProperty('--nota', n);
    icones.setAttribute('aria-hidden', 'true');
    const texto = criar('span', 'estrelas-texto');
    texto.textContent = n.toFixed(1).replace('.', ',') + (d.avaliacoes ? ` (${d.avaliacoes})` : '');
    box.append(icones, texto);
    return box;
}

// Botões pequenos de WhatsApp e Instagram do card compacto (o texto fica direto no <a>, sem <span>,
// para o cartão de visita continuar lendo o número/@ do contato completo)
function criarAcoesCompactas(contatos) {
    const wrap = criar('div', 'card-acoes');
    const ordem = { whatsapp: 0, instagram: 1 };           // WhatsApp sempre primeiro
    [...contatos].sort((x, y) => (ordem[x.rede] ?? 9) - (ordem[y.rede] ?? 9)).forEach(c => {
        if (c.tipo !== 'contato' || !c.url || (c.rede !== 'whatsapp' && c.rede !== 'instagram')) return;
        if (wrap.querySelector(`.${c.rede}`)) return;          // no máximo 1 botão de cada rede (o card completo mostra todos os contatos)
        const p = { ...REDES[c.rede], ...c };
        const a = criar('a', `${p.classe} acao-compacta`);
        a.setAttribute('href', c.url);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener');
        const img = criar('img', 'social-icon');
        img.setAttribute('src', p.icone);
        img.setAttribute('alt', '');
        a.append(img, c.rede === 'whatsapp' ? 'WhatsApp' : 'Instagram');
        wrap.appendChild(a);
    });
    return wrap.children.length ? wrap : null;
}

function criarBotaoCompacto() {
    const b = criar('button', 'card-toggle');
    b.type = 'button';
    b.setAttribute('aria-expanded', 'false');
    b.textContent = 'Exibir completo';
    return b;
}

function iniciarCompactar() {
    catalogo.addEventListener('click', (e) => {
        const botao = e.target.closest('.card-toggle');
        if (!botao) return;
        const card = botao.closest('.item');
        const abrir = card.classList.contains('compacto');
        card.classList.toggle('compacto', !abrir);
        botao.setAttribute('aria-expanded', abrir ? 'true' : 'false');
        botao.textContent = abrir ? 'Exibir menos' : 'Exibir completo';
        // ao recolher, se o topo do card ficou acima da tela, traz ele de volta à vista
        if (!abrir && card.getBoundingClientRect().top < 0) {
            card.scrollIntoView({ block: 'nearest', behavior: reduzirMovimento ? 'auto' : 'smooth' });
        }
    });
}

function criarCard(d) {
    const card = criar('div', 'item compacto');     // todo card nasce compacto; "Exibir completo" expande
    card.dataset.category = d.categorias.join(',');
    card.dataset.city = d.cidades.join(',');
    card.dataset.id = d.id;
    if (d.secao) card.dataset.secao = d.secao;   // premium ganha destaque via CSS

    if (d.imagem) {
        const img = document.createElement('img');
        img.setAttribute('src', d.imagem);
        img.setAttribute('alt', d.alt || d.nome);
        img.loading = 'lazy';          // só baixa a imagem quando o card aparece
        img.decoding = 'async';
        card.appendChild(img);
    }
    (d.topo || []).forEach(e => card.appendChild(criarBloco(e)));

    const h3 = document.createElement('h3');
    if (d.nome_html) h3.innerHTML = d.nome_html; else h3.textContent = d.nome;
    card.appendChild(h3);

    // ramo: o slogan do card; se não tiver, o nome da 1ª categoria
    const ramo = document.createElement('strong');
    if (d.ramo) ramo.innerHTML = d.ramo;
    else ramo.textContent = NOMES_CATEGORIA.get((d.categorias || [])[0]) || '';
    if (ramo.textContent) card.appendChild(ramo);

    const estrelas = criarEstrelas(d);
    if (estrelas) card.appendChild(estrelas);
    const acoes = criarAcoesCompactas(d.conteudo || []);
    if (acoes) card.appendChild(acoes);

    // A descrição (tudo antes do 1º contato) fica numa caixa; os contatos completos só aparecem no card expandido.
    let corpo = null;
    let chegouContato = false;
    (d.conteudo || []).forEach(e => {
        const ehContato = e.tipo === 'contato' || e.tipo === 'social_html';
        if (ehContato) {
            chegouContato = true;
            card.appendChild(criarContato(e));
        } else if (chegouContato) {
            card.appendChild(criarBloco(e));
        } else {
            if (!corpo) {
                corpo = criar('div', 'card-corpo');
                card.appendChild(corpo);
            }
            corpo.appendChild(criarBloco(e));
        }
    });
    card.appendChild(criarBotaoCompacto());
    return card;
}

function renderizarCards(lista) {
    const frag = document.createDocumentFragment();
    cards = lista.map(dados => {
        const el = criarCard(dados);
        frag.appendChild(el);
        return { dados, el, busca: normalizar(el.textContent.replace('Exibir completo', '')) };
    });
    catalogo.replaceChildren(frag);
}

/* =========================
   3. FILTROS, BUSCA, PAGINAÇÃO
========================= */
let timersAnimacao = [];

function animarVisiveis(visiveis) {
    timersAnimacao.forEach(clearTimeout);
    timersAnimacao = [];
    cards.forEach(c => c.el.classList.remove('show'));
    visiveis.forEach((c, i) => {
        if (reduzirMovimento) { c.el.classList.add('show'); return; }
        timersAnimacao.push(setTimeout(() => c.el.classList.add('show'), Math.min(i, 8) * 80));
    });
}

function aplicarFiltros() {
    const categoria = filtroCategoria.value;
    const cidade    = filtroCidade.value;
    const texto     = normalizar(campoBusca.value).trim();
    const filtrando = categoria !== 'all' || cidade !== 'all' || texto !== '' || macroAtual !== 'all';

    // banner só aparece na tela inicial "limpa"
    const banner = document.querySelector('.banner');
    if (banner) banner.style.display = filtrando ? 'none' : 'block';

    if (!filtrando) limiteVisivel = Math.max(limiteVisivel, CONFIG.itensPorPagina);

    const correspondentes = cards.filter(c =>
        (macroAtual === 'all' || c.dados.categorias.some(cat => macroDe(cat) === macroAtual)) &&
        (categoria === 'all' || c.dados.categorias.includes(categoria)) &&
        (cidade === 'all'    || c.dados.cidades.includes(cidade)) &&
        c.busca.includes(texto)
    );
    const conjunto = new Set(correspondentes);
    const exibidos = filtrando ? correspondentes : correspondentes.slice(0, limiteVisivel);
    const exibSet = new Set(exibidos);

    cards.forEach(c => {
        c.el.classList.toggle('hidden', !conjunto.has(c));
        c.el.style.display = exibSet.has(c) ? '' : 'none';   // '' = usa o display do CSS (grade no compacto, bloco no completo)
    });

    if (btnExibirMais) {
        btnExibirMais.classList.toggle('hidden-btn', filtrando || correspondentes.length <= limiteVisivel);
    }

    const n = correspondentes.length;
    feedback.textContent = !filtrando
        ? 'Exibindo todos os serviços'
        : `Exibindo ${n} ${n === 1 ? 'item' : 'itens'}`;

    if (btnLimpar) btnLimpar.classList.toggle('hidden-btn', !filtrando);

    if (semResultados) {
        const vazio = n === 0;
        semResultados.classList.toggle('hidden-btn', !vazio);
        if (vazio) {
            const termo = campoBusca.value.trim();
            semResultadosTx.textContent = termo
                ? `Nenhum resultado para “${termo}”.`
                : 'Nenhum resultado encontrado.';
        }
    }

    animarVisiveis(exibidos);
}

function limparFiltros() {
    macroAtual = 'all';
    marcarMacro();
    filtroCidade.value = 'all';
    atualizarCategoriasPorCidade();
    filtroCategoria.value = 'all';
    campoBusca.value = '';
    limiteVisivel = CONFIG.itensPorPagina;
    aplicarFiltros();
}

function atualizarCategoriasPorCidade() {
    const cidade = filtroCidade.value;
    const disponiveis = new Set();
    cards.forEach(c => {
        if (cidade === 'all' || c.dados.cidades.includes(cidade)) {
            c.dados.categorias.forEach(cat => { if (macroAtual === 'all' || macroDe(cat) === macroAtual) disponiveis.add(cat); });
        }
    });
    const atual = filtroCategoria.value;
    filtroCategoria.replaceChildren(
        ...opcoesCategoria
            .filter(o => o.value === 'all' || disponiveis.has(o.value))
            .map(o => o.cloneNode(true))
    );
    if ([...filtroCategoria.options].some(o => o.value === atual)) filtroCategoria.value = atual;
}

function prepararOpcoesCategoria() {
    const todas = Array.from(filtroCategoria.options);
    const primeira = todas.find(o => o.value === 'all');
    const outras = todas.filter(o => o.value !== 'all')
        .sort((a, b) => a.text.localeCompare(b.text, 'pt-BR'));
    opcoesCategoria = primeira ? [primeira, ...outras] : outras;
}

function iniciarFiltros() {
    prepararOpcoesCategoria();
    atualizarCategoriasPorCidade();

    filtroCategoria.addEventListener('change', () => { limiteVisivel = CONFIG.itensPorPagina; aplicarFiltros(); });
    filtroCidade.addEventListener('change', () => {
        atualizarCategoriasPorCidade();
        limiteVisivel = CONFIG.itensPorPagina;
        aplicarFiltros();
    });
    let t;
    campoBusca.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => { limiteVisivel = CONFIG.itensPorPagina; aplicarFiltros(); }, 150);
    });
    if (btnLimpar) btnLimpar.addEventListener('click', limparFiltros);
    if (btnSemResLimpar) btnSemResLimpar.addEventListener('click', limparFiltros);
    if (btnExibirMais) {
        btnExibirMais.addEventListener('click', () => {
            limiteVisivel += CONFIG.itensPorPagina;
            aplicarFiltros();
        });
    }
}

/* ---- Macrocategorias (ícones acima da lista; ícones da biblioteca Lucide) ---- */
function marcarMacro() {
    document.querySelectorAll('#macros .macro-chip').forEach(b =>
        b.setAttribute('aria-pressed', b.dataset.macro === macroAtual ? 'true' : 'false'));
}

// Só aparecem as macrocategorias que têm pelo menos um card
function renderizarMacros() {
    const box = $('macros');
    if (!box) return;
    const presentes = new Set();
    cards.forEach(c => c.dados.categorias.forEach(cat => presentes.add(macroDe(cat))));
    const lista = macros.filter(m => presentes.has(m.valor));
    if (presentes.has('outros') && !lista.some(m => m.valor === 'outros')) lista.push({ valor: 'outros', nome: 'Outros', icone: 'ellipsis' });
    if (macroAtual !== 'all' && !lista.some(m => m.valor === macroAtual)) macroAtual = 'all';
    box.hidden = lista.length < 2;
    box.replaceChildren(...lista.map(m => {
        const b = criar('button', 'macro-chip');
        b.type = 'button';
        b.dataset.macro = m.valor;
        const i = document.createElement('i');
        i.setAttribute('data-lucide', m.icone || 'tag');
        i.setAttribute('aria-hidden', 'true');
        const t = document.createElement('span');
        t.textContent = m.nome;
        b.append(i, t);
        return b;
    }));
    marcarMacro();
    if (window.lucide) window.lucide.createIcons();   // sem internet/CDN os nomes aparecem sem ícone, e tudo continua funcionando
}

function iniciarMacros() {
    const box = $('macros');
    if (!box) return;
    box.addEventListener('click', (e) => {
        const b = e.target.closest('.macro-chip');
        if (!b) return;
        macroAtual = (b.dataset.macro === macroAtual) ? 'all' : b.dataset.macro;   // tocar de novo desmarca
        marcarMacro();
        filtroCategoria.value = 'all';
        atualizarCategoriasPorCidade();
        limiteVisivel = CONFIG.itensPorPagina;
        aplicarFiltros();
    });
}

/* =========================
   4. BARRA DE FILTROS FIXA + VOLTAR AO TOPO
========================= */
function iniciarBarraFiltros() {
    if (!barraFiltros || !sentinela) return;
    const celular = window.matchMedia('(max-width: 600px)');
    let fixa = false;

    // Marca a barra como "fixa" quando ela encosta no topo da tela
    new IntersectionObserver(([entrada]) => {
        fixa = !entrada.isIntersecting && entrada.boundingClientRect.top < 0;
        barraFiltros.classList.toggle('fixa', fixa);
        if (!fixa) barraFiltros.classList.remove('escondida');
    }).observe(sentinela);

    // No celular: esconde ao rolar para baixo e volta ao rolar para cima
    let ultimoY = window.scrollY;
    let agendado = false;
    window.addEventListener('scroll', () => {
        if (agendado) return;
        agendado = true;
        requestAnimationFrame(() => {
            const y = window.scrollY;
            if (fixa && celular.matches && !barraFiltros.contains(document.activeElement)) {
                if (y > ultimoY + 4) barraFiltros.classList.add('escondida');
                else if (y < ultimoY - 4) barraFiltros.classList.remove('escondida');
            }
            ultimoY = y;
            agendado = false;
        });
    }, { passive: true });
}

function iniciarVoltarTopo() {
    if (!btnTopo) return;
    const atualizar = () => btnTopo.classList.toggle('hidden-btn', window.scrollY < 600);
    window.addEventListener('scroll', atualizar, { passive: true });
    btnTopo.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: reduzirMovimento ? 'auto' : 'smooth' });
    });
    atualizar();
}

/* =========================
   5. RASTREAMENTO
========================= */
function enviarApi(rota, corpo) {
    return fetch(`${CONFIG.apiBase}/api/${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
        keepalive: true
    });
}

function iniciarRastreamento() {
    // Cliques em WhatsApp / Instagram
    document.addEventListener('click', async (event) => {
        const link = event.target.closest('a[href*="wa.me"], a[href*="instagram.com"]');
        if (!link) return;
        try {
            await enviarApi('track-click', {
                site: CONFIG.siteId,
                link: link.href,
                x: event.clientX,
                y: event.clientY,
                element: event.target.tagName,
                action: 'click'
            });
        } catch (error) {
            console.error('Erro ao registrar clique:', error);
        }
    });

    // Cópia de links
    document.addEventListener('copy', async () => {
        const selecao = document.getSelection().toString().trim();
        if (!selecao.includes('wa.me') && !selecao.includes('instagram.com')) return;

        copyCount++;
        if (contadorCopias) contadorCopias.textContent = `Links copiados: ${copyCount}`;
        try { localStorage.setItem('copyCount', copyCount); } catch (_) {}

        try {
            await enviarApi('track-click', { site: CONFIG.siteId, link: selecao, x: null, y: null, element: 'copy', action: 'copied' });
        } catch (error) {
            console.error('Erro ao registrar cópia:', error);
        }
    });
}

// Conta no máximo UMA visita por visitante (navegador/aparelho) por dia.
// O "dia" segue o horário da Paraíba, o mesmo que a API usa para agrupar.
function diaDeHoje() {
    try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date());  // AAAA-MM-DD
    } catch (_) {
        return new Date().toISOString().slice(0, 10);
    }
}

async function registrarAcesso() {
    const chave = `acesso_dia_${CONFIG.siteId}`;
    const hoje = diaDeHoje();

    // Já contou hoje neste aparelho? Então não envia de novo (recarregar a página não conta).
    try {
        if (localStorage.getItem(chave) === hoje) return;
        localStorage.setItem(chave, hoje);       // marca antes de enviar: evita contar duas abas abertas juntas
    } catch (_) { /* armazenamento bloqueado (aba privada): conta normalmente */ }

    try {
        const r = await enviarApi('save-access', { site: CONFIG.siteId });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        console.log('Visita registrada com sucesso!');
    } catch (error) {
        console.error('Erro ao salvar visita:', error);
        try { localStorage.removeItem(chave); } catch (_) {}   // falhou: tenta de novo na próxima abertura
    }
}

/* =========================
   6. CARTÃO DE VISITA
========================= */
async function obterImagemBase64(url) {
    try {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error('Falha no download');
        const blob = await response.blob();
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn('⚠️ Base64 falhou, usando URL original:', url);
        return url;
    }
}

function esperarImagem(img) {
    return new Promise((resolve) => {
        if (img.complete) return resolve();
        img.onload = resolve;
        img.onerror = resolve;
    });
}

async function gerarECompartilhar(dados) {
    const template = $('share-master-template');
    const imgFoto = $('master-foto');
    const imgBg = $('master-bg');

    const btnAtivo = document.activeElement;
    if (btnAtivo) btnAtivo.style.opacity = '0.5';

    $('master-nome').innerText = dados.nome;
    $('master-ramo').innerText = dados.ramo;
    $('master-insta').innerText = dados.insta;
    $('master-whats').innerText = dados.whats;

    const [bgData, fotoData] = await Promise.all([
        obterImagemBase64(CONFIG.fundoCartao),
        obterImagemBase64(dados.foto)
    ]);

    imgBg.src = bgData;
    imgFoto.src = fotoData;

    await Promise.all([esperarImagem(imgBg), esperarImagem(imgFoto)]);

    try {
        const canvas = await html2canvas(template, { useCORS: true, allowTaint: false, scale: 2, backgroundColor: null });
        const dataUrl = canvas.toDataURL('image/png');
        const fileName = `${dados.nome.toLowerCase().replace(/\s/g, '-')}.png`;

        const isWebShareSupported = navigator.share && navigator.canShare;
        const isAndroid = /Android/i.test(navigator.userAgent);

        // 1. Compartilhar (melhor opção para WhatsApp)
        if (isWebShareSupported) {
            try {
                const blob = await (await fetch(dataUrl)).blob();
                const file = new File([blob], fileName, { type: 'image/png' });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: CONFIG.siteNome,
                        text: `🚀 Confira ${dados.nome} e outros empreendimentos no ${CONFIG.siteNome}!\nAcesse: ${CONFIG.siteUrl}`
                    });
                    if (btnAtivo) btnAtivo.style.opacity = '1';
                    return;
                }
            } catch (e) {
                console.warn('⚠️ Share falhou');
            }
        }

        // 2. Fallback Android/APK (modal de pré-visualização)
        if (isAndroid) {
            let modal = $('preview-share');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'preview-share';
                modal.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:9999; padding:20px;';
                document.body.appendChild(modal);
            }
            modal.innerHTML = `
                <p style="color:#fff; margin-bottom:15px; font-family:'Montserrat', Arial, sans-serif;text-align: center;">
                    Este cartão de visita pode ser baixado ou compartilhado no site:
                    <a href="${CONFIG.siteUrl}" style="color:#fff; text-decoration: underline;">${CONFIG.siteUrl}</a>
                </p>
                <img src="${dataUrl}" style="width:100%; max-width:400px; border: 2px solid #fff;">
                <button id="fecharPreview" style="margin-top:20px; padding:15px 30px; background:#fff; border:none; border-radius:5px; font-weight:bold;">FECHAR</button>`;
            $('fecharPreview').onclick = () => {
                modal.remove();
                if (btnAtivo) btnAtivo.style.opacity = '1';
            };
            return;
        }

        // 3. PC (download direto)
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.click();
        if (btnAtivo) btnAtivo.style.opacity = '1';

    } catch (err) {
        console.error('❌ Erro:', err);
        alert('Erro ao gerar imagem.');
        if (btnAtivo) btnAtivo.style.opacity = '1';
    }
}

function iniciarCompartilhar() {
    // Delegação de evento: funciona para cards criados dinamicamente
    catalogo.addEventListener('click', async (e) => {
        const botao = e.target.closest('.share-card');
        if (!botao) return;
        e.preventDefault();
        const item = botao.closest('.item');
        await gerarECompartilhar({
            nome: item.querySelector('h3')?.innerText || CONFIG.siteNome,
            ramo: item.querySelector('strong')?.innerText || '',
            insta: item.querySelector('a[href*="instagram"] span')?.innerText || CONFIG.instaPadrao,
            whats: item.querySelector('a[href*="wa.me"] span')?.innerText || '(83) 00000-0000',
            foto: item.querySelector('img')?.src
        });
    });
}

/* =========================
   7. BANNER ROTATIVO
========================= */
function iniciarBanner() {
    const container = document.querySelector('.banner-container');
    const slides = document.querySelectorAll('.slide');
    if (!container || slides.length === 0) return;

    let atual = Math.floor(Math.random() * slides.length);
    let timer = null;

    // Bolinhas (indicadores)
    const dots = document.createElement('div');
    dots.className = 'banner-dots';
    const botoes = Array.from(slides).map((_, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', `Ir para o banner ${i + 1}`);
        b.addEventListener('click', () => { mostrarSlide(i); reiniciarTimer(); });
        dots.appendChild(b);
        return b;
    });
    container.appendChild(dots);

    function mostrarSlide(i) {
        slides[atual].classList.remove('active');
        atual = i;
        slides[atual].classList.add('active');
        botoes.forEach((b, k) => b.setAttribute('aria-current', k === atual ? 'true' : 'false'));
    }

    function reiniciarTimer() {
        clearInterval(timer);
        if (reduzirMovimento) return;   // quem prefere menos movimento troca de banner pelas bolinhas
        timer = setInterval(() => mostrarSlide((atual + 1) % slides.length), 4000);
    }

    // Deslizar com o dedo: arrastar para a esquerda = próximo banner, para a direita = anterior
    let inicio = null;
    let deslizou = false;
    container.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;       // só toque/caneta
        inicio = { x: e.clientX, y: e.clientY };
        deslizou = false;
        clearInterval(timer);                        // pausa a troca automática enquanto o dedo está na tela
    });
    container.addEventListener('pointerup', (e) => {
        if (!inicio) return;
        const dx = e.clientX - inicio.x;
        const dy = e.clientY - inicio.y;
        inicio = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {   // movimento horizontal de verdade
            deslizou = true;
            mostrarSlide((atual + (dx < 0 ? 1 : -1) + slides.length) % slides.length);
        }
        reiniciarTimer();
    });
    container.addEventListener('pointercancel', () => {   // o navegador assumiu o gesto (rolagem vertical)
        inicio = null;
        reiniciarTimer();
    });
    // depois de deslizar, o toque não pode virar um clique no link do banner
    container.addEventListener('click', (e) => {
        if (deslizou) { e.preventDefault(); e.stopPropagation(); deslizou = false; }
    }, true);

    slides.forEach(s => s.classList.remove('active'));
    mostrarSlide(atual);
    reiniciarTimer();
}

/* =========================
   8. INSTALAR APP
========================= */
function iniciarInstalacao() {
    let deferredPrompt = null;
    const instalarFloat = document.querySelector('.install-float');
    const btn = $('installApp');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (instalarFloat) instalarFloat.style.display = 'block';
    });

    if (btn) {
        btn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const escolha = await deferredPrompt.userChoice;
            if (escolha.outcome === 'accepted') console.log('App instalado');
            deferredPrompt = null;
            if (instalarFloat) instalarFloat.style.display = 'none';
        });
    }
}

/* =========================
   9. INICIALIZAÇÃO
========================= */
function mostrarErro() {
    const caixa = document.createElement('div');
    caixa.className = 'catalogo-erro';
    const p = document.createElement('p');
    p.textContent = 'Não foi possível carregar os cadastros. Verifique sua conexão e tente de novo.';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'clear-filters';
    b.textContent = 'Tentar novamente';
    b.addEventListener('click', carregarCatalogo);
    caixa.append(p, b);
    catalogo.replaceChildren(caixa);
    feedback.textContent = 'Não foi possível carregar os cadastros.';
}

let filtrosIniciados = false;

async function carregarCatalogo() {
    feedback.textContent = 'Carregando cadastros...';
    try {
        const dados = await carregarDados();
        dados.categorias.forEach(c => { NOMES_CATEGORIA.set(c.valor, c.nome); if (c.macro) MACRO_DE.set(c.valor, c.macro); });
        macros = dados.macros;
        renderizarCards(dados.cadastros);
        renderizarMacros();
        if (!filtrosIniciados) {
            preencherSelect(filtroCidade, dados.cidades);
            preencherSelect(filtroCategoria, dados.categorias);
            iniciarFiltros();
            filtrosIniciados = true;
        }
    } catch (error) {
        console.error('Erro ao carregar os dados (cadastros.json / filtros.json):', error);
        mostrarErro();
        return;
    }
    aplicarFiltros();
}

async function iniciar() {
    iniciarBanner();
    iniciarInstalacao();
    iniciarRastreamento();
    iniciarCompartilhar();
    iniciarCompactar();
    iniciarMacros();
    iniciarBarraFiltros();
    iniciarVoltarTopo();
    registrarAcesso();
    await carregarCatalogo();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
} else {
    iniciar();
}
