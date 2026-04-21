const filter = document.getElementById('categoryFilter');
const cityFilter = document.getElementById('cityFilter');
const searchBar = document.getElementById('searchBar');
const items = document.querySelectorAll('.item');
const feedback = document.getElementById('feedback');
const copyCountDisplay = document.getElementById('copyCount');
const loadMoreBtn = document.getElementById('loadMore');
let copyCount = 0;
let visibleLimit = 4;

/* =========================
   ANIMAÇÃO DOS CARDS
========================= */
function animateVisibleItems() {
    const visibleItems = Array.from(items).filter(
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
    const category = filter.value;
    const selectedCity = cityFilter.value;
    const searchText = searchBar.value;

    const isFiltered = category !== 'all' || selectedCity !== 'all' || searchText !== '';

    // Itens que passaram pelo filtro (sem classe hidden)
    const matchingItems = Array.from(items).filter(item => !item.classList.contains('hidden'));

    if (isFiltered) {
        // Filtro ativo: exibe todos os correspondentes, oculta botão
        matchingItems.forEach(item => {
            item.style.display = 'block';
        });
        if (loadMoreBtn) loadMoreBtn.classList.add('hidden-btn');
    } else {
        // Tela inicial: aplica limite de visibilidade
        visibleLimit = Math.max(visibleLimit, 4);
        matchingItems.forEach((item, index) => {
            item.style.display = index < visibleLimit ? 'block' : 'none';
        });
        // Mostra ou oculta o botão "Exibir mais"
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
    const visibleItems = Array.from(items).filter(
        item => !item.classList.contains('hidden')
    );

    // Se estiver na categoria "Todas", não mostra quantidade
    if (filter.value === "all") {
        feedback.textContent = "Exibindo todos os serviços";
        return;
    }

    feedback.textContent = `Exibindo ${visibleItems.length} ${visibleItems.length === 1 ? 'item' : 'itens'}`;
}

/* =========================
   FEEDBACK EXIBIR TODOS OS ITENS

function updateFeedback() {
    const visibleItems = Array.from(items).filter(
        item => !item.classList.contains('hidden')
    );
    feedback.textContent = `Exibindo ${visibleItems.length} ${visibleItems.length === 1 ? 'item' : 'itens'}`;
}
========================= */

/* =========================
   FILTRO E BUSCA (CORRIGIDO)
========================= */
function filterItems() {
    const category = filter.value;
    const selectedCity = cityFilter.value;
    const searchText = searchBar.value.toLowerCase();

    items.forEach(item => {
        // 1. Obtém as categorias do dataset (convertendo para array)
        const itemCategories = item.dataset.category ? item.dataset.category.split(',') : [];
        
        // 2. Obtém a cidade ou define como "all" se não existir
        const itemCity = item.getAttribute('data-city') || "all";
        
        // 3. Obtém todo o texto do card para a busca
        const searchableText = item.innerText.toLowerCase();

        // Lógica de Comparação
        const matchesCategory = category === "all" || itemCategories.includes(category);
        const matchesCity = selectedCity === 'all' || itemCity === selectedCity;
        const matchesSearch = searchableText.includes(searchText); // Corrigido de itemText para searchableText

        // Ocultar banner ao selecionar filtro
        const banner = document.querySelector('.banner'); // Ou o nome da sua classe
        if (filter.value !== "all" || cityFilter.value !== "all" || searchBar.value !== "") {
            banner.style.display = "none"; // Esconde o banner ao filtrar
        } else {
            banner.style.display = "block"; // Mostra o banner na tela inicial "Limpa"
        }

        // Aplica o filtro visual
        if (matchesCategory && matchesCity && matchesSearch) {
            item.classList.remove("hidden");
            item.style.display = "block";
        } else {
            item.classList.add("hidden");
            item.style.display = "none";
        }
    });

    // Restaura o limite ao voltar para o estado padrão
    if (filter.value === "all" && cityFilter.value === "all" && searchBar.value === "") {
        visibleLimit = 4;
    }

    updateFeedback();
    applyVisibilityLimit();
}

filter.addEventListener('change', filterItems);
cityFilter.addEventListener('change', () => {
    updateCategoriesByCity();
    filterItems();
});
searchBar.addEventListener('input', filterItems);

/* =========================
   CATEGORIAS
========================= */
// Opções de categoria carregadas diretamente do HTML

/* ==============================================
   ATUALIZAR FILTRO DE CATEGORIA POR CIDADE
============================================== */
function updateCategoriesByCity() {
    const selectedCity = cityFilter.value;
    let availableCategories = new Set();

    items.forEach(item => {
        const itemCity = item.getAttribute('data-city') || "all";
        if (selectedCity === "all" || itemCity === selectedCity) {
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
}

const allCategoryOptions = Array.from(filter.options);
updateCategoriesByCity();

/* =========================
   INICIALIZAÇÃO
========================= */
updateFeedback();
applyVisibilityLimit();

/* =========================
   TRACK DE CLIQUES
========================= */
document.addEventListener("click", async (event) => {
    const link = event.target.closest('a[href*="wa.me"], a[href*="instagram.com"]');
    if (!link) return;

    try {
        await fetch("/api/track-click", {
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

document.addEventListener('DOMContentLoaded', function() {
    registrarAcesso();
});

async function registrarAcesso() {
    try {
        await fetch('https://patosservicos.vercel.app/api/save-access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ site: 'Ita' })
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
        copyCountDisplay.textContent = `Links copiados: ${copyCount}`;
        localStorage.setItem('copyCount', copyCount);

        try {
            await fetch("/api/track-click", {
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
    document.querySelector(".install-float").style.display = "none";
  });
}


/* =========================
   FUNÇÃO NOVA COMPARTILHAR
========================= */



/* ==================================
   GERAÇÃO E COMPARTILHAMENTO DE CARD
   ================================== */

async function obterImagemBase64(url) {
    try {
        // Para arquivos locais no Android (file://), o fetch pode falhar. 
        // Se falhar, ele cai no catch e tenta usar a URL original.
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

    // FeedBack visual rápido
    const btnAtivo = document.activeElement;
    if(btnAtivo) btnAtivo.style.opacity = "0.5";

    document.getElementById('master-nome').innerText = dados.nome;
    document.getElementById('master-ramo').innerText = dados.ramo;
    document.getElementById('master-insta').innerText = dados.insta;
    document.getElementById('master-whats').innerText = dados.whats;

    const [bgData, fotoData] = await Promise.all([
        obterImagemBase64('imagens/background-patos.png'),
        obterImagemBase64(dados.foto)
    ]);

    imgBg.src = bgData;
    imgFoto.src = fotoData;

    await Promise.all([esperarImagem(imgBg), esperarImagem(imgFoto)]);

    try {
        const canvas = await html2canvas(template, {
            useCORS: true,
            allowTaint: false, // Mudei para false para garantir a segurança do Blob
            scale: 2,
            backgroundColor: null
        });

        const dataUrl = canvas.toDataURL("image/png");
        const fileName = `${dados.nome.toLowerCase().replace(/\s/g, '-')}.png`;

        const isWebShareSupported = navigator.share && navigator.canShare;
        const isAndroid = /Android/i.test(navigator.userAgent);

        // 📱 1. TENTA COMPARTILHAR (MELHOR OPÇÃO PARA WHATSAPP)
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
                    if(btnAtivo) btnAtivo.style.opacity = "1";
                    return;
                }
            } catch (e) {
                console.warn("⚠️ Share falhou");
            }
        }

        // 🤖 2. FALLBACK PARA ANDROID/APK (MODAL DE PREVIEW)
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
                if(btnAtivo) btnAtivo.style.opacity = "1";
            };
            return;
        }

        // 💻 3. PC (DOWNLOAD DIRETO)
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.click();
        if(btnAtivo) btnAtivo.style.opacity = "1";

    } catch (err) {
        console.error("❌ Erro:", err);
        alert("Erro ao gerar imagem.");
        if(btnAtivo) btnAtivo.style.opacity = "1";
    }
}

// BOTÕES
document.querySelectorAll('.share-card').forEach(button => {
    button.onclick = async (e) => {
        e.preventDefault();
        const item = button.closest('.item');
        const dados = {
            nome: item.querySelector('h3')?.innerText || "Patos Serviços",
            ramo: item.querySelector('strong')?.innerText || "",
            insta: item.querySelector('a[href*="instagram"] span')?.innerText || "patosservicos_pb",
            whats: item.querySelector('a[href*="wa.me"] span')?.innerText || "(83) 00000-0000",
            foto: item.querySelector('img')?.src
        };
        await gerarECompartilhar(dados);
    };
});

/* =========================
   BANNER ROTATIVO ALEATÓRIO
========================= */
function initBanner() {
    const slides = document.querySelectorAll('.slide');
    if (slides.length === 0) return;

    // 1. Escolhe um índice aleatório entre 0 e o total de banners
    const randomIndex = Math.floor(Math.random() * slides.length);
    let currentSlide = randomIndex;

    // 2. Remove a classe 'active' de todos (limpeza inicial)
    slides.forEach(slide => slide.classList.remove('active'));

    // 3. Ativa o banner sorteado
    slides[currentSlide].classList.add('active');

    function nextSlide() {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
    }

    // Mantém a rotação a cada 4 segundos
    setInterval(nextSlide, 4000);
}

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', initBanner);