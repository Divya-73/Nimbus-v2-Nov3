FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY index.html vite.config.js vite-security-headers-plugin.js ./
COPY src ./src
COPY public ./public
COPY cert ./cert

EXPOSE 5005
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
