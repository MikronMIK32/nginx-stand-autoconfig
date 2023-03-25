FROM node:16.3.0-alpine as installer

RUN apk add npm git openjdk8-jre-base bash htop vim mc

RUN addgroup -g $GROUP_ID developer
RUN adduser -u $USER_ID -S -D -H -G developer developer

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

EXPOSE 3000

CMD [ "npm", "start" ]