FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Build id (YYMMDD.NN) injected by CI from git — same value as the client image
# built from the same commit. The build context has no .git to derive it from.
ARG BUILD
ENV BUILD=$BUILD

EXPOSE 3001
CMD ["npm", "start"]
