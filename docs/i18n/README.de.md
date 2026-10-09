# Usage

Bleibt dein Cloudflare-Konto in diesem Zeitraum im Rahmen des Workers-Paid-Abos, und was kostet es, wenn nicht?

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sz-ws/usage)

[English](../../README.md) · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · **Deutsch** · [Português](README.pt-BR.md)

![Die Nutzungsseite: Workers-Anfragen werden voraussichtlich am 19. Oktober die enthaltenen 10 Millionen überschreiten, mit Diagramm, Tempo und geschätzten Mehrkosten neben der Produktliste](../screenshot.png)

Ein Worker in deinem eigenen Cloudflare-Konto. Er liest die Nutzung des Kontos aus Cloudflare Analytics, vergleicht sie mit dem, was das Abo enthält, und prognostiziert, wo jedes Produkt am Ende des Zeitraums stehen wird. Du kannst ihn auf einer Seite ansehen, als JSON abrufen oder einen Agenten per MCP fragen lassen. Deine Nutzung geht von Cloudflare zu deinem Worker und sonst nirgendwohin: Es gibt keine Telemetrie, und kein Server von uns sieht sie.

## Was es dir sagt

- **Ob das Kontingent überschritten wird.** Workers-Anfragen und Workers-CPU-Zeit, D1, KV, R2, Durable Objects, Queues und Workers AI: bisher genutzt, enthaltenes Kontingent und Prognose zum Zeitraumende.
- **Was es kosten wird.** Die Überschreitung in Dollar, zu Cloudflares Listenpreisen.
- **Wer es nutzt.** Jede Zahl nach Worker, Datenbank, Namespace, Bucket, Queue oder Modell.
- **Was sich geändert hat.** Ein Worker, dessen Anfragen sich diese Woche verdreifacht haben. Speicher, der in 40 Tagen das enthaltene Kontingent überschreiten wird.
- **Wann du hinschauen solltest.** Eine Push-Benachrichtigung über ntfy oder einen webhook, wenn ein Produkt auf eine Überschreitung zusteuert.
- **Mehrere Konten**, pro Konto ein Tab.
- **Neun Sprachen.**

## Ohne Konto ausprobieren

```sh
git clone https://github.com/sz-ws/usage && cd usage
pnpm install
pnpm demo        # erfundene Daten auf http://localhost:8798
```

## Deployment

Du brauchst ein Cloudflare-Konto mit **Workers Paid**. Außer Workers Paid fallen keine weiteren Kosten an. Der Worker fragt Cloudflare viermal am Tag ab und speichert das Ergebnis in KV. Das ist nur ein kleiner Bruchteil dessen, was das Abo ohnehin enthält.

1. **Drück auf Deploy to Cloudflare.** Es legt den benötigten KV-Namespace an. Du musst kein Token erstellen und kein Passwort wählen.
2. **Öffne die Adresse deines Workers und drück auf Mit Cloudflare fortfahren**, zweimal: einmal, damit die Seite deine Konten findet, und einmal, damit sie die Nutzung dieser Konten lesen darf. Was du erlaubst, zeigt, wie viel genutzt wurde, und nichts von dem, was gespeichert ist: Es kann keine Datenbank, keinen KV-Wert und kein R2-Objekt lesen und nichts ändern.
3. **Stell den Tag ein, an dem sich dein Abo verlängert.** Das Datum findest du im Cloudflare-Dashboard unter Manage Account → Billing → Subscriptions.

Was die Anmeldung verlangt und speichert: [docs/sign-in.md](../sign-in.md) (auf Englisch). Mit einem API-Token stattdessen, aus einem Clone oder auf einer eigenen Domain: [docs/deploy.md](../deploy.md) (auf Englisch).

## Einen Agenten verbinden

Der Worker ist außerdem ein MCP-Server unter `https://<dein Worker>/mcp`. In Claude fügst du diese Adresse als benutzerdefinierten Connector hinzu. In Claude Code:

```sh
claude mcp add --transport http usage https://<dein Worker>/mcp
```

Der Worker bittet dich, dich anzumelden und ihm den Zugriff zu erlauben. Der Agent bekommt dann ein eigenes Token mit reinem Lesezugriff. Andere Clients, die Tools und die JSON-API sind in [docs/agents.md](../agents.md) (auf Englisch) beschrieben.

## Dokumentation

Die folgenden Dokumente sind auf Englisch.

- [Deployment und Konfiguration](../deploy.md)
- [Anmeldung mit Cloudflare](../sign-in.md)
- [Agenten, MCP und die JSON-API](../agents.md)
- [Benachrichtigungen über ntfy oder einen webhook](../alerts.md)
- [Funktionsweise und Herkunft der Zahlen](../how-it-works.md)
- [Entwicklung und das Hinzufügen einer Sprache](../development.md)

## Lizenz

[Apache-2.0](../../LICENSE)

Ein unabhängiges Projekt, weder mit Cloudflare, Inc. verbunden noch von Cloudflare, Inc. unterstützt. Cloudflare und das Cloudflare-Logo sind Marken von Cloudflare, Inc.
