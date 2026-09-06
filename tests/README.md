# SZEM4 tesztek

Ellenőrzések, amiket a `scripts/SZEM4.js` minden módosítása után le lehet
futtatni, mielőtt élesben kipróbálnád. Néhány másodperc, és megmondja, hogy
valami korábban működő elromlott-e.

## Futtatás

Kattints duplán a **`run.cmd`** fájlra. Megnyílik egy fekete ablak és a
böngészőben a teszt oldal.

- **Zöld sáv** — minden rendben, mehet a git commit.
- **Piros sáv** — valami elromlott. Lent a pirossal jelölt sorok mondják meg,
  mi, és mit várt a teszt a kapott érték helyett.

A forrás módosítása után elég **F5**-öt nyomni az oldalon, nem kell újraindítani.
Ha végeztél, zárd be a fekete ablakot.

> Miért kell a fekete ablak? A tesztek beolvassák a `scripts/SZEM4.js`-t. Ezt a
> böngésző biztonsági okból nem engedi közvetlenül a merevlemezről, ezért a
> `run.cmd` elindít egy kis helyi kiszolgálót. Semmi nem megy ki az internetre.

Ha nem nyílik meg semmi, valószínűleg a **8765**-ös port foglalt. Nyisd meg a
`run.cmd`-t Jegyzettömbbel, és írd át a számot mindkét helyen.

## Mit ellenőriz

| Csoport | Mire figyel |
| --- | --- |
| A fájl maga | Értelmezhető-e; a `window`-ra kitett 50 név pontosan a várt; nincs néma `catch` |
| Számok kiolvasása | Az ezres elválasztó pont ne rontsa el az árakat (ez a hiba kétszer előfordult) |
| Építési listák | `ANY()`, `FASTEST()`, egymásba ágyazás, `MINES` sorrend, megfizethetőség, kimaxolt épület |
| Farm távolság | A legközelebbi támadó falu számít, nem az első |
| VIJE pihenés | Két perccel a farm előtt ébred, rövid pihenőnél feleződik |
| Adatmentés | Ne írjon felül jó adatot töredéknyi rosszal |
| Szüneteltetés | Egy modul ki-be; a globális szünet és az önműködő újraindítás |
| Felület | Minden felületi gomb létező függvényt hív |

## Hogyan van felépítve

- `index.html` — az oldal, ami a forrást betölti és az eredményt kiírja
- `harness.js` — a gépezet: kivágja a függvényeket a forrásból és lefuttatja
- `tests.js` — maguk az ellenőrzések
- `run.cmd` — indító

A tesztek **a valódi kódot** futtatják: kivágják az adott függvényt a
`scripts/SZEM4.js` szövegéből, nem másolatot tartanak róla. Így nem fordulhat
elő, hogy a teszt zöld marad, miközben a script már mást csinál.

## Új ellenőrzés írása

A `tests.js` végére:

```js
suite('Aminek működnie kell', function () {
    var api = sandbox({}, [sliceFn(SZEM4_SRC, 'aFuggvenyNeve')]);
    eq(api.aFuggvenyNeve('bemenet'), 'várt kimenet', 'mit állítunk róla');
    ok(api.aFuggvenyNeve(null) === false, 'üres bemenetre nem omlik össze');
});
```

- `sliceFn(SZEM4_SRC, 'nev')` — kivág egy függvényt a forrásból.
- `sandbox(vilag, [...])` — lefuttatja őket egy hamis világban. Amire a
  függvény hivatkozik (`document`, `naplo`, globális változók), azt a `vilag`
  objektumba kell betenni.
- `eq(kapott, vart, 'címke')`, `ok(feltetel, 'címke')`,
  `throws(fn, 'címke', 'szövegrészlet')` — az állítások.

Ha egy függvény másikat hív, azt is vágd ki mellé ugyanabba a listába.

### Két buktató, amibe már belefutottunk

**A hamis világ értékeit `with` köti, nem paraméterként adjuk át.** Ha
paraméter lenne, a valódi kód `FARM_PAUSE = true` értékadása a paramétert írná,
nem a világot — a teszt semmit nem látna belőle, és zölden átmenne úgy, hogy
közben nem ellenőriz semmit. Ezért van minden szünet-teszt elején egy állítás,
ami pont ezt méri ("a sandbox tényleg látja az értékadást").

**Egy teszt csak akkor ér valamit, ha el is tud bukni.** Ha újat írsz, rontsd
el szándékosan a forrást, és nézd meg, hogy tényleg pirosra vált. Ezen a
suite-on ez megtörtént: öt hibát vittünk be, és a negyedik átcsúszott, mert a
teszt nem a megfelelő esetet vizsgálta — az állítás azóta szigorúbb.

## Megnézni, hogy néz ki (preview.html)

A `run.cmd` elindítása után a <http://localhost:8765/tests/preview.html> címen
megnézheted SZEM kinézetét anélkül, hogy elindítanád a játékban.

Miért kell: SZEM `init()` függvénye feladja, ha nem valódi Klánháború-oldalon
fut, így a panelek soha nem épülnek fel — a stílusán dolgozni tehát vakon
kellene. Ez az oldal kiszedi a *valódi* stíluslapot a `scripts/SZEM4.js`-ből
(nem másolatot, ami elavulhat), és alátesz egy jellemző darabot a felületből:
fejléc, modulsor, egy adattábla, a napló, egy űrlap és az üzenetdoboz.

Átírod a CSS-t a `SZEM4.js`-ben, F5, és látod. A piros csík a bal felső
sarokban emlékeztet, hogy ez csak előnézet, nem az igazi SZEM.
