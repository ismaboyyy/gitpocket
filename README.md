# Repocket ↗

Un tableau de bord simple pour retrouver ses dépôts GitHub et ses collaborations.

Chaque utilisateur se connecte avec **son compte GitHub** et voit **ses propres dépôts**. Fonctionne sur un ordinateur ou un Raspberry Pi, avec Node.js et sans dépendance npm.

## Quel mode choisir ?

| Besoin | Mode | À configurer |
| --- | --- | --- |
| Utiliser une instance déjà hébergée | Connexion GitHub dans le navigateur | Rien à installer ; cliquer sur « Se connecter avec GitHub » |
| Installer sa propre instance, en local ou pour plusieurs utilisateurs | `github` | Une OAuth App GitHub pour cette instance |
| Consulter uniquement ses dépôts sur son ordinateur | `local` | GitHub CLI connecté à son compte |

Pour une première installation avec connexion dans le navigateur, suivre les étapes ci-dessous. Pour un usage personnel sans OAuth App, suivre plutôt le [mode local](#mode-personnel-local-avec-github-cli).

## Fonctionnalités

- Tous les dépôts accessibles, collaborations directes et invitations en attente.
- Recherche par nom, propriétaire, description ou langage.
- Filtres par propriétaire et visibilité publique/privée.
- Tri par dernier push, nouveaux ajouts détectés, mise à jour ou nom.
- Deux colonnes sur ordinateur, une sur mobile.
- Par défaut : vue **Tous**, tri **Dernier push**, filtres ouverts.
- L’application utilise uniquement des requêtes de lecture vers l’API des dépôts.

## Installation avec connexion GitHub

### 1. Vérifier les prérequis

Installer [Node.js](https://nodejs.org/en/download) **22.9+** ou 24+, [Git](https://git-scm.com/downloads) et disposer d’un compte GitHub. Pas de `npm install` nécessaire : le projet utilise uniquement les modules intégrés à Node.js.

Vérifier les outils dans un terminal :

```sh
node --version
npm --version
git --version
```

### 2. Télécharger le projet

```sh
git clone https://github.com/ismaboyyy/repocket.git
cd repocket
```

Si le dépôt est privé, ton compte GitHub doit avoir reçu l’accès. En cas d’erreur d’authentification, utiliser les identifiants Git de ton compte ou GitHub CLI (`gh auth login`, puis `gh repo clone ismaboyyy/repocket`). Une fois le dépôt public, aucun accès particulier ne sera nécessaire pour le télécharger.

Créer ensuite la configuration personnelle :

```sh
cp .env.example .env
```

Sous Windows avec PowerShell, remplacer `cp` par `Copy-Item`. Les commandes `npm` restent identiques.

### 3. Créer l’application GitHub

L’OAuth App permet à GitHub de renvoyer les utilisateurs vers Repocket après leur connexion. Ce n’est pas un nouveau compte GitHub.

Ouvrir [la page de création d’une OAuth App](https://github.com/settings/applications/new) et remplir :

| Champ GitHub | Valeur pour tester sur son ordinateur |
| --- | --- |
| Application name | `Repocket Local` ou un nom personnel |
| Homepage URL | `http://127.0.0.1:3000` |
| Authorization callback URL | `http://127.0.0.1:3000/auth/callback` |

Laisser le **Device Flow désactivé** : Repocket utilise la connexion dans le navigateur. Les jetons expirants sont pris en charge ; il faudra simplement se reconnecter à leur expiration.

Cliquer sur **Register application**, puis relever le **Client ID**. Sur la page de l’application, générer un **client secret** avec **Generate a new client secret**. Garder ce secret privé et ne pas le partager dans une issue, un commit ou une capture d’écran. [Guide officiel GitHub](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)

### 4. Remplir le fichier `.env`

Ouvrir `.env` dans un éditeur de texte et remplacer les valeurs d’exemple par celles de l’OAuth App :

```dotenv
AUTH_MODE=github
APP_URL=http://127.0.0.1:3000
PORT=3000
GITHUB_CLIENT_ID=votre_client_id
GITHUB_CLIENT_SECRET=votre_client_secret
```

Ne pas laisser littéralement `votre_client_id` et `votre_client_secret`. Il faut les valeurs fournies par GitHub. Le fichier `.env` est ignoré par Git ; `.env.example` est uniquement un modèle.

| Variable | Rôle |
| --- | --- |
| `AUTH_MODE` | `github` pour une connexion par utilisateur, `local` pour GitHub CLI |
| `APP_URL` | Adresse exacte utilisée dans le navigateur, sans chemin |
| `PORT` | Port local du serveur Node.js, `3000` par défaut |
| `GITHUB_CLIENT_ID` | Identifiant public de l’OAuth App, requis en mode `github` |
| `GITHUB_CLIENT_SECRET` | Secret de l’OAuth App, requis en mode `github` |

### 5. Lancer Repocket

Depuis le dossier contenant `package.json` :

```sh
npm start
```

Le terminal doit afficher `Repocket : http://127.0.0.1:3000 (github)`.

Ouvrir **http://127.0.0.1:3000**, cliquer sur **Se connecter avec GitHub** et autoriser l’application. Tes dépôts apparaissent ensuite. Utiliser la même adresse que `APP_URL` : `localhost` et `127.0.0.1` ne sont pas interchangeables pour les cookies et les contrôles d’origine.

Garder le terminal ouvert pendant l’utilisation. Pour arrêter le serveur, appuyer sur **Ctrl+C** ; pour le relancer, exécuter `npm start`. Après une modification de `.env`, arrêter puis relancer le serveur.

Les visiteurs d’une instance hébergée n’ont rien à installer et n’ont pas besoin de créer leur propre OAuth App. Les personnes qui hébergent leur propre copie créent leur propre OAuth App et leurs propres secrets.

### Autorisations GitHub

Le scope OAuth **`repo`** est demandé pour découvrir les dépôts privés et les invitations. **Ce scope permet aussi des écritures** : GitHub OAuth ne propose pas de scope global équivalent limité à la lecture des dépôts privés. Repocket n’utilise pas ces capacités d’écriture. Lire les [scopes GitHub officiels](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps).

Connectez-vous uniquement sur une instance de confiance : son opérateur traite les jetons des utilisateurs. Une organisation peut exiger une approbation OAuth ou une autorisation SSO ; dans ce cas certains dépôts peuvent manquer.

## Mode personnel local avec GitHub CLI

Télécharger d’abord le projet et copier `.env.example` vers `.env` comme aux étapes 1 et 2. Pour utiliser uniquement son propre compte sur sa machine, sans créer d’OAuth App : installer [GitHub CLI](https://cli.github.com/), puis :

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

Cette partie concerne l’hébergeur. Les visiteurs utiliseront simplement leur navigateur et leur compte GitHub. Remplacer `github.example.com` par son vrai sous-domaine partout dans les étapes suivantes.

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

Pour la configuration Caddy standard, le DNS doit pointer vers l’IP publique de la maison et les ports 80 et 443 doivent atteindre Caddy sur le Pi. Si l’IP change, utiliser un DNS dynamique. Si la connexion est derrière une IP partagée et refuse les connexions entrantes, prévoir un tunnel ou un autre point d’entrée. [Guide HTTPS Caddy](https://caddyserver.com/docs/quick-starts/https)

Avant de partager l’adresse : ouvrir le site en navigation privée, vérifier que les dépôts exigent une connexion, tester son compte, puis la déconnexion. En mode `github`, une requête non authentifiée vers `/api/repos` doit répondre **401**. Vérifier aussi le fonctionnement après redémarrage du Pi.

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

## Mettre à jour son installation

Depuis le dossier du projet, après avoir arrêté le serveur :

```sh
git pull --ff-only
npm test
npm start
```

Si le site est géré par un service sur le Pi, redémarrer ce service au lieu de lancer une deuxième instance avec `npm start`. Le fichier `.env` n’est pas remplacé par Git. Un redémarrage déconnecte les utilisateurs ; ils pourront se reconnecter avec GitHub.

## Dépannage

| Problème | Vérification |
| --- | --- |
| `node` ou `npm` introuvable | Installer Node.js puis rouvrir le terminal |
| Option `--env-file-if-exists` inconnue | Mettre à jour Node.js vers 22.9+ ou 24+ |
| `package.json` introuvable | Se placer dans le dossier `repocket` avant `npm start` |
| Message demandant `GITHUB_CLIENT_ID` et `GITHUB_CLIENT_SECRET` | Créer `.env` et compléter les deux valeurs, ou choisir le mode `local` |
| GitHub indique un problème de callback | Vérifier l’URL de callback dans l’OAuth App : elle doit correspondre à `APP_URL` suivi de `/auth/callback` |
| Erreur 403 ou page inaccessible via un domaine | Vérifier `APP_URL`, HTTPS et le `Host` transmis par le reverse proxy ; ne pas utiliser le mode `local` pour héberger le site |
| Connexion expirée ou invalide | Revenir à l’accueil et recommencer ; utiliser le même navigateur et accepter les cookies du site |
| Un dépôt privé manque | Vérifier l’autorisation OAuth, l’approbation de l’organisation et le SSO ; cliquer sur Actualiser |
| Aucun dépôt affiché | Vérifier la recherche, la vue choisie et les filtres propriétaire/visibilité |
| Port 3000 déjà utilisé (`EADDRINUSE`) | Arrêter l’autre instance ou choisir un autre `PORT` ; en local, modifier aussi `APP_URL` et le callback GitHub pour utiliser ce port |
| GitHub inaccessible en mode local | Exécuter `gh auth status`, puis `gh auth login --hostname github.com` si nécessaire |
| Le site s’arrête quand le terminal est fermé | C’est normal en lancement manuel ; sur un serveur, configurer un service de démarrage |
