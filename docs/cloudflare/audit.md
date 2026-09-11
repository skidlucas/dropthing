# Audit Cloudflare (11 septembre 2026)

Base auditée : `b0b9d3c552d1af5a9443490414597ece88e6fd3c`, branche `codex/dropthing-cloudflare`. Les observations du prompt ont été confirmées. L’ancien serveur dépendait de Bun (`S3Client`, `Bun.file`, export serveur), de PostgreSQL/Effect SQL et d’une fibre de nettoyage permanente. Le frontend utilisait déjà `/api`, l’upload direct et le format de chiffrement navigateur ; ces contrats sont conservés.

Décisions : un Worker Hono sert l’API sous `/api/*` et les assets Vite ; D1 stocke les lignes et les intentions d’upload ; R2 stocke les objets sous la clé complète `R2_PREFIX/storageKey`. Les identifiants, timestamps absolus, JSON, NULL, booléens et anciennes clés sont conservés. Les nouveaux textes sont limités explicitement à 1 MiB UTF-8 (aucune troncature), sous la [limite D1 de 2 000 000 octets](https://developers.cloudflare.com/d1/platform/limits/). Les gros fichiers restent en upload direct.

Versions verrouillées : Wrangler 4.131.0, workers-types 5.20260911.1, Hono 4.13.3, Drizzle RC existant `1.0.0-rc.5-169397b`, Effect RC existant `4.0.0-rc.111`. Effect/Drizzle restent expérimentaux ; ils n’ont pas été mis à jour hors périmètre. `aws4fetch` remplace les API S3 Bun pour SigV4 Workers.

Preuve locale réalisée : démarrage workerd, migration D1, création/lecture Drizzle via Hono+Effect, PUT/get stream/delete R2 local, assets frontend, rejet d’une confirmation rejouée et invocation `scheduled`.

Preuve R2 distante réalisée avec autorisation le 11 septembre 2026 sur le bucket existant `dropthing` : CORS pour les deux origines configurées, PUT SigV4 de 120 secondes avec `Content-Type` signé, HEAD, GET streamé et SHA-256 identique sur un objet synthétique de 4096 octets. La clé isolée `cloudflare-validation/<uuid>.bin` a été supprimée en `finally`, puis HEAD 404 a confirmé son absence. Cela ne valide toujours pas les quotas CPU/stockage, les fichiers de plusieurs Go ou les performances de production.

Une base D1 vide `dropthing-production` (juridiction UE) et un Worker sans route DNS ni Cron ont ensuite été créés. La prévisualisation a validé assets, Hono+Effect+D1, texte chiffré et le parcours fichier complet navigateur → URL SigV4 → R2 → confirmation → streaming Worker, avec nom Unicode. Tous les drops, objets et intentions synthétiques ont été supprimés ; les deux tables applicatives distantes ont été contrôlées à zéro ligne.

Risque d’expiration : une URL publique R2 contourne l’API jusqu’à suppression physique et un cache peut prolonger cette fenêtre. Pour une expiration stricte, ne pas configurer `R2_PUBLIC_URL` et streamer via l’API. Le nettoyage conserve les lignes et met seulement `storage_key` à NULL, comme avant.
