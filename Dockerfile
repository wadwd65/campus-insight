FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=5191 CAMPUS_DATA_DIR=/data
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server ./server
COPY --from=build /app/src/lib/surveySchema.js ./src/lib/surveySchema.js
COPY --from=build /app/src/data/matrix.json ./src/data/matrix.json
COPY --from=build /app/scripts/backup-accounts.mjs ./scripts/backup-accounts.mjs
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 5191
CMD ["node", "server/index.mjs"]
