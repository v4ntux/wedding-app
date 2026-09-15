FROM node:24-bookworm-slim
WORKDIR /app
# ffmpeg вытаскивает звук из видео; yt-dlp — из ссылок YouTube, TikTok, Instagram
# и т.п. (magic import в студии и в боте). yt-dlp берём свежим бинарником с
# GitHub: сайты меняются часто, а пакет в Debian отстаёт на месяцы. Node для
# разбора роликов YouTube в образе уже есть (YTDLP_JS_RUNTIME=node).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates ffmpeg curl \
  && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && apt-get purge -y curl && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
COPY templates ./templates
COPY catalog ./catalog
ENV NODE_ENV=production
CMD ["npm", "start"]
