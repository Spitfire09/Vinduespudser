# Google Sheets Opsætningsguide

Denne guide viser dig hvordan du konfigurerer Google Sheets til at gemme alle data fra Vinduespudser appen.

## Hvad gemmes i Google Sheets?

Alle dine data bliver gemt sikkert i Google Sheets:
- **Firma information** (navn, adresse, CVR, email, telefon, MobilePay, kontonummer)
- **Kunder** (navn, adresse, telefon, email)
- **Opgaver/Ordrer** (titel, dato, status, noter, gentagelser)
- **Fakturaer** (fakturanummer, beskrivelse, beløb, dato)
- **Synkroniseringslog** (historik over alle synkroniseringer)

## Trin-for-trin opsætning

### 1. Opret et Google Sheet

1. Gå til [Google Sheets](https://sheets.google.com)
2. Klik på **+ Blank** for at oprette et nyt tomt regneark
3. Giv det et navn, f.eks. "Vinduespudser Data"

### 2. Åbn Apps Script Editor

1. I dit nye Google Sheet, klik på **Udvidelser** i menulinjen
2. Vælg **Apps Script**
3. En ny fane åbnes med Apps Script editoren

### 3. Indsæt scriptet

1. Slet alt eksisterende kode i editoren
2. Åbn filen `google-apps-script-example.js` fra dette projekt
3. Kopier **alt indhold** fra denne fil
4. Indsæt det i Apps Script editoren

### 4. Valgfri: Opsæt authentication token

Hvis du vil beskytte dine data med et token:

1. Find linjen `const AUTH_TOKEN = "";` øverst i scriptet
2. Udskift det med et token, f.eks.: `const AUTH_TOKEN = "min-hemmelighed-123";`
3. Husk dette token - du skal bruge det senere i appen

> **Bemærk:** Hvis du ikke sætter et token, kan alle der har link til din Web App tilgå dine data. Dette anbefales kun til test.

### 5. Gem scriptet

1. Klik på diskette-ikonet eller tryk **Ctrl+S** (Cmd+S på Mac)
2. Giv projektet et navn, f.eks. "Vinduespudser Sync Script"
3. Klik **OK**

### 6. Deploy Web App

1. Klik på **Deploy** knappen (øverste højre hjørne)
2. Vælg **New deployment**
3. Klik på tandhjulet ved "Select type" og vælg **Web app**
4. Konfigurer deployment:
   - **Description:** Skriv f.eks. "Vinduespudser Data Sync v1"
   - **Execute as:** Vælg **Me** (dit brugernavn)
   - **Who has access:** Vælg **Anyone** (eller "Anyone with the link")
5. Klik **Deploy**
6. Du bliver måske bedt om at give tilladelser:
   - Klik **Authorize access**
   - Vælg din Google konto
   - Klik **Advanced** hvis der vises en advarsel
   - Klik **Go to [Project name] (unsafe)**
   - Klik **Allow**

### 7. Kopier Web App URL

1. Efter deployment vises en dialog med din **Web app URL**
2. Den ligner: `https://script.google.com/macros/s/ABC...XYZ/exec`
3. Klik på **Copy** knappen for at kopiere URL'en
4. Gem denne URL - du skal bruge den i appen

### 8. Konfigurer Vinduespudser appen

1. Åbn Vinduespudser appen i din browser
2. Klik på fanen **Opsætning**
3. Scroll ned til **Google Sheets opsætning**
4. Indsæt din **Web App URL** i feltet "Apps Script URL"
5. Hvis du har sat et AUTH_TOKEN, indsæt det samme token i "Access token" feltet
6. Klik **Gem opsætning**

### 9. Test forbindelsen

1. Klik på **Test adgang** knappen
2. Hvis alt er konfigureret korrekt, ser du: ✓ Forbindelse OK!
3. Hvis der er fejl, kontrollér at:
   - URL'en er korrekt kopieret
   - Token'et matcher (hvis du bruger et)
   - Web App'en er deployed med "Who has access: Anyone"

### 10. Synkronisér dine data

Nu er du klar til at gemme dine data:

1. **Første gang:** Klik på **Fuld synkronisering** for at gemme alle eksisterende data
2. **Herefter:** Data gemmes automatisk ved hver ændring

Du kan også:
- **Hent data fra Google Sheets** - Indlæser data fra Sheets til appen (overskriver lokale data)
- **Fuld synkronisering** - Henter først data fra Sheets, gemmer derefter alt tilbage (anbefalet)

## Tjek dine data i Google Sheets

Gå tilbage til dit Google Sheet. Du vil nu se flere ark (tabs) nederst:

- **Company** - Din firma information
- **Customers** - Liste over alle kunder
- **Tasks** - Liste over alle opgaver
- **Invoices** - Liste over alle fakturaer
- **SyncLog** - Log over synkroniseringer

## Opdatering af scriptet

Hvis du senere skal opdatere scriptet:

1. Gå til Apps Script editoren
2. Opdater koden
3. Gem ændringerne
4. Klik **Deploy** > **Manage deployments**
5. Klik på edit-ikonet (blyant) ved din aktive deployment
6. Opdater **Version** til "New version"
7. Opdater **Description** hvis ønsket
8. Klik **Deploy**

URL'en forbliver den samme, så du behøver ikke opdatere den i appen.

## Fejlfinding

### "HTTP 404" eller "HTTP 403" fejl

- Tjek at Web App'en er deployed korrekt
- Sørg for at "Who has access" er sat til "Anyone"
- Prøv at gendeploye Web App'en

### "Unauthorized" fejl

- Hvis du bruger et token, sørg for at det matcher i både scriptet og appen
- Tjek at der ikke er ekstra mellemrum i token'et

### Data opdateres ikke

- Tjek at du er online
- Klik på "Fuld synkronisering" for at forcere en opdatering
- Tjek SyncLog arket i Google Sheets for at se om synkroniseringer logges

### Apps Script timeout

- Google Apps Script har en 6 minutters timeout for kørsel
- Hvis du har meget store datamængder (1000+ kunder/opgaver), kan det være nødvendigt at optimere scriptet

## Sikkerhed og privatliv

- Dine data gemmes i din egen Google Sheet - ingen andre har adgang medmindre du deler arket
- Web App'en kører under din Google konto (Execute as: Me)
- Overvej at bruge et AUTH_TOKEN for ekstra sikkerhed
- Gem aldrig AUTH_TOKEN i offentligt tilgængelige filer

## Backup

Google Sheets gemmer automatisk versionhistorik, så du kan gendanne tidligere versioner hvis nødvendigt:

1. Åbn dit Google Sheet
2. Klik på **File** > **Version history** > **See version history**
3. Vælg en tidligere version for at gendanne

## Support

Hvis du har problemer:
1. Tjek denne guide igen
2. Gennemgå alle trin nøje
3. Prøv at gendeploye Web App'en
4. Tjek Google Apps Script eksekveringsloggen (View > Executions) for fejlmeddelelser
