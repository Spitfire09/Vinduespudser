# Vinduespudser PWA

En personlig, installérbar PWA til at håndtere kunder, opgaver/ordrer og planlægning.

## Hvad er implementeret

- Login/profil (navn, email, rolle)
- Dashboard med nøgletal
- Kundeliste + oprettelse
- Opgaveliste med statusflow (ny/igang/færdig)
- Noter og billed-vedhæftning på opgaver
- Søgning, filtrering og sortering
- Simpel kalenderoversigt pr. dato
- CSV-eksport af opgaver
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
