# Changelog

Alle væsentlige ændringer i dette projekt dokumenteres i denne fil.

## [v1.4.1] - 2026-05-13

### Rettet
- **Faktura download og email-sending** - Rettet kritiske problemer med faktura funktionalitet
  - Ændret mailto-håndtering fra `window.location.href` til `window.open()` for at undgå afbrydelse af PDF-download
  - Tilføjet validering af kunde email før åbning af email-klient
  - Fjernet redundant PDF-download når "Send email" knappen trykkes i faktura historik
  - Tilføjet forsinkelse mellem PDF-download og email-åbning for at forhindre konflikter
  - Email åbner nu korrekt enhedens standard email-program uden at afbryde download

## [v1.4.0] - 2026-05-13

### Tilføjet
- **Bidirektionel Google Sheets synkronisering** - Data kan nu både gemmes til og hentes fra Google Sheets
- Ny "Hent data fra Google Sheets" knap til at indlæse data fra Sheets
- Ny "Fuld synkronisering" knap til at køre komplet backup (hent + gem)
- Automatisk indlæsning af data fra Google Sheets ved app-opstart (hvis konfigureret)
- Komplet Google Apps Script eksempel fil (`google-apps-script-example.js`)
- GET endpoint support i Google Apps Script for at hente data
- Separat Google Sheets ark for hver datatype: Company, Customers, Tasks, Invoices, SyncLog

### Ændret
- Google Sheets integration opgraderet fra envejs (kun POST) til tovejs (GET + POST)
- Opdateret README med omfattende Google Sheets dokumentation
- Opdateret UI tekst fra "skriver JSON" til "læser og skriver JSON"

### Forbedret
- Bedre datapersistence med fuld backup til cloud
- Mulighed for at gendanne data fra Google Sheets
- Synkroniseringslog i Google Sheets for at spore alle ændringer

## [v1.3.0] - 2026-05-13

### Tilføjet
- Ny "Kunder" fane med komplet kundeliste i tabelformat
- Kundeadresse opdelt i separate felter: Vej, Postnummer og By
- Versionshistorik sektion på Opsætning-fanen
- Visning af de 5 seneste versioner med tidsstempel

### Ændret
- Kundeformular opdateret til at bruge tre separate adressefelter
- Faktura PDF-generering opdateret til at bruge nye adressefelter
- Ruteliste opdateret til at vise formateret adresse
- Kundeliste på Dashboard opdateret til at vise formateret adresse

### Forbedret
- Bedre strukturering af kundedata
- Mere overskuelig præsentation af kundeoplysninger

## [v1.2.0] - 2026-05-12

### Forbedret
- Forbedret fakturafunktionalitet
- Email-integration optimeret

## [v1.1.0] - 2026-05-10

### Tilføjet
- Support for Google Sheets synkronisering
- Test-funktion for Google Sheets forbindelse

## [v1.0.0] - 2026-05-08

### Tilføjet
- Initial version af Vinduespudser PWA
- Dashboard med oversigt over kunder, opgaver og statistik
- Fakturaer-fane med fakturagenerering og historik
- Opsætning-fane med firma information og sync-indstillinger
- PWA-support med offline-funktionalitet
- Service Worker til caching
