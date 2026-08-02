# SocialFlow AI — Application (phase 0)

Next.js (App Router, TypeScript, Tailwind) + Supabase (Postgres UE, Auth, Storage, RLS).

## Démarrage
1. Créer le projet Supabase (région UE) et exécuter `../supabase/schema.sql` dans l'éditeur SQL.
2. Copier `.env.example` vers `.env.local` et renseigner les clés.
3. `npm install && npm run dev`

## Variables d'environnement
Voir `.env.example`. Les clés serveur (service role, agrégateur, IA) ne sont jamais exposées au navigateur.
