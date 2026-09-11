# Transfert PostgreSQL vers D1

L’outil a trois phases et ne journalise jamais le contenu :

```sh
SOURCE_DATABASE_URL='postgres://…' bun run transfer -- extract .local-data/transfer/dropthing.json
bun run transfer -- analyze .local-data/transfer/dropthing.json
bun run transfer -- import .local-data/transfer/dropthing.json
```

L’extraction utilise une transaction PostgreSQL `REPEATABLE READ READ ONLY`, conserve toutes les lignes (expirées incluses), UUID, clés R2, chiffrement, JSON, NULL et dates. Les timestamps PostgreSQL sans fuseau sont interprétés comme UTC, cohérent avec les `Date` JS historiques ; vérifier cette hypothèse sur un échantillon de production avant bascule. L’export est mode 0600, ignoré par Git, et doit être supprimé selon la politique convenue.

L’analyse valide types, UUID uniques, entiers sûrs et dates, puis rapporte uniquement comptages et SHA-256 déterministe. Tout import refuse une table `drops` non vide et utilise des `INSERT` stricts ; aucun `OR IGNORE`. D1 n’offre pas une atomicité garantie sur un import complet : après échec, inspecter la cible, la restaurer à un état vide connu et recommencer. Le mode distant exige simultanément une option explicite, le nom, l’UUID vérifié et une configuration distante.

Après autorisation, le mode distant a été activé avec vérification obligatoire du couple nom/UUID :

```sh
bun run transfer -- import .local-data/transfer/final-cutover.json --remote \
  --database-name dropthing-production \
  --database-id ef0a50c9-edcd-44e4-ab76-6ab3a224179b \
  --config wrangler.production-stage.jsonc
```

Les contenus dépassant la limite d’une instruction D1 sont insérés sans contenu puis reconstruits par concaténations UTF-8 de moins de 60 000 octets. La valeur finale n’est jamais tronquée et reste soumise à la limite de valeur/ligne D1.

Validation de production future : comparer rapport/fingerprint, répartition types/chiffrement/NULL/dates, unicité, et vérifier par HEAD R2 sans télécharger le contenu que chaque `storageKey` encore valide existe sous le préfixe exact. Tester plusieurs anciens liens (Unicode, chiffré/non chiffré, expiré) et créer un nouveau drop après import.
