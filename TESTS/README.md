# Tests exécutés (scripts et résultats bruts)

Environnement de test : Ubuntu, **MySQL 8.0.46 réel**, JDK 17, Spring Boot 3.2.5 avec les **vraies bibliothèques**
(extraites du jar `ecommerce-app-1.0.0.jar` de votre projet d'origine), backend compilé par `javac --release 17 -parameters`.
Le frontend Angular est exécuté dans **jsdom** (navigateur simulé, CORS appliqué) : ce n'est pas Edge/Chrome.

| Fichier | Contenu |
|---|---|
| `resultats/1_api_backend_ORIGINAL_jar_avant_correction.txt` | 72 lignes : suite d'API jouée sur votre backend d'origine (jar, avec Lombok) |
| `resultats/2_api_backend_SANS_LOMBOK_avant_correction.txt` | même suite sur le backend converti sans Lombok → identique au précédent (hors horodatages / ordre des clés d'un `Map.of`) |
| `resultats/3_api_backend_SANS_LOMBOK_apres_correction_roles.txt` | même suite après la correction des autorisations (+ cas limites) |
| `resultats/4_e2e_angular_vers_backend_et_mysql.txt` | 41 vérifications pilotées par l'interface Angular, avec contrôle du contenu de MySQL |
| `scripts/` | `suite.sh` (API, curl + requêtes SQL), `e2e_real.js` (Angular dans jsdom), `up.sh` / `startbe.sh` (démarrage) |

Les scripts contiennent des chemins de mon environnement (`/tmp/be`, `/tmp/jsd`) : ils servent de référence, à adapter pour les rejouer.
