FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY opensearch ./opensearch
COPY cert ./cert
COPY templates ./templates

ENV NODE_ENV=production
EXPOSE 3005

CMD ["npm", "start"]
