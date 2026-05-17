import { categorizeQuery } from "./categorize-client.js";
import { CATEGORIES, LISTINGS, DISCUSSIONS, USER } from "./data.js";
import {
  registerView,
  navigate,
  goBack,
  setNavTab,
  navTabForView,
  getCurrent,
} from "./router.js";

const POPULAR = [
  "Appartement à louer à Gombe",
  "Je cherche un chauffeur",
  "iPhone 13 pas cher",
  "Discussion sur Starlink",
];

const QUARTIERS = ["Gombe", "Limete", "Bandal", "Binza", "Kintambo", "Kinshasa"];

const app = document.getElementById("app");
const appHeader = document.getElementById("appHeader");
const headerBack = document.getElementById("headerBack");
const logoHome = document.getElementById("logoHome");
const menuBtn = document.getElementById("menuBtn");
const drawer = document.getElementById("drawer");
const drawerBackdrop = document.getElementById("drawerBackdrop");
const drawerClose = document.getElementById("drawerClose");
const navItems = document.querySelectorAll(".nav-item");

let searchQuery = "";
let resultsTab = "all";
let publishDraft = { text: "", category: null, quartier: "", prix: "", type: "demande" };
let currentListingId = null;
let currentDiscussionId = null;

const BACK_VIEWS = new Set([
  "results",
  "ad-detail",
  "publish-2",
  "publish-3",
  "discussion-detail",
]);

// Register views
[
  "home",
  "search",
  "results",
  "ad-detail",
  "publish-1",
  "publish-2",
  "publish-3",
  "discussions",
  "discussion-detail",
  "account",
].forEach((name) => {
  registerView(name, document.getElementById(`view-${name}`));
});

function closeDrawer() {
  drawer.hidden = true;
  drawerBackdrop.hidden = true;
  menuBtn.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
}

function openDrawer() {
  drawer.hidden = false;
  drawerBackdrop.hidden = false;
  menuBtn.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
}

function updateHeader(view) {
  const showBack = BACK_VIEWS.has(view) || view.startsWith("publish-");
  appHeader.classList.toggle("header-back-only", showBack);
  app.classList.toggle("show-ad-footer", view === "ad-detail");
}

function go(view, data) {
  navigate(view, { data });
  setNavTab(navTabForView(view), navItems);
  updateHeader(view);
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// --- Home pills ---
function renderHomePills() {
  const el = document.getElementById("homePills");
  el.innerHTML = POPULAR.map(
    (q) => `
    <button type="button" class="pill" data-query="${escapeHtml(q)}">
      <span class="pill-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF5500" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg></span>
      ${escapeHtml(q)}
    </button>`
  ).join("");
  el.querySelectorAll(".pill").forEach((p) => {
    p.addEventListener("click", () => openResults(p.dataset.query));
  });
}

// --- Categories ---
function renderCategories() {
  const ul = document.getElementById("categoryList");
  ul.innerHTML = CATEGORIES.map(
    (c) => `
    <li><button type="button" class="category-item" data-cat="${c.id}">
      <span class="category-item-icon">${c.icon}</span>
      ${escapeHtml(c.label)}
      <span class="category-item-chevron">›</span>
    </button></li>`
  ).join("");
  ul.querySelectorAll(".category-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const label = CATEGORIES.find((x) => x.id === btn.dataset.cat)?.label || "";
      openResults(label);
    });
  });
}

// --- Results ---
function filterListings(query) {
  const q = query.toLowerCase();
  return LISTINGS.filter(
    (l) =>
      !q ||
      l.title.toLowerCase().includes(q) ||
      l.location.toLowerCase().includes(q) ||
      l.description.toLowerCase().includes(q) ||
      q.includes("gombe") && l.location.toLowerCase().includes("gombe") ||
      q.includes("appartement") && l.category === "immobilier" ||
      q.includes("iphone") && l.category === "electronique" ||
      q.includes("chauffeur") && l.category === "vehicules_transport"
  );
}

function filterDiscussions(query) {
  const q = query.toLowerCase();
  return DISCUSSIONS.filter(
    (d) => !q || d.title.toLowerCase().includes(q) || d.body.toLowerCase().includes(q)
  );
}

function renderResults() {
  const list = document.getElementById("resultsList");
  const empty = document.getElementById("emptyResults");
  document.getElementById("resultsSearchInput").value = searchQuery;

  const listings = filterListings(searchQuery);
  const discussions = filterDiscussions(searchQuery);

  let html = "";

  if (resultsTab === "all" || resultsTab === "annonces") {
    html += listings
      .map(
        (l) => `
      <button type="button" class="listing-card" data-listing="${l.id}">
        <img class="listing-thumb" src="${l.image}" alt="" loading="lazy" />
        <span class="listing-body">
          <span class="listing-title">${escapeHtml(l.title)}</span>
          <span class="listing-price">${escapeHtml(l.price)}</span>
          <span class="listing-meta">${escapeHtml(l.location)} · ${escapeHtml(l.time)}</span>
        </span>
        <span class="listing-fav">♡</span>
      </button>`
      )
      .join("");
  }

  if (resultsTab === "all" || resultsTab === "discussions") {
    html += discussions
      .map(
        (d) => `
      <button type="button" class="listing-card" data-discussion="${d.id}">
        <span class="listing-thumb" style="display:flex;align-items:center;justify-content:center;font-size:2rem;background:var(--lavender)">💬</span>
        <span class="listing-body">
          <span class="listing-title">${escapeHtml(d.title)}</span>
          <span class="listing-meta">${d.replies} réponses · ${escapeHtml(d.time)}</span>
        </span>
      </button>`
      )
      .join("");
  }

  list.innerHTML = html;
  const hasItems = html.length > 0;
  empty.hidden = hasItems;
  list.hidden = !hasItems;

  list.querySelectorAll("[data-listing]").forEach((btn) => {
    btn.addEventListener("click", () => openAd(btn.dataset.listing));
  });
  list.querySelectorAll("[data-discussion]").forEach((btn) => {
    btn.addEventListener("click", () => openDiscussion(btn.dataset.discussion));
  });

  list.querySelectorAll(".listing-fav").forEach((fav) => {
    fav.addEventListener("click", (e) => {
      e.stopPropagation();
      fav.classList.toggle("active");
      fav.textContent = fav.classList.contains("active") ? "♥" : "♡";
    });
  });
}

function openResults(query) {
  searchQuery = query.trim();
  resultsTab = query.toLowerCase().includes("discussion") ? "discussions" : "all";
  document.querySelectorAll("#resultsTabs .tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === resultsTab || (resultsTab === "all" && t.dataset.tab === "all"));
  });
  renderResults();
  go("results");
}

// --- Ad detail ---
function openAd(id) {
  const ad = LISTINGS.find((l) => l.id === id);
  if (!ad) return;
  currentListingId = id;
  document.getElementById("adImage").src = ad.image;
  document.getElementById("adImage").alt = ad.title;
  document.getElementById("adCounter").textContent = `1/${ad.photos}`;
  document.getElementById("adTitle").textContent = ad.title;
  document.getElementById("adPrice").textContent = ad.price;
  document.getElementById("adLocation").textContent = `${ad.location} · ${ad.time}`;
  document.getElementById("adDesc").textContent = ad.description;
  document.getElementById("adTags").innerHTML = ad.tags
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
    .join("");
  document.getElementById("adWhatsApp").onclick = () => {
    window.open(`https://wa.me/${ad.phone.replace(/\D/g, "")}`, "_blank");
  };
  document.getElementById("adCall").onclick = () => {
    window.location.href = `tel:${ad.phone}`;
  };
  go("ad-detail");
}

// --- Discussions ---
function renderDiscussions() {
  const el = document.getElementById("discussionsList");
  const q = document.getElementById("discussSearchInput").value.toLowerCase();
  const items = DISCUSSIONS.filter(
    (d) => !q || d.title.toLowerCase().includes(q) || d.body.toLowerCase().includes(q)
  );
  el.innerHTML = items
    .map(
      (d) => `
    <button type="button" class="discussion-card" data-id="${d.id}">
      <p class="discussion-card-title">${escapeHtml(d.title)}</p>
      <p class="discussion-card-meta"><span>💬 ${d.replies} réponses</span><span>${escapeHtml(d.time)}</span></p>
    </button>`
    )
    .join("");
  el.querySelectorAll(".discussion-card").forEach((c) => {
    c.addEventListener("click", () => openDiscussion(c.dataset.id));
  });
}

function openDiscussion(id) {
  const d = DISCUSSIONS.find((x) => x.id === id);
  if (!d) return;
  currentDiscussionId = id;
  document.getElementById("discussDetailTitle").textContent = d.title;
  document.getElementById("discussMainPost").innerHTML = `
    <div class="thread-author">
      <span class="avatar">${d.avatar}</span>
      <div><div class="thread-name">${escapeHtml(d.author)}</div><div class="thread-time">${escapeHtml(d.time)}</div></div>
    </div>
    <p class="thread-body">${escapeHtml(d.body)}</p>
    <div class="thread-actions"><span>👍 J'aime</span><span>↩ Répondre</span><span>↗ Partager</span></div>
  `;
  document.getElementById("discussReplies").innerHTML = d.thread
    .map(
      (r) => `
    <div class="thread-reply">
      <div class="thread-author">
        <span class="avatar">${r.avatar}</span>
        <div><div class="thread-name">${escapeHtml(r.author)}</div><div class="thread-time">${escapeHtml(r.time)}</div></div>
      </div>
      <p class="thread-body">${escapeHtml(r.text)}</p>
    </div>`
    )
    .join("");
  go("discussion-detail");
}

function fillCategorySelect() {
  const sel = document.getElementById("pubCategory");
  sel.innerHTML = CATEGORIES.filter((c) => c.id !== "discussion")
    .map((c) => `<option value="${c.id}">${escapeHtml(c.label)}</option>`)
    .join("");
}

function extractQuartier(text) {
  const lower = text.toLowerCase();
  return QUARTIERS.find((q) => lower.includes(q.toLowerCase())) || "Kinshasa";
}

function extractPrix(text) {
  const m = text.match(/(\d[\d\s]*)\s*\$|budget\s*(\d+)/i);
  if (m) return (m[1] || m[2]).replace(/\s/g, "") + " $";
  return "";
}

async function runPublishAi() {
  const hint = document.getElementById("publishAiHint");
  hint.textContent = "⏳ Analyse IA en cours…";
  const data = await categorizeQuery(publishDraft.text);
  publishDraft.category = data;
  const catId = data.categoryId === "autre" || data.categoryId === "discussion"
    ? "emploi_services"
    : data.categoryId;
  document.getElementById("pubCategory").value = catId;
  document.getElementById("pubQuartier").value = extractQuartier(publishDraft.text);
  document.getElementById("pubPrix").value =
    extractPrix(publishDraft.text) || (data.intent === "demande" ? "" : "Sur devis");
  document.getElementById("pubType").value = data.intent === "offre" ? "offre" : "demande";
  hint.textContent = `✨ ${data.categoryIcon} ${data.summary}`;
}

function renderPublishPreview() {
  const cat =
    CATEGORIES.find((c) => c.id === document.getElementById("pubCategory").value)?.label || "Annonce";
  document.getElementById("publishPreview").innerHTML = `
    <img src="${LISTINGS[0].image}" alt="" />
    <div class="preview-card-body">
      <strong>${escapeHtml(publishDraft.text.slice(0, 80))}${publishDraft.text.length > 80 ? "…" : ""}</strong>
      <p class="listing-price" style="margin-top:0.5rem">${escapeHtml(document.getElementById("pubPrix").value || "—")}</p>
      <p class="listing-meta">${escapeHtml(cat)} · ${escapeHtml(document.getElementById("pubQuartier").value)}</p>
    </div>`;
}

function initPublishStep2() {
  fillCategorySelect();
  runPublishAi();
}

function init() {
  renderHomePills();
  renderCategories();
  document.getElementById("profileName").textContent = USER.name;
  document.getElementById("profileSince").textContent = USER.since;
  document.getElementById("profileAvatar").textContent = USER.avatar;

  document.getElementById("homeSearchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    openResults(document.getElementById("homeSearchInput").value);
  });

  document.getElementById("catSearchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    openResults(document.getElementById("catSearchInput").value);
  });

  document.getElementById("resultsSearchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    openResults(document.getElementById("resultsSearchInput").value);
  });

  document.querySelectorAll("#resultsTabs .tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      resultsTab = tab.dataset.tab;
      document.querySelectorAll("#resultsTabs .tab").forEach((t) => t.classList.toggle("active", t === tab));
      renderResults();
    });
  });

  document.getElementById("publishNext1").addEventListener("click", () => {
    publishDraft.text = document.getElementById("publishText").value.trim();
    if (!publishDraft.text) return;
    go("publish-2");
    initPublishStep2();
  });

  document.getElementById("publishNext2").addEventListener("click", () => {
    renderPublishPreview();
    go("publish-3");
  });

  document.getElementById("publishBack2").addEventListener("click", () => go("publish-1"));
  document.getElementById("publishBack3").addEventListener("click", () => go("publish-2"));

  document.getElementById("publishSubmit").addEventListener("click", () => {
    alert("Annonce publiée sur Kinshout !");
    document.getElementById("publishText").value = "";
    publishDraft.text = "";
    go("home");
  });

  document.getElementById("discussSearchInput").addEventListener("input", renderDiscussions);

  document.getElementById("replyForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = e.target.querySelector(".reply-input");
    if (!input.value.trim()) return;
    alert("Réponse publiée !");
    input.value = "";
  });

  headerBack.addEventListener("click", () => {
    const v = goBack();
    if (v) {
      setNavTab(navTabForView(v), navItems);
      updateHeader(v);
    }
  });
  document.getElementById("adBackBtn").addEventListener("click", () => {
    const v = goBack();
    if (v) {
      setNavTab(navTabForView(v), navItems);
      updateHeader(v);
      app.classList.toggle("show-ad-footer", v === "ad-detail");
    }
  });

  logoHome.addEventListener("click", (e) => {
    e.preventDefault();
    go("home");
  });

  menuBtn.addEventListener("click", () => (drawer.hidden ? openDrawer() : closeDrawer()));
  drawerClose.addEventListener("click", closeDrawer);
  drawerBackdrop.addEventListener("click", closeDrawer);

  document.querySelectorAll("[data-go]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      closeDrawer();
      go(el.dataset.go);
      if (el.dataset.go === "discussions") renderDiscussions();
    });
  });

  document.querySelectorAll(".drawer-link").forEach((el) => {
    el.addEventListener("click", () => {
      closeDrawer();
      go(el.dataset.go);
      if (el.dataset.go === "discussions") renderDiscussions();
    });
  });

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const tab = item.dataset.tab;
      if (tab === "home") go("home");
      else if (tab === "search") go("search");
      else if (tab === "publish") go("publish-1");
      else if (tab === "discussions") {
        go("discussions");
        renderDiscussions();
      } else if (tab === "account") go("account");
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!drawer.hidden) closeDrawer();
      else if (getCurrent() !== "home") {
        const v = goBack();
        if (v) {
          setNavTab(navTabForView(v), navItems);
          updateHeader(v);
        }
      }
    }
  });

  const q = new URLSearchParams(location.search).get("q");
  if (q) openResults(q);
}

init();