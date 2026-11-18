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
    itensPorPagina: 4,
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

const normalizar = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/* =========================
   2. CARREGAR E RENDERIZAR
========================= */
async function carregarJson(url) {
    const resp = await fetch(url, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`${url}: HTTP ${resp.status}`);
    return resp.json();
}

async function carregarDados() {
    const [cad, filtros] = await Promise.all([
        carregarJson(CONFIG.cadastrosUrl),
        carregarJson(CONFIG.filtrosUrl)
    ]);
    return {
        cadastros: (cad.cadastros || []).filter(c => c.ativo !== false),
        cidades: filtros.cidades || [],
        categorias: filtros.categorias || []
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

/* ---- Descrição recortável ("Mostrar completo") ---- */
function criarBotaoExpandir(corpo) {
    const b = criar('button', 'card-expandir');
    b.type = 'button';
    b.hidden = true;                                  // só aparece se a descrição for recortada
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', corpo.id);
    b.innerHTML = '<span class="card-expandir-texto">Mostrar completo</span>' +
        '<svg class="card-expandir-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    return b;
}

const alturaMaxCorpo = (corpo) =>
    parseFloat(getComputedStyle(corpo).getPropertyValue('--corpo-max')) || 176;

// Decide se a descrição precisa ser recortada. Roda quando o card aparece
// ou muda de tamanho (girar o celular, fonte carregando etc.).
function avaliarCorpo(corpo) {
    if (corpo.classList.contains('expandido') || corpo.dataset.animando) return;
    if (corpo.offsetParent === null) return;          // card oculto: avalia quando aparecer
    const recortar = corpo.scrollHeight > alturaMaxCorpo(corpo) + CONFIG.corteTolerancia;
    if (corpo.classList.contains('recortavel') !== recortar) {
        corpo.classList.toggle('recortavel', recortar);
        corpo.nextElementSibling.hidden = !recortar;
    }
}

const observadorCorpo = new ResizeObserver(entradas => entradas.forEach(e => avaliarCorpo(e.target)));

function alternarCorpo(botao) {
    const corpo = botao.previousElementSibling;
    const abrir = botao.getAttribute('aria-expanded') !== 'true';
    const limite = alturaMaxCorpo(corpo);

    const terminar = () => {
        clearTimeout(reserva);
        corpo.removeEventListener('transitionend', aoTerminar);
        corpo.style.maxHeight = '';
        delete corpo.dataset.animando;
    };
    const aoTerminar = (ev) => { if (ev.propertyName === 'max-height') terminar(); };
    const reserva = setTimeout(terminar, 500);        // garantia caso o navegador não dispare o evento
    corpo.dataset.animando = '1';
    corpo.addEventListener('transitionend', aoTerminar);

    if (abrir) {
        corpo.style.maxHeight = corpo.clientHeight + 'px';
        corpo.classList.add('expandido');
        requestAnimationFrame(() => { corpo.style.maxHeight = corpo.scrollHeight + 'px'; });
    } else {
        corpo.style.maxHeight = corpo.scrollHeight + 'px';
        corpo.classList.remove('expandido');
        void corpo.offsetHeight;                      // força o navegador a registrar o ponto de partida
        corpo.style.maxHeight = limite + 'px';
        // se o topo do card ficou para cima da tela, traz ele de volta à vista
        const card = botao.closest('.item');
        if (card.getBoundingClientRect().top < 0) {
            card.scrollIntoView({ block: 'nearest', behavior: reduzirMovimento ? 'auto' : 'smooth' });
        }
    }
    botao.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    botao.querySelector('.card-expandir-texto').textContent = abrir ? 'Mostrar menos' : 'Mostrar completo';
}

function iniciarExpandir() {
    catalogo.addEventListener('click', (e) => {
        const botao = e.target.closest('.card-expandir');
        if (botao) alternarCorpo(botao);
    });
}

function criarCard(d) {
    const card = criar('div', 'item');
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

    if (d.ramo) {
        const s = document.createElement('strong');
        s.innerHTML = d.ramo;
        card.appendChild(s);
    }
    // A descrição (tudo antes do 1º contato) fica numa caixa recortável com botão
    // "Mostrar completo". Os contatos nunca são escondidos.
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
                corpo.id = `corpo-${d.id}`;
                card.append(corpo, criarBotaoExpandir(corpo));
            }
            corpo.appendChild(criarBloco(e));
        }
    });
    return card;
}

function renderizarCards(lista) {
    const frag = document.createDocumentFragment();
    observadorCorpo.disconnect();
    cards = lista.map(dados => {
        const el = criarCard(dados);
        frag.appendChild(el);
        el.querySelectorAll('.card-corpo').forEach(c => observadorCorpo.observe(c));
        return { dados, el, busca: normalizar(el.textContent) };
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
    const filtrando = categoria !== 'all' || cidade !== 'all' || texto !== '';

    // banner só aparece na tela inicial "limpa"
    const banner = document.querySelector('.banner');
    if (banner) banner.style.display = filtrando ? 'none' : 'block';

    if (!filtrando) limiteVisivel = Math.max(limiteVisivel, CONFIG.itensPorPagina);

    const correspondentes = cards.filter(c =>
        (categoria === 'all' || c.dados.categorias.includes(categoria)) &&
        (cidade === 'all'    || c.dados.cidades.includes(cidade)) &&
        c.busca.includes(texto)
    );
    const conjunto = new Set(correspondentes);
    const exibidos = filtrando ? correspondentes : correspondentes.slice(0, limiteVisivel);
    const exibSet = new Set(exibidos);

    cards.forEach(c => {
        c.el.classList.toggle('hidden', !conjunto.has(c));
        c.el.style.display = exibSet.has(c) ? 'block' : 'none';
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
            c.dados.categorias.forEach(cat => disponiveis.add(cat));
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
        renderizarCards(dados.cadastros);
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
    iniciarExpandir();
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
