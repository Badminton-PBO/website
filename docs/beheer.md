# Beheer van de PBO-website

De site haalt alles uit bestanden in deze GitHub-repo. Wie iets aanpast in `/admin`, maakt een commit. GitHub bouwt de site dan opnieuw, en een paar minuten later staat de wijziging online.

## Wie mag wat

| Wie | Adres | Wat |
|---|---|---|
| Gewone user (jeugdcup) | `https://www.badminton-pbo.be/admin/jeugdcup/` | Enkel standen van de jeugdcuptour toevoegen en aanpassen |
| Beheerder | `https://www.badminton-pbo.be/admin/` | Rankings, jeugdcupkalender, nieuws, vaste pagina's, site-instellingen |

Iedereen logt in met een eigen GitHub-account. Dat account heeft schrijfrechten op de repo nodig: een beheerder nodigt het uit via GitHub → `Badminton-PBO/website` → Settings → Collaborators → Add people (rol **Write**).

Let op: GitHub kent geen rechten per map. Een gewone user ziet in `/admin/jeugdcup/` enkel de rankings, maar kan technisch via GitHub of `/admin` ook andere bestanden aanpassen. Bij een klein, vertrouwd team is dat aanvaardbaar. Elke wijziging staat met naam in de geschiedenis en is terug te draaien.

## Staat mijn wijziging online?

Linksonder in het beheer staat een blokje met de laatste publicatie. Klik erop voor meer uitleg.

| Blokje | Betekenis |
|---|---|
| **Bezig met publiceren …** | Je wijziging is bewaard, de site wordt opnieuw gebouwd. Dat duurt een paar minuten; je mag verder werken. |
| **Online sinds vandaag om 14:05** | De laatste wijziging staat op de site. Zie je ze nog niet? Wacht een paar minuten en herlaad de pagina. |
| **Publiceren mislukt** (rood) | De site toont nog de vorige versie, en ook wat je daarna publiceert komt niet online tot dit opgelost is. In het blokje staat wat er misliep en welke wijziging het was. |

Bij **Publiceren mislukt**: verbeter in het beheer wat het blokje aangeeft en publiceer opnieuw. Voorbeelden:

- "De standen ... horen bij een halte die niet meer in de kalender staat": zet de halte terug in **Jeugdcup-kalender**.
- Een melding over een veld (bv. `mail.secretariaat`): open dat item en vul het veld juist in.

Kom je er niet uit, verwittig dan de webbeheerder; de link **Technische details op GitHub** toont het volledige verslag.

De meeste fouten houdt het beheer al tegen als je op **Publiceer** klikt: een verplicht veld dat leeg is, of een toernooilink zonder "Inschrijven tot". Je krijgt dan een melding en er wordt niets gepubliceerd.

## Standen toevoegen na een jeugdcup

Eén item per toernooi. Je uploadt de pdf met de rankings en de site leest er de tien standen uit: Minibad, U11, U13, U15 en U17+U19, telkens jongens en meisjes.

1. Sla de rankings in Excel op als pdf (Bestand → Opslaan als → PDF), zoals altijd.
2. Ga naar `/admin/jeugdcup/` en log in met GitHub.
3. Klik op **+ ranking** en kies het toernooi.
4. Klik bij **Pdf met de rankings** op **Kies een bestand**, dan op **Nieuwe uploaden**, kies de pdf en klik op **Gebruik selectie**.
5. Rechts staan na een paar seconden de tien reeksen, elk met het aantal spelers en wie op kop staat. Klik op een reeks voor de volledige stand. Vergelijk met Excel.
6. Klik **Publiceer → Publiceer nu**. Alle standen staan in één keer online, en bezoekers kunnen de pdf downloaden onder elke tabel.

Wat je rechts kan zien:

| Melding | Wat je doet |
|---|---|
| **10 standen gevonden** | Nakijken en publiceren. |
| **8 van de 10 standen gevonden** | Speelde er in de andere reeksen nog niemand, dan klopt dat: voor die reeksen verandert er niets op de site. Ontbreekt er een stand, plak ze dan (zie hieronder). |
| **In de pdf staat "Na ...", maar je koos ...** | Je koos het verkeerde toernooi of de verkeerde pdf. Verbeter het links. |
| **De site vindt geen standen in deze pdf** | Het is niet de pdf met de rankings, of de opmaak van de Excel is veranderd. Kies een ander bestand, of plak de standen. Publiceren lukt niet zolang er geen enkele stand is. |

De site toont per categorie, jongens en meisjes apart, altijd de stand van het laatste toernooi in dat kalenderjaar. Een fout verbeteren: open het toernooi in de lijst, kies de verbeterde pdf en publiceer opnieuw. Maak geen tweede item voor hetzelfde toernooi.

### Als de pdf niet lukt: standen plakken

Onder de pdf staat het blok **Standen plakken**, met een veld per reeks. Een geplakte stand gaat voor op de pdf, voor die reeks alleen.

- Selecteer in Excel de rijen van de stand, van de eerste tot de laatste speler (de kopregel mag mee), en plak ze in het veld van die reeks, bv. **U13 jongens**. Kopieer uit Excel zelf, niet uit de pdf: daar gaan de kolommen verloren.
- Lidnummers en punten per halte mogen mee: de site neemt positie, naam, club en het totaal in de laatste kolom.
- Een gedeelde plaats: laat de positie leeg, dan krijgt de speler de positie van de rij erboven.
- Rechts staat bij die reeks **geplakt**, en **kijk na** als de site regels oversloeg.

De site leest de pdf op de plaats van elke cel: de reeks rechtsboven op de pagina ("Jongens U13"), en per rij de positie, de naam, de club en het totaal in de laatste kolom. Verandert de opmaak van de Excel grondig, verwittig dan de webbeheerder (`src/lib/stand-pdf.ts`).

## Jeugdcupkalender (beheerders)

De kalender heeft één item per seizoen (augustus tot juli), met een lijst haltes. Zo zet je een hele kalender in één keer online.

- **Nieuw seizoen:** **Jeugdcup-kalender → + seizoen**, vul het seizoen in (bv. `2027-2028`) en klik bij **Haltes** zo vaak als nodig op **+ halte**. Publiceer één keer.
- **Haltes toevoegen of schrappen:** open het seizoen, voeg toe of verwijder met het kruisje bij de halte, en publiceer. De volgorde maakt niet uit: de site zet ze op datum.
- **Per halte:** datum, club, sporthal, adres en beginuur (voor de routelink), prijsuitreiking, en zodra het toernooi op tournamentsoftware staat de **toernooilink** en **Inschrijven tot**.
- **Twee data per toernooi:** de **datum** is de speeldag, **Inschrijven tot** de laatste dag om in te schrijven. Bij een toernooilink is "Inschrijven tot" verplicht, en die datum ligt voor de speeldag. Klopt dat niet, dan publiceert het beheer niet en zegt het bij welke halte het misloopt.
- **Toernooilink:** één link per halte, die je nooit hoeft te vervangen. De knop op de home en de kalender past zich aan: **Inschrijven tot ...** tot en met de datum bij **Inschrijven tot**, daarna **Wedstrijden** tot en met de speeldag, en na de halte **Uitslagen**.
- **Inschrijvingen open:** op de home staan onder de volgende halte alle latere haltes waarvoor je nu kan inschrijven, elk tot de laatste inschrijfdag. Bij de volgende halte zelf staat "inschrijvingen afgesloten" zodra die datum voorbij is. Een halte komt er vanzelf bij zodra ze een toernooilink en "Inschrijven tot" heeft.
- Een nieuwe halte verschijnt in de keuzelijst bij de rankings na de volgende build, binnen een paar minuten.

Een gespeelde halte met standen niet verwijderen: dan lukt publiceren niet meer (zie "Staat mijn wijziging online?"). De datum, de club of de sporthal verbeteren mag wel; verbeter de datum en de club niet in één keer, want dan vindt de site de standen van die halte niet terug. Een seizoen verwijderen kan niet in het beheer.

## Vaste pagina's (beheerders)

**Vaste pagina's** bevat per pagina de titel, de intro, de lopende tekst en de lijsten: bestuursleden met foto, medewerkers, provinciale bijdrage, documenten, trainers, vacatures, reglement en archief van de jeugdcuptour. De opmaak eromheen (kaarten, knoppen, kalender) zit in de code.

Bij **Jeugdcuptour** staat het **archief standen**: de pdf's onder "Eerdere standen" op de rankingpagina. Een eindstand ("Eindstand kalenderjaar 2025") krijgt geen datum en komt bij "Andere jaren". Een tussenstand van voor de standen op de site stonden ("Na BC Temse") krijgt de datum van de halte: de site zet hem dan op datum bij "Eerder in 2026". Standen die je via Jeugdcup-rankings uploadt, komen daar vanzelf bij.

Bij **Jeugdcuptour** staan ook de **geboortejaren per categorie**. Ze komen in de tabel "Categorieën" en bij de filters van de ranking. Vul ze in voor één kalenderjaar, bijvoorbeeld 2026: U13 van 2014 tot en met 2015. Het jaar erna schuift de site ze zelf op (U13 in 2027: 2015 en 2016). Enkel aanpassen als de leeftijdsgrenzen veranderen. Minibad heeft geen "tot en met": leeg betekent "of later". De categorieën zelf (Minibad, U11, ...) zitten in de code, want de standen verwijzen ernaar.

## Nieuws bovenaan de home (beheerders)

Open het bericht, zet **Uitgelicht** aan en publiceer. Het bericht staat dan bovenaan het nieuwsoverzicht en bovenaan de home:

- zolang de jeugdcup een volgende halte heeft, als blok net onder die halte (en boven het PK-blok);
- als alle haltes gespeeld zijn en de nieuwe kalender nog niet online staat, in de plaats van de halte, groot bovenaan.

Is de titel lang, vul dan **Korte titel voor de home** in. Er staat altijd maar één bericht bovenaan: het nieuwste dat uitgelicht is. Zet **Uitgelicht** weer uit als het niet meer actueel is.

## Oude nieuwsberichten (beheerders)

In **Nieuws** staan enkel de berichten van de laatste maanden. Oudere berichten blijven op de site op hetzelfde adres, maar staan in `src/content/nieuws/archief/` en niet meer in het beheer. Zo opent de lijst snel: het beheer haalt elk bericht apart op bij GitHub, en dat duurde met ruim 800 berichten enkele minuten.

- Een oud bericht toch aanpassen: verplaats het bestand in GitHub van `src/content/nieuws/archief/` naar `src/content/nieuws/`. Het staat dan weer in het beheer.
- Het archief aanvullen: `npm run archiveer` verplaatst alles wat ouder is dan zes maanden en commit je daarna. Uitgelichte berichten blijven staan. Eens per jaar volstaat.

## Afbeelding in een nieuwsbericht (beheerders)

Zet de cursor op een lege regel, klik op **+** boven de tekst en kies **Image**. Kies een bestand van je computer: het komt in `public/uploads/nieuws` en staat mee op de site.

Een foto recht van je telefoon mag, je hoeft ze niet eerst te verkleinen: de site maakt er zelf een lichte versie van (hoogstens 1600 pixels breed) en zet een foto die op haar kant ligt recht. Het origineel blijft bewaard.

Een afbeelding plakken of naar de tekst slepen kan niet: je krijgt dan een melding onderaan het scherm. Plak je tekst waar een afbeelding in zit, dan komt enkel de tekst mee.

## Provinciaal kampioenschap (beheerders)

Het PK heeft een eigen pagina (`/pk`) en een blok op de home. Je hoeft er geen nieuwsbericht voor te maken.

1. Open **Vaste pagina's → PK (provinciaal kampioenschap)**.
2. Vul de data, de plaats, de organisatie, de **toernooilink** (tournamentsoftware) en **Inschrijven tot** in (verplicht bij een toernooilink). Sporthal en adres zijn optioneel; met een adres krijgt `/pk` een routeknop.
3. Zet in **Tekst** de reeksen, het uurschema en de praktische info. Een affiche mag erbij.
4. Zet **Tonen op de home** aan en publiceer.

Hetzelfde blok dient ook voor het **PK Jeugd en Veteranen** in februari: verander de **Naam** (het jaar zet de site er zelf achter) en vul de gegevens van dat PK in. De twee PK's lopen niet tegelijk.

De knop past zich aan zoals bij de jeugdcupkalender: **Inschrijven tot ...**, daarna **Wedstrijden**, na het PK **Uitslagen**. Twee weken na de laatste speeldag verdwijnt het blok vanzelf van de home; uitzetten hoeft niet. Vul je de gegevens van het volgende PK in, dan staat het er weer. De pagina `/pk` blijft bestaan met de info van het laatste PK, tot je ze het jaar erna overschrijft.

## Site-instellingen (beheerders)

**Site-instellingen → Contact, sponsors en links**:

- **Mailadressen** van secretariaat, jeugdcup, recreanten en voorzitter. Ze staan in de footer en op elke pagina die naar contact verwijst (ranking, kalender, competitie, ...).
- **Sociale media** onder "Volg ons" in de footer.
- **Sponsors** bovenaan elke pagina, naast het PBO-logo (op de telefoon onder het menu): naam, website en logo. Eén sponsor krijgt een groot logo, meerdere staan naast elkaar. Zonder sponsors verdwijnt het blok.
- **Partners** op de home, boven Nieuws: de federatie en de overheid (Badminton Vlaanderen, Sport Vlaanderen), geen sponsors. Naam, website en logo, in de volgorde van de lijst. Kies een logo op een witte of doorzichtige achtergrond, zonder brede witrand. Zonder partners verdwijnt het blok.
- **Competitie**: de links naar de competitieagenda en naar uitslagen en standen bij Badminton Vlaanderen.

Links beginnen altijd met `https://`. Het hoofdmenu, de vaste footerlinks (Bestuur, Vacatures, PBO-kalender) en de Google-agenda zitten in de code.

## Eenmalig instellen: login met GitHub

Decap heeft een kleine loginhelper nodig: `public/admin/auth/index.php`. Die moet op de hosting staan.

1. Maak een OAuth App op GitHub, onder het account of de organisatie die de repo beheert: Settings → Developer settings → OAuth Apps → New OAuth App.
   - Homepage URL: `https://www.badminton-pbo.be`
   - Authorization callback URL: `https://www.badminton-pbo.be/admin/auth/` (of het testsubdomein, zie `docs/domeinswitch.md`)
2. Zet in de repo onder Settings → Secrets and variables → Actions:
   - secrets `OAUTH_CLIENT_ID` en `OAUTH_CLIENT_SECRET` (uit de OAuth App)
   - secrets `FTP_USERNAME`, `FTP_PASSWORD` en variabelen `FTP_SERVER`, `FTP_SERVER_DIR` (van de hostingprovider)
3. De workflow **Deploy naar de hosting** schrijft bij elke deploy `admin/auth/config.php` met die geheimen.

Het beheer vraagt GitHub enkel toegang tot publieke repo's (`auth_scope: public_repo` in `src/lib/cms.ts`), niet tot de privérepo's van wie inlogt. Wie al ingelogd was met de ruimere toegang, krijgt de beperkte na uitloggen en opnieuw inloggen. Wordt deze repo ooit privé, zet die instelling dan op `repo`.

De helper geeft het logintoken enkel aan `www.badminton-pbo.be`, de testversie op GitHub Pages en het adres in de variabele `SITE_URL` (een testsubdomein). Draait `/admin` op nog een ander adres, zet dat dan in `config.php` onder `origins`; anders blijft het loginvenster hangen op "Ingelogd. Dit venster sluit vanzelf."

De testversie op GitHub Pages gebruikt dezelfde loginhelper (variabele `CMS_AUTH_URL`, standaard `https://www.badminton-pbo.be`). Inloggen op de testversie lukt dus pas als de helper op de hosting staat.

Zolang de PBO-hosting geen PHP heeft, kan de helper tijdelijk op een andere server staan: zet de drie bestanden uit `public/admin/auth/` daar in `<map>/admin/auth/` (`config.example.php` als `config.php`, met Client ID en secret ingevuld), zet de callback-URL van de OAuth App op `https://<server>/<map>/admin/auth/` en de variabele `CMS_AUTH_URL` op `https://<server>/<map>`.

## Lokaal testen zonder GitHub

```sh
npx decap-server   # in een tweede terminal
npm run dev        # open http://localhost:4321/admin/ en klik Inloggen
```

Wijzigingen komen dan rechtstreeks in je werkmap terecht, zonder commit.
