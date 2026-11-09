# Testni načrt

Za testiranje potrebuješ lokalno aplikacijo (`docker compose up -d`, v mapi `server` `npm run dev`, v mapi `client` `npm run dev`, nato odpri http://localhost:5173) ali živo stran.

Demo uporabniki (geslo `noah123`):

| Uporabnik | Vloga |
| --- | --- |
| janez@noah.si | Vodja (kasneje Admin) |
| marko@noah.si | Delavec |
| luka@noah.si | Delavec |

**Glasovni vnos (gumb Govori)** deluje samo prek HTTPS. Na lokalnem naslovu `http://localhost` ga ne moreš preizkusiti, zato ga preizkusi na živi strani.

Nalog **2026-00126** imata dodeljena Marko in Luka. Nalog **2026-00125** ima samo Marko.

---

## Stopnja 1: potek dela delavca in dnevno stanje

### 1. Zaslon naloga (prijava kot marko@noah.si)

1. Prijavi se kot **marko@noah.si**. Odpre se "Moji nalogi".
2. Odpri nalog **2026-00125**.
   - Pričakovano: najprej je viden opis dela, pod njim projekt in kraj, nato "Datum" in "Rok". Planirano in material sta manjše besedilo pod tem ("Planirano: ... Material: ...").
   - Pričakovano: ni obrazca za vnos dela, ni seznama vnosov, ni polja za količino in enoto, ni vnosa količin materiala.
3. Pritisni **Začni delovni nalog**. Status postane "V delu".
4. Pritisni **Začni delo**. Pojavi se "Delo poteka".

### 2. Odgovor NE (nalog ostane odprt)

1. Pod "Zaključen nalog" pritisni **NE**.
   - Pričakovano: pojavi se polje "Zakaj ni narejeno in kaj ostane" in gumb **Govori**. Pod poljem piše "Brez razloga se stanje NE ne shrani."
2. Vnesi besedilo, npr. "Manjka 10 vijakov, jutri dokončamo." in počakaj približno sekundo.
   - Pričakovano: pod poljem se prikaže "Shranjujem...", nato "Shranjeno". Ni gumba Shrani.
3. Osveži stran.
   - Pričakovano: NE je še vedno izbran, besedilo je ohranjeno.
4. Pojdi nazaj na seznam, zavihek **Odprti**.
   - Pričakovano: nalog je še v "Odprti". Ostane tam tudi naslednji dan.
5. Izbriši besedilo in počakaj sekundo.
   - Pričakovano: stanja brez razloga ne shrani (ne zapiše se prazen razlog).

### 3. Odgovor DA (nalog se zaključi)

1. Na nalogu 2026-00125 imaš zagnano delo (Delo poteka). Pritisni **DA**.
   - Pričakovano: pojavi se vprašanje "Delo še poteka. Končam delo in zaključim nalog?". Pritisni **Prekliči**: nič se ne spremeni, delo teče naprej.
2. Ponovno pritisni **DA** in potrdi.
   - Pričakovano: delo se konča (ure se zapišejo), nalog dobi status "Zaključen", pod DA se prikaže "Nalog je zaključen...".
3. Vpiši neobvezno opombo (polje "Opomba (neobvezno)"). Pričakovano: samodejno "Shranjujem...", "Shranjeno".
4. Na seznamu odpri zavihek **Zaključeni**.
   - Pričakovano: nalog je tam.

### 4. DA brez ur

1. Prijavi se kot **luka@noah.si**, odpri nalog **2026-00127**, pritisni **Začni delovni nalog**.
2. Ne začni dela. Pritisni **DA**.
   - Pričakovano: nalog se zaključi kljub temu, da ni ur.

### 5. Več delavcev na nalogu (2026-00126)

1. Marko: odpri nalog 2026-00126, **Začni delovni nalog**, pritisni **DA**.
   - Pričakovano: nalog ostane "V delu", piše "Čakamo še na ostale delavce na tem nalogu.".
2. Luka: odpri isti nalog, pritisni **DA**.
   - Pričakovano: nalog postane "Zaključen" (obema je zadnje stanje DA).
3. Luka: pritisni **NE**, vpiši razlog.
   - Pričakovano: nalog je spet "V delu" (ponovno odprt). Marko ga vidi spet pod "Odprti".

### 6. Fotografije

1. Odpri odprt nalog. V razdelku **Fotografije** sta gumba **Izberi fotografije** in **Slikaj**. Ni štirih ploščic (Pred, Med delom, ...).
2. Pritisni **Izberi fotografije** in izberi 5 do 8 slik hkrati.
   - Pričakovano: vsaka slika dobi sličico z napisom "Nalaga se..." in nato "Naloženo". Pod gumbi piše "X od Y naloženih".
3. Izklopi omrežje (v brskalniku Orodja za razvijalce → Network → Offline) in dodaj sliko.
   - Pričakovano: slika ima napis "Napaka" in gumb **Poskusi znova**. Vklopi omrežje in pritisni gumb: slika se naloži enkrat (brez dvojnika).
4. Zaključi nalog (DA) in dodaj še eno fotografijo.
   - Pričakovano: fotografija se naloži tudi na zaključen nalog.
5. **Slikaj** na telefonu odpre kamero.

### 7. Ostalo za delavca

- **Prijavi težavo** deluje kot prej (pošlje težavo vodji, nalog postane "Problem").
- **Sporočila vodje** se še vedno prikažejo na vrhu naloga.
- Gumba **Začni delo** / **Končaj delo** in skupne ure delujejo kot prej.

### 8. Pogled vodje (prijava kot janez@noah.si)

1. Odpri nalog, ki so ga delavci obdelali (Pregled → nalog).
   - Pričakovano: razdelek "Stanje naloga po dnevih" kaže ime, datum, "Narejeno" / "Ni narejeno" in opombo. Pod njim je "Zgodovina sprememb" z vsako spremembo DA/NE.
2. Za nalog, ki je bil zaključen brez ur, piše pri urah **brez ur**.
3. Odpri **Poročila** (poročilo ekipe) in dnevno poročilo delavca za ta dan.
   - Pričakovano: pri nalogu je "Stanje: narejeno" ali "Stanje: ni narejeno" z opombo, pri nalogu brez ur piše "brez ur".
4. Prenesi PDF poročila (dnevno in ekipno).
   - Pričakovano: v PDF je vrstica "Stanje: narejeno / ni narejeno" z opombo, pri nalogu brez ur piše "brez ur".

### 9. Čez noč / naslednji dan

- Nalog z odgovorom NE ostane v "Odprti". Ko ga delavec naslednji dan odpre, vidi pod DA / NE "Zadnji vnos, ...: ni narejeno" in razlog od prej.
