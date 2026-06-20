import { categorizeQuery } from "./categorize-client.js";
import { api } from "./api-client.js";
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

const WHATSAPP_KEY = "kinshout_whatsapp";
const FACEBOOK_APP_ID =
  (typeof window !== "undefined" && window.KINSHOUT_FACEBOOK_APP_ID) ||
  import.meta?.env?.VITE_FACEBOOK_APP_ID ||
  "";
const MAX_PUBLISH_PHOTOS = 10;

let searchQuery = "";
let resultsTab = "all";
let selectedCategory = null;
let publishDraft = {
  editingId: null,
  text: "",
  category: null,
  quartier: "",
  prix: "",
  type: "demande",
  photos: [],
  resume: null,
  resumeUrl: null,
};
let currentListingId = null;
let currentDiscussionId = null;
let currentAdPhotoIndex = 0;
let authUser = null;
let facebookSdkReady = false;

const CATEGORY_QUERIES = {
  immobilier: "Appartement à louer à Gombe",
  vehicules_transport: "Véhicules",
  emploi_services: "Emplois",
  electronique: "Électroniques",
  maison_jardin: "Services",
  discussion: "Discussions",
};

const PUBLISH_CATEGORY_LABELS = {
  immobilier: "Immobilier",
  vehicules_transport: "Véhicules",
  emploi_services: "Emplois",
  electronique: "Électroniques",
  maison_jardin: "Services",
};

const TAB_ROUTES = {
  home: "home",
  search: "search",
  publish: "publish-1",
  discussions: "discussions",
  account: "account",
};

const BACK_VIEWS = new Set([
  "results",
  "ad-detail",
  "publish-2",
  "publish-3",
  "discussion-detail",
  "my-adverts",
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
  "my-adverts",
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
  const isPublish = view.startsWith("publish-");
  appHeader.classList.toggle("header-back-only", showBack);
  app.classList.toggle("show-ad-footer", view === "ad-detail");
  app.classList.toggle("is-publish", isPublish);
}

function go(view, data) {
  if (view === "publish" || view === "publier" || view === "deposer") {
    view = "publish-1";
  }
  if (view === "publish-1" && !isSignedIn()) {
    alert("Connectez-vous avec Facebook pour publier une annonce.");
    view = "account";
  } else if (view === "publish-1" && !hasWhatsAppProfile()) {
    alert("Votre profil doit inclure un numéro WhatsApp valide.");
    view = "account";
  }
  navigate(view, { data });
  setNavTab(navTabForView(view), navItems);
  updateHeader(view);

  if (view === "discussions") {
    renderDiscussions();
  }
  if (view === "account") {
    refreshAccountView();
  }
  if (view === "my-adverts") {
    if (!isSignedIn()) {
      alert("Connectez-vous pour gérer vos annonces.");
      navigate("account", { replace: true });
      setNavTab("account", navItems);
      updateHeader("account");
      refreshAccountView();
      return;
    }
    renderMyAdverts();
  }
  if (view.startsWith("publish-")) {
    updatePublishModeUi();
  }
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function formatPublishedTime(time) {
  const clean = time.replace(/^Il y a\s*/i, "").replace(/\s+/g, "");
  return `Publié il y a ${clean}`;
}

function isSignedIn() {
  return Boolean(api.auth.getToken());
}

function profileInitials(name) {
  return (
    (name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "?"
  );
}

function getWhatsAppNumber() {
  return authUser?.whatsAppNumber || localStorage.getItem(WHATSAPP_KEY) || USER.whatsapp || "";
}

function setWhatsAppNumber(number) {
  localStorage.setItem(WHATSAPP_KEY, number);
  USER.whatsapp = number;
}

function normalizeWhatsApp(number) {
  const digits = number.replace(/\D/g, "");
  if (digits.startsWith("243") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 9) return `+243${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return "";
}

function hasWhatsAppProfile() {
  if (authUser?.hasWhatsApp) return true;
  return normalizeWhatsApp(getWhatsAppNumber()).length > 0;
}

function setFacebookLoginStatus(message, kind = "") {
  const status = document.getElementById("facebookLoginStatus");
  if (!status) return;
  status.textContent = message;
  status.className = `profile-whatsapp-status${kind ? ` is-${kind}` : ""}`;
}

function initFacebookSdk() {
  if (!FACEBOOK_APP_ID) return Promise.resolve(false);
  if (facebookSdkReady && window.FB) return Promise.resolve(true);

  return new Promise((resolve) => {
    const finish = () => {
      if (!window.FB) {
        resolve(false);
        return;
      }
      window.FB.init({
        appId: FACEBOOK_APP_ID,
        cookie: true,
        xfbml: false,
        version: "v19.0",
      });
      facebookSdkReady = true;
      resolve(true);
    };

    if (window.FB) {
      finish();
      return;
    }

    window.fbAsyncInit = finish;
    setTimeout(() => resolve(facebookSdkReady), 3000);
  });
}

function loginWithFacebook() {
  return new Promise((resolve, reject) => {
    window.FB.login(
      (response) => {
        if (response.authResponse?.accessToken) {
          resolve(response.authResponse.accessToken);
          return;
        }
        reject(new Error("Connexion Facebook annulée."));
      },
      { scope: "public_profile,email" }
    );
  });
}

async function refreshAccountView() {
  const guest = document.getElementById("accountGuest");
  const signedIn = document.getElementById("accountSignedIn");

  if (!isSignedIn()) {
    authUser = null;
    guest.hidden = false;
    signedIn.hidden = true;
    setFacebookLoginStatus("");
    return;
  }

  try {
    authUser = await api.auth.me();
    if (authUser?.whatsAppNumber) setWhatsAppNumber(authUser.whatsAppNumber);
    guest.hidden = true;
    signedIn.hidden = false;
    document.getElementById("profileName").textContent = authUser.displayName;
    document.getElementById("profileSince").textContent = authUser.memberSince;
    document.getElementById("profileAvatar").textContent = profileInitials(authUser.displayName);
    updateProfileWhatsAppUi();
  } catch {
    api.auth.clearSession();
    await refreshAccountView();
  }
}

function listingImages(ad) {
  if (Array.isArray(ad.images) && ad.images.length) return ad.images;
  return ad.image ? [ad.image] : [];
}

function listingThumb(ad) {
  const images = listingImages(ad);
  return images[0] ? displayImageUrl(images[0]) : "";
}

function whatsappLink(number) {
  const digits = (number || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function updateProfileWhatsAppUi() {
  const input = document.getElementById("profileWhatsApp");
  const status = document.getElementById("profileWhatsAppStatus");
  const card = document.getElementById("profileWhatsAppCard");
  const saved = getWhatsAppNumber();
  input.value = saved;
  if (hasWhatsAppProfile()) {
    setProfileWhatsAppStatus("✓ Numéro enregistré — vous pouvez publier et être contacté.", "ok");
    card.classList.remove("is-missing");
  } else {
    setProfileWhatsAppStatus("Ajoutez votre WhatsApp pour publier une annonce.", "warn");
    card.classList.add("is-missing");
  }
}

function setProfileWhatsAppStatus(message, kind = "") {
  const status = document.getElementById("profileWhatsAppStatus");
  if (!status) return;
  status.textContent = message;
  status.className = `profile-whatsapp-status${kind ? ` is-${kind}` : ""}`;
}

function toUploadPath(url) {
  if (!url) return "";
  if (url.startsWith("/uploads/")) return url;
  try {
    const path = new URL(url).pathname;
    return path.startsWith("/uploads/") ? path : url;
  } catch {
    return url;
  }
}

function displayImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("blob:") || url.startsWith("data:")) return url;
  return `${api.baseUrl}${url.startsWith("/") ? url : `/${url}`}`;
}

function apiAdvertToListing(ad) {
  return {
    id: ad.id,
    title: ad.title,
    price: ad.price || "—",
    location: ad.location || "Kinshasa",
    time: ad.time,
    category: ad.categoryId,
    intent: ad.intent,
    images: ad.imageUrls || [],
    resumeUrl: ad.resumeUrl,
    tags: ad.tags || [],
    description: ad.description,
    whatsapp: ad.whatsAppNumber,
  };
}

function ensureWhatsAppForPublish() {
  if (!isSignedIn()) {
    alert("Connectez-vous avec Facebook pour publier.");
    go("account");
    return false;
  }
  if (hasWhatsAppProfile()) return true;
  alert("Votre profil doit inclure un numéro WhatsApp valide.");
  go("account");
  return false;
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
      <span class="category-item-icon category-icon-${c.id}">${c.icon}</span>
      ${escapeHtml(c.label)}
      <span class="category-item-chevron">›</span>
    </button></li>`
  ).join("");
  ul.querySelectorAll(".category-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      openCategoryResults(btn.dataset.cat);
    });
  });
}

// --- Results ---
function filterListings(query) {
  if (selectedCategory) {
    return LISTINGS.filter(
      (l) =>
        l.category === selectedCategory ||
        (selectedCategory === "maison_jardin" && l.category === "emploi_services")
    );
  }

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
  if (selectedCategory === "discussion") return DISCUSSIONS;
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
        <img class="listing-thumb" src="${listingThumb(l)}" alt="" loading="lazy" />
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
  selectedCategory = null;
  resultsTab = query.toLowerCase().includes("discussion") ? "discussions" : "all";
  document.querySelectorAll("#resultsTabs .tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === resultsTab || (resultsTab === "all" && t.dataset.tab === "all"));
  });
  renderResults();
  go("results");
}

function openCategoryResults(categoryId) {
  selectedCategory = categoryId;
  searchQuery = CATEGORY_QUERIES[categoryId] || "";
  resultsTab = categoryId === "discussion" ? "discussions" : "all";
  document.querySelectorAll("#resultsTabs .tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === resultsTab);
  });
  renderResults();
  go("results");
}

// --- Ad detail ---
function showAdPhoto(ad, index) {
  const images = listingImages(ad);
  if (!images.length) {
    document.getElementById("adImage").src = "";
    document.getElementById("adImage").alt = ad.title;
    document.getElementById("adImage").hidden = true;
    document.getElementById("adCounter").hidden = true;
    return;
  }

  document.getElementById("adImage").hidden = false;
  document.getElementById("adCounter").hidden = images.length <= 1;
  currentAdPhotoIndex = ((index % images.length) + images.length) % images.length;
  document.getElementById("adImage").src = displayImageUrl(images[currentAdPhotoIndex]);
  document.getElementById("adImage").alt = ad.title;
  document.getElementById("adCounter").textContent = `${currentAdPhotoIndex + 1}/${images.length}`;
}

function openAd(id) {
  const ad = LISTINGS.find((l) => l.id === id);
  if (!ad) return;
  currentListingId = id;
  showAdPhoto(ad, 0);
  document.getElementById("adGallery").onclick = () => {
    if (listingImages(ad).length > 1) showAdPhoto(ad, currentAdPhotoIndex + 1);
  };
  document.getElementById("adTitle").textContent = ad.title;
  document.getElementById("adPrice").textContent = ad.price;
  const detailLocation = ad.location.includes("Kinshasa") ? ad.location : `${ad.location}, Kinshasa`;
  document.getElementById("adLocation").textContent = `${detailLocation} · ${formatPublishedTime(ad.time)}`;
  document.getElementById("adDesc").textContent = ad.description;
  document.getElementById("adTags").innerHTML = ad.tags
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
    .join("");

  const resumeEl = document.getElementById("adResume");
  if (ad.resumeUrl) {
    resumeEl.innerHTML = `<a href="${escapeHtml(ad.resumeUrl)}" target="_blank" rel="noopener">📄 CV disponible</a>`;
    resumeEl.hidden = false;
  } else {
    resumeEl.hidden = true;
    resumeEl.innerHTML = "";
  }

  const wa = whatsappLink(ad.whatsapp);
  const waBtn = document.getElementById("adWhatsApp");
  if (wa) {
    waBtn.disabled = false;
    waBtn.textContent = "Contacter sur WhatsApp";
    waBtn.onclick = () => window.open(wa, "_blank");
  } else {
    waBtn.disabled = true;
    waBtn.textContent = "WhatsApp indisponible";
    waBtn.onclick = null;
  }
  go("ad-detail");
}

// --- Discussions ---
function renderDiscussions() {
  const el = document.getElementById("discussionsList");
  const q = document.getElementById("discussSearchInput").value.toLowerCase();
  const activeTab =
    document.querySelector("[data-discuss-tab].active")?.dataset.discussTab || "popular";
  const items = DISCUSSIONS.filter(
    (d) => !q || d.title.toLowerCase().includes(q) || d.body.toLowerCase().includes(q)
  );
  const visibleItems =
    activeTab === "recent" ? [...items].reverse() : [...items].sort((a, b) => b.replies - a.replies);

  el.innerHTML = visibleItems
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
    .map((c) => `<option value="${c.id}">${escapeHtml(PUBLISH_CATEGORY_LABELS[c.id] || c.label)}</option>`)
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
  updatePublishResumeVisibility();
}

function updatePublishResumeVisibility() {
  const categoryId = document.getElementById("pubCategory").value;
  const type = document.getElementById("pubType").value;
  const section = document.getElementById("publishResumeSection");
  const show = categoryId === "emploi_services" && type === "demande";
  section.hidden = !show;
}

function updatePublishModeUi() {
  const isEdit = Boolean(publishDraft.editingId);
  const submit = document.getElementById("publishSubmit");
  if (submit) submit.textContent = isEdit ? "Enregistrer les modifications" : "Publier maintenant";
  document.querySelectorAll("#view-publish-2 .page-title, #view-publish-3 .page-title").forEach((el) => {
    el.textContent = isEdit ? "Modifier l'annonce" : "Déposer une annonce";
  });
}

function resetPublishDraft() {
  publishDraft.photos.forEach((photo) => {
    if (photo.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(photo.previewUrl);
  });
  publishDraft = {
    editingId: null,
    text: "",
    category: null,
    quartier: "",
    prix: "",
    type: "demande",
    photos: [],
    resume: null,
    resumeUrl: null,
  };
  document.getElementById("publishText").value = "";
  document.getElementById("publishCount").textContent = "0/1000";
  renderPublishPhotoGrid();
  updatePublishResumeLabel();
  document.getElementById("publishResumeInput").value = "";
  updatePublishModeUi();
}

async function renderMyAdverts() {
  const list = document.getElementById("myAdvertsList");
  const empty = document.getElementById("myAdvertsEmpty");
  list.innerHTML = '<p class="profile-whatsapp-status">Chargement…</p>';
  empty.hidden = true;

  try {
    const adverts = await api.adverts.listMine();
    if (!adverts.length) {
      list.innerHTML = "";
      empty.hidden = false;
      return;
    }

    list.innerHTML = adverts
      .map(
        (ad) => `
      <article class="my-advert-card">
        <div class="my-advert-body">
          <h2 class="my-advert-title">${escapeHtml(ad.title)}</h2>
          <p class="my-advert-meta">${escapeHtml(ad.price || "—")} · ${escapeHtml(ad.location || "Kinshasa")} · ${escapeHtml(ad.time)}</p>
        </div>
        <button type="button" class="btn-primary-inline my-advert-edit" data-id="${ad.id}">Modifier</button>
      </article>`
      )
      .join("");

    list.querySelectorAll(".my-advert-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ad = adverts.find((item) => item.id === btn.dataset.id);
        if (ad) startEditAdvert(ad);
      });
    });
  } catch (err) {
    list.innerHTML = "";
    empty.textContent = err.message || "Impossible de charger vos annonces.";
    empty.hidden = false;
  }
}

function startEditAdvert(ad) {
  publishDraft.photos.forEach((photo) => {
    if (photo.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(photo.previewUrl);
  });

  publishDraft = {
    editingId: ad.id,
    text: ad.description,
    category: { categoryId: ad.categoryId },
    quartier: ad.location || "",
    prix: ad.price || "",
    type: ad.intent || "demande",
    photos: (ad.imageUrls || []).map((url) => ({
      existingUrl: toUploadPath(url),
      previewUrl: displayImageUrl(url),
    })),
    resume: null,
    resumeUrl: ad.resumeUrl ? toUploadPath(ad.resumeUrl) : null,
  };

  document.getElementById("publishText").value = ad.description;
  document.getElementById("publishCount").textContent = `${ad.description.length}/1000`;
  renderPublishPhotoGrid();
  updatePublishResumeLabel();
  go("publish-1");
}

async function submitPublish() {
  if (!ensureWhatsAppForPublish()) return;

  const submitBtn = document.getElementById("publishSubmit");
  const wasEdit = Boolean(publishDraft.editingId);
  submitBtn.disabled = true;
  submitBtn.textContent = wasEdit ? "Enregistrement…" : "Publication…";

  try {
    const newFiles = publishDraft.photos.filter((photo) => photo.file).map((photo) => photo.file);
    const uploadedUrls = newFiles.length ? await api.uploads.images(newFiles) : [];
    const existingUrls = publishDraft.photos
      .filter((photo) => photo.existingUrl)
      .map((photo) => photo.existingUrl);
    const imageUrls = [...existingUrls, ...uploadedUrls.map(toUploadPath)];

    if (imageUrls.length > MAX_PUBLISH_PHOTOS) {
      throw new Error(`Maximum ${MAX_PUBLISH_PHOTOS} photos par annonce.`);
    }

    let resumeUrl = publishDraft.resumeUrl || null;
    if (publishDraft.resume?.file) {
      resumeUrl = toUploadPath(await api.uploads.resume(publishDraft.resume.file));
    }

    const payload = {
      text: publishDraft.text,
      price: document.getElementById("pubPrix").value.trim() || null,
      location: document.getElementById("pubQuartier").value.trim() || null,
      imageUrls,
      resumeUrl,
      intent: document.getElementById("pubType").value,
    };

    const saved = wasEdit
      ? await api.adverts.update(publishDraft.editingId, payload)
      : await api.adverts.create(payload);

    const listing = apiAdvertToListing(saved);
    const existingIndex = LISTINGS.findIndex((item) => item.id === listing.id);
    if (existingIndex >= 0) LISTINGS[existingIndex] = listing;
    else LISTINGS.unshift(listing);

    resetPublishDraft();
    alert(wasEdit ? "Annonce mise à jour !" : "Annonce publiée sur Kinshout !");
    go("my-adverts");
  } catch (err) {
    alert(err.message || "Impossible de publier l'annonce.");
  } finally {
    submitBtn.disabled = false;
    updatePublishModeUi();
  }
}

function renderPublishPhotoGrid() {
  const grid = document.getElementById("publishPhotoGrid");
  const hint = document.getElementById("publishPhotoHint");
  if (!publishDraft.photos.length) {
    grid.hidden = true;
    grid.innerHTML = "";
    hint.textContent = "Photos facultatives · max 10";
    return;
  }

  grid.hidden = false;
  hint.textContent = `${publishDraft.photos.length}/${MAX_PUBLISH_PHOTOS} photo(s)`;
  grid.innerHTML = publishDraft.photos
    .map(
      (photo, index) => `
      <figure class="publish-photo-item">
        <img src="${photo.previewUrl}" alt="" />
        <button type="button" class="publish-photo-remove" data-index="${index}" aria-label="Supprimer">×</button>
      </figure>`
    )
    .join("");

  grid.querySelectorAll(".publish-photo-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      const photo = publishDraft.photos[index];
      if (photo?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(photo.previewUrl);
      publishDraft.photos.splice(index, 1);
      renderPublishPhotoGrid();
    });
  });
}

function addPublishPhotos(fileList) {
  const remaining = MAX_PUBLISH_PHOTOS - publishDraft.photos.length;
  if (remaining <= 0) {
    alert(`Maximum ${MAX_PUBLISH_PHOTOS} photos.`);
    return;
  }

  Array.from(fileList)
    .slice(0, remaining)
    .forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      publishDraft.photos.push({ file, previewUrl: URL.createObjectURL(file) });
    });
  renderPublishPhotoGrid();
}

function updatePublishResumeLabel() {
  const nameEl = document.getElementById("publishResumeName");
  if (publishDraft.resume) {
    nameEl.textContent = publishDraft.resume.file.name;
    nameEl.hidden = false;
  } else if (publishDraft.resumeUrl) {
    nameEl.textContent = publishDraft.resumeUrl.split("/").pop();
    nameEl.hidden = false;
  } else {
    nameEl.hidden = true;
    nameEl.textContent = "";
  }
}

function renderPublishPreview() {
  const categoryId = document.getElementById("pubCategory").value;
  const cat = PUBLISH_CATEGORY_LABELS[categoryId] || "Annonce";
  const quartier = document.getElementById("pubQuartier").value || "Kinshasa";
  const prix = document.getElementById("pubPrix").value || "—";
  const type = document.getElementById("pubType").value === "offre" ? "Offre" : "Recherche";
  const photosHtml = publishDraft.photos.length
    ? `<div class="preview-photos">${publishDraft.photos
        .map((p) => `<img src="${p.previewUrl}" alt="" />`)
        .join("")}</div>`
    : `<div class="preview-no-photo">Sans photo</div>`;
  const resumeHtml = publishDraft.resume
    ? `<div><dt>CV</dt><dd>${escapeHtml(publishDraft.resume.file.name)}</dd></div>`
    : "";

  document.getElementById("publishPreview").innerHTML = `
    <div class="preview-card-body">
      <strong>${escapeHtml(publishDraft.text.slice(0, 120))}${publishDraft.text.length > 120 ? "…" : ""}</strong>
      ${photosHtml}
      <dl class="preview-meta">
        <div><dt>Catégorie</dt><dd>${escapeHtml(cat)}</dd></div>
        <div><dt>Quartier</dt><dd>${escapeHtml(quartier)}</dd></div>
        <div><dt>Prix</dt><dd>${escapeHtml(prix)}</dd></div>
        <div><dt>Type</dt><dd>${escapeHtml(type)}</dd></div>
        ${resumeHtml}
      </dl>
    </div>`;
}

function initPublishStep2() {
  fillCategorySelect();
  if (publishDraft.editingId) {
    document.getElementById("pubCategory").value =
      PUBLISH_CATEGORY_LABELS[publishDraft.category?.categoryId]
        ? publishDraft.category.categoryId
        : "emploi_services";
    document.getElementById("pubQuartier").value = publishDraft.quartier || "";
    document.getElementById("pubPrix").value = publishDraft.prix || "";
    document.getElementById("pubType").value = publishDraft.type || "demande";
    document.getElementById("publishAiHint").textContent = "Modifiez les détails si nécessaire.";
    updatePublishResumeVisibility();
  } else {
    runPublishAi();
  }
}

function init() {
  renderHomePills();
  renderCategories();
  refreshAccountView();
  initFacebookSdk();

  const homeInput = document.getElementById("homeSearchInput");
  const publishText = document.getElementById("publishText");
  const publishCount = document.getElementById("publishCount");
  const publishPhotoInput = document.getElementById("publishPhotoInput");
  const publishResumeInput = document.getElementById("publishResumeInput");

  function updatePublishTextState() {
    const length = publishText.value.length;
    publishCount.textContent = `${length}/1000`;
  }

  publishText.addEventListener("input", updatePublishTextState);
  updatePublishTextState();

  document.getElementById("homeSearchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    openResults(homeInput.value);
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
    if (!ensureWhatsAppForPublish()) return;
    publishDraft.text = publishText.value.trim();
    if (!publishDraft.text) {
      alert("Décrivez votre annonce avant de continuer.");
      return;
    }
    go("publish-2");
    initPublishStep2();
  });

  document.getElementById("publishAddPhotos").addEventListener("click", () => publishPhotoInput.click());
  publishPhotoInput.addEventListener("change", () => {
    if (publishPhotoInput.files?.length) addPublishPhotos(publishPhotoInput.files);
    publishPhotoInput.value = "";
  });

  document.getElementById("publishAddResume").addEventListener("click", () => publishResumeInput.click());
  publishResumeInput.addEventListener("change", () => {
    const file = publishResumeInput.files?.[0];
    if (file) {
      publishDraft.resume = { file };
      updatePublishResumeLabel();
    }
    publishResumeInput.value = "";
  });

  document.getElementById("pubCategory").addEventListener("change", updatePublishResumeVisibility);
  document.getElementById("pubType").addEventListener("change", updatePublishResumeVisibility);

  document.getElementById("profileWhatsAppSave").addEventListener("click", async () => {
    const btn = document.getElementById("profileWhatsAppSave");
    const normalized = normalizeWhatsApp(document.getElementById("profileWhatsApp").value.trim());
    if (!normalized) {
      alert("Entrez un numéro WhatsApp valide (ex. +243 900 000 000).");
      return;
    }
    btn.disabled = true;
    try {
      if (isSignedIn()) {
        authUser = await api.auth.updateProfile(normalized);
      }
      setWhatsAppNumber(authUser?.whatsAppNumber || normalized);
      updateProfileWhatsAppUi();
    } catch (err) {
      setProfileWhatsAppStatus(err.message || "Impossible de mettre à jour le profil.", "warn");
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById("accountMyAdverts").addEventListener("click", () => {
    if (!isSignedIn()) {
      alert("Connectez-vous pour gérer vos annonces.");
      go("account");
      return;
    }
    go("my-adverts");
  });

  document.getElementById("facebookLoginBtn").addEventListener("click", async () => {
    if (!FACEBOOK_APP_ID) {
      setFacebookLoginStatus("Facebook App ID non configuré (VITE_FACEBOOK_APP_ID).", "warn");
      return;
    }

    setFacebookLoginStatus("Connexion…");
    try {
      const ready = await initFacebookSdk();
      if (!ready) throw new Error("Impossible de charger le SDK Facebook.");

      const accessToken = await loginWithFacebook();
      const response = await api.auth.facebook(accessToken);
      api.auth.setSession(response);
      authUser = response.user;
      if (authUser?.whatsAppNumber) setWhatsAppNumber(authUser.whatsAppNumber);
      setFacebookLoginStatus("");
      await refreshAccountView();
    } catch (err) {
      setFacebookLoginStatus(err.message || "Connexion Facebook impossible.", "warn");
    }
  });

  document.getElementById("accountLogout").addEventListener("click", () => {
    api.auth.clearSession();
    api.client.clearToken();
    authUser = null;
    refreshAccountView();
  });

  document.getElementById("publishNext2").addEventListener("click", () => {
    renderPublishPreview();
    go("publish-3");
  });

  document.getElementById("publishBack2").addEventListener("click", () => go("publish-1"));
  document.getElementById("publishBack3").addEventListener("click", () => go("publish-2"));

  document.getElementById("publishSubmit").addEventListener("click", () => {
    submitPublish();
  });

  document.getElementById("discussSearchInput").addEventListener("input", renderDiscussions);

  document.querySelectorAll("[data-discuss-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll("[data-discuss-tab]")
        .forEach((t) => t.classList.toggle("active", t === tab));
      renderDiscussions();
    });
  });

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
  drawerClose.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeDrawer();
  });
  drawerBackdrop.addEventListener("click", closeDrawer);

  drawer.addEventListener("click", (e) => {
    const link = e.target.closest("[data-go]");
    if (!link) return;
    e.preventDefault();
    closeDrawer();
    go(link.dataset.go);
  });

  document.querySelectorAll("[data-go]:not(.drawer-link)").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      closeDrawer();
      go(el.dataset.go);
    });
  });

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const route = TAB_ROUTES[item.dataset.tab];
      if (route === "publish-1" && !publishDraft.editingId) {
        resetPublishDraft();
      }
      if (route) go(route);
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