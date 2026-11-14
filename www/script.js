/* =====================================================================
   PATOS SERVIÇOS — script.js
   1. Configuração
   2. Carregamento (cadastros.json e filtros.json) e renderização dos cards
   3. Filtros, busca e paginação
   4. Rastreamento (cliques, cópias e visitas)
   5. Cartão de visita (compartilhar)
   6. Banner rotativo
   7. Instalar app
   8. Inicialização
===================================================================== */

/* =========================
   1. CONFIGURAÇÃO
========================= */
const CONFIG = {
    cadastrosUrl: 'cadastros.json',
    filtrosUrl: 'filtros.json',   // lista de cidades e categorias dos filtros
    apiBase: 'https://patosservicos.vercel.app', // base da API (track-click / save-access)
    siteId: 'Ita',
    itensPorPagina: 4
};

// Modelos de contato: no JSON basta informar "rede", "url" e "rotulo".
// Qualquer campo informado no próprio contato sobrescreve o modelo.
const REDES = {
    instagram:    { classe: 'social-link instagram',   icone: '/imagens_icons/instagram.png',    alt: 'Instagram' },
    whatsapp:     { classe: 'social-link whatsapp',    icone: '/imagens_icons/whatsapp.png',     alt: 'WhatsApp' },
    compartilhar: { classe: 'social-link share-card',  icone: '/imagens_icons/compartilhar.png', botao: true },
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

function criarCard(d) {
    const card = criar('div', 'item');
    card.dataset.category = d.categorias.join(',');
    card.dataset.city = d.cidades.join(',');
    card.dataset.id = d.id;

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
    (d.conteudo || []).forEach(e => {
        const ehContato = e.tipo === 'contato' || e.tipo === 'social_html';
        card.appendChild(ehContato ? criarContato(e) : criarBloco(e));
    });
    return card;
}

function renderizarCards(lista) {
    const frag = document.createDocumentFragment();
    cards = lista.map(dados => {
        const el = criarCard(dados);
        frag.appendChild(el);
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
    feedback.textContent = categoria === 'all'
        ? 'Exibindo todos os serviços'
        : `Exibindo ${n} ${n === 1 ? 'item' : 'itens'}`;

    animarVisiveis(exibidos);
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
    if (btnExibirMais) {
        btnExibirMais.addEventListener('click', () => {
            limiteVisivel += CONFIG.itensPorPagina;
            aplicarFiltros();
        });
    }
}

/* =========================
   4. RASTREAMENTO
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
            await enviarApi('track-click', { link: selecao, x: null, y: null, element: 'copy', action: 'copied' });
        } catch (error) {
            console.error('Erro ao registrar cópia:', error);
        }
    });
}

async function registrarAcesso() {
    try {
        const r = await enviarApi('save-access', { site: CONFIG.siteId });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        console.log('Visita registrada com sucesso!');
    } catch (error) {
        console.error('Erro ao salvar visita:', error);
    }
}

/* =========================
   5. CARTÃO DE VISITA
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
        obterImagemBase64('imagens/background-patos.png'),
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
                        title: 'Patos Serviços',
                        text: `🚀 Confira ${dados.nome} e outros empreendimentos no Patos Serviços!\nAcesse: https://patosservicos.vercel.app`
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
                <p style="color:#fff; margin-bottom:15px; font-family:Montserrat;text-align: center;">
                    Este cartão de visita pode ser baixado ou compartilhado no site:
                    <a href="https://patosservicos.vercel.app" style="color:#fff; text-decoration: underline;">https://patosservicos.vercel.app</a>
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
            nome: item.querySelector('h3')?.innerText || 'Patos Serviços',
            ramo: item.querySelector('strong')?.innerText || '',
            insta: item.querySelector('a[href*="instagram"] span')?.innerText || 'patosservicos_pb',
            whats: item.querySelector('a[href*="wa.me"] span')?.innerText || '(83) 00000-0000',
            foto: item.querySelector('img')?.src
        });
    });
}

/* =========================
   6. BANNER ROTATIVO
========================= */
function iniciarBanner() {
    const slides = document.querySelectorAll('.slide');
    if (slides.length === 0) return;

    let atual = Math.floor(Math.random() * slides.length);
    slides.forEach(s => s.classList.remove('active'));
    slides[atual].classList.add('active');

    setInterval(() => {
        slides[atual].classList.remove('active');
        atual = (atual + 1) % slides.length;
        slides[atual].classList.add('active');
    }, 4000);
}

/* =========================
   7. INSTALAR APP
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
   8. INICIALIZAÇÃO
========================= */
async function iniciar() {
    iniciarBanner();
    iniciarInstalacao();
    iniciarRastreamento();
    iniciarCompartilhar();
    registrarAcesso();

    feedback.textContent = 'Carregando cadastros...';
    try {
        const dados = await carregarDados();
        renderizarCards(dados.cadastros);
        preencherSelect(filtroCidade, dados.cidades);
        preencherSelect(filtroCategoria, dados.categorias);
    } catch (error) {
        console.error('Erro ao carregar os dados (cadastros.json / filtros.json):', error);
        feedback.textContent = 'Não foi possível carregar os cadastros. Atualize a página para tentar novamente.';
        return;
    }
    iniciarFiltros();
    aplicarFiltros();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
} else {
    iniciar();
}
