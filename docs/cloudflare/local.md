# Développement local

Prérequis : Bun 1.4+, Docker uniquement pour la fixture PostgreSQL de transfert.

```sh
bun install
bun run db:migrate:local
bun run dev
```

Ouvrir `http://127.0.0.1:3001`. D1 et R2 persistent dans `apps/api/.wrangler/state`. `bun run db:reset:local` supprime uniquement cet état local ; relancer ensuite la migration. Aucun fichier `.env` n’est fourni ni versionné. Groq est facultatif : sans `GROQ_API_KEY`, l’enrichissement échoue de façon non bloquante ; les contenus chiffrés ne l’appellent jamais.

Vérifications : `bun run type-check`, `bun run lint`, `bun run format:check`, `bun run test`, `bun run build`. Le build exécute Vite puis `wrangler deploy --dry-run` et ne contacte/crée aucune ressource distante.

Le PUT local `/api/uploads/*` est un substitut Miniflare destiné au parcours navigateur. En production, cette route renvoie 404 et `/drops/presign` produit une URL S3 SigV4 de 10 minutes, PUT seulement, clé unique, avec `Content-Type` signé.

Le test R2 distant reproductible utilise uniquement une clé synthétique isolée et la supprime :

```sh
bun run --cwd apps/api validate:r2:remote
```

Il nécessite les variables S3 R2 locales non versionnées. Il ne liste, ne lit ni ne supprime aucun objet Dropthing. Le bucket existant a passé PUT/HEAD/GET/DELETE SigV4 et les préflights CORS le 11 septembre 2026. Tester un fichier de plusieurs Go, le multipart/reprise et les limites réelles reste une décision produit et opérationnelle distincte.

La prévisualisation distante, sans domaine de production et sans Cron, est disponible sur `https://dropthing-cloudflare-preview.lucas-4ee.workers.dev`. Elle partage uniquement le bucket existant sous le préfixe isolé `cloudflare-preview` et utilise la base D1 vide créée pour Dropthing. Ne pas y charger de données réelles avant décision de bascule.
