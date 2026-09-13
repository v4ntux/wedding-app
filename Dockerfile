FROM node:24-bookworm-slim
WORKDIR /app
# yt-dlp забирает песни с YouTube целиком. Свежий релиз на каждой сборке: YouTube
# меняется часто, и старый yt-dlp перестаёт качать. Node для его проверок уже есть.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ADD https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux /usr/local/bin/yt-dlp
RUN chmod 755 /usr/local/bin/yt-dlp
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
COPY templates ./templates
COPY catalog ./catalog
ENV NODE_ENV=production
CMD ["npm", "start"]
