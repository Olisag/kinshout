import { categorizeQuery } from "./categorize-client.js";
import { api } from "./api-client.js";
import { CATEGORIES, LISTINGS, DISCUSSIONS, USER } from "./data.js";
import { applyDisplayMode, getStoredDisplayMode, initDisplayModeFromStorage } from "./theme.js";
import {
  registerView,
  navigate,
  goBack,
  setNavTab,
  navTabForView,
  getCurrent,
} from "./router.js";

const QUARTIERS = ["Gombe", "Limete", "Bandal", "Binza", "Kintambo", "Kinshasa"];

let browseCategories = [];
let browseDiscussionCategories = [];

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
let searchSort = "recent";
let intentFilter = "offre";
let sourceFilter = "all";
let searchPage = 1;
const SEARCH_PAGE_SIZE = 20;
let categoryAdvertsPage = 1;
const CATEGORY_ADVERTS_PAGE_SIZE = 20;
let categorySlugToId = new Map();
let discussionCategorySlugToId = new Map();
let lastCategoryAdverts = null;
let myAdvertsPage = 1;
const MY_ADVERTS_PAGE_SIZE = 20;
let myAdvertsHasMore = false;
let myAdvertsItems = [];
let lastSearchFromApi = null;
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
let currentDiscussionDetail = null;
let discussionThreadPage = 1;
let discussionEditing = false;
let replyEditingId = null;
const DISCUSSION_THREAD_PAGE_SIZE = 20;
let currentAdPhotoIndex = 0;
let authUser = null;
let facebookSdkReady = false;
let savedAdvertIds = new Set();
let savedAdvertsPage = 1;
const SAVED_ADVERTS_PAGE_SIZE = 20;
let savedAdvertsHasMore = false;
let savedAdvertsItems = [];
let lastDiscussionsFromApi = null;

const CATEGORY_QUERIES = {
  immobilier: "Appartement à louer à Gombe",
  vehicules: "Voiture Kinshasa",
  telephones: "iPhone Kinshasa",
  informatique: "Ordinateur Kinshasa",
  electronique: "Électronique Kinshasa",
  emplois: "Emploi Kinshasa",
  meubles: "Meubles Kinshasa",
  services: "Services Kinshasa",
  mode: "Vêtements Kinshasa",
  jouets: "Jouets Kinshasa",
  autres: "Annonces Kinshasa",
  vehicules_transport: "Véhicules",
  emploi_services: "Emplois",
  maison_jardin: "Maison",
  discussion: "Discussions",
  sport: "Football et sport à Kinshasa",
  politique: "Politique Kinshasa",
  societe: "Vie quotidienne Kinshasa",
  education: "Éducation et EXETAT Kinshasa",
  tech: "Tech et internet Kinshasa",
  economie: "Économie Kinshasa",
  culture: "Culture Kinshasa",
  sante: "Santé Kinshasa",
  securite: "Sécurité Kinshasa",
  transport: "Transport Kinshasa",
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
  "saved-adverts",
  "settings",
  "user-profile",
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
  "saved-adverts",
  "settings",
  "user-profile",
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
  app.classList.toggle("hide-header", view === "ad-detail");
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
  if (view === "results") {
    updateIntentFilterVisibility();
  }
  if (view === "account") {
    refreshAccountView();
  }
  if (view === "settings") {
    renderSettingsView();
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
  if (view === "saved-adverts") {
    if (!isSignedIn()) {
      alert("Connectez-vous pour voir vos annonces sauvegardées.");
      navigate("account", { replace: true });
      setNavTab("account", navItems);
      updateHeader("account");
      refreshAccountView();
      return;
    }
    renderSavedAdverts();
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

function updateDisplayModePicker(mode) {
  document.querySelectorAll("#displayModePicker .display-mode-option").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
}

function renderSettingsView() {
  updateDisplayModePicker(getStoredDisplayMode());
  const toggle = document.getElementById("profilePublicToggle");
  const hint = document.getElementById("profilePublicHint");
  if (toggle) {
    toggle.disabled = !isSignedIn();
    toggle.checked = authUser ? Boolean(authUser.isProfilePublic) : true;
  }
  if (hint) hint.hidden = !toggle?.checked;
}

async function setProfileVisibility(isPublic) {
  const toggle = document.getElementById("profilePublicToggle");
  const hint = document.getElementById("profilePublicHint");
  if (hint) hint.hidden = !isPublic;
  if (!isSignedIn()) {
    if (toggle) toggle.checked = false;
    alert("Connectez-vous pour modifier la visibilité de votre profil.");
    go("account");
    return;
  }

  try {
    const result = await api.auth.updateProfileVisibility(isPublic);
    const saved = Boolean(result?.isPublic);
    if (toggle) toggle.checked = saved;
    if (hint) hint.hidden = !saved;
    if (authUser) authUser.isProfilePublic = saved;
  } catch (err) {
    if (toggle) toggle.checked = Boolean(authUser?.isProfilePublic);
    alert(err.message || "Impossible d'enregistrer la visibilité du profil.");
  }
}

async function openPublicProfile(userId) {
  const empty = document.getElementById("publicProfileEmpty");
  const privateMsg = document.getElementById("publicProfilePrivate");
  const list = document.getElementById("publicProfileAdverts");
  empty.hidden = true;
  privateMsg.hidden = true;
  list.innerHTML = '<p class="profile-whatsapp-status">Chargement…</p>';

  try {
    const profile = await api.users.getProfile(userId);
    document.getElementById("publicProfileName").textContent = profile.displayName;
    document.getElementById("publicProfileSince").textContent = profile.memberSince;
    document.getElementById("publicProfileAvatar").textContent = profileInitials(profile.displayName);
    document.getElementById("publicProfileCount").textContent =
      `${profile.publishedAdvertCount} annonce${profile.publishedAdvertCount === 1 ? "" : "s"} publiée${profile.publishedAdvertCount === 1 ? "" : "s"}`;

    const adverts = await api.users.listAdverts(userId, { page: 1, pageSize: 20 });
    if (!adverts.items.length) {
      list.innerHTML = "";
      empty.hidden = false;
    } else {
      list.innerHTML = adverts.items
        .map((ad) => {
          const listing = apiAdvertToListing(ad);
          return `
      <button type="button" class="listing-card" data-listing="${listing.id}">
        ${renderListingThumb(listing)}
        <span class="listing-body">
          ${intentPillHtml(listing.intent)}
          <span class="listing-title">${escapeHtml(listing.title)}</span>
          <span class="listing-price">${escapeHtml(listing.price)}</span>
          ${listingStatsHtml(listing)}
          <span class="listing-meta">${escapeHtml(listing.location)} · ${escapeHtml(listing.time)}</span>
        </span>
        ${listingFavHtml(listing.id)}
      </button>`;
        })
        .join("");
      list.querySelectorAll("[data-listing]").forEach((btn) => {
        btn.addEventListener("click", () => openAd(btn.dataset.listing));
      });
    }

    go("user-profile");
  } catch {
    list.innerHTML = "";
    privateMsg.hidden = false;
    go("user-profile");
  }
}

function profileShareUrl(userId) {
  return shareUrl(`#profile/${userId}`);
}

async function setDisplayMode(mode) {
  const normalized = applyDisplayMode(mode);
  updateDisplayModePicker(normalized);
  if (!isSignedIn()) return normalized;

  try {
    const result = await api.auth.updateDisplayPreference(normalized);
    const saved = result?.mode === "sombre" ? "sombre" : "clair";
    applyDisplayMode(saved);
    updateDisplayModePicker(saved);
    if (authUser) authUser.displayPreference = saved;
    return saved;
  } catch (err) {
    alert(err.message || "Impossible d'enregistrer le mode d'affichage.");
    return normalized;
  }
}

async function syncDisplayPreferenceFromApi() {
  if (!isSignedIn()) return;
  try {
    const result = await api.auth.getDisplayPreference();
    if (result?.mode) applyDisplayMode(result.mode);
  } catch {
    // keep local preference
  }
}

async function refreshAccountView() {
  const guest = document.getElementById("accountGuest");
  const signedIn = document.getElementById("accountSignedIn");

  if (!isSignedIn()) {
    authUser = null;
    savedAdvertIds = new Set();
    guest.hidden = false;
    signedIn.hidden = true;
    setFacebookLoginStatus("");
    return;
  }

  try {
    authUser = await api.auth.me();
    if (authUser?.whatsAppNumber) setWhatsAppNumber(authUser.whatsAppNumber);
    if (authUser?.displayPreference) applyDisplayMode(authUser.displayPreference);
    guest.hidden = true;
    signedIn.hidden = false;
    document.getElementById("profileName").textContent = authUser.displayName;
    document.getElementById("profileSince").textContent = authUser.memberSince;
    document.getElementById("profileAvatar").textContent = profileInitials(authUser.displayName);
    updateProfileWhatsAppUi();
    await refreshSavedAdvertIds();
  } catch {
    api.auth.clearSession();
    savedAdvertIds = new Set();
    await refreshAccountView();
  }
}

function canPersistSavedAdvert(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id));
}

function isAdvertSaved(id) {
  return savedAdvertIds.has(String(id));
}

function updateFavButton(btn, advertId) {
  if (!btn) return;
  const active = isAdvertSaved(advertId);
  btn.classList.toggle("active", active);
  btn.textContent = active ? "♥" : "♡";
  btn.setAttribute("aria-pressed", active ? "true" : "false");
}

async function refreshSavedAdvertIds() {
  if (!isSignedIn()) {
    savedAdvertIds = new Set();
    return;
  }
  try {
    const ids = await api.adverts.listSavedIds();
    savedAdvertIds = new Set(ids.map(String));
  } catch {
    savedAdvertIds = new Set();
  }
}

function listingFavHtml(advertId) {
  const active = isAdvertSaved(advertId);
  return `<span class="listing-fav${active ? " active" : ""}" data-advert-id="${escapeHtml(String(advertId))}" aria-label="Sauvegarder" aria-pressed="${active ? "true" : "false"}">${active ? "♥" : "♡"}</span>`;
}

function wireListingFavButtons(container) {
  container.querySelectorAll(".listing-fav[data-advert-id]").forEach((fav) => {
    fav.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSavedAdvert(fav.dataset.advertId, fav);
    });
  });
}

function applyAdvertSaveState(apiAd) {
  if (!apiAd?.id) return;

  const id = String(apiAd.id);
  const isSaved = Boolean(apiAd.isSaved);
  const likeCount = apiAd.likeCount ?? 0;

  if (isSaved) savedAdvertIds.add(id);
  else savedAdvertIds.delete(id);

  const patchRaw = (ad) => {
    if (String(ad.id) !== id) return;
    ad.isSaved = isSaved;
    ad.likeCount = likeCount;
  };

  lastCategoryAdverts?.items?.forEach(patchRaw);
  lastSearchFromApi?.adverts?.forEach(patchRaw);
  savedAdvertsItems.forEach(patchRaw);

  const listing = { likeCount, viewCount: apiAd.viewCount ?? findListing(id)?.viewCount ?? 0 };

  document.querySelectorAll(`.listing-card[data-listing="${CSS.escape(id)}"] .listing-stats`).forEach((el) => {
    el.outerHTML = listingStatsHtml(listing);
  });

  if (String(currentListingId) === id) {
    document.getElementById("adStats").textContent =
      `👁 ${formatAdvertCount(listing.viewCount)} vues · ♡ ${formatAdvertCount(likeCount)} favoris`;
  }

  document.querySelectorAll(`.listing-fav[data-advert-id="${CSS.escape(id)}"]`).forEach((el) => {
    updateFavButton(el, id);
  });
  updateFavButton(document.getElementById("adFavBtn"), id);
}

async function toggleSavedAdvert(advertId, btn) {
  if (!isSignedIn()) {
    alert("Connectez-vous pour sauvegarder une annonce.");
    go("account");
    return;
  }

  const id = String(advertId);
  const wasSaved = isAdvertSaved(id);
  const persist = canPersistSavedAdvert(id);
  if (btn) btn.disabled = true;

  try {
    if (persist) {
      const updated = wasSaved ? await api.adverts.unsave(id) : await api.adverts.save(id);
      applyAdvertSaveState(updated);
    } else {
      if (wasSaved) savedAdvertIds.delete(id);
      else savedAdvertIds.add(id);

      document.querySelectorAll(`.listing-fav[data-advert-id="${CSS.escape(id)}"]`).forEach((el) => {
        updateFavButton(el, id);
      });
      updateFavButton(document.getElementById("adFavBtn"), id);
    }

    if (getCurrent() === "saved-adverts" && wasSaved && persist) {
      await fetchSavedAdverts(true);
    }
  } catch (err) {
    alert(err.message || "Impossible de mettre à jour.");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function shareUrl(path) {
  return `${window.location.origin}${window.location.pathname}${path}`;
}

function advertShareUrl(id) {
  return shareUrl(`#ad/${id}`);
}

function discussionShareUrl(id) {
  return shareUrl(`#discussion/${id}`);
}

async function shareContent({ title, text, url }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    alert("Lien copié dans le presse-papiers.");
    return;
  }

  prompt("Copiez ce lien :", url);
}

async function shareAdvert(ad) {
  await shareContent({
    title: ad.title,
    text: ad.title,
    url: advertShareUrl(ad.id),
  });
}

async function inviteToDiscussion(discussion) {
  await shareContent({
    title: discussion.title,
    text: `Rejoignez cette discussion sur Kinshout : ${discussion.title}`,
    url: discussionShareUrl(discussion.id),
  });
}

function handleDeepLink() {
  const hash = window.location.hash.replace(/^#/, "");
  if (hash.startsWith("ad/")) {
    openAd(hash.slice(3));
    return;
  }
  if (hash.startsWith("discussion/")) {
    openDiscussion(hash.slice(12));
    return;
  }
  if (hash.startsWith("profile/")) {
    openPublicProfile(hash.slice(8));
  }
}

function listingImages(ad) {
  if (Array.isArray(ad.thumbnails) && ad.thumbnails.length) return ad.thumbnails;
  if (Array.isArray(ad.images) && ad.images.length) return ad.images;
  return ad.image ? [ad.image] : [];
}

function listingFullImages(ad) {
  if (Array.isArray(ad.images) && ad.images.length) return ad.images;
  return ad.image ? [ad.image] : [];
}

function kinshoutDisplayUrl(url) {
  if (!url) return "";
  const path = toUploadPath(url);
  if (!path.startsWith("/uploads/images/")) return displayImageUrl(url);
  const displayPath = path.replace(/\.[a-z0-9]+$/i, "_display.webp");
  return displayImageUrl(displayPath);
}

function displayImages(ad) {
  if (Array.isArray(ad.displayImages) && ad.displayImages.length) return ad.displayImages;
  return listingFullImages(ad).map(kinshoutDisplayUrl);
}

function preloadAdPhotos(ad) {
  displayImages(ad).forEach((url) => {
    const img = new Image();
    img.decoding = "async";
    img.src = displayImageUrl(url);
  });
}

function listingThumb(ad) {
  const images = listingImages(ad);
  return images[0] ? displayImageUrl(images[0]) : "";
}

function whatsappLink(number) {
  const digits = (number || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function isValidSourceUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return false;
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    if (host === "removed.local") return false;
  } catch {
    return false;
  }
  return true;
}

function listingSourceUrl(listing) {
  const url = listing?.source?.externalUrl;
  return isValidSourceUrl(url) ? url.trim() : null;
}

function listingContactNumber(listing) {
  return listing?.contact?.whatsapp || listing?.contact?.phone || listing?.whatsapp || null;
}

function externalProviderLabel(source) {
  return source?.providerName || source?.provider || "la source";
}

function externalSourceActionLabel(source) {
  const name = externalProviderLabel(source);
  if (source?.provider === "facebook_marketplace") return "Contacter sur Facebook";
  return `Voir sur ${name}`;
}

function openExternalSourceUrl(url) {
  window.open(url, "_blank", "noopener,noreferrer");
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
  const base = api.baseUrl?.replace(/\/$/, "") || "";
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

function formatAdvertCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`.replace(".0M", "M");
  if (n >= 10_000) return `${Math.round(n / 100) / 10}k`.replace(".0k", "k");
  if (n >= 1_000) return `${(n / 1000).toFixed(1).replace(".0", "")}k`;
  return String(n);
}

function listingStatsHtml(listing) {
  const views = formatAdvertCount(listing.viewCount);
  const likes = formatAdvertCount(listing.likeCount);
  return `<span class="listing-stats" aria-label="${views} vues, ${likes} favoris"><span class="listing-stat">👁 ${views}</span><span class="listing-stat">♡ ${likes}</span></span>`;
}

function apiAdvertToListing(ad) {
  const isSaved = Boolean(ad.isSaved);
  if (isSaved) savedAdvertIds.add(String(ad.id));
  else savedAdvertIds.delete(String(ad.id));
  return {
    id: ad.id,
    title: ad.title,
    price: ad.price || "—",
    location: ad.location || "Kinshasa",
    time: ad.time,
    category: ad.categoryId,
    intent: ad.intent,
    images: ad.imageUrls || [],
    thumbnails: ad.thumbnailUrls?.length ? ad.thumbnailUrls : ad.imageUrls || [],
    displayImages: ad.displayImageUrls?.length ? ad.displayImageUrls : [],
    resumeUrl: ad.resumeUrl,
    tags: ad.tags || [],
    description: ad.description,
    whatsapp: ad.whatsAppNumber,
    viewCount: ad.viewCount ?? 0,
    likeCount: ad.likeCount ?? 0,
    isSaved,
    isExternal: Boolean(ad.isExternal),
    source: ad.source || null,
    contact: ad.contact || null,
    details: ad.details || null,
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
function renderPopularPills(queries) {
  const el = document.getElementById("homePills");
  if (!queries.length) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = queries
    .map(
      (q) => `
    <button type="button" class="pill" data-query="${escapeHtml(q)}">
      <span class="pill-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF5500" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg></span>
      ${escapeHtml(q)}
    </button>`
    )
    .join("");
  el.querySelectorAll(".pill").forEach((p) => {
    p.addEventListener("click", () => openResults(p.dataset.query));
  });
}

async function loadPopularSearches() {
  const section = document.querySelector(".popular");
  try {
    const result = await api.search.popular(1, 10);
    const queries = result.items.map((item) => item.query).filter(Boolean);
    if (section) section.hidden = queries.length === 0;
    renderPopularPills(queries);
  } catch {
    if (section) section.hidden = true;
    renderPopularPills([]);
  }
}

function normalizeDiscussionFromApi(d) {
  if (!d) return d;
  const replyCount = Number(d.replyCount ?? d.replies) || 0;
  const isExternal = d.isExternal === true;
  const source = d.source || null;
  return {
    ...d,
    replyCount,
    replies: replyCount,
    isLiked: d.isLiked === true,
    likeCount: Number(d.likeCount) || 0,
    viewCount: Number(d.viewCount) || 0,
    isExternal,
    source,
  };
}

function apiDiscussionToDiscussion(d) {
  const normalized = normalizeDiscussionFromApi(d);
  return {
    id: normalized.id,
    title: normalized.title,
    body: normalized.body,
    author: normalized.author,
    authorId: normalized.authorId,
    avatar: normalized.avatar,
    replyCount: normalized.replyCount,
    replies: normalized.replyCount,
    time: normalized.time,
    likeCount: normalized.likeCount,
    viewCount: normalized.viewCount,
    isLiked: normalized.isLiked,
    isExternal: normalized.isExternal,
    source: normalized.source,
  };
}

function findAdvertDto(id) {
  const sid = String(id);
  const fromCategory = lastCategoryAdverts?.items?.find((ad) => String(ad.id) === sid);
  if (fromCategory) return fromCategory;
  const fromApi = lastSearchFromApi?.adverts?.find((ad) => String(ad.id) === sid);
  if (fromApi) return fromApi;
  const fromMixed = lastSearchFromApi?.items?.find(
    (item) => item.kind === "advert" && item.advert && String(item.advert.id) === sid
  );
  return fromMixed?.advert || null;
}

function findListing(id) {
  const dto = findAdvertDto(id);
  if (dto) return apiAdvertToListing(dto);
  return LISTINGS.find((l) => l.id === id);
}

function findDiscussion(id) {
  const sid = String(id);
  const fromList = lastDiscussionsFromApi?.find((d) => String(d.id) === sid);
  if (fromList) return apiDiscussionToDiscussion(fromList);
  const fromApi = lastSearchFromApi?.discussions?.find((d) => String(d.id) === sid);
  if (fromApi) return apiDiscussionToDiscussion(fromApi);
  return DISCUSSIONS.find((d) => d.id === id);
}

// --- Categories ---
function sortCategoriesAutresLast(categories) {
  const autres = categories.filter((c) => c.id === "autres");
  const rest = categories.filter((c) => c.id !== "autres");
  return [...rest, ...autres];
}

function renderCategories() {
  const ul = document.getElementById("categoryList");
  if (!browseCategories.length) {
    ul.innerHTML =
      '<li class="category-empty">Les catégories apparaîtront ici au fur et à mesure des annonces importées.</li>';
    return;
  }

  ul.innerHTML = sortCategoriesAutresLast(browseCategories)
    .map(
      (c) => `
    <li><button type="button" class="category-item" data-cat="${c.id}">
      <span class="category-item-icon category-icon-${c.id}">${c.icon}</span>
      ${escapeHtml(c.label)}
      <span class="category-item-chevron">›</span>
    </button></li>`
    )
    .join("");
  ul.querySelectorAll(".category-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      openCategoryResults(btn.dataset.cat);
    });
  });
}

function renderDiscussionCategories() {
  const ul = document.getElementById("discussionCategoryList");
  if (!ul) return;

  const items = [
    { id: "discussion", label: "Toutes les discussions", icon: "💬" },
    ...sortCategoriesAutresLast(browseDiscussionCategories),
  ];

  if (items.length <= 1) {
    ul.innerHTML =
      '<li class="category-empty">Les thématiques apparaîtront ici au fur et à mesure des discussions importées.</li>';
    return;
  }

  ul.innerHTML = items
    .map(
      (c) => `
    <li><button type="button" class="category-item" data-cat="${c.id}" data-kind="discussion">
      <span class="category-item-icon category-icon-${c.id}">${c.icon}</span>
      ${escapeHtml(c.label)}
      <span class="category-item-chevron">›</span>
    </button></li>`
    )
    .join("");
  ul.querySelectorAll(".category-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      openCategoryResults(btn.dataset.cat, btn.dataset.kind);
    });
  });
}

async function loadBrowseCategories() {
  try {
    const items = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const result = await api.categories.list({ page, pageSize: 100 });
      items.push(...result.items);
      hasMore = result.hasMore;
      page += 1;
    }
    browseCategories = items.map((c) => ({
      id: c.slug,
      label: c.label,
      icon: c.icon || "📦",
    }));
    categorySlugToId = new Map(items.map((c) => [c.slug, c.id]));
  } catch {
    browseCategories = [];
    categorySlugToId = new Map();
  }
  renderCategories();
}

async function loadDiscussionBrowseCategories() {
  try {
    const items = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const result = await api.discussions.listCategories({ page, pageSize: 100 });
      items.push(...result.items);
      hasMore = result.hasMore;
      page += 1;
    }
    browseDiscussionCategories = items.map((c) => ({
      id: c.slug,
      label: c.label,
      icon: c.icon || "💬",
    }));
    discussionCategorySlugToId = new Map(items.map((c) => [c.slug, c.id]));
  } catch {
    browseDiscussionCategories = [];
    discussionCategorySlugToId = new Map();
  }
  renderDiscussionCategories();
}

async function loadAllBrowseCategories() {
  await Promise.all([loadBrowseCategories(), loadDiscussionBrowseCategories()]);
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

function intentLabel(intent) {
  return intent === "offre" ? "Offre" : "Demande";
}

function intentPillHtml(intent) {
  const key = intent === "offre" ? "offre" : "demande";
  return `<span class="intent-pill intent-${key}">${intentLabel(intent)}</span>`;
}

function shouldShowSourceFilter() {
  return resultsTab !== "discussions";
}

function updateSourceFilterVisibility() {
  const el = document.getElementById("resultsSourceFilter");
  if (!el) return;
  el.hidden = !shouldShowSourceFilter();
}

function setSourceFilter(value, { refetch = true } = {}) {
  sourceFilter = value || "all";
  document.querySelectorAll("#resultsSourceChips .source-chip").forEach((chip) => {
    const active = chip.dataset.source === sourceFilter;
    chip.classList.toggle("active", active);
    chip.setAttribute("aria-selected", active ? "true" : "false");
  });
  updateSourceFilterVisibility();
  if (!refetch) return;
  if (isCategoryBrowseMode()) {
    fetchAndRenderCategoryResults(true);
  } else {
    fetchAndRenderResults(true);
  }
}

function listingSourceHtml(listing) {
  if (!listing.isExternal || !listing.source) return "";
  const name = externalProviderLabel(listing.source);
  const hasLink = Boolean(listingSourceUrl(listing));
  return `<span class="listing-source">${hasLink ? "↗" : "•"} ${escapeHtml(name)}</span>`;
}

function discussionSourceHtml(d) {
  return listingSourceHtml(d);
}

function renderDiscussionResultCard(d) {
  const item = apiDiscussionToDiscussion(d);
  return `
      <button type="button" class="listing-card${item.isExternal ? " listing-card--external" : ""}" data-discussion="${item.id}">
        <span class="listing-thumb" style="display:flex;align-items:center;justify-content:center;font-size:2rem;background:var(--lavender)">💬</span>
        <span class="listing-body">
          <span class="listing-title">${escapeHtml(item.title)}</span>
          <span class="listing-meta">${item.replies} réponses · ${escapeHtml(item.time)}</span>
          ${discussionSourceHtml(item)}
        </span>
      </button>`;
}

function renderDiscussionListCard(d) {
  const item = apiDiscussionToDiscussion(d);
  const sourceLine = discussionSourceHtml(item);
  return `
    <button type="button" class="discussion-card${item.isExternal ? " discussion-card--external" : ""}" data-id="${item.id}">
      <p class="discussion-card-title">${escapeHtml(item.title)}</p>
      <p class="discussion-card-meta"><span>💬 ${item.replies} réponses</span><span>❤ ${item.likeCount ?? 0}</span><span>${escapeHtml(item.time)}</span></p>
      ${sourceLine}
    </button>`;
}

function renderListingCard(l) {
  return `
      <button type="button" class="listing-card${l.isExternal ? " listing-card--external" : ""}" data-listing="${l.id}">
        ${renderListingThumb(l)}
        <span class="listing-body">
          ${intentPillHtml(l.intent)}
          <span class="listing-title">${escapeHtml(l.title)}</span>
          <span class="listing-price">${escapeHtml(l.price)}</span>
          ${listingStatsHtml(l)}
          <span class="listing-meta">${escapeHtml(l.location)} · ${escapeHtml(l.time)}</span>
          ${listingSourceHtml(l)}
        </span>
        ${listingFavHtml(l.id)}
      </button>`;
}

function searchSourceParam() {
  return shouldShowSourceFilter() && sourceFilter !== "all" ? { source: sourceFilter } : {};
}

function formatImportDate(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(
      new Date(iso)
    );
  } catch {
    return "";
  }
}

function shouldShowIntentFilter() {
  return Boolean(selectedCategory) && !isDiscussionTopicCategory(selectedCategory) && resultsTab !== "discussions";
}

function isDiscussionTopicCategory(slug) {
  return slug === "discussion" || discussionCategorySlugToId.has(slug);
}

function isDiscussionCategoryBrowseMode() {
  return Boolean(selectedCategory) && isDiscussionTopicCategory(selectedCategory);
}

function isCategoryBrowseMode() {
  return Boolean(selectedCategory) && !isDiscussionTopicCategory(selectedCategory);
}

function getCategoryApiId(slug) {
  return categorySlugToId.get(slug) || null;
}

function getDiscussionCategoryApiId(slug) {
  if (slug === "discussion") return null;
  return discussionCategorySlugToId.get(slug) || null;
}

function matchesIntentFilter(listing) {
  if (!shouldShowIntentFilter()) return true;
  const key = listing.intent === "offre" ? "offre" : "demande";
  return key === intentFilter;
}

function setIntentFilter(value, { refetch = true } = {}) {
  intentFilter = value === "demande" ? "demande" : "offre";
  document.querySelectorAll("#resultsIntentChips .intent-chip").forEach((chip) => {
    const active = chip.dataset.intent === intentFilter;
    chip.classList.toggle("active", active);
    chip.setAttribute("aria-selected", active ? "true" : "false");
  });
  updateIntentFilterVisibility();
  if (!refetch) return;
  if (isCategoryBrowseMode()) {
    fetchAndRenderCategoryResults(true);
  } else {
    renderResults();
  }
}

function updateIntentFilterVisibility() {
  const el = document.getElementById("resultsIntentFilter");
  if (!el) return;
  el.hidden = !shouldShowIntentFilter();
}

function renderListingThumb(listing) {
  const thumb = listingThumb(listing);
  if (thumb) {
    const full = listingFullImages(listing)[0] ? displayImageUrl(listingFullImages(listing)[0]) : "";
    const fallback =
      full && full !== thumb ? ` onerror="this.onerror=null;this.src='${full.replace(/'/g, "%27")}'"` : "";
    return `<img class="listing-thumb" src="${thumb}" alt="" loading="lazy" decoding="async"${fallback} />`;
  }
  const key = listing.intent === "offre" ? "offre" : "demande";
  return `<span class="listing-thumb listing-thumb--placeholder listing-thumb--${key}" aria-hidden="true">${
    key === "offre" ? "📦" : "🔍"
  }</span>`;
}

async function loadCategorySlugMap() {
  if (categorySlugToId.size > 0 && discussionCategorySlugToId.size > 0) return;
  await loadAllBrowseCategories();
}

function renderResults() {
  const list = document.getElementById("resultsList");
  const empty = document.getElementById("emptyResults");
  document.getElementById("resultsSearchInput").value = searchQuery;

  let html = "";

  if (resultsTab === "all" && Array.isArray(lastSearchFromApi?.items)) {
    html = lastSearchFromApi.items
      .map((item) => {
        if (item.kind === "advert" && item.advert) {
          return renderListingCard(apiAdvertToListing(item.advert));
        }
        if (item.kind === "discussion" && item.discussion) {
          return renderDiscussionResultCard(item.discussion);
        }
        return "";
      })
      .join("");
  } else {
    const listings = isCategoryBrowseMode() && lastCategoryAdverts
      ? lastCategoryAdverts.items.map(apiAdvertToListing)
      : lastSearchFromApi
        ? lastSearchFromApi.adverts.map(apiAdvertToListing)
        : filterListings(searchQuery).filter(matchesIntentFilter);
    const discussions = lastSearchFromApi
      ? lastSearchFromApi.discussions.map(apiDiscussionToDiscussion)
      : filterDiscussions(searchQuery);

    if (resultsTab === "all" || resultsTab === "annonces") {
      html += listings.map((l) => renderListingCard(l)).join("");
    }

    if (resultsTab === "all" || resultsTab === "discussions") {
      html += discussions.map((d) => renderDiscussionResultCard(d)).join("");
    }
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

  wireListingFavButtons(list);

  updateLoadMoreButton();
  updateIntentFilterVisibility();
  updateSourceFilterVisibility();
}

function hasMoreSearchResults() {
  if (isCategoryBrowseMode() && lastCategoryAdverts) {
    return lastCategoryAdverts.hasMore;
  }
  if (isDiscussionCategoryBrowseMode()) {
    return Boolean(lastSearchFromApi?.pagination?.hasMoreDiscussions);
  }
  const pagination = lastSearchFromApi?.pagination;
  if (!pagination) return false;
  if (resultsTab === "all") {
    if (pagination.hasMore != null) return pagination.hasMore;
    return pagination.hasMoreAdverts || pagination.hasMoreDiscussions;
  }
  if (resultsTab === "annonces") return pagination.hasMoreAdverts;
  if (resultsTab === "discussions") return pagination.hasMoreDiscussions;
  return pagination.hasMoreAdverts || pagination.hasMoreDiscussions;
}

function updateLoadMoreButton() {
  const btn = document.getElementById("resultsLoadMore");
  if (!btn) return;
  btn.hidden = !hasMoreSearchResults();
}

async function fetchAndRenderResults(reset = true) {
  const list = document.getElementById("resultsList");
  const empty = document.getElementById("emptyResults");
  const loadMore = document.getElementById("resultsLoadMore");
  document.getElementById("resultsSearchInput").value = searchQuery;

  if (reset) {
    searchPage = 1;
    lastSearchFromApi = null;
    list.innerHTML = '<p class="profile-whatsapp-status">Recherche…</p>';
    list.hidden = false;
    empty.hidden = true;
    if (loadMore) loadMore.hidden = true;
  } else if (loadMore) {
    loadMore.disabled = true;
    loadMore.textContent = "Chargement…";
  }

  try {
    const result = await api.search.post(searchQuery, {
      tab: resultsTab,
      page: searchPage,
      pageSize: SEARCH_PAGE_SIZE,
      sort: searchSort,
      ...(shouldShowIntentFilter() ? { intent: intentFilter } : {}),
      ...searchSourceParam(),
    });
    if (reset || !lastSearchFromApi) {
      lastSearchFromApi = result;
    } else {
      lastSearchFromApi = {
        ...result,
        adverts: [...(lastSearchFromApi.adverts || []), ...(result.adverts || [])],
        discussions: [...(lastSearchFromApi.discussions || []), ...(result.discussions || [])],
        items: [...(lastSearchFromApi.items || []), ...(result.items || [])],
      };
    }
    renderResults();
  } catch {
    if (reset) lastSearchFromApi = null;
    renderResults();
  } finally {
    if (loadMore) {
      loadMore.disabled = false;
      loadMore.textContent = "Afficher plus";
    }
  }
}

async function loadMoreSearchResults() {
  if (isCategoryBrowseMode() && lastCategoryAdverts?.hasMore) {
    categoryAdvertsPage += 1;
    await fetchAndRenderCategoryResults(false);
    return;
  }
  if (
    isDiscussionCategoryBrowseMode() &&
    lastSearchFromApi?.pagination?.hasMoreDiscussions
  ) {
    categoryAdvertsPage += 1;
    await fetchAndRenderCategoryResults(false);
    return;
  }
  if (!hasMoreSearchResults()) return;
  searchPage += 1;
  await fetchAndRenderResults(false);
}

async function fetchAndRenderCategoryResults(reset = true) {
  const list = document.getElementById("resultsList");
  const empty = document.getElementById("emptyResults");
  const loadMore = document.getElementById("resultsLoadMore");
  document.getElementById("resultsSearchInput").value = searchQuery;

  if (isDiscussionCategoryBrowseMode()) {
    lastCategoryAdverts = null;
    if (reset) {
      categoryAdvertsPage = 1;
      list.innerHTML = '<p class="profile-whatsapp-status">Chargement…</p>';
      list.hidden = false;
      empty.hidden = true;
      if (loadMore) loadMore.hidden = true;
    } else if (loadMore) {
      loadMore.disabled = true;
      loadMore.textContent = "Chargement…";
    }

    try {
      const categoryId = getDiscussionCategoryApiId(selectedCategory);
      const result = await api.discussions.list({
        q: searchQuery || undefined,
        categoryId: categoryId || undefined,
        page: categoryAdvertsPage,
        pageSize: SEARCH_PAGE_SIZE,
        sort: searchSort,
      });
      if (reset || !lastSearchFromApi?.discussions) {
        lastSearchFromApi = {
          discussions: result.items,
          pagination: { hasMoreDiscussions: result.hasMore },
        };
      } else {
        lastSearchFromApi = {
          ...lastSearchFromApi,
          discussions: [...lastSearchFromApi.discussions, ...result.items],
          pagination: { hasMoreDiscussions: result.hasMore },
        };
      }
      resultsTab = "discussions";
      renderResults();
    } catch {
      if (reset) lastSearchFromApi = null;
      renderResults();
    } finally {
      if (loadMore) {
        loadMore.disabled = false;
        loadMore.textContent = "Afficher plus";
      }
    }
    return;
  }

  const categoryId = getCategoryApiId(selectedCategory);
  if (!categoryId) {
    if (reset) {
      lastCategoryAdverts = null;
      categoryAdvertsPage = 1;
    }
    renderResults();
    return;
  }

  if (reset) {
    categoryAdvertsPage = 1;
    lastCategoryAdverts = null;
    list.innerHTML = '<p class="profile-whatsapp-status">Chargement…</p>';
    list.hidden = false;
    empty.hidden = true;
    if (loadMore) loadMore.hidden = true;
  } else if (loadMore) {
    loadMore.disabled = true;
    loadMore.textContent = "Chargement…";
  }

  try {
    const result = await api.adverts.list({
      categoryId,
      intent: shouldShowIntentFilter() ? intentFilter : undefined,
      page: categoryAdvertsPage,
      pageSize: CATEGORY_ADVERTS_PAGE_SIZE,
      ...searchSourceParam(),
    });

    if (reset || !lastCategoryAdverts) {
      lastCategoryAdverts = result;
    } else {
      lastCategoryAdverts = {
        ...result,
        items: [...lastCategoryAdverts.items, ...result.items],
      };
    }
    renderResults();
  } catch {
    if (reset) lastCategoryAdverts = null;
    renderResults();
  } finally {
    if (loadMore) {
      loadMore.disabled = false;
      loadMore.textContent = "Afficher plus";
    }
  }
}

async function openResults(query) {
  searchQuery = query.trim();
  selectedCategory = null;
  lastCategoryAdverts = null;
  resultsTab = query.toLowerCase().includes("discussion") ? "discussions" : "all";
  updateIntentFilterVisibility();
  document.querySelectorAll("#resultsTabs .tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === resultsTab || (resultsTab === "all" && t.dataset.tab === "all"));
  });
  go("results");
  await fetchAndRenderResults();
}

async function openCategoryResults(categoryId, kind = "advert") {
  selectedCategory = categoryId;
  const catalog = kind === "discussion" ? browseDiscussionCategories : browseCategories;
  searchQuery = CATEGORY_QUERIES[categoryId] || catalog.find((c) => c.id === categoryId)?.label || "";
  lastSearchFromApi = null;
  resultsTab = kind === "discussion" ? "discussions" : "annonces";
  setIntentFilter("offre", { refetch: false });
  document.querySelectorAll("#resultsTabs .tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === resultsTab);
  });
  go("results");
  await fetchAndRenderCategoryResults(true);
}

// --- Ad detail ---
function showAdPhoto(ad, index) {
  const images = displayImages(ad);
  const fullImages = listingFullImages(ad);
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
  const imgEl = document.getElementById("adImage");
  const src = displayImageUrl(images[currentAdPhotoIndex]);
  const fallback = fullImages[currentAdPhotoIndex]
    ? displayImageUrl(fullImages[currentAdPhotoIndex])
    : "";
  imgEl.onerror = fallback && fallback !== src
    ? () => {
        imgEl.onerror = null;
        imgEl.src = fallback;
      }
    : null;
  imgEl.decoding = "async";
  imgEl.src = src;
  imgEl.alt = ad.title;
  document.getElementById("adCounter").textContent = `${currentAdPhotoIndex + 1}/${images.length}`;
}

function openAd(id) {
  const ad = findListing(id);
  if (!ad) return;
  currentListingId = id;
  showAdPhoto(ad, 0);
  preloadAdPhotos(ad);
  const isExternal = Boolean(ad.isExternal && ad.source);
  const sourceUrl = isExternal ? listingSourceUrl(ad) : null;
  document.getElementById("adExternalBadge").hidden = !isExternal;
  document.getElementById("adPhotoLabel").hidden = !isExternal;

  const sourceCard = document.getElementById("adSourceCard");
  const externalBtn = document.getElementById("adExternalBtn");
  const importNote = document.getElementById("adImportNote");
  if (isExternal) {
    sourceCard.hidden = false;
    const providerLabel = externalProviderLabel(ad.source);
    document.getElementById("adSourceTitle").textContent = `Trouvé sur ${providerLabel}`;
    const sourceLink = document.getElementById("adSourceLink");
    if (sourceUrl) {
      sourceLink.hidden = false;
      sourceLink.href = sourceUrl;
      sourceLink.textContent = "Voir l'annonce originale ↗";
    } else {
      sourceLink.hidden = true;
      sourceLink.removeAttribute("href");
    }
    const imported = formatImportDate(ad.source.importedAt);
    if (imported) {
      importNote.hidden = false;
      importNote.textContent = sourceUrl
        ? `Annonce importée et vérifiée par Kinshout le ${imported}.`
        : `Annonce importée le ${imported}. Lien vers la source indisponible.`;
    } else {
      importNote.hidden = !sourceUrl;
      importNote.textContent = sourceUrl
        ? ""
        : "Lien vers l'annonce originale indisponible pour cette source.";
    }
  } else {
    sourceCard.hidden = true;
    importNote.hidden = true;
    importNote.textContent = "";
  }

  document.getElementById("adGallery").onclick = isExternal
    ? null
    : () => {
        if (listingImages(ad).length > 1) showAdPhoto(ad, currentAdPhotoIndex + 1);
      };

  document.getElementById("adTitle").textContent = ad.title;
  document.getElementById("adPrice").textContent = ad.price;
  const detailLocation = ad.location.includes("Kinshasa") ? ad.location : `${ad.location}, Kinshasa`;
  document.getElementById("adLocation").textContent = `${detailLocation} · ${formatPublishedTime(ad.time)}`;
  document.getElementById("adStats").textContent =
    `👁 ${formatAdvertCount(ad.viewCount)} vues · ♡ ${formatAdvertCount(ad.likeCount)} favoris`;
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

  const wa = whatsappLink(listingContactNumber(ad));
  const waBtn = document.getElementById("adWhatsApp");
  waBtn.hidden = false;
  if (wa) {
    waBtn.disabled = false;
    waBtn.classList.remove("btn-source-action");
    waBtn.textContent = "Contacter sur WhatsApp";
    waBtn.onclick = () => window.open(wa, "_blank");
    if (isExternal && sourceUrl) {
      externalBtn.hidden = false;
      externalBtn.disabled = false;
      externalBtn.textContent = `Voir sur ${externalProviderLabel(ad.source)} ↗`;
      externalBtn.onclick = () => openExternalSourceUrl(sourceUrl);
    } else {
      externalBtn.hidden = true;
      externalBtn.onclick = null;
    }
  } else if (isExternal && sourceUrl) {
    waBtn.disabled = false;
    waBtn.classList.add("btn-source-action");
    waBtn.textContent = externalSourceActionLabel(ad.source);
    waBtn.onclick = () => openExternalSourceUrl(sourceUrl);
    externalBtn.hidden = true;
    externalBtn.onclick = null;
  } else {
    waBtn.disabled = true;
    waBtn.classList.remove("btn-source-action");
    waBtn.textContent = isExternal ? "Contact indisponible" : "WhatsApp indisponible";
    waBtn.onclick = null;
    externalBtn.hidden = true;
    externalBtn.onclick = null;
  }

  updateFavButton(document.getElementById("adFavBtn"), id);
  go("ad-detail");
}

// --- Discussions ---
async function loadDiscussionsFromApi(sort = "popular") {
  try {
    const result = await api.discussions.list({ sort, page: 1, pageSize: 50 });
    lastDiscussionsFromApi = result.items.map(normalizeDiscussionFromApi);
    return lastDiscussionsFromApi;
  } catch {
    lastDiscussionsFromApi = null;
    return null;
  }
}

async function renderDiscussions() {
  const el = document.getElementById("discussionsList");
  const q = document.getElementById("discussSearchInput").value.toLowerCase();
  const activeTab =
    document.querySelector("[data-discuss-tab].active")?.dataset.discussTab || "popular";
  const sort = activeTab === "recent" ? "recent" : "popular";

  el.innerHTML = '<p class="profile-whatsapp-status">Chargement…</p>';
  const fromApi = await loadDiscussionsFromApi(sort);
  const base = fromApi ?? DISCUSSIONS;
  const items = base.filter(
    (d) => !q || d.title.toLowerCase().includes(q) || d.body.toLowerCase().includes(q)
  );
  const visibleItems = fromApi
    ? items
    : activeTab === "recent"
      ? [...items].reverse()
      : [...items].sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0));

  if (!visibleItems.length) {
    el.innerHTML = '<p class="empty-state">Aucune discussion pour le moment.</p>';
    return;
  }

  el.innerHTML = visibleItems.map((d) => renderDiscussionListCard(d)).join("");
  el.querySelectorAll(".discussion-card").forEach((c) => {
    c.addEventListener("click", () => openDiscussion(c.dataset.id));
  });
}

function openDiscussion(id) {
  currentDiscussionId = id;
  discussionThreadPage = 1;
  discussionEditing = false;
  replyEditingId = null;
  loadDiscussionDetail(true).then(() => go("discussion-detail"));
}

function sameUserId(a, b) {
  return a && b && String(a).toLowerCase() === String(b).toLowerCase();
}

function renderDiscussionOwnerActions(kind, id) {
  return `
    <div class="thread-owner-actions">
      <button type="button" class="btn-primary-inline thread-edit-btn" data-kind="${kind}" data-id="${id}">Modifier</button>
      <button type="button" class="btn-secondary-inline thread-delete-btn" data-kind="${kind}" data-id="${id}">Supprimer</button>
    </div>`;
}

function updateDiscussionExternalUi(d) {
  const isExternal = Boolean(d.isExternal && d.source);
  const sourceUrl = isExternal ? listingSourceUrl(d) : null;
  document.getElementById("discussExternalBadge").hidden = !isExternal;

  const sourceCard = document.getElementById("discussSourceCard");
  if (isExternal) {
    sourceCard.hidden = false;
    const providerLabel = externalProviderLabel(d.source);
    const originalAuthor = d.source.originalAuthor?.trim();
    document.getElementById("discussSourceTitle").textContent = originalAuthor
      ? `Publication de ${originalAuthor} sur ${providerLabel}`
      : `Trouvé sur ${providerLabel}`;
    const sourceLink = document.getElementById("discussSourceLink");
    if (sourceUrl) {
      sourceLink.hidden = false;
      sourceLink.href = sourceUrl;
      sourceLink.textContent = `Voir sur ${providerLabel} ↗`;
    } else {
      sourceLink.hidden = true;
      sourceLink.removeAttribute("href");
    }
  } else {
    sourceCard.hidden = true;
  }
}

function renderDiscussionDetail() {
  const d = currentDiscussionDetail;
  if (!d) return;

  document.getElementById("discussDetailTitle").textContent = d.title;
  updateDiscussionExternalUi(d);

  const isOwner = !d.isExternal && sameUserId(authUser?.id, d.authorId);
  if (discussionEditing && isOwner) {
    document.getElementById("discussMainPost").innerHTML = `
      <form class="thread-edit-form" id="discussEditForm">
        <label class="form-label" for="discussEditTitle">Titre</label>
        <input type="text" class="form-input" id="discussEditTitle" value="${escapeHtml(d.title)}" maxlength="200" required />
        <label class="form-label" for="discussEditBody">Message</label>
        <textarea class="form-textarea" id="discussEditBody" rows="5" required>${escapeHtml(d.body)}</textarea>
        <div class="thread-owner-actions">
          <button type="submit" class="btn-primary-inline">Enregistrer</button>
          <button type="button" class="btn-secondary-inline" id="discussEditCancel">Annuler</button>
        </div>
      </form>`;
  } else {
    document.getElementById("discussMainPost").innerHTML = `
      <div class="thread-author">
        <span class="avatar">${d.avatar}</span>
        <div><div class="thread-name">${escapeHtml(d.author)}</div><div class="thread-time">${escapeHtml(d.time)} · ${d.viewCount ?? 0} vues · ${d.likeCount ?? 0} j'aime</div></div>
      </div>
      <p class="thread-body">${escapeHtml(d.body)}</p>
      ${isOwner ? renderDiscussionOwnerActions("discussion", d.id) : ""}
      <div class="thread-actions">
        <button type="button" class="thread-action-btn" data-action="reply">↩ Répondre</button>
        <button type="button" class="thread-action-btn" data-action="invite">↗ Inviter</button>
      </div>
    `;
  }

  const replies = d.thread?.items || [];
  document.getElementById("discussReplies").innerHTML = replies
    .map((r) => {
      const replyOwner = sameUserId(authUser?.id, r.authorId);
      if (replyEditingId === r.id && replyOwner) {
        return `
    <div class="thread-reply" data-reply-id="${r.id}">
      <form class="thread-edit-form thread-reply-edit-form" data-reply-id="${r.id}">
        <textarea class="form-textarea" rows="3" required>${escapeHtml(r.text)}</textarea>
        <div class="thread-owner-actions">
          <button type="submit" class="btn-primary-inline">Enregistrer</button>
          <button type="button" class="btn-secondary-inline thread-reply-edit-cancel" data-reply-id="${r.id}">Annuler</button>
        </div>
      </form>
    </div>`;
      }

      return `
    <div class="thread-reply" data-reply-id="${r.id}">
      <div class="thread-author">
        <span class="avatar">${r.avatar}</span>
        <div><div class="thread-name">${escapeHtml(r.author)}</div><div class="thread-time">${escapeHtml(r.time)}</div></div>
      </div>
      <p class="thread-body">${escapeHtml(r.text)}</p>
      ${replyOwner ? renderDiscussionOwnerActions("reply", r.id) : ""}
    </div>`;
    })
    .join("");

  const loadMore = document.getElementById("discussThreadLoadMore");
  if (loadMore) loadMore.hidden = !(d.thread?.hasMore);

  wireDiscussionDetailActions();
}

function wireDiscussionDetailActions() {
  document.getElementById("discussEditForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentDiscussionId) return;

    const title = document.getElementById("discussEditTitle").value.trim();
    const body = document.getElementById("discussEditBody").value.trim();
    if (!title || !body) return;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await api.discussions.update(currentDiscussionId, { title, body });
      discussionEditing = false;
      await loadDiscussionDetail(true);
    } catch (err) {
      alert(err.message || "Impossible de modifier cette discussion.");
      submitBtn.disabled = false;
    }
  });

  document.getElementById("discussEditCancel")?.addEventListener("click", () => {
    discussionEditing = false;
    renderDiscussionDetail();
  });

  document.querySelectorAll(".thread-edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.kind === "discussion") {
        discussionEditing = true;
        replyEditingId = null;
        renderDiscussionDetail();
        return;
      }

      replyEditingId = btn.dataset.id;
      discussionEditing = false;
      renderDiscussionDetail();
    });
  });

  document.querySelectorAll(".thread-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!currentDiscussionId) return;

      if (btn.dataset.kind === "discussion") {
        const d = currentDiscussionDetail;
        if (!confirm(`Supprimer « ${d?.title || "cette discussion"} » ? Cette action est définitive.`)) return;

        btn.disabled = true;
        try {
          await api.discussions.remove(currentDiscussionId);
          currentDiscussionId = null;
          currentDiscussionDetail = null;
          discussionEditing = false;
          replyEditingId = null;
          go("discussions");
        } catch (err) {
          alert(err.message || "Impossible de supprimer cette discussion.");
          btn.disabled = false;
        }
        return;
      }

      if (!confirm("Supprimer cette réponse ? Cette action est définitive.")) return;

      btn.disabled = true;
      try {
        await api.discussions.removeReply(currentDiscussionId, btn.dataset.id);
        replyEditingId = null;
        await loadDiscussionDetail(true);
      } catch (err) {
        alert(err.message || "Impossible de supprimer cette réponse.");
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll(".thread-reply-edit-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentDiscussionId) return;

      const replyId = form.dataset.replyId;
      const body = form.querySelector("textarea").value.trim();
      if (!body) return;

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        await api.discussions.updateReply(currentDiscussionId, replyId, body);
        replyEditingId = null;
        await loadDiscussionDetail(true);
      } catch (err) {
        alert(err.message || "Impossible de modifier cette réponse.");
        submitBtn.disabled = false;
      }
    });
  });

  document.querySelectorAll(".thread-reply-edit-cancel").forEach((btn) => {
    btn.addEventListener("click", () => {
      replyEditingId = null;
      renderDiscussionDetail();
    });
  });

  document.querySelectorAll(".thread-action-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const d = currentDiscussionDetail;
      if (!d) return;

      if (btn.dataset.action === "reply") {
        document.querySelector("#replyForm .reply-input")?.focus();
        return;
      }

      if (btn.dataset.action === "invite") {
        await inviteToDiscussion(d);
      }
    });
  });
}

async function loadDiscussionDetail(reset = true) {
  if (!currentDiscussionId) return;

  const loadMore = document.getElementById("discussThreadLoadMore");
  if (reset) {
    discussionThreadPage = 1;
    currentDiscussionDetail = null;
    document.getElementById("discussReplies").innerHTML =
      '<p class="profile-whatsapp-status">Chargement…</p>';
    if (loadMore) loadMore.hidden = true;
  } else if (loadMore) {
    loadMore.disabled = true;
    loadMore.textContent = "Chargement…";
  }

  try {
    const detail = await api.discussions.get(currentDiscussionId, {
      page: discussionThreadPage,
      pageSize: DISCUSSION_THREAD_PAGE_SIZE,
    });

    if (reset || !currentDiscussionDetail) {
      currentDiscussionDetail = normalizeDiscussionFromApi(detail);
    } else {
      currentDiscussionDetail = normalizeDiscussionFromApi({
        ...detail,
        thread: {
          ...detail.thread,
          items: [...(currentDiscussionDetail.thread?.items || []), ...(detail.thread?.items || [])],
        },
      });
    }

    renderDiscussionDetail();
  } catch {
    const fallback = findDiscussion(currentDiscussionId);
    if (fallback) {
      currentDiscussionDetail = {
        ...fallback,
        thread: {
          items: (fallback.thread || []).map((r) => ({
            id: r.id,
            author: r.author,
            avatar: r.avatar,
            time: r.time,
            text: r.text,
          })),
          hasMore: false,
        },
      };
      renderDiscussionDetail();
    }
  } finally {
    if (loadMore) {
      loadMore.disabled = false;
      loadMore.textContent = "Afficher plus de réponses";
    }
  }
}

async function loadMoreDiscussionThread() {
  if (!currentDiscussionDetail?.thread?.hasMore) return;
  discussionThreadPage += 1;
  await loadDiscussionDetail(false);
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

function renderMyAdvertsList(adverts) {
  return adverts
    .map(
      (ad) => `
      <article class="my-advert-card">
        <div class="my-advert-body">
          <h2 class="my-advert-title">${escapeHtml(ad.title)}</h2>
          <p class="my-advert-meta">${escapeHtml(ad.price || "—")} · ${escapeHtml(ad.location || "Kinshasa")} · ${escapeHtml(ad.time)}</p>
          <p class="my-advert-stats">👁 ${formatAdvertCount(ad.viewCount)} vues · ♡ ${formatAdvertCount(ad.likeCount)} favoris</p>
        </div>
        <div class="my-advert-actions">
          <button type="button" class="btn-primary-inline my-advert-edit" data-id="${ad.id}">Modifier</button>
          <button type="button" class="btn-secondary-inline my-advert-delete" data-id="${ad.id}">Supprimer</button>
        </div>
      </article>`
    )
    .join("");
}

function wireMyAdvertActions(adverts) {
  const list = document.getElementById("myAdvertsList");
  list.querySelectorAll(".my-advert-edit").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ad = adverts.find((item) => item.id === btn.dataset.id);
      if (ad) startEditAdvert(ad);
    });
  });

  list.querySelectorAll(".my-advert-delete").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ad = adverts.find((item) => item.id === btn.dataset.id);
      if (!ad) return;
      if (!confirm(`Supprimer « ${ad.title} » ? Cette action est définitive.`)) return;

      btn.disabled = true;
      try {
        await api.adverts.remove(ad.id);
        const listingIndex = LISTINGS.findIndex((item) => item.id === ad.id);
        if (listingIndex >= 0) LISTINGS.splice(listingIndex, 1);
        await fetchMyAdverts(true);
      } catch (err) {
        alert(err.message || "Impossible de supprimer cette annonce.");
        btn.disabled = false;
      }
    });
  });
}

async function fetchMyAdverts(reset = false) {
  const list = document.getElementById("myAdvertsList");
  const empty = document.getElementById("myAdvertsEmpty");
  const loadMore = document.getElementById("myAdvertsLoadMore");

  if (reset) {
    myAdvertsPage = 1;
    myAdvertsItems = [];
    list.innerHTML = '<p class="profile-whatsapp-status">Chargement…</p>';
    empty.hidden = true;
    if (loadMore) loadMore.hidden = true;
  } else if (loadMore) {
    loadMore.disabled = true;
    loadMore.textContent = "Chargement…";
  }

  try {
    const result = await api.adverts.listMine({
      page: myAdvertsPage,
      pageSize: MY_ADVERTS_PAGE_SIZE,
    });

    myAdvertsHasMore = result.hasMore;
    myAdvertsItems = reset ? result.items : [...myAdvertsItems, ...result.items];

    if (!myAdvertsItems.length) {
      list.innerHTML = "";
      empty.hidden = false;
      if (loadMore) loadMore.hidden = true;
      return;
    }

    list.innerHTML = renderMyAdvertsList(myAdvertsItems);
    wireMyAdvertActions(myAdvertsItems);
    empty.hidden = true;
    if (loadMore) {
      loadMore.hidden = !myAdvertsHasMore;
      loadMore.disabled = false;
      loadMore.textContent = "Afficher plus";
    }
  } catch (err) {
    list.innerHTML = "";
    empty.textContent = err.message || "Impossible de charger vos annonces.";
    empty.hidden = false;
    if (loadMore) loadMore.hidden = true;
  }
}

async function loadMoreMyAdverts() {
  if (!myAdvertsHasMore) return;
  myAdvertsPage += 1;
  await fetchMyAdverts(false);
}

async function renderMyAdverts() {
  await fetchMyAdverts(true);
}

function renderSavedAdvertsList(adverts) {
  return adverts
    .map((ad) => {
      const listing = apiAdvertToListing(ad);
      return `
      <button type="button" class="listing-card" data-listing="${listing.id}">
        ${renderListingThumb(listing)}
        <span class="listing-body">
          ${intentPillHtml(listing.intent)}
          <span class="listing-title">${escapeHtml(listing.title)}</span>
          <span class="listing-price">${escapeHtml(listing.price)}</span>
          ${listingStatsHtml(listing)}
          <span class="listing-meta">${escapeHtml(listing.location)} · ${escapeHtml(listing.time)}</span>
        </span>
        ${listingFavHtml(listing.id)}
      </button>`;
    })
    .join("");
}

async function fetchSavedAdverts(reset = false) {
  const list = document.getElementById("savedAdvertsList");
  const empty = document.getElementById("savedAdvertsEmpty");
  const loadMore = document.getElementById("savedAdvertsLoadMore");

  if (reset) {
    savedAdvertsPage = 1;
    savedAdvertsItems = [];
    list.innerHTML = '<p class="profile-whatsapp-status">Chargement…</p>';
    empty.hidden = true;
    if (loadMore) loadMore.hidden = true;
  } else if (loadMore) {
    loadMore.disabled = true;
    loadMore.textContent = "Chargement…";
  }

  try {
    const result = await api.adverts.listSaved({
      page: savedAdvertsPage,
      pageSize: SAVED_ADVERTS_PAGE_SIZE,
    });

    savedAdvertsHasMore = result.hasMore;
    savedAdvertsItems = reset ? result.items : [...savedAdvertsItems, ...result.items];
    result.items.forEach((ad) => savedAdvertIds.add(String(ad.id)));

    if (!savedAdvertsItems.length) {
      list.innerHTML = "";
      empty.hidden = false;
      if (loadMore) loadMore.hidden = true;
      return;
    }

    list.innerHTML = renderSavedAdvertsList(savedAdvertsItems);
    list.querySelectorAll("[data-listing]").forEach((btn) => {
      btn.addEventListener("click", () => openAd(btn.dataset.listing));
    });
    wireListingFavButtons(list);
    empty.hidden = true;
    if (loadMore) {
      loadMore.hidden = !savedAdvertsHasMore;
      loadMore.disabled = false;
      loadMore.textContent = "Afficher plus";
    }
  } catch (err) {
    list.innerHTML = "";
    empty.textContent = err.message || "Impossible de charger vos annonces sauvegardées.";
    empty.hidden = false;
    if (loadMore) loadMore.hidden = true;
  }
}

async function loadMoreSavedAdverts() {
  if (!savedAdvertsHasMore) return;
  savedAdvertsPage += 1;
  await fetchSavedAdverts(false);
}

async function renderSavedAdverts() {
  await fetchSavedAdverts(true);
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
  loadPopularSearches();
  loadAllBrowseCategories();
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
    tab.addEventListener("click", async () => {
      resultsTab = tab.dataset.tab;
      document.querySelectorAll("#resultsTabs .tab").forEach((t) => t.classList.toggle("active", t === tab));
      updateIntentFilterVisibility();
      updateSourceFilterVisibility();
      if (isCategoryBrowseMode()) {
        await fetchAndRenderCategoryResults(true);
      } else {
        await fetchAndRenderResults(true);
      }
    });
  });

  document.querySelectorAll("#resultsIntentChips .intent-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      setIntentFilter(chip.dataset.intent);
    });
  });

  document.querySelectorAll("#resultsSourceChips .source-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      setSourceFilter(chip.dataset.source);
    });
  });

  document.getElementById("resultsLoadMore")?.addEventListener("click", () => {
    loadMoreSearchResults();
  });

  document.getElementById("myAdvertsLoadMore")?.addEventListener("click", () => {
    loadMoreMyAdverts();
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

  document.getElementById("accountSavedAdverts").addEventListener("click", () => {
    if (!isSignedIn()) {
      alert("Connectez-vous pour voir vos annonces sauvegardées.");
      go("account");
      return;
    }
    go("saved-adverts");
  });

  document.getElementById("accountSettings").addEventListener("click", () => {
    go("settings");
  });

  document.querySelectorAll("#displayModePicker .display-mode-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      setDisplayMode(btn.dataset.mode);
    });
  });

  document.getElementById("profilePublicToggle")?.addEventListener("change", (e) => {
    setProfileVisibility(e.target.checked);
  });

  document.getElementById("adFavBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    if (currentListingId) toggleSavedAdvert(currentListingId, e.currentTarget);
  });

  document.getElementById("adShareBtn").addEventListener("click", async (e) => {
    e.stopPropagation();
    const ad = findListing(currentListingId);
    if (ad) await shareAdvert(ad);
  });

  document.getElementById("savedAdvertsLoadMore")?.addEventListener("click", () => {
    loadMoreSavedAdverts();
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
      if (authUser?.displayPreference) applyDisplayMode(authUser.displayPreference);
      setFacebookLoginStatus("");
      await refreshAccountView();
      await refreshSavedAdvertIds();
    } catch (err) {
      setFacebookLoginStatus(err.message || "Connexion Facebook impossible.", "warn");
    }
  });

  document.getElementById("accountLogout").addEventListener("click", () => {
    api.auth.clearSession();
    api.client.clearToken();
    authUser = null;
    savedAdvertIds = new Set();
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

  document.getElementById("discussThreadLoadMore")?.addEventListener("click", () => {
    loadMoreDiscussionThread();
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
  initDisplayModeFromStorage();
  if (isSignedIn()) syncDisplayPreferenceFromApi();
  if (q) openResults(q);
  else handleDeepLink();
}

init();