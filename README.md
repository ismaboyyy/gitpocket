# Repocket ↗

Un tableau de bord simple pour retrouver ses dépôts GitHub et ses collaborations.

Chaque utilisateur se connecte avec **son compte GitHub** et voit **ses propres dépôts**. Fonctionne sur un ordinateur ou un Raspberry Pi, avec Node.js et sans dépendance npm.

## Fonctionnalités

- Tous les dépôts accessibles, collaborations directes et invitations en attente.
- Recherche par nom, propriétaire, description ou langage.
- Filtres par propriétaire et visibilité publique/privée.
- Tri par dernier push, nouveaux ajouts détectés, mise à jour ou nom.
- Deux colonnes sur ordinateur, une sur mobile.
- Par défaut : vue **Tous**, tri **Dernier push**, filtres ouverts.
- L’application utilise uniquement des requêtes de lecture vers l’API des dépôts.

## Installation avec connexion GitHub

Prérequis : Node.js **22.9+** ou 24+, Git et un compte GitHub. Pas de `npm install` nécessaire.

Après avoir cloné ou téléchargé ce dépôt :

```sh
cd repocket
cp .env.example .env
```

1. Créer une [OAuth App dans les paramètres GitHub](https://github.com/settings/applications/new).
2. Pour une installation locale, renseigner :
   - Application name : `Repocket Local` (ou un nom personnel).
   - Homepage URL : `http://127.0.0.1:3000`.
   - Authorization callback URL : **`http://127.0.0.1:3000/auth/callback`**.
3. Générer le client secret et remplir `.env` :

```dotenv
AUTH_MODE=github
APP_URL=http://127.0.0.1:3000
PORT=3000
GITHUB_CLIENT_ID=votre_client_id
GITHUB_CLIENT_SECRET=votre_client_secret
```

```sh
npm start
```

Ouvrir **http://127.0.0.1:3000**, cliquer sur **Se connecter avec GitHub** et autoriser l’application. Utiliser la même adresse que `APP_URL` : `localhost` et `127.0.0.1` ne sont pas interchangeables pour les cookies et les contrôles d’origine.

Les visiteurs d’une instance hébergée n’ont rien à installer et n’ont pas besoin de créer leur propre OAuth App. Les personnes qui hébergent leur propre copie créent leur propre OAuth App et leurs propres secrets.

### Autorisations GitHub

Le scope OAuth **`repo`** est demandé pour découvrir les dépôts privés et les invitations. **Ce scope permet aussi des écritures** : GitHub OAuth ne propose pas de scope global équivalent limité à la lecture des dépôts privés. Repocket n’utilise pas ces capacités d’écriture. Lire les [scopes GitHub officiels](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps).

Connectez-vous uniquement sur une instance de confiance : son opérateur traite les jetons des utilisateurs. Une organisation peut exiger une approbation OAuth ou une autorisation SSO ; dans ce cas certains dépôts peuvent manquer.

## Mode personnel local avec GitHub CLI

Pour utiliser uniquement son propre compte sur sa machine, sans créer d’OAuth App : installer [GitHub CLI](https://cli.github.com/), puis :

```sh
gh auth login --hostname github.com
```

Dans `.env` :

```dotenv
AUTH_MODE=local
APP_URL=http://127.0.0.1:3000
PORT=3000
```

Lancer `npm start`. Ce mode utilise le compte GitHub CLI de l’utilisateur système et n’a pas de connexion par visiteur. **Ne pas le publier via un proxy ou un tunnel** : toute personne pouvant y accéder verrait les dépôts du compte local. Le serveur refuse une `APP_URL` distante dans ce mode.

## Hébergement sur Raspberry Pi ou autre serveur

1. Installer Node.js 22.9+ ou 24+ et copier le projet.
2. Créer une OAuth App distincte pour la production :
   - Homepage URL : `https://github.example.com`.
   - Callback : `https://github.example.com/auth/callback`.
3. Configurer `.env` avec `AUTH_MODE=github`, `APP_URL=https://github.example.com`, les identifiants OAuth correspondants et `PORT=3000`.
4. Exécuter `npm start` avec un service `systemd` ou le mécanisme existant du serveur, depuis le dossier du projet. Le compte système doit pouvoir lire `.env`. Restreindre ses permissions, par exemple `chmod 600 .env`.
5. Placer un reverse proxy HTTPS devant **`127.0.0.1:3000`**, en conservant le `Host` public. Exemple Caddy :

```caddyfile
github.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

6. Configurer le DNS et les possibilités de connexion à domicile selon l’installation existante. Ne pas exposer directement le port 3000.

En mode GitHub, l’interface de connexion est publique, mais `/api/repos` nécessite une session personnelle. **Il ne faut pas connecter `gh` au compte du propriétaire sur le serveur** : chaque visiteur autorise son compte via OAuth. Un second login devant le proxy n’est pas nécessaire pour séparer les utilisateurs, mais peut restreindre l’ensemble du site si souhaité.

### Sessions et confidentialité

- OAuth avec `state` lié au navigateur et PKCE S256 ; callback à usage unique.
- Session opaque dans un cookie `HttpOnly`, `SameSite=Lax`, et `Secure` en HTTPS.
- Jetons conservés uniquement en mémoire côté serveur, jamais dans le HTML, les réponses API ou le stockage du navigateur.
- Sessions de huit heures maximum, plus courtes si le jeton expire avant. Pas de renouvellement silencieux : reconnectez-vous après expiration.
- Déconnexion locale immédiate ; pour retirer l’autorisation GitHub elle-même, utiliser les [applications autorisées sur GitHub](https://github.com/settings/applications).
- Redémarrer le serveur déconnecte tous les utilisateurs. Une seule instance est prise en charge ; pour plusieurs instances il faudrait un stockage de sessions partagé.
- Ne jamais committer `.env`, un secret OAuth ou un jeton. `.gitignore` les exclut.

## Limites des données

**Collaborations** utilise `affiliation=collaborator`. **Partagés** inclut tous les dépôts accessibles dont on n’est pas propriétaire, y compris par une organisation. Ces vues décrivent les accès actuels, pas l’historique des invitations acceptées.

**Dernier push** utilise `pushed_at` : il reflète les envois vers le dépôt, pas la date du dernier commit de sa branche principale. Les dépôts sans date apparaissent en dernier. Les dates sont affichées dans le fuseau du navigateur.

**Derniers ajouts détectés** compare les dépôts avec la première visite. Les identifiants et dates de détection sont conservés dans `localStorage`, séparément par compte. Aucun ancien ajout ne reçoit une date inventée. Changer de navigateur ou d’adresse, ou effacer le stockage local, réinitialise ce suivi. Les descriptions et jetons n’y sont pas enregistrés.

## Développement et vérification

```sh
npm test
```

Les tests couvrent les filtres, la pagination, l’isolation entre deux comptes, OAuth/PKCE, les cookies, l’expiration, la déconnexion et les contrôles d’origine. GitHub est simulé dans les tests ; aucun secret n’est requis. La CI les exécute sur Node.js 22 et 24.

Pour tester réellement OAuth, créer l’application locale décrite plus haut. Vérifier la connexion de deux comptes, les dépôts affichés, le refus de `/api/repos` sans cookie et la déconnexion. L’inscription de l’OAuth App et l’autorisation initiale doivent être effectuées par l’hébergeur et chaque utilisateur.

Pour contribuer : proposer une issue ou une pull request, garder les changements simples et exécuter `npm test`.
