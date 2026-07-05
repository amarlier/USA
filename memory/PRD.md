# USA Ouest 2026 — Carnet de route

## Contexte
L'utilisateur a repris un ancien projet (trip-planner-guide-2) sans accès à la session originale. Site reconstruit depuis un Google Doc (~560KB de contenu, 149 images, 454 liens externes) pour un voyage familial de 26 jours dans l'Ouest américain (été 2026).

## Personas
- Familles Dufour Cagna et Marlier (utilisateurs du carnet pendant le voyage).

## Architecture
- **Frontend** : React SPA (react-router-dom), CSS custom, FontAwesome
- **Backend** : FastAPI (stub, non utilisé pour le MVP)
- **Data** : Statique dans `/app/frontend/src/data/trip.js` (26 jours, ~150 restaurants, ~180 lieux, 9 documents guides)
- **Photos** : Extraites du docx source, stockées dans `/app/frontend/public/photos/day{N}.png` + galeries `/app/frontend/public/photos/day{N}/imageXXX.png` (149 fichiers, 45MB)

## Routes
- `/` : Home (hero, stats, timeline des 26 jours)
- `/jour/:id` : Page jour (hero + galerie + tabs vers sous-pages)
- `/jour/:id/hotel` : Sous-page Hôtel avec bouton Google Maps ✅
- `/jour/:id/manger` : Sous-page Où Manger (liste restaurants) ✅
- `/guides` : Infos pratiques (8 rubriques) + Documents complémentaires cliquables (Ouvrir/PDF/EPUB)
- `/carte` : Carte interactive Google My Maps (iframe) ✅ NOUVEAU
- `/recherche`, `/checklist`, `/favoris` : placeholders

## Livré (au 05/07/2026)
- ✅ Reconstruction complète avec le look d'origine
- ✅ 26 jours détaillés (récit, hôtel, restaurants, lieux)
- ✅ Sous-pages Hôtel + Où Manger
- ✅ Vraies photos du Google Doc extraites (galerie par jour)
- ✅ 9 documents guides avec liens Google Docs + PDF + EPUB
- ✅ Carte interactive Google My Maps

## Backlog
- P1 : Recherche full-text
- P2 : Checklist voyage interactive (backend)
- P2 : Favoris (backend + auth)
- P3 : PDF export du carnet complet
- P3 : Mode hors-ligne (PWA)
- P3 : Mode "Aujourd'hui" avec détection automatique du jour du voyage
