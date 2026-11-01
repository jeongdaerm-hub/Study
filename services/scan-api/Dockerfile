# 건강수첩 사진 인식 서버
#   docker build -f services/scan-api/Dockerfile -t daro-scan-api .   (저장소 루트에서)
#   docker run -e ANTHROPIC_API_KEY=... -p 8787:8787 daro-scan-api
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json .npmrc ./
COPY packages/health-scan/package.json packages/health-scan/
COPY services/scan-api/package.json services/scan-api/
RUN npm ci --omit=dev --ignore-scripts --workspace @daro/scan-api --include-workspace-root=false
COPY packages/health-scan packages/health-scan
COPY services/scan-api services/scan-api
USER node
EXPOSE 8787
CMD ["node", "--experimental-strip-types", "--disable-warning=ExperimentalWarning", "services/scan-api/src/server.ts"]
