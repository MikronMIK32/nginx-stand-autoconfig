FROM node:16.3.0-alpine as installer

WORKDIR /app
COPY . .

RUN npm i
RUN npm run build

FROM node:16.3.0-alpine AS runner

WORKDIR /app

RUN apk add npm
 
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/dist ./dist
COPY --from=installer /app/package.json ./package.json

EXPOSE 80

CMD [ "npm", "start" ]