# ==============================================================================
# Dockerfile for Azure App Service (Web App for Containers)
# ==============================================================================

# Etap 1: Budowanie aplikacji
FROM node:22-alpine AS builder

WORKDIR /app

# Kopiowanie plików definicji pakietów
COPY package*.json ./

# Instalacja pełnych zależności (w tym devDependencies potrzebnych do buildu)
RUN npm ci

# Kopiowanie kodu źródłowego
COPY . .

# Budowanie paczki SvelteKit za pomocą adapter-node
RUN npm run build

# Przycięcie zależności wyłącznie do produkcyjnych
RUN npm prune --omit=dev

# ==============================================================================
# Etap 2: Obraz produkcyjny (lekki i bezpieczny)
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
# Azure App Service standardowo nasłuchuje na porcie 8080 dla kontenerów niestandardowych
ENV PORT=8080

# Użycie nieuprzywilejowanego użytkownika 'node'
USER node

# Kopiowanie zbudowanych artefaktów i produkcyjnych zależności
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/build ./build

EXPOSE 8080

CMD ["node", "build/index.js"]
