// Reisemålsinnhold – skrevet for dem som reiser hjem til familien,
// og for alle som vil utforske verden fra Norge.

export interface Gateway {
  iata: string;
  label: string;
}

export interface FeaturedDestination {
  id: string;
  country: string;
  headline: string;
  community: string;
  gateways: Gateway[];
  paragraphs: string[];
  tips: string[];
  bestTime: string;
  flightTime: string;
  typicalRoute: string;
}

export interface ContinentPlace {
  city: string;
  country: string;
  iata: string;
  note: string;
}

export interface Continent {
  id: string;
  name: string;
  blurb: string;
  places: ContinentPlace[];
}

export const FEATURED: FeaturedDestination[] = [
  {
    id: "tyrkia-kurdistan",
    country: "Tyrkia og Kurdistan",
    headline: "Bazaren, fjellene og familiens bord",
    community:
      "En av Norges største innvandrergrupper – med røtter i både Tyrkia og Kurdistan-regionen.",
    gateways: [
      { iata: "IST", label: "Istanbul" },
      { iata: "AYT", label: "Antalya" },
      { iata: "EBL", label: "Erbil" },
      { iata: "BGW", label: "Bagdad" },
    ],
    paragraphs: [
      "For titusener av nordmenn med tyrkiske og kurdiske røtter er reisen hjem mer enn en ferie – det er tepper av lammegryte, te i små glass, besteforeldre som venter på trappen og et språk som høres hjemme i gatene. Istanbul er den naturlige porten: Turkish Airlines flyr Oslo–Istanbul daglig, og derfra går det forbindelser videre til Ankara, Izmir, Diyarbakır, Gaziantep og over hundre andre byer – ofte med bare én kort mellomlanding.",
      "Mange i det kurdiske miljøet reiser videre til Kurdistan-regionen i Nord-Irak. Erbil (EBL) er hovedflyplassen, med forbindelser via Istanbul, og er utgangspunktet for reiser videre til Sulaymaniyah, Duhok og fjellandsbyene der slekten bor. Bagdad (BGW) dekker dem som har familie lenger sør. Vi vet at disse reisene ofte handler om hele familien – besteforeldre, barn og barnebarn på samme billett – og at bagasjen er full av gaver begge veier. Derfor gjør vi det enkelt å legge til ekstra kolli allerede i bestillingen.",
      "Sommeren er høysesong, men de sterkeste prisoppgangene ser vi rundt ramadan bayram (Eid al-fitr) og kurban bayram (Eid al-adha), da halve Norge–Tyrkia-korridoren reiser samtidig. Vårt råd: book bayram-reisen minst tre måneder før, og vurder å fly ut et par dager før selve høytiden – prisforskjellen kan være flere tusen kroner per person.",
    ],
    tips: [
      "Book bayram- og sommerreiser 3–4 måneder i forkant – prisene stiger bratt i juni og rundt Eid.",
      "Til Erbil og Bagdad er én mellomlanding i Istanbul som regel både raskest og rimeligst.",
      "Reiser hele familien? Legg inn ekstra bagasje i bestillingen – det er billigere enn på flyplassen.",
      "Tyrkia krever at passet er gyldig minst 150 dager etter innreise. Sjekk passet til barna også.",
    ],
    bestTime: "April–juni og september–oktober. Bayram og juli er travlest.",
    flightTime: "Ca. 4 t til Istanbul, 7–9 t til Erbil inkl. mellomlanding",
    typicalRoute: "OSL → IST (direkte) · OSL → IST → EBL",
  },
  {
    id: "syria",
    country: "Syria",
    headline: "Damaskus – verdens eldste levende by",
    community:
      "Et av de nyeste og største miljøene i Norge – med familie både i Syria og i nabolandene.",
    gateways: [
      { iata: "DAM", label: "Damaskus" },
      { iata: "BEY", label: "Beirut (inngangsport)" },
    ],
    paragraphs: [
      "Det syriske miljøet i Norge har vokst til å bli en av landets største innvandrergrupper i løpet av det siste tiåret. For mange er drømmen om å se familien igjen sterk, og reiseruten endrer seg med forholdene i regionen. Damaskus internasjonale lufthavn (DAM) er igjen åpen for internasjonal trafikk, med forbindelser blant annet via Istanbul. Mange velger også å fly til Beirut (BEY) og fortsette over landegrensen – en reise på rundt tre timer med bil.",
      "Forholdene kan endre seg raskt, og rutetilbudet med dem. Derfor anbefaler vi alltid å snakke med oss før du booker til Syria: vi følger med på hvilke selskaper som faktisk flyr, hvilke mellomlandinger som fungerer, og hva som gjelder av dokumentasjon for deg og familien. Det er nettopp på slike reiser at personlig hjelp betyr mest.",
      "For familier som reiser med barn er fleksible billetter gull verdt på denne ruten. Vi hjelper deg å finne billetter som kan endres uten at det koster skjorta, og vi holder deg oppdatert dersom flyselskapet endrer rutetidene – noe som skjer oftere her enn på europeiske ruter.",
    ],
    tips: [
      "Rutetilbudet til Syria endrer seg – kontakt oss på WhatsApp før du booker, så finner vi den tryggeste veien.",
      "Beirut er et populært alternativ når forbindelsene til Damaskus er begrenset.",
      "Velg endringsvennlig billett – ruteendringer skjer oftere på denne korridoren.",
      "Sjekk UD sine reiseråd og krav til reisedokumenter i god tid før avreise.",
    ],
    bestTime: "Vår (mars–mai) og høst (september–november)",
    flightTime: "Ca. 8–12 t inkl. mellomlanding",
    typicalRoute: "OSL → IST → DAM · OSL → BEY + landvei",
  },
  {
    id: "libanon",
    country: "Libanon",
    headline: "Middelhav, fjell og verdens beste meze",
    community:
      "Et veletablert libanesisk miljø – med bryllupssomre og familiebesøk året rundt.",
    gateways: [{ iata: "BEY", label: "Beirut" }],
    paragraphs: [
      "Libanon er lite av størrelse, men enormt i opplevelser – og for det libanesiske miljøet i Norge er Beirut byen der alle veier møtes. Rafic Hariri internasjonale lufthavn (BEY) ligger like sør for byen, og hit flyr du enkelt fra Oslo med én mellomlanding i Istanbul, Frankfurt eller Paris. Om sommeren fylles flyene av familier på vei til bryllup, dåp og lange kvelder på verandaen i fjellandsbyene.",
      "Beirut er kjent for matkulturen som aldri slutter å imponere: meze-bord som dekker hele bordet, fersk fisk ved Corniche, og kaffe servert slik den har vært servert i hundre år. Samtidig ligger fjellene en halvtime unna – på vinteren kan du stå på ski om morgenen og bade i Middelhavet om ettermiddagen. For barnefamilier er Libanon et land der barn bæres, kysses og mates overalt dere kommer.",
      "Valuta- og banksituasjonen i Libanon gjør at kontanter (USD) er kongen. Ta med dollar i sedler i god stand, og regn med at kort ikke alltid virker. Vi deler gjerne oppdaterte praktiske råd når du booker.",
    ],
    tips: [
      "Juli–august er bryllupssesong – book tidlig, flyene til Beirut fylles raskt.",
      "Ta med kontanter i amerikanske dollar; kort virker ikke overalt.",
      "Én mellomlanding i Istanbul er som regel den smidigste veien fra Oslo.",
      "Sjekk alltid gjeldende reiseråd fra UD før avreise.",
    ],
    bestTime: "Mai–juni og september–oktober. Juli–august er travlest.",
    flightTime: "Ca. 7–9 t inkl. mellomlanding",
    typicalRoute: "OSL → IST/FRA/CDG → BEY",
  },
  {
    id: "marokko",
    country: "Marokko",
    headline: "Souker, Atlasfjell og myntete på takterrassen",
    community:
      "Et stort marokkansk miljø i Norge – sommerflyene til Casablanca og Marrakech fylles tidlig.",
    gateways: [
      { iata: "CMN", label: "Casablanca" },
      { iata: "RAK", label: "Marrakech" },
    ],
    paragraphs: [
      "Marokko ligger bare fire-fem timer unna, men føles som en annen verden – det er nettopp derfor så mange nordmenn med marokkanske røtter reiser hjem hver eneste sommer. Casablanca Mohammed V (CMN) er hovedinngangsporten, med togforbindelse videre til Rabat, Fès og Meknès rett fra flyplassen. Marrakech Menara (RAK) dekker sør, med soukene, Majorelle-hagen og veien videre over Atlasfjellene til Agadir og Souss-dalen der mange familiar har røttene sine.",
      "Sommerens familiebesøk er landets store reisebegivenhet: billetter til juli og august bør sikres tidlig, spesielt for større familier. Rundt Eid al-adha og i ramadan er tempoet et helt annet – magisk å oppleve, men verdt å planlegge rundt. Utover høsten og vinteren er Marokko også en fantastisk feriedestinasjon: 20 plussgrader i Marrakech i november, surfing i Taghazout og rosa solnedganger over Koutoubia-moskeen.",
      "Reiser du med barn, husk at det marokkanske veinettet er komfortabelt: høyhastighetstoget Al Boraq tar deg fra Casablanca til Tanger på drøyt to timer. Vi hjelper deg gjerne med å legge opp reisen slik at hele slekten nås – fra Tanger i nord til Agadir i sør.",
    ],
    tips: [
      "Sommerbilletter til Casablanca og Marrakech bør bookes 3+ måneder før avreise.",
      "Fly til Casablanca hvis familien bor i Rabat/Fès-området – toget fra flyplassen er raskt og billig.",
      "Vinteren er perfekt for Marrakech: varmt, rimelig og færre turister.",
      "Ekstra kolli for gaver hjem og olivenolje tilbake – legg det inn i bestillingen.",
    ],
    bestTime: "Hele året – vår og høst er best. Sommeren er familiebesøksesong.",
    flightTime: "Ca. 4,5–7 t avhengig av mellomlanding",
    typicalRoute: "OSL → CMN via LIS/CDG/AMS · OSL → RAK via AGP/LIS",
  },
  {
    id: "eritrea",
    country: "Eritrea",
    headline: "Asmara – Afrikas lille Roma over skyene",
    community:
      "Et sterkt eritreisk miljø – reisen hjem er lang, men betydningen er stor.",
    gateways: [{ iata: "ASM", label: "Asmara" }],
    paragraphs: [
      "For det eritreiske miljøet i Norge er reisen til Asmara en av årets viktigste begivenheter. Byen ligger 2 300 meter over havet, med evig vårvær, italiensk art deco-arkitektur og macchiato servert på gamle espressomaskiner – et stykke Italia på Afrikas horn. Asmara internasjonale lufthavn (ASM) nås fra Oslo med mellomlanding i Istanbul, Kairo eller Addis Abeba, og vi kjenner kombinasjonene som gir kortest total reisetid.",
      "Mange reiser hjem i juli–august og rundt jul (Gena feires 7. januar), og billettene på disse ukene forsvinner raskt. Det er ikke uvanlig at tre generasjoner reiser sammen, og at hjemmebesøket varer tre-fire uker. Planlegger du å reise med små barn for første gang, anbefaler vi å legge inn en rolig mellomlanding heller enn den korteste – vi hjelper deg å finne riktig balanse.",
      "Praktisk å vite: pass må være gyldig minst seks måneder, visum ordnes via eritreiske myndigheter eller ambassade, og valuta (nakfa) veksles lokalt – ta med euro eller dollar. Internett er begrenset i Eritrea, så avtal gjerne med familien om møtepunkt og tid før du lander. Og pakk gaver i god tid: bagasjekvoten går fort når en hel slekt skal glede seg.",
    ],
    tips: [
      "Juli–august og desember–januar (Gena) er høysesong – book 4+ måneder før.",
      "Istanbul er ofte den mest stabile mellomlandingen fra Oslo.",
      "Ta med euro/dollar kontant; kort brukes ikke, og internett er begrenset.",
      "Sjekk visumkrav og UDs reiseråd i god tid – prosessene kan ta tid.",
    ],
    bestTime: "Oktober–mars for kjøligere vær. Sommer og jul er reisesesongene.",
    flightTime: "Ca. 10–14 t inkl. mellomlanding",
    typicalRoute: "OSL → IST/CAI/ADD → ASM",
  },
  {
    id: "afghanistan",
    country: "Afghanistan",
    headline: "Hindukush, granatepler og gjestfrihet uten sidestykke",
    community:
      "Et voksende afghansk miljø – mange reiser via nabolandene for å møte familien.",
    gateways: [
      { iata: "KBL", label: "Kabul" },
      { iata: "ISB", label: "Islamabad (inngangsport)" },
    ],
    paragraphs: [
      "Reiser til Afghanistan krever mer planlegging enn de fleste andre destinasjoner – og det er akkurat her vi gjør størst nytte. Kabul internasjonale lufthavn (KBL) betjenes av blant andre Turkish Airlines via Istanbul og flyselskaper via Dubai, og mange i det afghanske miljøet velger også å fly til Islamabad (ISB) i Pakistan og møte familien der eller reise videre over land.",
      "Forholdene på bakken kan endre seg, og flyselskapene justerer rutene sine med kort varsel. Derfor anbefaler vi alltid personlig oppfølging på denne ruten: vi sjekker hvilke forbindelser som faktisk opererer når du skal reise, legger inn generøse mellomlandinger, og sørger for at billetten din kan endres dersom noe skulle skje.",
      "For dem som reiser for første gang på lenge: Kabul ligger 1 800 meter over havet, vintrene er kalde og sommernettene kjølige. Pakk etter sesong, og husk at afghansk gjestfrihet betyr at du aldri reiser tomhendt – verken dit eller hjem. Planlegg bagasjen deretter.",
    ],
    tips: [
      "Kontakt oss før du booker – rutetilbudet til Kabul endrer seg, og vi finner den tryggeste reiseveien.",
      "Endringsvennlig billett er en selvfølge på denne ruten.",
      "Islamabad er et alternativ når forbindelsene til Kabul er begrenset.",
      "Følg UDs reiseråd nøye og sørg for gyldige dokumenter for hele familien.",
    ],
    bestTime: "Vår og høst",
    flightTime: "Ca. 10–14 t inkl. mellomlanding",
    typicalRoute: "OSL → IST/DXB → KBL · OSL → ISB",
  },
  {
    id: "pakistan",
    country: "Pakistan",
    headline: "Fra Lahores festmåltider til Karakorams giganter",
    community:
      "En av Norges aller største innvandrergrupper – desember er bryllupssesong.",
    gateways: [
      { iata: "ISB", label: "Islamabad" },
      { iata: "LHE", label: "Lahore" },
      { iata: "KHI", label: "Karachi" },
    ],
    paragraphs: [
      "Få reisemål betyr like mye for like mange nordmenn som Pakistan. Det pakistanske miljøet er en av Norges eldste og største innvandrergrupper, og korridoren Oslo–Islamabad/Lahore er en av de mest trafikkerte familie­rutene vi har. Islamabad (ISB) er den moderne hovedstaden med Margalla Hills som bakteppe, Lahore (LHE) er landets sjel – matbyen over alle, med Mughal-arkitektur og festmiddager som varer til langt på natt – mens Karachi (KHI) dekker dem med røtter i Sindh og ved kysten.",
      "De travleste reiseperiodene er sommerferien og desember, da pakistanske bryllupssesonger tiltrekker hele slekter. Et pakistansk bryllup varer i flere dager, og halve Norge kan være invitert. Vårt råd er å booke desemberreisen allerede på sensommeren – prisene på de populære ukene rundt 20. desember–5. januar kan doble seg jo nærmere du kommer.",
      "Vanlige reiseveier fra Oslo går via Istanbul, Doha eller Dubai – alle med gode forbindelser til både ISB, LHE og KHI. Mange familier lander i én by og reiser hjem fra en annen (f.eks. inn til Lahore, ut fra Islamabad). Det heter multicity-søk, og søkemotoren vår støtter det direkte – prøv det neste gang dere skal besøke slekt i flere byer.",
    ],
    tips: [
      "Desember er bryllupssesong – book før oktober for de beste prisene.",
      "Inn til Lahore og hjem fra Islamabad? Bruk multicity i søket vårt.",
      "Pakistansk visum (e-visum) ordnes enkelt på nett – søk i god tid.",
      "Sommeren i Punjab er svært varm; vinteren er behagelig og best for de fleste.",
    ],
    bestTime: "Oktober–mars. Desember er bryllupshøysesong.",
    flightTime: "Ca. 9–12 t inkl. mellomlanding",
    typicalRoute: "OSL → IST/DOH/DXB → ISB/LHE/KHI",
  },
  {
    id: "india",
    country: "India",
    headline: "Et kontinent av smaker, språk og farger",
    community:
      "Et stort og voksende indisk miljø – med familie spredt fra Punjab til Kerala.",
    gateways: [
      { iata: "DEL", label: "New Delhi" },
      { iata: "BOM", label: "Mumbai" },
    ],
    paragraphs: [
      "India er ikke ett reisemål, men hundre – og det indiske miljøet i Norge har røtter i dem alle: Punjab og Gujarat, Kerala og Tamil Nadu, Hyderabad og Bengaluru. New Delhi (DEL) er den største inngangsporten fra Norge, med videreforbindelser til hele Nord-India. Mumbai (BOM) dekker vestkysten og er knutepunktet for reiser videre sørover. Begge nås fra Oslo med én mellomlanding i Doha, Dubai, Istanbul eller Helsinki.",
      "Reisesesongene følger høytidskalenderen: Diwali (oktober/november) er landets største fest, da hele India gløder av lys og flyene er fulle av familier med gaver og søtsaker. Vinterferien (desember–januar) er perfekt tid for de fleste regioner – 20–28 grader, lite regn og behagelige netter. Sommeren er varm, men det er da mange familier har ferie og reiser hjem i flere uker.",
      "India krever visum for norske statsborgere, men e-visumordningen er rask og enkel – søk minst en uke før avreise. Og et praktisk tips til store familiegrupper: indre innenlandsflyvninger er svært rimelige, så land i Delhi eller Mumbai og fly videre til familiens by heller enn å velge den billigste enkeltbilletten med fem timers ventetid.",
    ],
    tips: [
      "Diwali og desember–januar er høysesong – book minst tre måneder før.",
      "E-visum søkes på nett; gjør det minst en uke før avreise.",
      "Land i DEL eller BOM og fly innenlands videre – ofte både raskere og billigere.",
      "Norsk pass må være gyldig minst seks måneder ved innreise.",
    ],
    bestTime: "Oktober–mars",
    flightTime: "Ca. 10–13 t inkl. mellomlanding",
    typicalRoute: "OSL → DOH/DXB/IST/HEL → DEL/BOM",
  },
  {
    id: "bangladesh",
    country: "Bangladesh",
    headline: "Elvelandet der alle kjenner alle",
    community:
      "Et etablert bangladeshisk miljø – med sterke bånd til Sylhet og Dhaka.",
    gateways: [{ iata: "DAC", label: "Dhaka" }],
    paragraphs: [
      "For det bangladeshiske miljøet i Norge fører de fleste reiser til Hazrat Shahjalal internasjonale lufthavn i Dhaka (DAC) – og mange videre nordøst til Sylhet, regionen en stor del av miljøet stammer fra. Fra Oslo flyr du med én mellomlanding i Doha, Dubai eller Istanbul, og innenlandsforbindelsen videre til Sylhet tar under en time.",
      "Vinterhalvåret (november–februar) er den gylne reisetiden: tørke, 18–28 grader og grøn telandskap så langt øyet rekker. Det er også bryllupssesong, og flyene fylles av familier med store pakker og enda større forventninger. Monsunen (juni–september) er våt og heftig, men landskapet er på sitt frodigste – og prisene på sitt laveste.",
      "Bangladesh er gjestfrihetens land: forvent å bli invitert hjem på middag av folk du så vidt har møtt, og forvent at bordet alltid har plass til én til. Praktisk: visum ordnes som e-visum eller ved ankomst for enkelte kategorier – sjekk hva som gjelder for deg før avreise, og sørg for at passet er gyldig minst seks måneder.",
    ],
    tips: [
      "November–februar er best og travlest – book tidlig, særlig rundt jul og nyttår.",
      "Mange reiser videre til Sylhet – vi hjelper deg med gjennomgående billett.",
      "Monsunsommeren gir de laveste prisene for deg som kan reise fleksibelt.",
      "Sjekk visumregler for din situasjon i god tid før avreise.",
    ],
    bestTime: "November–februar",
    flightTime: "Ca. 12–15 t inkl. mellomlanding",
    typicalRoute: "OSL → DOH/DXB/IST → DAC",
  },
  {
    id: "sri-lanka",
    country: "Sri Lanka",
    headline: "Teplantasjer, templer og tamilske tradisjoner",
    community:
      "Et av Norges eldste asiatiske miljøer – med sterke bånd til nord og øst på øya.",
    gateways: [{ iata: "CMB", label: "Colombo" }],
    paragraphs: [
      "Det tamilske miljøet fra Sri Lanka er en av Norges mest etablerte innvandrergrupper, og reisen til Colombo (CMB) er en kjær tradisjon for tusenvis av familier. Bandaranaike internasjonale lufthavn ligger nord for hovedstaden, og derfra går veiene videre til Jaffna i nord, Batticaloa og Trincomalee i øst, eller til teplantasjene i høylandet. Fra Oslo er Doha, Dubai og Istanbul de smidigste mellomlandingene.",
      "Reisekalenderen følger både vær og høytider: desember–mars er tørketiden på vest- og sørkysten og høysesong for alle. Tamilsk nyttår (Puthandu) i april og Thai Pongal i januar samler familiene. Om sommeren er det østkysten som leverer sitt beste vær – Trincomalees strender er blant Asias vakreste, og langt mindre kjent enn de fortjener.",
      "For førstegangsreisende med norske barn: Sri Lanka er et av Asias enkleste land å reise i med familie – korte avstander, toglinjen gjennom tefjellene (en av verdens vakreste togturer), safariparker med elefanter og en matkultur barna vil snakke om lenge. Norske statsborgere trenger ETA (elektronisk reisetillatelse), som ordnes på nett på få minutter.",
    ],
    tips: [
      "Desember–mars er høysesong for vest/sør; mai–september er best i øst.",
      "Thai Pongal (januar) og tamilsk nyttår (april) er familiehøytider – book tidlig.",
      "ETA søkes på nett før avreise – raskt og enkelt for nordmenn.",
      "Toget Kandy–Ella er verdt turen alene; bestill plassbillett i god tid.",
    ],
    bestTime: "Desember–mars (vest/sør) · mai–september (øst)",
    flightTime: "Ca. 12–15 t inkl. mellomlanding",
    typicalRoute: "OSL → DOH/DXB/IST → CMB",
  },
  {
    id: "polen",
    country: "Polen",
    headline: "Norges nærmeste naboland – og største fellesskap",
    community:
      "Den største innvandrergruppen i Norge – med daglige direktefly til hele landet.",
    gateways: [
      { iata: "WAW", label: "Warszawa" },
      { iata: "KRK", label: "Kraków" },
      { iata: "GDN", label: "Gdańsk" },
    ],
    paragraphs: [
      "Polakker utgjør den største innvandrergruppen i Norge, og flyrutene mellom landene er deretter: direktefly til Warszawa (WAW), Kraków (KRK) og Gdańsk (GDN) flere ganger daglig, pluss forbindelser til Wrocław, Poznań, Katowice og Szczecin. På under to timer er du fremme – nærmere enn mange norske byer. Det gjør Polen til det enkleste «hjemmebesøket» av dem alle: langhelg til mamma i Kraków er fullt mulig, og mange gjør nettopp det.",
      "Reisetoppene er like forutsigbare som de er hyggelige: julen (Wigilia er hellig i polske hjem), påsken med sine tradisjoner, og sommeren ved Mazury-sjøene eller Baltikum-kysten. Rundt disse høytidene bør du booke noen uker tidlig – ellers finnes det nesten alltid rimelige billetter, ofte billigere enn toget til Bergen.",
      "Polen byr også på noen av Europas mest undervurderte storbyer: Krakóws middelaldertorg, Warszawas gjenoppbygde gamleby, Gdańsks gullgater ved Motława-elven og Wrocławs øyby. For familier er landet enkelt: gode priser, trygge byer, barnevennlig mat – og alle snakker i praksis engelsk i tillegg til polsk.",
    ],
    tips: [
      "Jul og påske er travlest – book 4–6 uker før høytidene.",
      "Direktefly under to timer gjør Polen perfekt for langhelger.",
      "Sammenlign WAW, KRK og GDN – prisene varierer mye mellom byene.",
      "Rimelig innenlands tog og buss gjør det enkelt å nå småbyene.",
    ],
    bestTime: "Hele året – mai–september er finest",
    flightTime: "Ca. 1 t 45 min direkte",
    typicalRoute: "OSL → WAW/KRK/GDN (direkte)",
  },
];

export const CONTINENTS: Continent[] = [
  {
    id: "europa",
    name: "Europa",
    blurb:
      "Alt fra storbyhelger til solkysten – under tre timer unna, hele året.",
    places: [
      { city: "London", country: "Storbritannia", iata: "LHR", note: "Teater, pub og verdensby" },
      { city: "Paris", country: "Frankrike", iata: "CDG", note: "Kunst, caféer og croissanter" },
      { city: "Roma", country: "Italia", iata: "FCO", note: "Evig historie og pasta" },
      { city: "Barcelona", country: "Spania", iata: "BCN", note: "Gaudí, strand og tapas" },
      { city: "Málaga", country: "Spania", iata: "AGP", note: "Costa del Sol året rundt" },
      { city: "Athen", country: "Hellas", iata: "ATH", note: "Akropolis og øyhopping" },
      { city: "Berlin", country: "Tyskland", iata: "BER", note: "Kultur og klubbliv" },
      { city: "Praha", country: "Tsjekkia", iata: "PRG", note: "Eventyrbroer og bryggerier" },
      { city: "Lisboa", country: "Portugal", iata: "LIS", note: "Sju åser og pastel de nata" },
      { city: "Amsterdam", country: "Nederland", iata: "AMS", note: "Kanaler og museer" },
      { city: "Wien", country: "Østerrike", iata: "VIE", note: "Kaffehauser og klassisk musikk" },
      { city: "Reykjavík", country: "Island", iata: "KEF", note: "Nordlys og varme kilder" },
    ],
  },
  {
    id: "asia",
    name: "Asia",
    blurb:
      "Verdens største kontinent – fra Gulfens skyline til templene i Kyoto.",
    places: [
      { city: "Bangkok", country: "Thailand", iata: "BKK", note: "Street food og templer" },
      { city: "Phuket", country: "Thailand", iata: "HKT", note: "Vinterens favorittstrand" },
      { city: "Tokyo", country: "Japan", iata: "NRT", note: "Fremtid og tradisjon i én by" },
      { city: "Seoul", country: "Sør-Korea", iata: "ICN", note: "K-kultur og nattmarkeder" },
      { city: "Singapore", country: "Singapore", iata: "SIN", note: "Hageby og hawker centres" },
      { city: "Hongkong", country: "Hongkong", iata: "HKG", note: "Skyline og dim sum" },
      { city: "Dubai", country: "Emiratene", iata: "DXB", note: "Vintersol og superlativer" },
      { city: "Doha", country: "Qatar", iata: "DOH", note: "Kultur-hub og mellomlandingsmekka" },
      { city: "New Delhi", country: "India", iata: "DEL", note: "Porten til hele India" },
      { city: "Istanbul", country: "Tyrkia", iata: "IST", note: "To kontinenter, én by" },
    ],
  },
  {
    id: "afrika",
    name: "Afrika",
    blurb:
      "Fra Middelhavets kyst til savannen – et kontinent fullt av varme møter.",
    places: [
      { city: "Casablanca", country: "Marokko", iata: "CMN", note: "Porten til Maghreb" },
      { city: "Marrakech", country: "Marokko", iata: "RAK", note: "Souker og Atlasfjell" },
      { city: "Addis Abeba", country: "Etiopia", iata: "ADD", note: "Kaffens fødested" },
      { city: "Asmara", country: "Eritrea", iata: "ASM", note: "Art deco over skyene" },
      { city: "Mogadishu", country: "Somalia", iata: "MGQ", note: "Byen ved Indiahavet" },
      { city: "Cape Town", country: "Sør-Afrika", iata: "CPT", note: "Table Mountain og vinland" },
      { city: "Johannesburg", country: "Sør-Afrika", iata: "JNB", note: "Safariens inngangsport" },
    ],
  },
  {
    id: "nord-amerika",
    name: "Nord-Amerika",
    blurb:
      "Storbyer i verdensklasse, nasjonalparker og karibiske strender.",
    places: [
      { city: "New York", country: "USA", iata: "JFK", note: "Byen som aldri sover" },
      { city: "Los Angeles", country: "USA", iata: "LAX", note: "Hollywood og Highway 1" },
      { city: "Miami", country: "USA", iata: "MIA", note: "Art deco og latin rytmer" },
      { city: "Chicago", country: "USA", iata: "ORD", note: "Arkitektur ved Michigansjøen" },
      { city: "Boston", country: "USA", iata: "BOS", note: "Historie og høstfarger" },
      { city: "San Francisco", country: "USA", iata: "SFO", note: "Golden Gate og tåke" },
      { city: "Toronto", country: "Canada", iata: "YYZ", note: "Verdens mest multikulturelle by" },
      { city: "Vancouver", country: "Canada", iata: "YVR", note: "Fjell, fjord og by" },
      { city: "Cancún", country: "Mexico", iata: "CUN", note: "Karibia og Maya-templer" },
    ],
  },
  {
    id: "sor-amerika",
    name: "Sør-Amerika",
    blurb:
      "Samba, tango og eventyr – kontinentet som danser deg i møte.",
    places: [
      { city: "São Paulo", country: "Brasil", iata: "GRU", note: "Sør-Amerikas pulsslag" },
      { city: "Buenos Aires", country: "Argentina", iata: "EZE", note: "Tango, biff og bolerko" },
    ],
  },
  {
    id: "oseania",
    name: "Oseania",
    blurb:
      "Verdens lengste flyreiser – og belønningen er verdt hvert minutt.",
    places: [
      { city: "Sydney", country: "Australia", iata: "SYD", note: "Operahuset og Bondi Beach" },
    ],
  },
];
