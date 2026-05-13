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

### Oversigt

Appen understøtter fuld **bidirektionel synkronisering** med Google Sheets via Google Apps Script:
- **POST** - Gem data fra appen til Google Sheets
- **GET** - Hent data fra Google Sheets til appen
- **Fuld sync** - Hent data først, gem derefter (sikrer backup)

### Data struktur

Appen sender en POST med følgende struktur:

```json
{
  "token": "optional",
  "payload": {
    "company": {
      "name": "",
      "address": "",
      "cvr": "",
      "email": "",
      "phone": "",
      "mobilePay": "",
      "bankAccount": ""
    },
    "customers": [],
    "tasks": [],
    "invoices": [],
    "invoiceCounter": 1,
    "queue": [],
    "syncedAt": "ISO timestamp"
  }
}
```

Ved GET-anmodninger returnerer scriptet:

```json
{
  "company": {},
  "customers": [],
  "tasks": [],
  "invoices": [],
  "invoiceCounter": 1,
  "lastSynced": "ISO timestamp"
}
```

### Opsætning af Google Apps Script

1. **Opret et nyt Google Sheet** til at gemme dine data
2. **Åbn Script Editor** (Udvidelser → Apps Script)
3. **Kopier indholdet** fra `google-apps-script-example.js` til Script Editor
4. **Valgfrit**: Sæt `AUTH_TOKEN` konstanten for at aktivere authentication
5. **Deploy som Web App**:
   - Klik på "Deploy" → "New deployment"
   - Vælg type: "Web app"
   - Execute as: **Me** (din Google konto)
   - Who has access: **Anyone** (eller "Anyone with the link")
   - Klik "Deploy"
6. **Kopier Web App URL** fra deployment dialogen
7. **Indsæt URL'en** i Vinduespudser appen under Opsætning → Google Sheets opsætning
8. **Valgfrit**: Hvis du har sat AUTH_TOKEN, indsæt den også i "Access token" feltet
9. **Test forbindelsen** med "Test adgang" knappen
10. **Kør fuld synkronisering** for at gemme alle eksisterende data

### Funktioner i appen

- **Test adgang** - Tjekker om Google Sheets er konfigureret korrekt
- **Hent data fra Google Sheets** - Indlæser data fra Google Sheets til appen (overskriver lokale data)
- **Fuld synkronisering** - Henter først data fra Sheets, gemmer derefter alle data tilbage (anbefalet)
- **Automatisk sync** - Appen synkroniserer automatisk ved ændringer og når du er online

### Data arkitektur

Google Sheets vil indeholde følgende ark (sheets):
- **Company** - Firma information
- **Customers** - Kundeliste
- **Tasks** - Opgaver/ordrer
- **Invoices** - Fakturaer
- **SyncLog** - Log over synkroniseringer (sidste 100 entries)

## Begrænsninger ift. 1:1

- UI kan nærme sig 1:1, men præcis funktionalitet kræver adgang til samme backend/API’er/forretningslogik som partner.fenster.dk.
- Denne løsning er lavet til personlig brug og lille til mellemstor datamængde.
