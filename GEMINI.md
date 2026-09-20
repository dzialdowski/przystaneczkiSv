## Project Configuration

- **Language**: TypeScript
- **Package Manager**: npm
- **Add-ons**: prettier, eslint, vitest, playwright, tailwindcss, sveltekit-adapter, ai-tools

---

## Zasady interfejsu użytkownika (UI / UX) i komunikacji

- **BEZWZGLĘDNY ZAKAZ TECHNICZNEGO ŻARGONU W INTERFEJSIE UŻYTKOWNIKA**:
  - W komunikatach widocznych dla użytkownika (powiadomienia toast, banery informacyjne, etykiety, modale, przyciski, opisy, komunikaty błędów) **NIGDY** nie umieszczaj nazw wewnętrznych technologii, protokołów, bibliotek czy silników bazodanowych (np. zabronione są terminy: `IndexedDB`, `SQL`, `baza danych`, `cache przeglądarki`, `API`, `localStorage`, `SSR` itp.).
  - Komunikaty i teksty w interfejsie muszą być proste, naturalne, zwięzłe i zrozumiałe dla każdego zwykłego pasażera (np. „Dodano do ulubionych! ⭐”, „Ulubione na tym urządzeniu”, „Zapisano na Twoim koncie”, „Wczytaj listę z pliku”).

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
