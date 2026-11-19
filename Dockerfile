FROM node:24-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 3000

CMD ["node", "server/index.js"]
