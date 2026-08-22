const FEEDS = [
  { name: "IGN", url: "https://feeds.ign.com/ign/games-all" },
  { name: "Eurogamer", url: "https://www.eurogamer.net/feed" },
  { name: "PC Gamer", url: "https://www.pcgamer.com/rss/" },
  { name: "Kotaku", url: "https://kotaku.com/rss" },
];

const RSS2JSON_ENDPOINT = "https://api.rss2json.com/v1/api.json";

const statusEl = document.getElementById("status");
const gridEl = document.getElementById("articleGrid");
const searchInput = document.getElementById("searchInput");
const resultCountEl = document.getElementById("resultCount");
const filterButtons = document.querySelectorAll(".filter-chip");

let allArticles = [];
let activeFilter = "all";

function tagFor(article) {
  const text = (article.title + " " + article.description).toLowerCase();
  if (/\bleak(ed|s)?\b|\brumo(u)?r/.test(text)) return "leak";
  if (/\bexclusiv/.test(text)) return "exclusive";
  if (/\brelease(d|s)?\b|\bout now\b|\blaunch/.test(text)) return "release";
  return "news";
}

function stripHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  return div.textContent || div.innerText || "";
}

function extractThumb(item) {
  if (item.thumbnail) return item.thumbnail;
  if (item.enclosure && item.enclosure.link) return item.enclosure.link;
  const match = /<img[^>]+src="([^">]+)"/.exec(item.description || item.content || "");
  return match ? match[1] : null;
}

async function loadFeed(feed) {
  const url = `${RSS2JSON_ENDPOINT}?rss_url=${encodeURIComponent(feed.url)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== "ok") throw new Error(data.message || "flux indisponible");

  return data.items.slice(0, 15).map((item) => {
    const description = stripHtml(item.description).slice(0, 220).trim();
    const article = {
      title: item.title,
      link: item.link,
      source: feed.name,
      pubDate: item.pubDate ? new Date(item.pubDate) : new Date(0),
      description,
      thumb: extractThumb(item),
    };
    article.tag = tagFor(article);
    return article;
  });
}

function formatDate(date) {
  if (!date || isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function renderArticles() {
  const query = normalize(searchInput.value.trim());

  const filtered = allArticles.filter((a) => {
    const matchesFilter = activeFilter === "all" || a.tag === activeFilter;
    const matchesQuery =
      !query ||
      normalize(a.title).includes(query) ||
      normalize(a.description).includes(query) ||
      normalize(a.source).includes(query);
    return matchesFilter && matchesQuery;
  });

  resultCountEl.textContent = filtered.length
    ? `${filtered.length} article${filtered.length > 1 ? "s" : ""}`
    : "";

  gridEl.innerHTML = "";

  if (filtered.length === 0) {
    statusEl.textContent = allArticles.length
      ? "Aucun article ne correspond à ta recherche."
      : "";
    statusEl.classList.remove("error");
    return;
  }
  statusEl.textContent = "";

  const fragment = document.createDocumentFragment();
  for (const article of filtered) {
    const card = document.createElement("a");
    card.className = "article-card";
    card.href = article.link;
    card.target = "_blank";
    card.rel = "noopener noreferrer";

    const thumbHtml = article.thumb
      ? `<img class="article-thumb" src="${article.thumb}" alt="" loading="lazy" onerror="this.style.display='none'">`
      : `<div class="article-thumb placeholder">Pas d'image</div>`;

    card.innerHTML = `
      ${thumbHtml}
      <div class="article-body">
        <div class="article-meta">
          <span class="tag ${article.tag}">${article.tag}</span>
          <span class="source-badge">${article.source}</span>
          <span>·</span>
          <span>${formatDate(article.pubDate)}</span>
        </div>
        <h3 class="article-title">${article.title}</h3>
        <p class="article-desc">${article.description}</p>
      </div>
    `;
    fragment.appendChild(card);
  }
  gridEl.appendChild(fragment);
}

async function init() {
  statusEl.textContent = "Chargement des actus…";

  const results = await Promise.allSettled(FEEDS.map(loadFeed));

  const failedFeeds = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      allArticles.push(...result.value);
    } else {
      failedFeeds.push(FEEDS[i].name);
    }
  });

  allArticles.sort((a, b) => b.pubDate - a.pubDate);

  if (allArticles.length === 0) {
    statusEl.textContent = "Impossible de charger les flux pour le moment. Réessaie plus tard.";
    statusEl.classList.add("error");
    return;
  }

  if (failedFeeds.length) {
    statusEl.textContent = `Certaines sources n'ont pas répondu (${failedFeeds.join(", ")}).`;
  } else {
    statusEl.textContent = "";
  }

  renderArticles();
}

searchInput.addEventListener("input", renderArticles);

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.filter;
    renderArticles();
  });
});

init();
