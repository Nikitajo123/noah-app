# Testni načrt

## Priprava

1. `docker compose up -d` (lokalna baza).
2. V mapi `server`: `npx prisma migrate dev` (doda nove tabele v **lokalno** bazo), nato `npx prisma db seed`, nato `npm run dev`.
3. V mapi `client`: `npm run dev`, odpri http://localhost:5173.
4. Samodejno preverjanje pravic (strežnik mora teči na portu 3000): v mapi `server` zaženi `npm run check:permissions`. Na koncu mora pisati "N od N preverjanj uspešnih". Skripta sama ustvari in izbriše testni nalog in testno gradbišče. Nikoli je ne zaganjaj proti živi strani.

Demo uporabniki (geslo `noah123`):

| Uporabnik | Vloga | Vidi gradbišča |
| --- | --- | --- |
| janez@noah.si | Admin | vsa |
| vodja.gradbisc@noah.si | Vodja gradbišč | vsa |
| vodja.del@noah.si | Vodja dela | samo dodeljena (Hiša Novak) |
| marko@noah.si | Delavec | samo svoje naloge |
| luka@noah.si | Delavec | samo svoje naloge |

Nalogi iz seed podatkov: **2026-00125** (Hiša Novak, Marko), **2026-00126** (Hiša Müller, Marko in Luka), **2026-00127** (Hiša Kovač, Luka).

**Glasovni vnos (gumb Govori)** deluje samo prek HTTPS. Na `http://localhost` ga ne moreš preizkusiti, zato ga preizkusi na živi strani.

**Če se z `noah123` lokalno ne moreš prijaviti**: seed ne spreminja gesel uporabnikov, ki že obstajajo. Lokalno bazo lahko na novo napolniš z `npx prisma migrate reset` (izbriše vse **lokalne** podatke, nato znova zažene seed).

---

## Stopnja 1: potek dela delavca in dnevno stanje

### 1.1 Zaslon naloga (marko@noah.si)

1. Prijavi se kot **marko@noah.si** in odpri nalog **2026-00125**.
   - Pričakovano: najprej je viden opis dela, pod njim gradbišče in kraj, nato "Datum" in "Rok". Planirano in material sta manjše besedilo ("Planirano: ... Material: ...").
   - Pričakovano: ni obrazca za vnos dela, ni seznama vnosov, ni polja za količino in enoto, ni vnosa porabe materiala.
2. Pritisni **Začni delovni nalog**. Status postane "V delu".
3. Pritisni **Začni delo**. Pojavi se "Delo poteka".

### 1.2 Odgovor NE

1. Pod "Zaključen nalog" pritisni **NE**.
   - Pričakovano: pojavi se polje "Zakaj ni narejeno in kaj ostane", gumb **Govori** in opozorilo "Brez razloga se stanje NE ne shrani."
2. Vpiši "Manjka 10 vijakov, jutri dokončamo." in počakaj sekundo.
   - Pričakovano: "Shranjujem...", nato "Shranjeno". Gumba Shrani ni.
3. Osveži stran. Pričakovano: NE in besedilo sta ohranjena, besedilo lahko še urejaš.
4. Na seznamu nalogov je nalog še pod **Odprti**.

### 1.3 Odgovor DA (fotografija končanega dela je obvezna)

1. Delo še poteka. Pritisni **DA**. Pojavi se "Delo še poteka. Končam delo in zaključim nalog?".
2. Pritisni **Prekliči**. Pričakovano: nič se ne spremeni.
3. Znova pritisni **DA** in potrdi. Pričakovano: delo se konča, prikaže se okvir "**Dodaj fotografijo končanega dela.** Nalog se zaključi, ko se prva fotografija naloži." z gumboma **Izberi fotografije** in **Slikaj**. Nalog je še "V delu".
4. Opombo lahko vpišeš že zdaj, neobvezno.
5. Dodaj fotografijo. Pričakovano: ko se naloži, nalog dobi status "Zaključen", piše "Nalog je zaključen. Opombo in fotografije lahko še dopolnjuješ." Fotografija je v razdelku Fotografije z oznako "Končano".
6. Nalog je na seznamu pod **Zaključeni**.
7. Če na nalogu že imaš fotografijo "Končano" (npr. nalog je bil ponovno odprt), se DA shrani takoj brez nove fotografije.

### 1.4 DA brez ur

1. Prijavi se kot **luka@noah.si**, odpri **2026-00127**, pritisni **Začni delovni nalog**, ne začni dela, pritisni **DA** in dodaj fotografijo.
   - Pričakovano: nalog se zaključi. Admin pri tem nalogu vidi "brez ur".

### 1.5 Več delavcev (2026-00126)

1. Marko: **Začni delovni nalog**, nato **DA** in fotografija. Pričakovano: nalog ostane "V delu", piše "Čakamo še na ostale delavce na tem nalogu."
2. Luka: **DA** in fotografija. Pričakovano: nalog postane "Zaključen".
3. Luka: **NE** z razlogom. Pričakovano: nalog je spet "V delu" in je pri obeh spet pod **Odprti**.

### 1.6 Fotografije

1. Na odprtem nalogu sta gumba **Izberi fotografije** in **Slikaj**. Štirih ploščic (Pred, Med delom, ...) ni več.
2. **Izberi fotografije**: izberi 5 do 8 slik. Pričakovano: vsaka sličica ima "Nalaga se...", nato "Naloženo". Nad sličicami piše "X od Y naloženih".
3. V brskalniku vklopi način brez povezave (Orodja za razvijalce, Network, Offline) in dodaj sliko. Pričakovano: "Napaka" in gumb **Poskusi znova**. Vklopi povezavo, pritisni gumb: slika se naloži enkrat, brez dvojnika.
4. Na zaključenem nalogu dodaj fotografijo. Pričakovano: se naloži.
5. Na telefonu **Slikaj** odpre kamero.

### 1.7 Ostalo pri delavcu

- **Prijavi težavo**, **Sporočila vodje**, **Začni delo** / **Končaj delo** in "Evidenca ur" delujejo kot prej.
- **Moje ure** (dnevno poročilo) in poročilo ekipe še delujeta, PDF se prenese.

### 1.8 Kaj vidi vodja (janez@noah.si)

1. Odpri nalog 2026-00126. Pričakovano: razdelek "Stanje naloga po dnevih" (ime, datum, "Narejeno" / "Ni narejeno", opomba) in "Zgodovina sprememb" z vsako spremembo DA/NE.
2. Nalog brez ur ima pri urah "brez ur".
3. Dnevno poročilo delavca in poročilo ekipe (Poročila) imata "Stanje: narejeno / ni narejeno" z opombo. PDF-ja imata isto vrstico in "brez ur".

### 1.9 Naslednji dan

- Nalog z NE ostane pod **Odprti**. Ko ga delavec naslednji dan odpre, pod DA / NE vidi "Zadnji vnos, ...: ni narejeno" in razlog.

---

## Stopnja 2: vloge in pravice

### 2.1 Admin (janez@noah.si)

1. Levo pod logotipom (na računalniku) piše **Admin**. Na Profilu piše vloga "Admin".
2. Meni: Pregled, Dnevni pregled, Poročila, **Gradbišča** (prej Projekti), Upravljanje, Profil.
3. **Upravljanje** ima zavihke: Nov nalog, Nalogi, Gradbišče, Uporabnik, Ekipe.
4. **Gradbišča** pokaže vsa tri gradbišča, tudi **Hiša Kovač**.
5. Upravljanje, **Gradbišče**: ustvari "Hiša Test", Maribor. Pričakovano: "Ustvarjeno gradbišče Hiša Test" in je na seznamu spodaj.
6. Pri Hiši Test pritisni **Uredi**, spremeni ime, **Shrani**. Pričakovano: novo ime.
7. Pri Hiši Novak pritisni **Vodje dela**: vidiš "Tomaž Kranjc" označen. Gumba "Vodje gradbišč" ni, ker vodja gradbišč vidi vsa gradbišča.
8. Pri Hiši Novak je **Izbriši** onemogočen (ima naloge). Pri Hiši Test **Izbriši** deluje.
9. Upravljanje, **Uporabnik**: vloga ima izbire Delavec, Vodja dela, Vodja gradbišč, Admin. Na seznamu uporabnikov lahko spremeniš vlogo (potrditev), pri sebi ne.
10. Upravljanje, **Nalogi**: pri vsakem nalogu sta **Uredi** in **Izbriši**.

### 2.2 Vodja gradbišč (vodja.gradbisc@noah.si)

1. Vloga pod logotipom in na profilu: "Vodja gradbišč".
2. **Gradbišča**: vsa tri, tudi Hiša Kovač.
3. **Pregled**, **Poročila** in **Dnevni pregled** kažejo vsa gradbišča.
4. **Upravljanje** ima samo: Nov nalog, Nalogi, Gradbišče. Zavihkov Uporabnik in Ekipe ni.
5. **Nov nalog**: izbira "Gradbišče" ponuja vsa gradbišča.
6. **Gradbišče**: ustvari "Hiša Zupan". Pričakovano: je na seznamu. Pri katerem koli gradbišču lahko pritisneš **Uredi**.
7. Pri Hiši Kovač pritisni **Vodje dela**, označi "Tomaž Kranjc", **Shrani**. Pričakovano: vodja dela zdaj vidi Hišo Kovač. Nato ga spet odznači.
8. Gumba **Izbriši** pri gradbiščih ni.
9. **Nalogi**: pri vsakem nalogu je **Uredi**, gumba **Izbriši** ni.

### 2.3 Vodja dela (vodja.del@noah.si)

1. Vloga: "Vodja dela". **Gradbišča**: samo Hiša Novak (dodeljena).
2. **Upravljanje** ima samo: Nov nalog, Nalogi.
3. **Nov nalog**: ustvari nalog v Hiši Novak in izberi poljubnega delavca (tudi Luko). Pričakovano: "Ustvarjen nalog ...".
4. **Nalogi**: pri vsakem nalogu je **Uredi** (odpre obrazec Uredi nalog), gumba **Izbriši** ni. Številka naloga odpre nalog.
5. Na nalogu lahko dodaš opombo, spremeniš delavce in popraviš ure.

### 2.4 Delavec

1. **marko@noah.si** vidi samo svoje naloge, kot prej. Do strani vodje nima dostopa.

### 2.5 Pravice na strežniku

- Zaženi `npm run check:permissions` (v mapi `server`). Preveri med drugim:
  - Vodja dela ne more ustvariti gradbišča (403) in ne vidi Hiše Kovač (404), dokler mu je nihče ne dodeli.
  - Vodja gradbišč vidi vsa gradbišča in lahko dodeli vodjo dela kjer koli, ne more pa izbrisati gradbišča ali naloga.
  - Delavec ne more zaključiti naloga (DA) brez fotografije končanega dela.
  - Delavec ne more klicati nobene poti vodje (403).
  - Samo Admin lahko izbriše nalog in ustvari uporabnika.
  - Vodja dela ustvari in uredi nalog v Hiši Novak.

---

## Stopnja 3: Uredi nalog

Prijava kot **vodja.del@noah.si** (ali Admin ali Vodja gradbišč).

Obrazec **Uredi nalog** se odpre na dva načina: na strani naloga in v **Upravljanje, Nalogi** z gumbom **Uredi** pri nalogu. Preizkusi oba.

1. Odpri nalog v Hiši Novak. Na vrhu sta gumba **Uredi nalog** in **Zaključi nalog**.
2. Pritisni **Uredi nalog**. Odpre se obrazec: Naloga, Gradbišče, Planirana količina, Enota, Predviden čas (ure), Datum, Rok, Material, Delavci.
3. Spremeni opis in rok, preimenuj en material, dodaj nov material (**Dodaj material**), **Shrani spremembe**.
   - Pričakovano: obrazec se zapre, podatki so posodobljeni. Pojavi se razdelek **Spremembe** z imenom, datumom, uro in vsako spremembo ("Naloga: ... → ...", "Material dodan: ...").
4. Kot Vodja dela je v izbiri "Gradbišče" samo Hiša Novak. Kot Vodja gradbišč ali Admin so vsa gradbišča.
5. **Odstranjevanje z uporabo**:
   - Če ima delavec na nalogu ure, ga odznači in shrani. Pričakovano: napaka "... ima na tem nalogu evidentirane ure, zato ga ni mogoče odstraniti."
   - Če ima material vneseno porabo (iz starih podatkov), ga odstrani in shrani. Pričakovano: napaka "Material "..." ima vneseno porabo, zato ga ni mogoče odstraniti."
6. **Spremeni delavce** deluje tudi na zaključenem nalogu in se zapiše v Spremembe.
7. **Zaključi nalog** (potrditev, fotografija ni potrebna, ker je to ukrep vodje): nalog postane "Zaključen", v Spremembah piše "Status: V delu → Zaključen". Če kdo še dela, se prikaže napaka "... še dela na tem nalogu."
8. Na zaključenem nalogu je gumb **Ponovno odpri**: nalog je spet "V delu", zapis v Spremembah.
9. **Uredi nalog** deluje tudi na zaključenem nalogu.
10. Delavec (marko@noah.si) na svojem nalogu ne vidi razdelka Spremembe in nima gumba Uredi nalog.

---

## Stopnja 4: Dnevni pregled

Prijava kot **janez@noah.si**, nato še kot **vodja.gradbisc@noah.si** in **vodja.del@noah.si**.

1. V meniju izberi **Dnevni pregled**.
2. Pričakovano: datum je danes. Razdelek "Nalogi na ta dan" je razdeljen po gradbiščih, vsako ima vrstico z imenom in "N nalogov, narejeno X od Y".
3. Pritisni na vrstico gradbišča: skupina se zapre, ob ponovnem pritisku odpre.
4. Pri vsakem nalogu je povezava **Nalog 2026-...** (odpre nalog), status, opis in vsak dodeljen delavec s stanjem **Narejeno**, **Ni narejeno** ali **Brez vnosa**, opombo, številom fotografij in urami (ali "brez ur", ali "dela").
5. Izberi drug datum: podatki se zamenjajo.
6. Izbira **Vsa gradbišča**: izberi eno gradbišče, prikaže se samo to. Iskalnik "Išči gradbišče" filtrira po imenu ali kraju.
7. Razdelek **Odprti nalogi**: nalogi iz prejšnjih dni, ki niso zaključeni, z "Odprt N dni (od ...)", delavci in zadnjo opombo ("Ime, datum: besedilo").
8. Vodja dela vidi samo Hišo Novak. Vodja gradbišč in Admin vidita vsa gradbišča.
9. Na telefonu je v spodnjem meniju 6 gumbov in vsi napisi so berljivi.
