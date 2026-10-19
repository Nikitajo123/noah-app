# NOAH aplikacija za delovne naloge

Mobilna PWA aplikacija za gradbene delavce za upravljanje delovnih nalogov, beleženje ur, fotografiranje in oddajo dnevnih poročil, z pregledom za vodje in skrbniškim zaslonom. Izdelana kot testni projekt za NOAH.


## Funkcionalnosti

**Delavci (DELAVEC)**
- Seznam dodeljenih delovnih nalogov in podrobnosti naloga
- Začetek/konec beleženja ur (en tekoč vnos ur na delavca)
- Dnevnik dela, material in fotografije za vsak nalog
- Osebno dnevno poročilo ("Moje ure"), eno na delavca na dan, sestavljeno iz vnosov ur, dnevnika dela, materiala in fotografij
- Glasovni vnos (Groq Whisper)
- Vodja ekipe napiše povzetek in odda eno poročilo ekipe na dan

**Vodje (VODJA)**
- Pregled nalogov v živo (osvežuje se na 15 s, dokler je zavihek viden)
- Dodajanje opomb k nalogom, označitev PROBLEMA kot rešenega (nazaj na V_DELU)
- Popravljanje vnosov ur; vsak popravek se shrani s starimi/novimi časi, razlogom in urejevalcem
- Zavihek "Poročila": poročila ekip po dnevih in ure po projektih
- Izvoz poročil v PDF

**Skrbnik**
- Upravljanje uporabnikov, ekip in projektov

**Pravila domene**
- Statusi nalogov: `NOV`, `V_DELU`, `ZAKLJUCEN`, `PROBLEM`
- En delavec na nalog
- Naloga ni mogoče zaključiti, dokler delo teče ali preden je bilo zabeleženo kakršno koli delo
- Strežnik sprejema UUID-je in čase, ki jih ustvari odjemalec, da je kasneje mogoče dodati sinhronizacijo brez povezave (delo brez povezave še ni implementirano)

## Tehnologije

| Del | Tehnologija |
|------|-----------|
| Odjemalec (`client/`) | React, TypeScript, Vite, PWA, TanStack Query, react-router-dom |
| Strežnik (`server/`) | Node.js, Express, TypeScript, Prisma 6, PostgreSQL, JWT avtentikacija, zod, multer, pdfkit |
| Podatkovna baza | PostgreSQL 16 (fotografije so shranjene v bazi, tabela `PhotoFile`) |

API je dostopen pod `/api`. V produkciji isti Express strežnik streže tudi `client/dist`.

## Struktura projekta

```
client/                React PWA (strani, komponente, API pomočniki)
server/
  src/routes/          API poti (auth, workOrders, time, logs, photos, reports, teams, admin, voice, ...)
  src/pdf.ts           Generiranje PDF (dnevno poročilo)
  src/pdfTeam.ts       Generiranje PDF (poročilo ekipe)
  prisma/              shema, migracije, seed
docker-compose.yml     lokalni Postgres 16
nacrt-dokumentacija/   dokumenti načrtovanja
```



## Namestitev (deployment)

- Gostovano kot brezplačna Render spletna storitev iz veje `main`; vsak push na `main` sproži ponovno namestitev.
- Produkcijska baza je brezplačna Neon PostgreSQL (ločena od lokalne).
- Build: build odjemalca, `tsc` build strežnika, `prisma migrate deploy`.
- Zahtevana je spremenljivka okolja `TZ=Europe/Ljubljana`.
