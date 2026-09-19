# Przystaneczki Gdynia (TRISTAR & ZKM) 🚌🚏

Nowoczesna aplikacja internetowa do śledzenia odjazdów komunikacji miejskiej w Gdyni w czasie rzeczywistym, wykorzystująca otwarte API systemu **TRISTAR (ZDiZ Gdynia)**, dane **GTFS** oraz bazę taboru **ZKM Gdynia**.

Zbudowana w oparciu o **SvelteKit 5 (Runes)**, **Tailwind CSS**, **Node.js** oraz relacyjną bazę danych **Microsoft SQL Server / Azure SQL**.

---

## ✨ Główne funkcjonalności

- **Tablica odjazdów na żywo**: Rzeczywiste czasy odjazdów z uwzględnieniem opóźnień i przyspieszeń prosto z API TRISTAR.
- **Karty i wyposażenie pojazdów**: Prezentacja marki, modelu, zdjęcia oraz udogodnień pojazdu (klimatyzacja, ładowarki USB) na podstawie numeru bocznego.
- **Wizualizacja trasy kursu**: Szczegółowy przebieg linii z oznaczeniem miniętych i nadchodzących przystanków, synchronizowany z danymi GTFS.
- **Interaktywna mapa przystanków**: Przeglądanie słupków na mapie (Leaflet) wraz z szybkim przejściem do tablicy danego przystanku.
- **Ulubione przystanki i synchronizacja z chmurą**: Logowanie użytkowników przez oficjalny Telegram Widget z zapisem spersonalizowanych nazw przystanków w bazie SQL.
- **Dwa tryby wizualne tablicy**: Nowoczesny (ciemny z akcentami) oraz retro (nawiązujący do klasycznych pomarańczowych matryc LED TRISTAR).
- **Panel administratora**: Uruchamianie synchronizacji geometrii tras GTFS (`gtfs.zip`) oraz skanera taboru ze stron ZKM Gdynia.

---

## 🛠️ Wymagania wstępne

- **Node.js** 20.6.0 lub nowszy (zalecana wersja LTS)
- **Baza danych MSSQL** (np. Azure SQL Database lub lokalny SQL Server / Docker)
- **Bot Telegram** (utworzony w [@BotFather](https://t.me/BotFather)) do obsługi logowania użytkowników

---

## 🚀 Szybki start

### 1. Klonowanie repozytorium i instalacja zależności

```bash
git clone <adres-repozytorium>
cd przystaneczkiSv
npm install
```

### 2. Konfiguracja zmiennych środowiskowych

Skopiuj plik szablonu `.env.example` do `.env`:

```bash
cp .env.example .env
```

Uzupełnij zmienne w `.env` swoimi danymi.

### 3. Uruchomienie serwera deweloperskiego

```bash
npm run dev
```

Aplikacja wystartuje pod adresem `http://localhost:5173` (lub `http://127.0.0.1:5173` dla poprawnego działania widgetu Telegram).

---

## 🔐 Zmienne środowiskowe (`.env`)

Wszystkie poufne dane i parametry konfiguracyjne zostały przeniesione do zmiennych środowiskowych:

| Zmienna | Wymagana | Opis | Wartość domyślna / Przykład |
|---|:---:|---|---|
| `MSSQL_SERVER` | Tak | Adres hosta serwera MSSQL / Azure SQL | `twoj-serwer.database.windows.net` |
| `MSSQL_DATABASE` | Tak | Nazwa bazy danych | `komunikacjamiejska` |
| `MSSQL_USER` | Tak | Login użytkownika bazy danych | `db_user` |
| `MSSQL_PASSWORD` | Tak | Hasło użytkownika bazy danych | `tajne_haslo` |
| `MSSQL_PORT` | Nie | Port serwera MSSQL | `1433` |
| `MSSQL_ENCRYPT` | Nie | Wymuszenie szyfrowania połączenia TLS/SSL | `true` |
| `MSSQL_TRUST_SERVER_CERTIFICATE` | Nie | Ufaj certyfikatowi serwera (np. dla połączeń lokalnych) | `true` |
| `BOT_TOKEN` | Tak | Token bota Telegram z @BotFather | `123456789:ABCdef...` |
| `BOT_ID` / `PUBLIC_BOT_ID` | Tak | Numeryczny identyfikator bota (pierwsza część tokena) | `123456789` |
| `BOT_USERNAME` / `PUBLIC_BOT_USERNAME`| Tak | Nazwa użytkownika bota bez znaku `@` | `mojBot` |
| `ADMIN_TELEGRAM_IDS` | Nie | Identyfikatory numeryczne Telegram uprawnione do `/admin` (oddzielone przecinkami) | `123456789,987654321` |
| `ENABLE_DEV_LOGIN` | Nie | Włącza przyciski szybkiego logowania testowego w środowisku lokalnym | `false` w produkcji |
| `TRISTAR_API_BASE_URL` | Nie | Adres bazowy API TRISTAR | `http://api.zdiz.gdynia.pl/pt` |
| `GTFS_ZIP_URL` | Nie | Bezpośredni URL do archiwum GTFS | `http://api.zdiz.gdynia.pl/pt/gtfs.zip` |
| `ZKM_BASE_URL` | Nie | Bazowy URL serwisu ZKM Gdynia | `https://zkmgdynia.pl` |
| `PUBLIC_CARTO_API_KEY` / `CARTO_API_KEY` | Nie | Klucz API CARTO Basemaps (usuwa znak wodny z kafelków mapy) | Uzyskaj bezpłatnie na https://carto.com/basemaps/apikey |

---

## 🤖 Konfiguracja bota Telegram

1. Otwórz [@BotFather](https://t.me/BotFather) w aplikacji Telegram.
2. Utwórz nowego bota poleceniem `/newbot` lub wybierz istniejącego (`/mybots`).
3. Skonfiguruj domenę dla Telegram Login Widget:
   - Wyślij komendę `/setdomain`.
   - Wybierz bota.
   - Wpisz domenę produkcyjną (np. `twoja-domena.pl`) lub dla testów lokalnych: `http://127.0.0.1:5173` (BotFather wymaga adresu IP `127.0.0.1`, a nie nazwy hosta `localhost`).
4. Skopiuj token i ID bota do pliku `.env`.

---

## 🗄️ Struktura bazy danych (MSSQL)

Aplikacja współpracuje z następującymi tabelami:

- **`[dbo].[przystanki]`** – Przystanki komunikacji miejskiej (id, nazwa, współrzędne, strefa).
- **`[dbo].[linie]`** – Oznaczenia linii autobusowych i trolejbusowych.
- **`[dbo].[trasy]`** – Przebieg tras kursów i sekwencje przystanków.
- **`[dbo].[busy]`** – Spis taboru (nr boczny, marka, model, URL zdjęcia).
- **`[dbo].[busFeatures]`** – Cechy pojazdów (np. klimatyzacja, USB, niska podłoga).
- **`[dbo].[VancoUsers]`** – Użytkownicy logujący się przez Telegram i ich preferencje.
- **`[dbo].[VancoFavs]`** – Ulubione słupki przystankowe użytkowników.

---

## ☁️ Wdrożenie w Azure App Service

Szczegółowy przewodnik wdrożenia aplikacji w chmurze Azure znajduje się w dokumencie **[AZURE_DEPLOY.md](file:///C:/Users/rafal/source/repos/komunikacja/przystaneczkiSv/AZURE_DEPLOY.md)**.
Zawiera on:
- Konfigurację zmiennych środowiskowych i Azure SQL
- Ustawienia reverse proxy i nagłówków SvelteKit
- Gotowy workflow GitHub Actions ([`.github/workflows/azure-appservice.yml`](file:///C:/Users/rafal/source/repos/komunikacja/przystaneczkiSv/.github/workflows/azure-appservice.yml))
- Opcjonalne wdrożenie kontenerowe za pomocą [Dockerfile](file:///C:/Users/rafal/source/repos/komunikacja/przystaneczkiSv/Dockerfile)

---

## 📜 Dostępne skrypty

- `npm run dev` – Uruchomienie deweloperskiego serwera Vite z HMR.
- `npm run build` – Zbudowanie produkcyjnej paczki aplikacji (`svelte-kit build`).
- `npm start` – Uruchomienie zbudowanego serwera Node.js (`node build/index.js`).
- `npm run check` – Statyczna weryfikacja typów TypeScript i komponentów Svelte (`svelte-check`).
- `npm run sync:gtfs` – Samodzielny skrypt pobierający `gtfs.zip` i synchronizujący bazę.
- `npm run scrape:vehicles` – Samodzielny skrypt aktualizujący dane taboru z wyszukiwarki ZKM.

---

## 📄 Licencja

Projekt udostępniony na licencji [MIT](LICENSE).
Dane rozkładowe i pozycje pojazdów pochodzą z otwartych źródeł ZDiZ Gdynia oraz ZKM Gdynia.
