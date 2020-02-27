FROM mhart/alpine-node:12.13

RUN apk update && apk upgrade

WORKDIR /
ADD . .

RUN npm version && npm install && npm update

EXPOSE 5000
CMD ["node", "app.js"]

