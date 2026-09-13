FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
COPY templates ./templates
COPY catalog ./catalog
ENV NODE_ENV=production
CMD ["npm", "start"]
