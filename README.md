# Repocket ↗

Repocket rassemble dans une seule page les dépôts GitHub auxquels tu as accès, y compris ceux où tu es invité comme collaborateur, pour les retrouver facilement et voir lesquels ont reçu du code récemment.

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
gh repo clone ismaboyyy/repocket
cd repocket
```

Le dépôt est privé pour le moment : ton compte doit avoir reçu l’accès.

### 4. Créer la configuration

Dans le dossier `repocket`, crée un fichier nommé **`.env`** avec ce contenu :

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

### 6. Ouvrir Repocket

Va sur **http://127.0.0.1:3000** dans ton navigateur. Tes dépôts s’affichent avec le compte connecté à l’étape 2.

Garde le terminal ouvert. Pour arrêter l’application : **Ctrl+C**.

## La prochaine fois

Ouvre un terminal dans le dossier `repocket`, puis lance `npm start` et ouvre **http://127.0.0.1:3000**.

## Mettre à jour

Arrête l’application, puis lance depuis son dossier :

```sh
git pull --ff-only
npm start
```

Usage local uniquement avec cette configuration : ne l’expose pas sur Internet, car elle utilise ton compte GitHub.
