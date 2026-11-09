# Lerntrainer

Englisch und Mathe in einer Datei. Läuft im Browser, auch offline. Der Fortschritt bleibt in diesem Browser.

- **App:** `index.html`
- **Lernkarten:** `lernkarten-duplex.pdf` – beidseitig drucken, an der langen Kante spiegeln, 100 % / tatsächliche Größe. Vorher `lernkarten-testseite.pdf` testen.
- **Vokabelliste:** `vokabeln.csv`, `vokabeln.json`

Alle Verweise in der App sind relativ (`index.html`, `manifest.webmanifest`). Die Seite wird unter https://dblndr.github.io/lerntrainer/ ausgeliefert. Der Speicher-Key im Browser bleibt `anton-vokabeln-v1`, damit der Spielstand auf dem Origin `dblndr.github.io` erhalten bleibt.

Tests: `npm test`
