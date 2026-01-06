FROM node:22.14.0-alpine

WORKDIR /app

COPY ./ ./

RUN npm install && npm run build

EXPOSE 3000

ENTRYPOINT ["npm", "run", "start:prod"]