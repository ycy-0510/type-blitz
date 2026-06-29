FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Public Turnstile site key — must be present at build time (Vite inlines VITE_* envs)
ARG VITE_TURNSTILE_SITE_KEY
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY

# Build id (YYMMDD.NN) computed by CI from git — the build context has no .git,
# so it must be injected here rather than derived in vite.config.ts.
ARG VITE_BUILD
ENV VITE_BUILD=$VITE_BUILD

RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
