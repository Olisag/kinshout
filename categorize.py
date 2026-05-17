"""Kinshout listing categorizer — OpenAI when OPENAI_API_KEY is set, else rules."""

import json
import os
import re
import urllib.error
import urllib.request
from typing import Optional

CATEGORIES = {
    "immobilier": {
        "label": "Immobilier",
        "icon": "🏠",
        "keywords": [
            "appartement", "maison", "studio", "villa", "loyer", "louer", "location",
            "colocation", "terrain", "bureau", "commerce", "gombe", "limete", "bandal",
            "kinshasa", "chambre", "immeuble", "parcelle",
        ],
    },
    "vehicules_transport": {
        "label": "Véhicules & transport",
        "icon": "🚗",
        "keywords": [
            "voiture", "moto", "taxi", "chauffeur", "conducteur", "véhicule", "vehicule",
            "camion", "bus", "transport", "permis", "garage", "pièces auto",
        ],
    },
    "electronique": {
        "label": "Électronique",
        "icon": "📱",
        "keywords": [
            "iphone", "samsung", "téléphone", "telephone", "ordinateur", "laptop",
            "tablette", "tv", "télévision", "console", "playstation", "xbox",
            "écouteurs", "chargeur", "starlink", "internet", "modem", "wifi",
        ],
    },
    "emploi_services": {
        "label": "Emploi & services",
        "icon": "💼",
        "keywords": [
            "emploi", "travail", "job", "recrute", "cv", "salaire", "stage",
            "plombier", "électricien", "electricien", "menuisier", "coiffeur",
            "nettoyage", "réparation", "reparation", "service", "freelance",
        ],
    },
    "mode_beaute": {
        "label": "Mode & beauté",
        "icon": "👗",
        "keywords": [
            "vêtement", "vetement", "robe", "chaussure", "sac", "montre",
            "parfum", "maquillage", "coiffure", "beauté", "beaute", "bijou",
        ],
    },
    "maison_jardin": {
        "label": "Maison & jardin",
        "icon": "🛋️",
        "keywords": [
            "meuble", "canapé", "canape", "frigo", "réfrigérateur", "cuisine",
            "ustensile", "décoration", "jardin", "outil",
        ],
    },
    "discussion": {
        "label": "Discussion",
        "icon": "💬",
        "keywords": [
            "discussion", "avis", "question", "forum", "conseil", "qu'en pensez",
            "starlink", "politique", "société", "societe", "débat", "debat",
        ],
    },
}

OFFER_WORDS = [
    "vends", "vendre", "vend", "à vendre", "a vendre", "disponible", "propose",
    "offre", "location", "loue", "louer",
]
DEMAND_WORDS = [
    "cherche", "recherche", "besoin", "voulez", "veux", "acheter", "achète",
    "achete", "louer un", "louer une", "recrute",
]


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().strip())


def categorize_local(text: str) -> dict:
    norm = _normalize(text)
    scores = {key: 0.0 for key in CATEGORIES}
    matched = []

    for cat_id, meta in CATEGORIES.items():
        for kw in meta["keywords"]:
            if kw in norm:
                scores[cat_id] += 1.5 if len(kw) > 5 else 1.0
                matched.append(kw)

    best_id = max(scores, key=scores.get)
    best_score = scores[best_id]
    if best_score == 0:
        best_id = "autre"

    total = sum(scores.values()) or 1
    confidence = min(0.95, 0.45 + (best_score / total) * 0.5) if best_score else 0.4

    intent = "demande"
    if any(w in norm for w in OFFER_WORDS):
        intent = "offre"
    elif any(w in norm for w in DEMAND_WORDS):
        intent = "demande"
    if best_id == "discussion" or "discussion" in norm:
        intent = "discussion"

    cat = CATEGORIES.get(best_id, {"label": "Autre", "icon": "📦", "keywords": []})
    intent_labels = {
        "offre": "Offre — le client vend ou propose",
        "demande": "Demande — le client cherche",
        "discussion": "Discussion communautaire",
    }

    return {
        "categoryId": best_id if best_id != "autre" else "autre",
        "categoryLabel": cat["label"] if best_id != "autre" else "Autre",
        "categoryIcon": cat["icon"] if best_id != "autre" else "📦",
        "intent": intent,
        "intentLabel": intent_labels[intent],
        "confidence": round(confidence, 2),
        "summary": _build_summary(text, cat["label"] if best_id != "autre" else "Autre", intent),
        "source": "rules",
        "matchedKeywords": list(dict.fromkeys(matched))[:5],
    }


def _build_summary(text: str, category: str, intent: str) -> str:
    if intent == "offre":
        return f"Annonce classée en « {category} » — le client propose un bien ou un service."
    if intent == "discussion":
        return f"Sujet classé en « {category} » — question ou échange communautaire."
    return f"Recherche classée en « {category} » — le client cherche un bien ou un service."


def categorize_openai(text: str) -> Optional[dict]:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None

    categories_list = ", ".join(
        f"{k} ({v['label']})" for k, v in CATEGORIES.items()
    ) + ", autre (Autre)"

    prompt = f"""Tu es l'IA de Kinshout, une plateforme d'annonces à Kinshasa (RDC).
Analyse ce texte et réponds UNIQUEMENT en JSON valide:
{{
  "categoryId": "une parmi: {categories_list}",
  "categoryLabel": "nom français de la catégorie",
  "intent": "offre|demande|discussion",
  "confidence": 0.0 à 1.0,
  "summary": "une phrase en français expliquant ce que le client annonce ou cherche"
}}

Texte: "{text}"
"""

    body = json.dumps(
        {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }
    ).encode()

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode())
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        cat_id = parsed.get("categoryId", "autre")
        meta = CATEGORIES.get(cat_id, {"label": "Autre", "icon": "📦"})
        intent = parsed.get("intent", "demande")
        intent_labels = {
            "offre": "Offre — le client vend ou propose",
            "demande": "Demande — le client cherche",
            "discussion": "Discussion communautaire",
        }
        return {
            "categoryId": cat_id,
            "categoryLabel": parsed.get("categoryLabel", meta["label"]),
            "categoryIcon": meta["icon"],
            "intent": intent,
            "intentLabel": intent_labels.get(intent, intent_labels["demande"]),
            "confidence": float(parsed.get("confidence", 0.85)),
            "summary": parsed.get("summary", ""),
            "source": "openai",
            "matchedKeywords": [],
        }
    except (urllib.error.URLError, KeyError, json.JSONDecodeError, ValueError):
        return None


def categorize(text: str) -> dict:
    text = (text or "").strip()
    if not text:
        return categorize_local("")

    ai = categorize_openai(text)
    if ai:
        return ai
    return categorize_local(text)
