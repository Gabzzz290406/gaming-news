const CORS_PROXY = "https://corsproxy.io/?url=";
const STEAM_SEARCH_URL = "https://store.steampowered.com/api/storesearch/";
const DEBOUNCE_MS = 400;

const statusEl = document.getElementById("status");
const gridEl = document.getElementById("resultGrid");
const searchInput = document.getElementById("searchInput");

let debounceTimer = null;
let requestSeq = 0;

function formatPrice(cents, currency) {
  if (cents === 0) return "Gratuit";
  const amount = (cents / 100).toFixed(2).replace(".", ",");
  return `${amount} ${currency === "EUR" ? "€" : currency}`;
}

function epicSearchUrl(name) {
  return `https://store.epicgames.com/fr/browse?q=${encodeURIComponent(name)}&sortBy=relevancy&sortDir=DESC`;
}

function instantGamingUrl(name) {
  const base = `https://www.instant-gaming.com/en/search/?q=${encodeURIComponent(name)}`;
  const ref = AFFILIATE_CONFIG.instantGamingRef;
  return ref && ref !== "TON_CODE_INSTANT_GAMING" ? `${base}&igr=${encodeURIComponent(ref)}` : base;
}

function renderGame(game) {
  const card = document.createElement("div");
  card.className = "game-card";

  const thumbHtml = game.tiny_image
    ? `<img class="game-thumb" src="${game.tiny_image}" alt="" loading="lazy">`
    : `<div class="game-thumb"></div>`;

  const hasDiscount = game.price && game.price.initial !== game.price.final;
  const steamPriceHtml = game.price
    ? `<span class="store-price ${game.price.final === 0 ? "free" : ""}">${formatPrice(game.price.final, game.price.currency)}</span>
       ${hasDiscount ? `<span class="discount-badge">-${Math.round((1 - game.price.final / game.price.initial) * 100)}%</span>` : ""}`
    : `<span class="store-price">Voir le prix</span>`;

  const epicCode = AFFILIATE_CONFIG.epicCreatorCode;
  const epicNote =
    epicCode && epicCode !== "TON_CODE_EPIC"
      ? `<div class="epic-note">Sur Epic, pense à entrer le code créateur <strong>${epicCode}</strong> au moment de payer.</div>`
      : "";

  card.innerHTML = `
    ${thumbHtml}
    <div class="game-info">
      <h3 class="game-title">${game.name}</h3>
      <div class="game-meta">${game.platforms && game.platforms.windows ? "Windows" : ""}</div>
      <div class="store-list">
        <a class="store-link steam" href="https://store.steampowered.com/app/${game.id}" target="_blank" rel="noopener noreferrer nofollow">
          Steam · ${steamPriceHtml}
        </a>
        <a class="store-link epic" href="${epicSearchUrl(game.name)}" target="_blank" rel="noopener noreferrer nofollow">
          Voir sur Epic Games Store
        </a>
        <a class="store-link instant" href="${instantGamingUrl(game.name)}" target="_blank" rel="noopener noreferrer nofollow">
          Voir sur Instant Gaming
        </a>
        ${epicNote}
      </div>
    </div>
  `;
  return card;
}

function renderSpinner() {
  return `
    <div class="loading-state">
      <span class="spinner"></span>
      <span>Recherche en cours…</span>
    </div>
  `;
}

function createBackgroundBlobs() {
  const blob1 = document.createElement("div");
  blob1.className = "bg-blob bg-blob-1";
  const blob2 = document.createElement("div");
  blob2.className = "bg-blob bg-blob-2";
  document.body.prepend(blob2);
  document.body.prepend(blob1);
}

async function searchSteam(term) {
  const url = `${STEAM_SEARCH_URL}?term=${encodeURIComponent(term)}&cc=fr&l=french`;
  const res = await fetch(CORS_PROXY + encodeURIComponent(url));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

async function runSearch() {
  const term = searchInput.value.trim();
  gridEl.innerHTML = "";

  if (!term) {
    statusEl.textContent = "Tape le nom d'un jeu pour comparer les prix.";
    statusEl.classList.remove("error");
    return;
  }

  const seq = ++requestSeq;
  statusEl.innerHTML = renderSpinner();
  statusEl.classList.remove("error");

  try {
    const items = await searchSteam(term);
    if (seq !== requestSeq) return;

    if (items.length === 0) {
      statusEl.textContent = "Aucun jeu trouvé pour cette recherche.";
      return;
    }

    statusEl.textContent = "";
    const fragment = document.createDocumentFragment();
    items.slice(0, 10).forEach((game, i) => {
      const card = renderGame(game);
      card.style.animationDelay = `${i * 60}ms`;
      fragment.appendChild(card);
    });
    gridEl.appendChild(fragment);
  } catch (err) {
    if (seq !== requestSeq) return;
    statusEl.textContent = "Impossible de récupérer les prix pour le moment. Réessaie plus tard.";
    statusEl.classList.add("error");
  }
}

searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runSearch, DEBOUNCE_MS);
});

createBackgroundBlobs();
statusEl.textContent = "Tape le nom d'un jeu pour comparer les prix.";
