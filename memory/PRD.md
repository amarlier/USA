# USA Ouest 2026 — Carnet de route

## Problème / Contexte
L'utilisateur reprend un projet Emergent (trip-planner-guide-2) qui n'a plus d'accès. 
Le projet est un carnet de route familial pour un roadtrip USA Ouest été 2026 (26 jours, 179 lieux).
Contenu source : Google Doc long de ~560 KB. 
Demandes : (1) reconstruire avec le même look, (2) réinsérer des photos, (3) ajouter des sous-pages Hôtel et Où Manger par jour.

## Personas
- Familles Dufour Cagna et Marlier (utilisateurs finaux consultant le carnet pendant le voyage).

## Architecture
- **Frontend** : React SPA (react-router-dom)
- **Backend** : FastAPI (stub — pas d'API métier utilisée pour ce MVP)
- **Data** : Statique dans `/app/frontend/src/data/trip.js` (26 jours, ~150 restaurants, ~150 lieux)
- **Design** : palette terracotta/crème, typographie Fraunces (serif) + DM Sans (sans), icônes FontAwesome

## Routes implémentées
- `/` : Home (hero, stats, timeline 26 jours)
- `/jour/:id` : Page d'un jour (récit + lieux + tabs vers sous-pages)
- `/jour/:id/hotel` : Sous-page Hôtel avec lien Google Maps ✅ NOUVEAU
- `/jour/:id/manger` : Sous-page Où Manger avec liste des restaurants ✅ NOUVEAU
- `/guides` : Infos pratiques (pass parcs, conduite, ESTA, internet, manger, etc.)
- `/carte`, `/recherche`, `/checklist`, `/favoris` : placeholders

## Ce qui a été livré (05/07/2026)
- ✅ Reconstruction complète avec look d'origine (couleurs, typo, layout)
- ✅ 26 jours avec date, résumé, récit, hôtel, restaurants, lieux
- ✅ Photos d'illustration Unsplash par thème pour chaque jour
- ✅ Sous-pages Hôtel et Où Manger (demande principale utilisateur)
- ✅ Header sticky avec navigation
- ✅ Guides pratiques (8 sections)
- ✅ Documents complémentaires listés

## Backlog / Future
- P1: Réinsérer les vraies photos utilisateur (actuellement Unsplash génériques) — nécessite upload
- P1: Section Carte interactive (Google Maps embed du carnet original)
- P2: Recherche full-text sur lieux/restaurants
- P2: Checklist voyage interactive avec état sauvegardé (backend)
- P2: Favoris (backend + auth)
- P3: PDF export du carnet
- P3: Mode hors-ligne (PWA)

## Notes
- Backend FastAPI reste minimal (endpoints /api/status seulement).
- Données trip stockées statiquement — pour évoluer vers un CMS, migrer vers MongoDB.
