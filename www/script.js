const filter = document.getElementById('categoryFilter');
const cityFilter = document.getElementById('cityFilter');
const searchBar = document.getElementById('searchBar');
const catalog = document.getElementById('catalog');
const feedback = document.getElementById('feedback');
const copyCountDisplay = document.getElementById('copyCount');
const loadMoreBtn = document.getElementById('loadMore');

let items = [];
let copyCount = Number(localStorage.getItem('copyCount')) || 0;
let visibleLimit = 4;
let allCategoryOptions = [];

/* =========================
   ORDENAÇÃO ALFABÉTICA DO FILTRO
========================= */
function sortCategoryOptions() {
    if (!filter) return;
    const options = Array.from(filter.options);
    const todasOption = options.find(opt => opt.value === "all");
    const outras = options.filter(opt => opt.value !== "all");

    outras.sort((a, b) => a.text.localeCompare(b.text, "pt-BR"));

    filter.innerHTML = "";
    if (todasOption) filter.appendChild(todasOption);
    outras.forEach(opt => filter.appendChild(opt));

    allCategoryOptions = Array.from(filter.options).map(opt => opt.cloneNode(true));
}

/* =========================
   RENDERIZAÇÃO DINÂMICA DOS CARDS (JSON)
========================= */
function criarElementoCard(cadastro) {
    const card = document.createElement('div');
    card.className = 'item';
    card.dataset.id = cadastro.id || '';
    card.dataset.category = (cadastro.categorias || []).join(',');
    if (cadastro.cidades && cadastro.cidades.length > 0) {
        card.setAttribute('data-city', cadastro.cidades.join(','));
    }

    // Imagem principal do card
    if (cadastro.imagem) {
        const img = document.createElement('img');
        img.src = cadastro.imagem.replace(/\\/g, '/');
        img.alt = cadastro.alt || cadastro.nome || '';
        img.loading = 'lazy';
        card.appendChild(img);
    }

    // Elementos de topo customizados (ex: Fabiana Araújo)
    if (Array.isArray(cadastro.topo)) {
        cadastro.topo.forEach(blocoTopo => {
            const el = document.createElement(blocoTopo.tag || 'div');
            if (blocoTopo.classe) el.className = blocoTopo.classe;
            if (blocoTopo.html) el.innerHTML = blocoTopo.html;
            card.appendChild(el);
        });
    }

    // Título (h3)
    if (cadastro.nome_html || cadastro.nome) {
        const h3 = document.createElement('h3');
        if (cadastro.nome_html) {
            h3.innerHTML = cadastro.nome_html;
        } else {
            h3.textContent = cadastro.nome;
        }
        card.appendChild(h3);
    }

    // Ramo / Subtítulo (strong)
    if (cadastro.ramo) {
        const strong = document.createElement('strong');
        strong.innerHTML = cadastro.ramo;
        card.appendChild(strong);
    }

    // Conteúdo dinâmico (textos, listas, links, botões)
    (cadastro.conteudo || []).forEach(bloco => {
        if (bloco.tipo === 'texto') {
            if (bloco.tag === 'ul') {
                const ul = document.createElement('ul');
                if (bloco.classe) ul.className = bloco.classe;
                ul.innerHTML = bloco.html || '';
                card.appendChild(ul);
            } else if (bloco.tag === 'div') {
                const div = document.createElement('div');
                if (bloco.classe) div.className = bloco.classe;
                div.innerHTML = bloco.html || '';
                card.appendChild(div);
            } else if (bloco.tag === 'hr') {
                const hr = document.createElement('hr');
                if (bloco.classe) hr.className = bloco.classe;
                card.appendChild(hr);
            } else if (bloco.tag === 'a') {
                const a = document.createElement('a');
                if (bloco.classe) a.className = bloco.classe;
                a.innerHTML = bloco.html || '';
                card.appendChild(a);
            } else {
                const p = document.createElement('p');
                if (bloco.classe) p.className = bloco.classe;
                p.innerHTML = bloco.html || '';
                card.appendChild(p);
            }
        } else if (bloco.tipo === 'texto_solto') {
            const spanWrapper = document.createElement('div');
            spanWrapper.innerHTML = bloco.html || '';
            while (spanWrapper.firstChild) {
                card.appendChild(spanWrapper.firstChild);
            }
        } else if (bloco.tipo === 'social_html') {
            const socialDiv = document.createElement('div');
            socialDiv.className = 'social';
            socialDiv.innerHTML = bloco.html || '';
            card.appendChild(socialDiv);
        } else if (bloco.tipo === 'contato') {
            const socialDiv = document.createElement('div');
            socialDiv.className = 'social';

            if (bloco.rede === 'compartilhar') {
                const btn = document.createElement('button');
                btn.className = bloco.classe || 'social-link share-card';

                const iconImg = document.createElement('img');
                iconImg.src = bloco.icone || '/imagens_icons/compartilhar.png';
                iconImg.alt = bloco.alt || 'Compartilhar';
                iconImg.className = 'social-icon';

                const span = document.createElement('span');
                span.textContent = bloco.rotulo || 'Cartão de Visita';

                btn.appendChild(iconImg);
                btn.appendChild(span);

                // Apenas o botão "Cartão de Visita" dispara a geração de imagem
                if ((bloco.rotulo || 'Cartão de Visita').toLowerCase().includes('cartão')) {
                    btn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        const dados = extrairDadosParaCartao(cadastro, card);
                        await gerarECompartilhar(dados);
                    });
                }

                socialDiv.appendChild(btn);
            } else {
                const a = document.createElement('a');
                a.href = bloco.url || '#';
                a.target = '_blank';
                a.rel = 'noopener noreferrer';

                if (bloco.classe) {
                    a.className = bloco.classe;
                } else if (bloco.rede === 'instagram') {
                    a.className = 'social-link instagram';
                } else if (bloco.rede === 'whatsapp') {
                    a.className = 'social-link whatsapp';
                } else {
                    a.className = 'social-link';
                }

                let defaultIcon = '/imagens_icons/logo_pdf.png';
                let defaultAlt = bloco.rotulo || 'Link';
                if (bloco.rede === 'instagram') {
                    defaultIcon = '/imagens_icons/instagram.png';
                    defaultAlt = 'Instagram';
                } else if (bloco.rede === 'whatsapp') {
                    defaultIcon = '/imagens_icons/whatsapp.png';
                    defaultAlt = 'WhatsApp';
                }

                const iconImg = document.createElement('img');
                iconImg.src = bloco.icone || defaultIcon;
                iconImg.alt = bloco.alt || defaultAlt;
                iconImg.className = 'social-icon';

                const span = document.createElement('span');
                span.textContent = bloco.rotulo || '';

                a.appendChild(iconImg);
                a.appendChild(span);
                socialDiv.appendChild(a);
            }

            card.appendChild(socialDiv);
        }
    });

    return card;
}

function extrairDadosParaCartao(cadastro, cardElement) {
    const instaItem = (cadastro.conteudo || []).find(c => c.tipo === 'contato' && c.rede === 'instagram');
    const whatsItem = (cadastro.conteudo || []).find(c => c.tipo === 'contato' && c.rede === 'whatsapp');

    let nome = cadastro.nome || cardElement.querySelector('h3')?.innerText || 'Patos Serviços';
    if (nome === 'Nossos Diferenciais:' && Array.isArray(cadastro.topo)) {
        const h2Topo = cadastro.topo.find(t => t.tag === 'h2');
        if (h2Topo) nome = h2Topo.html.replace(/<[^>]*>/g, '');
    }

    return {
        nome: nome,
        ramo: cadastro.ramo || cardElement.querySelector('strong')?.innerText || '',
        insta: instaItem?.rotulo || cardElement.querySelector('a[href*="instagram"] span')?.innerText || 'patosservicos_pb',
        whats: whatsItem?.rotulo || cardElement.querySelector('a[href*="wa.me"] span')?.innerText || '(83) 00000-0000',
        foto: (cadastro.imagem || cardElement.querySelector('img')?.src || '').replace(/\\/g, '/')
    };
}

async function carregarCadastros() {
    try {
        const response = await fetch('cadastros.json');
        if (!response.ok) {
            throw new Error(`Erro HTTP ao carregar cadastros.json: ${response.status}`);
        }
        const data = await response.json();
        const ativos = (data.cadastros || []).filter(item => item.ativo !== false);

        if (catalog) {
            catalog.innerHTML = '';
            ativos.forEach(cadastro => {
                const cardEl = criarElementoCard(cadastro);
                catalog.appendChild(cardEl);
            });
        }

        items = Array.from(document.querySelectorAll('.item'));
        updateCategoriesByCity();
        filterItems();
    } catch (error) {
        console.error('Erro ao carregar cadastros.json:', error);
        if (feedback) {
            feedback.textContent = 'Erro ao carregar os serviços. Tente recarregar a página.';
        }
    }
}

/* =========================
   ANIMAÇÃO DOS CARDS
========================= */
function animateVisibleItems() {
    const visibleItems = items.filter(
        item => !item.classList.contains('hidden') && item.style.display !== 'none'
    );

    visibleItems.forEach((item, index) => {
        item.classList.remove('show');
        setTimeout(() => {
            item.classList.add('show');
        }, index * 80);
    });
}

/* =========================
   PAGINAÇÃO (EXIBIR MAIS)
========================= */
function applyVisibilityLimit() {
    const category = filter ? filter.value : 'all';
    const selectedCity = cityFilter ? cityFilter.value : 'all';
    const searchText = searchBar ? searchBar.value : '';

    const isFiltered = category !== 'all' || selectedCity !== 'all' || searchText !== '';
    const matchingItems = items.filter(item => !item.classList.contains('hidden'));

    if (isFiltered) {
        matchingItems.forEach(item => {
            item.style.display = 'block';
        });
        if (loadMoreBtn) loadMoreBtn.classList.add('hidden-btn');
    } else {
        visibleLimit = Math.max(visibleLimit, 4);
        matchingItems.forEach((item, index) => {
            item.style.display = index < visibleLimit ? 'block' : 'none';
        });

        if (loadMoreBtn) {
            if (matchingItems.length > visibleLimit) {
                loadMoreBtn.classList.remove('hidden-btn');
            } else {
                loadMoreBtn.classList.add('hidden-btn');
            }
        }
    }

    animateVisibleItems();
}

if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
        visibleLimit += 4;
        applyVisibilityLimit();
    });
}

/* =========================
   FEEDBACK
========================= */
function updateFeedback() {
    if (!feedback) return;
    const visibleItems = items.filter(
        item => !item.classList.contains('hidden')
    );

    if (filter && filter.value === "all" && (!cityFilter || cityFilter.value === "all") && (!searchBar || searchBar.value === "")) {
        feedback.textContent = "Exibindo todos os serviços";
        return;
    }

    feedback.textContent = `Exibindo ${visibleItems.length} ${visibleItems.length === 1 ? 'item' : 'itens'}`;
}

/* =========================
   FILTRO E BUSCA (SUPORTE A MÚLTIPLAS CIDADES)
========================= */
function filterItems() {
    const category = filter ? filter.value : 'all';
    const selectedCity = cityFilter ? cityFilter.value : 'all';
    const searchText = searchBar ? searchBar.value.toLowerCase() : '';

    items.forEach(item => {
        const itemCategories = item.dataset.category
            ? item.dataset.category.split(',').map(c => c.trim())
            : [];

        const rawCity = item.getAttribute('data-city') || "all";
        const itemCities = rawCity.split(',').map(c => c.trim());

        const searchableText = item.innerText.toLowerCase();

        const matchesCategory = category === "all" || itemCategories.includes(category);
        const matchesCity = selectedCity === 'all' || itemCities.includes(selectedCity);
        const matchesSearch = searchableText.includes(searchText);

        if (matchesCategory && matchesCity && matchesSearch) {
            item.classList.remove("hidden");
            item.style.display = "block";
        } else {
            item.classList.add("hidden");
            item.style.display = "none";
        }
    });

    const banner = document.querySelector('.banner');
    if (banner) {
        if (category !== "all" || selectedCity !== "all" || searchText !== "") {
            banner.style.display = "none";
        } else {
            banner.style.display = "block";
        }
    }

    if (category === "all" && selectedCity === "all" && searchText === "") {
        visibleLimit = 4;
    }

    updateFeedback();
    applyVisibilityLimit();
}

if (filter) filter.addEventListener('change', filterItems);
if (cityFilter) {
    cityFilter.addEventListener('change', () => {
        updateCategoriesByCity();
        filterItems();
    });
}
if (searchBar) searchBar.addEventListener('input', filterItems);

/* ==============================================
   ATUALIZAR FILTRO DE CATEGORIA POR CIDADE
============================================== */
function updateCategoriesByCity() {
    if (!filter || !cityFilter) return;
    const selectedCity = cityFilter.value;
    const currentCategory = filter.value;
    let availableCategories = new Set();

    items.forEach(item => {
        const rawCity = item.getAttribute('data-city') || "all";
        const itemCities = rawCity.split(',').map(c => c.trim());

        if (selectedCity === "all" || itemCities.includes(selectedCity)) {
            const itemCategories = item.dataset.category
                ? item.dataset.category.split(',')
                : [];
            itemCategories.forEach(cat => availableCategories.add(cat.trim()));
        }
    });

    filter.innerHTML = "";
    allCategoryOptions.forEach(opt => {
        if (opt.value === "all" || availableCategories.has(opt.value)) {
            filter.appendChild(opt.cloneNode(true));
        }
    });

    // Mantém a categoria selecionada se ela ainda existir na cidade escolhida
    if (Array.from(filter.options).some(opt => opt.value === currentCategory)) {
        filter.value = currentCategory;
    } else {
        filter.value = "all";
    }
}

/* =========================
   TRACK DE CLIQUES
========================= */
document.addEventListener("click", async (event) => {
    const link = event.target.closest('a[href*="wa.me"], a[href*="instagram.com"]');
    if (!link) return;

    try {
        await fetch("https://patosservicos.vercel.app/api/track-click", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                link: link.href,
                x: event.clientX,
                y: event.clientY,
                element: event.target.tagName,
                action: "click"
            })
        });
    } catch (error) {
        console.error("Erro ao registrar clique:", error);
    }
});

/* =========================
   VISITAS NO SITE
========================= */
async function registrarAcesso() {
    try {
        await fetch('https://patosservicos.vercel.app/api/save-access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ site: 'Patos' })
        });
        console.log("Visita registrada com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar visita:", error);
    }
}

/* =========================
   TRACK DE CÓPIA
========================= */
document.addEventListener("copy", async () => {
    const selection = document.getSelection().toString().trim();

    if (selection.includes("wa.me") || selection.includes("instagram.com")) {
        copyCount++;
        if (copyCountDisplay) {
            copyCountDisplay.textContent = `Links copiados: ${copyCount}`;
        }
        localStorage.setItem('copyCount', copyCount);

        try {
            await fetch("https://patosservicos.vercel.app/api/track-click", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    link: selection,
                    x: null,
                    y: null,
                    element: "copy",
                    action: "copied"
                })
            });
        } catch (error) {
            console.error("Erro ao registrar cópia:", error);
        }
    }
});

/* =========================
   INSTALAR APPS
========================= */
let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const installFloat = document.querySelector(".install-float");
    if (installFloat) {
        installFloat.style.display = "block";
    }
});

const installBtn = document.getElementById("installApp");

if (installBtn) {
    installBtn.addEventListener("click", async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;

        if (choiceResult.outcome === "accepted") {
            console.log("App instalado");
        }

        deferredPrompt = null;
        const installFloat = document.querySelector(".install-float");
        if (installFloat) installFloat.style.display = "none";
    });
}

/* ==================================
   GERAÇÃO E COMPARTILHAMENTO DE CARD
================================== */
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
        console.warn("⚠️ Base64 falhou, usando URL original:", url);
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
    const template = document.getElementById('share-master-template');
    const imgFoto = document.getElementById('master-foto');
    const imgBg = document.getElementById('master-bg');

    const btnAtivo = document.activeElement;
    if (btnAtivo) btnAtivo.style.opacity = "0.5";

    document.getElementById('master-nome').innerText = dados.nome;
    document.getElementById('master-ramo').innerText = dados.ramo;
    document.getElementById('master-insta').innerText = dados.insta;
    document.getElementById('master-whats').innerText = dados.whats;

    const [bgData, fotoData] = await Promise.all([
        obterImagemBase64('imagens_icons/background-patos.png'),
        obterImagemBase64(dados.foto)
    ]);

    imgBg.src = bgData;
    imgFoto.src = fotoData;

    await Promise.all([esperarImagem(imgBg), esperarImagem(imgFoto)]);

    try {
        const canvas = await html2canvas(template, {
            useCORS: true,
            allowTaint: false,
            scale: 2,
            backgroundColor: null
        });

        const dataUrl = canvas.toDataURL("image/png");
        const fileName = `${dados.nome.toLowerCase().replace(/\s+/g, '-')}.png`;

        const isWebShareSupported = navigator.share && navigator.canShare;
        const isAndroid = /Android/i.test(navigator.userAgent);

        // 1. TENTA COMPARTILHAR (MOBILE / WHATSAPP)
        if (isWebShareSupported) {
            try {
                const response = await fetch(dataUrl);
                const blob = await response.blob();
                const file = new File([blob], fileName, { type: 'image/png' });

                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Patos Serviços',
                        text: `🚀 Confira ${dados.nome} e outros empreendimentos no Patos Serviços!\nAcesse: https://patosservicos.vercel.app`
                    });
                    if (btnAtivo) btnAtivo.style.opacity = "1";
                    return;
                }
            } catch (e) {
                console.warn("⚠️ Share falhou");
            }
        }

        // 2. FALLBACK PARA ANDROID/APK (MODAL DE PREVIEW)
        if (isAndroid) {
            let modal = document.getElementById('preview-share');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'preview-share';
                modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:9999; padding:20px;";
                document.body.appendChild(modal);
            }

            modal.innerHTML = `
                <p style="color:#fff; margin-bottom:15px; font-family:Montserrat;text-align: center;">
                    Este cartão de visita pode ser baixado ou compartilhado no site: 
                    <a href="https://patosservicos.vercel.app" style="color:#fff; text-decoration: underline;">https://patosservicos.vercel.app</a>
                </p>

                <img src="${dataUrl}" style="width:100%; max-width:400px; border: 2px solid #fff;">
                <button id="fecharPreview" style="margin-top:20px; padding:15px 30px; background:#fff; border:none; border-radius:5px; font-weight:bold;">FECHAR</button>`;

            document.getElementById('fecharPreview').onclick = () => {
                modal.remove();
                if (btnAtivo) btnAtivo.style.opacity = "1";
            };
            return;
        }

        // 3. PC (DOWNLOAD DIRETO)
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.click();
        if (btnAtivo) btnAtivo.style.opacity = "1";

    } catch (err) {
        console.error("❌ Erro:", err);
        alert("Erro ao gerar imagem.");
        if (btnAtivo) btnAtivo.style.opacity = "1";
    }
}

/* =========================
   BANNER ROTATIVO ALEATÓRIO
========================= */
function initBanner() {
    const slides = document.querySelectorAll('.slide');
    if (slides.length === 0) return;

    const randomIndex = Math.floor(Math.random() * slides.length);
    let currentSlide = randomIndex;

    slides.forEach(slide => slide.classList.remove('active'));
    slides[currentSlide].classList.add('active');

    function nextSlide() {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
    }

    setInterval(nextSlide, 4000);
}

/* =========================
   INICIALIZAÇÃO GERAL
========================= */
document.addEventListener('DOMContentLoaded', () => {
    sortCategoryOptions();
    initBanner();
    registrarAcesso();
    carregarCadastros();
});
