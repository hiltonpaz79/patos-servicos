const filter = document.getElementById('categoryFilter');
const cityFilter = document.getElementById('cityFilter');
const searchBar = document.getElementById('searchBar');
const items = document.querySelectorAll('.item');
const feedback = document.getElementById('feedback');
const copyCountDisplay = document.getElementById('copyCount');
let copyCount = 0;

/* =========================
   ANIMAÇÃO DOS CARDS
========================= */
function animateVisibleItems() {
    const visibleItems = Array.from(items).filter(
        item => !item.classList.contains('hidden')
    );

    visibleItems.forEach((item, index) => {
        item.classList.remove('show');
        setTimeout(() => {
            item.classList.add('show');
        }, index * 80);
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

    updateFeedback();
    animateVisibleItems();
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
let categories = new Set();
items.forEach(item => {
    item.dataset.category.split(',').forEach(cat => categories.add(cat.trim()));
});

let sortedCategories = Array.from(categories).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
);

filter.innerHTML = "";
filter.appendChild(new Option("Todas as categoria", "all"));

sortedCategories.forEach(category => {
    filter.appendChild(new Option(formatCategoryName(category), category));
});

function formatCategoryName(category) {
    const names = {
        aa_aluguel_venda_imovel: "Aluguel e Venda de Imóvel",
        loja_animes: "Loja de Animes",
        consultoria_ambiental: "Consultoria Ambiental",
        mercadinho: "Mercadinho",
        personal_trainer: "Personal Trainer",
        confeccao_fardamentos: "Confecção de Fardamentos",
        depilacao_feminina:"Depilação Feminina",
        roupas_vestuario: "Roupas e Vestuário",
        acessorios_femininos: "Acessórios Femininos",
        costureira: "Costureira",
        suporte_ita: "Suporte Ita Serviços",
        montador_moveis: "Montador de Móveis",
        artes_marciais: "Artes Marciais",
        eletrica_automotiva: "Elétrica Automotiva",
        climatizacao_automotiva: "Climatização Automotiva",
        podagem: "Podagem",
        temperos_ervas: "Temperos e Ervas",
        designer_grafico: "Designer Gráfico",
        jardinagem: "Jardinagem",
        terapeuta_ocupacional: "Terapeuta Ocupacional",
        maquiagem: "Maquiagem",
        salgados: "Salgados",
        conveniencia_bebidas: "Conveniência de Bebidas",
        oficina_motos: "Oficina de Motos",
        assessorias_cursos: "Assessorias e Cursos",
        seg_eletronica: "Segurança Eletrônica",
        marmitas_caseiras: "Marmitas Caseiras",
        marcenaria: "Marcenaria",
        mobilidade_urbana: "Mobilidade Urbana",
        carvao_vegetal: "Carvão Vegetal",
        encanador: "Encanador",
        decoracoes_festas: "Decorações de Festas",
        autoescola: "Autoescola",
        consultoria_beleza: "Consultoria de Beleza",
        personal_shopper: "Personal Shopper",
        transportadora: "Transportadora",
        pre_moldados: "Pré-Moldados",
        const_civil: "Construção Civil",
        design_sobrancelhas: "Design de Sobrancelhas",
        eletricista: "Eletricista",
        energia_solar: "Energia Solar",
        doces: "Doces",
        acaiteria: "Açaiteria",
        gas: "Gás",
        protecao_veicular: "Proteção Veicular",
        holtel: "Hotel",
        restaurante: "Restaurante",
        seguradora: "Seguradora",
        madeireira: "Madeireira",
        viagens_fretes_encomendas: "Viagens, Fretes e Encomendas",
        taxi: "Táxi",
        corretor_imoveis: "Corretor de Imóveis",
        grafica: "Gráfica",
        pedreiro: "Pedreiro",
        pintor: "Pintor",
        croche: "Crochê",
        borracharia: "Borracharia",
        motocicleta: "Motocicletas",
        serralheria: "Serralheria",
        sorveteria: "Sorveteria",
        moveis_planejados: "Móveis Planejados",
        azulejista: "Azulejista",
        moda_fitness: "Moda Fitness",
        entrega_leite: "Entrega de Leite",
        hamburgueria: "Hamburgueria",
        home_care: "Home Care",
        meteriais_esportivos: "Materiais Esportivos",
        calcados: "Calçados",
        tec_enfermagem: "Técnico em Enfermagem",
        reforco_escolar: "Reforço Escolar",
        agua_mineral: "Água Mineral",
        porcelananto: "Porcelananto",
        cursinho: "Cursinho",
        educacao: "Educação",
        turismo: "Turismo",
        marketing_digital: "Marketing Digital",
        equipadora_automotiva: "Equipadora Automotiva",
        delivery_comida: "Delivery de Comida",
        lanches: "Lanches",
        higienizacao_estofados: "Higienização de Estofados",
        topografia: "Topografia",
        agronomia: "Agronomia",
        vidracaria: "Vidraçaria",
        arquitetura:"Arquitetura",
        sopa: "Sopa",
        personalizados: "Personalizados",
        cosmeticos: "Cosméticos",
        cama_mesa_banho: "Cama, Mesa e Banho",
        roupas_infantis: "Roupas Infantis",
        brinquedos: "Brinquedos",
        conserto_eletronicos: "Conserto de Eletrônicos",
        informatica: "Informática",
        joias_acessorios: "Joias e Acessórios",
        perfumaria: "Perfumaria",
        manicure: "Manicure",
        assistencia_tecnica_celulares: "Assistência Técnica de Celulares",
        pedicure: "Pedicure",
        gesso: "Gesso",
        pizzaria: "Pizzaria",
        artigos_femininos: "Artigos Femininos",
        churrascaria: "Churrascaria",
        serigrafia: "Serigrafia",
        seguranca_tecnologia: "Segurança e Tecnologia",
        barbearia: "Barbearia",
        salao_beleza: "Salão de Beleza",
        loja_veiculos: "Loja de Veículos",
        locadora_veiculos: "Locadora de Veículos",
        fisioterapia: "Fisioterapia",
        pediatria: "Pediatria",
        advocacia: "Advocacia"
    };
    return names[category] || category;
}

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

    const sortedCategories = Array.from(availableCategories).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
    );

    // limpa o select
    filter.innerHTML = "";

    // adiciona "todas"
    filter.appendChild(new Option("Todas as categorias", "all"));

    // adiciona apenas as categorias da cidade
    sortedCategories.forEach(category => {
        filter.appendChild(new Option(formatCategoryName(category), category));
    });

}

updateCategoriesByCity();

/* =========================
   INICIALIZAÇÃO
========================= */
updateFeedback();
animateVisibleItems();

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
            body: JSON.stringify({ site: 'Ita Serviços' })
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
   FUNÇÃO COMPARTILHAR
========================= */

document.querySelectorAll('.share-card').forEach(button => {
  button.addEventListener('click', async () => {
    const card = button.closest('.item');

    // força visual limpo
    card.classList.remove('hidden');

    const canvas = await html2canvas(card, {
      backgroundColor: "#ffffff",
      scale: 2
    });

    // Gera a imagem em base64 (necessário para o Capacitor)
    const base64Data = canvas.toDataURL("image/png");

// LÓGICA PARA APK (CAPACITOR)
if (window.Capacitor && window.Capacitor.isNativePlatform()) {
try {
    const { Share, Filesystem } = window.Capacitor.Plugins;

    // 1. Criar um nome de arquivo único
    const fileName = `ita-servico-${Date.now()}.png`;

    // 2. Salvar o Base64 como arquivo real no cache do celular
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data, // Sua variável canvas.toDataURL()
      directory: 'CACHE' // Salva na pasta temporária para não encher o celular do cliente
    });

    // 3. Compartilhar o caminho do arquivo gerado
    await Share.share({
      title: 'Patos Serviços',
      text: "*Patos Serviços 2026*\n\nEncontre tudo o que você precisa em um só lugar!\nAcesse: https://patosservicos.vercel.app\n",
      url: savedFile.uri, // Aqui passamos o "endereço" do arquivo no celular
      dialogTitle: 'Compartilhar serviço',
    });

    } catch (error) {
    console.error("Erro ao converter/compartilhar no App:", error);
    }
  return;
}

    // LÓGICA PARA PWA/NAVEGADOR (WEB)
    canvas.toBlob(blob => {
      const file = new File([blob], "patos-servicos.png", { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: "Patos Serviços",
          text: "*Patos Serviços 2026*\n\nEncontre tudo o que você precisa em um só lugar!\nAcesse: https://patosservicos.vercel.app\n"
        });
      } else {
        // fallback: download
        const link = document.createElement("a");
        link.href = base64Data;
        link.download = "ita-servicos.png";
        link.click();
      }
    });
  });
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