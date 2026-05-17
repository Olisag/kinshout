/** Client-side fallback when API is unavailable (mirrors categorize.py rules). */

const CATEGORIES = {
  immobilier: {
    label: "Immobilier",
    icon: "🏠",
    keywords: [
      "appartement", "maison", "studio", "villa", "loyer", "louer", "location",
      "colocation", "terrain", "bureau", "gombe", "limete", "bandal", "chambre",
    ],
  },
  vehicules_transport: {
    label: "Véhicules & transport",
    icon: "🚗",
    keywords: ["voiture", "moto", "taxi", "chauffeur", "véhicule", "vehicule", "transport"],
  },
  electronique: {
    label: "Électronique",
    icon: "📱",
    keywords: [
      "iphone", "samsung", "téléphone", "telephone", "ordinateur", "laptop",
      "starlink", "internet", "tv",
    ],
  },
  emploi_services: {
    label: "Emploi & services",
    icon: "💼",
    keywords: ["emploi", "travail", "job", "recrute", "plombier", "service"],
  },
  mode_beaute: {
    label: "Mode & beauté",
    icon: "👗",
    keywords: ["vêtement", "vetement", "robe", "chaussure", "coiffure"],
  },
  maison_jardin: {
    label: "Maison & jardin",
    icon: "🛋️",
    keywords: ["meuble", "canapé", "canape", "frigo", "cuisine"],
  },
  discussion: {
    label: "Discussion",
    icon: "💬",
    keywords: ["discussion", "avis", "question", "forum", "débat", "debat"],
  },
};

const OFFER = ["vends", "vendre", "à vendre", "a vendre", "disponible", "propose", "loue"];
const DEMAND = ["cherche", "recherche", "besoin", "acheter", "achète", "achete"];

export function categorizeLocal(text) {
  const norm = text.toLowerCase().trim();
  const scores = Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, 0]));
  const matched = [];

  for (const [id, meta] of Object.entries(CATEGORIES)) {
    for (const kw of meta.keywords) {
      if (norm.includes(kw)) {
        scores[id] += kw.length > 5 ? 1.5 : 1;
        matched.push(kw);
      }
    }
  }

  let bestId = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  if (scores[bestId] === 0) bestId = "autre";

  let intent = "demande";
  if (OFFER.some((w) => norm.includes(w))) intent = "offre";
  if (bestId === "discussion" || norm.includes("discussion")) intent = "discussion";

  const cat = CATEGORIES[bestId] || { label: "Autre", icon: "📦" };
  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const confidence = Math.min(0.95, 0.45 + (scores[bestId] / total) * 0.5);

  const intentLabels = {
    offre: "Offre — le client vend ou propose",
    demande: "Demande — le client cherche",
    discussion: "Discussion communautaire",
  };

  const label = bestId === "autre" ? "Autre" : cat.label;
  let summary;
  if (intent === "offre") summary = `Annonce classée en « ${label} » — le client propose un bien ou un service.`;
  else if (intent === "discussion") summary = `Sujet classé en « ${label} » — question ou échange communautaire.`;
  else summary = `Recherche classée en « ${label} » — le client cherche un bien ou un service.`;

  return {
    categoryId: bestId,
    categoryLabel: label,
    categoryIcon: cat.icon || "📦",
    intent,
    intentLabel: intentLabels[intent],
    confidence: Math.round(confidence * 100) / 100,
    summary,
    source: "rules",
    matchedKeywords: [...new Set(matched)].slice(0, 5),
  };
}

export async function categorizeQuery(text) {
  try {
    const res = await fetch("/api/categorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) return await res.json();
  } catch {
    /* offline or static file — use local rules */
  }
  return categorizeLocal(text);
}
