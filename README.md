# Vinduespudser PWA

En personlig, installérbar PWA til at håndtere kunder, opgaver/ordrer og planlægning.

## Hvad er implementeret

- Login/profil (navn, email)
- Dashboard med nøgletal
- **Kunder-fane** – komplet kundeliste i tabelformat
- Kundeliste + oprettelse med separate felter for vej, postnummer og by
- Opgaveliste med statusflow (ny/igang/færdig)
- **Gentagende opgaver** – sæt interval (ugentlig/månedlig/kvartalsvis); næste opgave oprettes automatisk, når en markeres færdig
- **Faktura fra opgave** – knappen "Lav faktura" på færdige opgaver forudfylder faktura-formularen
- **Ruteliste** – gruppér kommende opgaver pr. dag med kundeadresser (tænd/sluk via knap)
- Noter og billed-vedhæftning på opgaver
- Søgning, filtrering og sortering
- Simpel kalenderoversigt pr. dato
- CSV-eksport af opgaver
- **Versionshistorik** – viser de seneste versioner med tidsstempel på Opsætning-fanen
- Offline support med Service Worker
- Lokal sync-kø og manuel/automatisk sync
- Google Sheets integration via Apps Script endpoint
- Installérbar PWA (manifest + install prompt)
- Browser-notifikationer (påmindelser for dagens opgaver)

## Kør lokalt

```bash
npm run serve
```

Åbn derefter: `http://localhost:4173`

## Build

```bash
npm run build
```

Build output lægges i `dist/` og cache-navnet i service worker opdateres for hver build.

## Versionshistorik

Versionshistorik vedligeholdes i `CHANGELOG.md` filen. Ved hver væsentlig ændring:

1. Opdater `CHANGELOG.md` med en ny version, dato og beskrivelse
2. Opdater `versionHistory` arrayet i `app.js` renderVersionHistory() funktionen hvis nødvendigt
3. Commit med en beskrivende commit-besked

Versionshistorikken vises automatisk på Opsætning-fanen i applikationen.

## Google Sheets (Apps Script)

Appen sender en POST med følgende struktur:

```json
{
  "token": "optional",
  "payload": {
    "profile": {},
    "customers": [],
    "tasks": [],
    "queue": [],
    "syncedAt": "ISO timestamp"
  }
}
```

Lav et Google Apps Script Web App endpoint, der modtager JSON i `doPost(e)` og skriver data til ark.

## Begrænsninger ift. 1:1

- UI kan nærme sig 1:1, men præcis funktionalitet kræver adgang til samme backend/API’er/forretningslogik som partner.fenster.dk.
- Denne løsning er lavet til personlig brug og lille til mellemstor datamængde.
