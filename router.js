const views = new Map();
let current = "home";
let history = ["home"];

export function registerView(name, el) {
  views.set(name, el);
}

export function getCurrent() {
  return current;
}

export function navigate(name, { replace = false, data = null } = {}) {
  if (!views.has(name)) return;

  const prev = views.get(current);
  const next = views.get(name);

  if (prev) {
    prev.hidden = true;
    prev.classList.remove("view-active");
  }

  next.hidden = false;
  next.classList.add("view-active");

  if (replace) {
    history[history.length - 1] = name;
  } else if (history[history.length - 1] !== name) {
    history.push(name);
  }

  current = name;
  window.scrollTo({ top: 0, behavior: "instant" });

  window.dispatchEvent(
    new CustomEvent("kinshout:navigate", { detail: { view: name, data } })
  );

  return data;
}

export function goBack() {
  if (history.length <= 1) {
    navigate("home", { replace: true });
    return "home";
  }
  history.pop();
  const prev = history[history.length - 1];
  const prevEl = views.get(current);
  if (prevEl) {
    prevEl.hidden = true;
    prevEl.classList.remove("view-active");
  }
  const nextEl = views.get(prev);
  nextEl.hidden = false;
  nextEl.classList.add("view-active");
  current = prev;
  window.scrollTo({ top: 0, behavior: "instant" });
  window.dispatchEvent(new CustomEvent("kinshout:navigate", { detail: { view: prev } }));
  return prev;
}

export function setNavTab(tab, navItems) {
  navItems.forEach((n) => {
    const match =
      (tab === "home" && n.dataset.tab === "home") ||
      (tab === "search" && n.dataset.tab === "search") ||
      (tab === "publish" && n.dataset.tab === "publish") ||
      (tab === "discussions" && n.dataset.tab === "discussions") ||
      (tab === "account" && n.dataset.tab === "account");
    n.classList.toggle("active", match);
  });
}

/** Map view to bottom nav highlight */
export function navTabForView(view) {
  const map = {
    home: "home",
    search: "search",
    results: "search",
    "ad-detail": "search",
    "publish-1": "publish",
    "publish-2": "publish",
    "publish-3": "publish",
    discussions: "discussions",
    "discussion-detail": "discussions",
    account: "account",
    "my-adverts": "account",
    "saved-adverts": "account",
    settings: "account",
    "user-profile": "search",
    categorize: "search",
  };
  return map[view] || "home";
}
