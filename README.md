# SpielZähler

Eine mobile, offlinefähige PWA zum Mitschreiben von Spielständen. Partien, Mitspieler und Runden werden ausschließlich lokal im Browser gespeichert.

## Funktionen

- Mehrere Partien und beliebig viele Mitspieler
- Positive und negative Punkte pro Runde
- Automatisch berechneter Gesamtstand
- Runden nachträglich ändern oder löschen
- Lokale Speicherung ohne Konto
- Installierbar und nach dem ersten Laden offline nutzbar

## Lokal starten

Einfach einen lokalen Webserver im Projektordner starten, zum Beispiel:

```sh
npx serve .
```

Service Worker funktionieren aus Sicherheitsgründen nur über `https://` oder auf `localhost`, nicht beim direkten Öffnen der HTML-Datei.
