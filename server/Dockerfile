FROM node:22-bookworm-slim

# better-sqlite3 compiles a native addon at install time.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p data uploads backups

EXPOSE 3001
CMD ["node", "src/index.js"]
