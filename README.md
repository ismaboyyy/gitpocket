# GitPocket ↗

GitPocket rassemble dans une seule page les dépôts GitHub auxquels tu as accès, y compris ceux où tu es invité comme collaborateur, pour les retrouver facilement et voir lesquels ont reçu du code récemment.

## Installation pas à pas

### 1. Installer les outils

- [Node.js](https://nodejs.org/en/download) : version 22.9+ ou 24+.
- [Git](https://git-scm.com/downloads).
- [GitHub CLI](https://cli.github.com/).

### 2. Connecter ton compte GitHub

Ouvre un terminal et lance :

```sh
gh auth login --hostname github.com
```

Choisis la connexion avec le navigateur et suis les instructions.

### 3. Télécharger l’application

```sh
gh repo clone ismaboyyy/gitpocket
cd gitpocket
```

Le dépôt est public : chacun peut le télécharger et l’utiliser avec son propre compte GitHub.

### 4. Créer la configuration

Dans le dossier `gitpocket`, crée un fichier nommé **`.env`** avec ce contenu :

```dotenv
AUTH_MODE=local
APP_URL=http://127.0.0.1:3000
PORT=3000
```

### 5. Lancer l’application

Depuis le même dossier :

```sh
npm start
```

Aucun `npm install` n’est nécessaire.

### 6. Ouvrir GitPocket

Va sur **http://127.0.0.1:3000** dans ton navigateur. Tes dépôts s’affichent avec le compte connecté à l’étape 2.

Garde le terminal ouvert. Pour arrêter l’application : **Ctrl+C**.

## La prochaine fois

Ouvre un terminal dans le dossier `gitpocket`, puis lance `npm start` et ouvre **http://127.0.0.1:3000**.

## Mettre à jour

Arrête l’application, puis lance depuis son dossier :

```sh
git pull --ff-only
npm start
```

Usage local uniquement avec cette configuration : ne l’expose pas sur Internet, car elle utilise ton compte GitHub.

## Proposer une amélioration

Une idée, un problème ou une fonctionnalité à proposer ? [Ouvre une issue](https://github.com/ismaboyyy/gitpocket/issues/new) en expliquant ce que tu souhaites améliorer.

Pour contribuer au code :

1. Fais un fork du dépôt et crée une branche pour ta modification.
2. Effectue tes changements et lance `npm test`.
3. Ouvre une **pull request** vers la branche `main`, avec une courte explication du changement.

Ne partage jamais ton fichier `.env`, tes jetons ou tes secrets GitHub dans une issue ou une pull request.

## Licence

Projet sous [licence MIT](LICENSE) : tu peux l’utiliser, le modifier et le redistribuer en conservant la notice de licence.
