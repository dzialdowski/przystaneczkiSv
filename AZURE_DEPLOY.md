# Instrukcja wdrożenia w Azure App Service

Niniejszy przewodnik opisuje krok po kroku przygotowanie i wdrożenie aplikacji **Przystaneczki** w usłudze **Azure App Service** (zalecany system: **Linux** ze środowiskiem **Node.js 22 LTS**).

---

## 1. Wybór metody wdrożenia

Projekt został przygotowany do obsługi trzech najpopularniejszych metod publikacji:

1. **GitHub Actions (Zalecana i już skonfigurowana)** – automatyczne budowanie i publikacja po każdym `git push` do gałęzi `master` (plik workflow: [`.github/workflows/master_przystaneczki.yml`](file:///C:/Users/rafal/source/repos/komunikacja/przystaneczkiSv/.github/workflows/master_przystaneczki.yml)).
2. **Azure CLI / Zip Deploy / Git** – publikacja bezpośrednia kodu źródłowego (mechanizm Oryx sam instaluje zależności i uruchamia `npm run build`).
3. **Kontener Docker (Web App for Containers)** – użycie załączonego pliku [Dockerfile](file:///C:/Users/rafal/source/repos/komunikacja/przystaneczkiSv/Dockerfile).

---

## 2. Utworzenie zasobu w Azure App Service

1. Zaloguj się do [Azure Portal](https://portal.azure.com).
2. Przejdź do **App Services** i kliknij **Create** -> **Web App**.
3. Wypełnij podstawowe parametry:
   - **Publish**: `Code` (lub `Docker Container` w przypadku metody 3)
   - **Runtime stack**: `Node 22 LTS`
   - **Operating System**: `Linux` (zalecany)
   - **Pricing Plan**: Basic (B1), Standard (S1) lub Premium (P1v3). *(Darmowy plan F1 nie jest zalecany ze względu na limity pamięci przy budowaniu)*.
4. Kliknij **Review + create** i utwórz aplikację.

---

## 3. Konfiguracja zmiennych środowiskowych (App Settings)

W portalu Azure przejdź do swojej aplikacji: **Settings** -> **Environment variables** (lub **Configuration**):

### Wymagane zmienne SvelteKit & Reverse Proxy
* **`PORT`**: `8080` (w Azure App Service Linux port zazwyczaj jest ustawiany automatycznie, ale warto upewnić się, że pasuje do konfiguracji).
* **`HOST`**: `0.0.0.0`
* **`ORIGIN`**: `https://<twoja-aplikacja>.azurewebsites.net` *(lub Twoja własna domena z https, np. `https://przystaneczki.pl`)* – **bardzo ważne dla zabezpieczeń CSRF formularzy SvelteKit**.
* **`PROTOCOL_HEADER`**: `x-forwarded-proto`
* **`HOST_HEADER`**: `x-forwarded-host`

### Konfiguracja Bazy Danych (Azure SQL Database)
* **`MSSQL_SERVER`**: `<twoj-serwer>.database.windows.net`
* **`MSSQL_DATABASE`**: `komunikacjamiejska` (lub inna nazwa bazy)
* **`MSSQL_USER`**: `<login-uzytkownika-bazy>`
* **`MSSQL_PASSWORD`**: `<haslo-uzytkownika-bazy>`
* **`MSSQL_PORT`**: `1433`
* **`MSSQL_ENCRYPT`**: `true`
* **`MSSQL_TRUST_SERVER_CERTIFICATE`**: `false` (w Azure SQL certyfikat jest zaufany)

> [!IMPORTANT]
> **Zapora sieciowa Azure SQL**:
> W ustawieniach serwera Azure SQL Database (**Security** -> **Networking**) upewnij się, że opcja **"Allow Azure services and resources to access this server"** jest zaznaczona (**Yes**). Bez tego App Service nie połączy się z bazą danych.

### Konfiguracja Telegram Bot
* **`BOT_TOKEN`**: Token uzyskany z `@BotFather`
* **`BOT_ID`** / **`PUBLIC_BOT_ID`**: Identyfikator bota (numeryczna część przed dwukropkiem w tokenie)
* **`BOT_USERNAME`** / **`PUBLIC_BOT_NAME`**: Nazwa bota (bez znaku `@`)
* **`ADMIN_TELEGRAM_IDS`**: Identyfikatory administratorów (np. `123456789,987654321`)
* **`ENABLE_DEV_LOGIN`**: `false`

> [!NOTE]
> **Domena bota w Telegramie**:
> Wyślij do `@BotFather` komendę `/setdomain`, wybierz swojego bota i podaj domenę produkcyjną: `<twoja-aplikacja>.azurewebsites.net` (bez `https://`).

### Zewnętrzne API & Mapy
* **`TRISTAR_API_BASE_URL`**: `http://api.zdiz.gdynia.pl/pt`
* **`GTFS_ZIP_URL`**: `http://api.zdiz.gdynia.pl/pt/gtfs.zip`
* **`ZKM_BASE_URL`**: `https://zkmgdynia.pl`
* **`PUBLIC_CARTO_API_KEY`** / **`CARTO_API_KEY`**: Klucz CARTO Basemaps API (opcjonalny; usuwa znak wodny *"API key required"* z podkładu mapowego). Klucz można wygenerować bezpłatnie na stronie [carto.com/basemaps/apikey](https://carto.com/basemaps/apikey).

---

## 4. Konfiguracja polecenia startowego (Startup Command)

W Azure Portal:
1. Przejdź do **Settings** -> **Configuration** (lub **General settings**).
2. W polu **Startup Command** wpisz:
   ```bash
   node build/index.js
   ```
   *(Plik [package.json](file:///C:/Users/rafal/source/repos/komunikacja/przystaneczkiSv/package.json) posiada również skrypt `"start": "node build/index.js"`)*.

---

## 5. Wdrożenie z GitHub Actions

Workflow GitHub Actions został automatycznie powiązany z Azure App Service w pliku:
[`.github/workflows/master_przystaneczki.yml`](file:///C:/Users/rafal/source/repos/komunikacja/przystaneczkiSv/.github/workflows/master_przystaneczki.yml)

Każdy commit i push do gałęzi `master`:
1. Uruchamia Node.js 22 LTS.
2. Wykonuje `npm install`, `npm run build` oraz `npm test`.
3. Przesyła zbudowaną paczkę do aplikacji `przystaneczki` w Azure App Service.

---

## 6. Wdrożenie za pomocą Azure CLI (metoda alternatywna)

Jeśli wolisz wdrożyć bezpośrednio z konsoli lokalnej:

```bash
# 1. Zbuduj aplikację lokalnie
npm ci
npm run build

# 2. Przygotuj katalog wdrożeniowy
mkdir deploy
cp -r build deploy/
cp package.json deploy/
cp package-lock.json deploy/
cd deploy
npm ci --omit=dev

# 3. Spakuj do pliku zip
zip -r ../deploy.zip .
cd ..

# 4. Opublikuj przez Azure CLI
az webapp deploy --resource-group <NazwaGrupy> --name <NazwaAplikacji> --src-path deploy.zip --type zip
```
