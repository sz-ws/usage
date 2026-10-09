# Usage

Votre compte Cloudflare restera-t-il dans les limites de votre abonnement Workers Paid pendant cette période de facturation, et combien coûtera-t-il sinon ?

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sz-ws/usage)

[English](../../README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · **Français** · [Deutsch](README.de.md) · [Português](README.pt-BR.md)

![Page de consommation : les requêtes Workers devraient dépasser les 10 millions inclus le 19 octobre, avec le graphique, le rythme et le dépassement estimé à côté de la liste des produits](../screenshot.png)

Un Worker dans votre propre compte Cloudflare. Il lit la consommation du compte dans Cloudflare Analytics, la compare à ce qu'inclut l'abonnement et projette où se situera chaque produit à la fin de la période. Consultez-la sur une page, récupérez-la en JSON, ou laissez un agent l'interroger par MCP. Rien ne quitte votre compte : il n'y a ni télémétrie ni service tiers.

## Ce qu'il vous indique

- **Si vous allez dépasser le quota inclus.** Requêtes Workers et temps CPU, D1, KV, R2, Durable Objects, Queues et Workers AI : la consommation jusqu'ici, le quota inclus et la prévision pour la fin de la période de facturation.
- **Ce que cela coûtera.** Le dépassement en dollars, aux tarifs publics de Cloudflare.
- **Qui l'utilise.** Chaque chiffre par Worker, base de données, espace de noms, compartiment, file d'attente ou modèle.
- **Ce qui a changé.** Un Worker dont les requêtes ont triplé cette semaine. Un stockage qui dépassera son quota inclus dans 40 jours.
- **Quand regarder.** Une notification par ntfy ou webhook lorsqu'un produit est en passe de dépasser son quota inclus.
- **Plusieurs comptes**, un onglet pour chacun.
- **Neuf langues.**

## Essayer sans compte

```sh
git clone https://github.com/sz-ws/usage && cd usage
pnpm install
pnpm demo        # données fictives sur http://localhost:8798
```

## Déploiement

Il vous faut un compte Cloudflare avec l'abonnement **Workers Paid**. Son fonctionnement ne coûte rien de plus que cela : il interroge Cloudflare quatre fois par jour et conserve le résultat dans KV, une petite fraction de ce que l'abonnement inclut déjà.

1. **Cliquez sur Deploy to Cloudflare.** Il crée l'espace de noms KV dont il a besoin et demande deux secrets.
   - `ANALYTICS_TOKEN` : un jeton API avec une seule permission, **Account Analytics: Read**. [Ce lien](https://dash.cloudflare.com/?to=/:account/api-tokens&permissionGroupKeys=%5B%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%5D&name=usage) remplit le formulaire. Le jeton montre combien a été consommé et rien de ce qui est stocké : il ne peut pas lire une base de données, une valeur KV ni un objet R2, et il ne peut rien modifier.
   - `ACCESS_KEY` : le mot de passe de votre page, de 24 caractères ou plus. `openssl rand -base64 32` en génère un.
2. **Ouvrez l'adresse du Worker** et connectez-vous avec la clé d'accès.
3. **Réglez le jour de renouvellement de votre facture.** Vous le trouverez dans Manage Account → Billing → Subscriptions, sur le tableau de bord Cloudflare.

Depuis un clone, avec plusieurs comptes ou sur votre propre domaine : [docs/deploy.md](../deploy.md) (en anglais).

## Connecter un agent

Le Worker est aussi un serveur MCP à l'adresse `https://<your-worker>/mcp`. Dans Claude, ajoutez cette adresse comme connecteur personnalisé. Dans Claude Code :

```sh
claude mcp add --transport http usage https://<your-worker>/mcp
```

Votre Worker vous demande de vous connecter et de l'autoriser, et l'agent reçoit un jeton en lecture seule qui lui est propre. Autres clients, les outils et l'API JSON : [docs/agents.md](../agents.md) (en anglais).

## Documentation

Les documents suivants sont en anglais.

- [Déploiement et configuration](../deploy.md)
- [Agents, MCP et API JSON](../agents.md)
- [Alertes par ntfy ou webhook](../alerts.md)
- [Fonctionnement, et d'où viennent les chiffres](../how-it-works.md)
- [Développement, et ajout d'une langue](../development.md)

## Licence

[Apache-2.0](../../LICENSE)
