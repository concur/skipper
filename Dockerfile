FROM mhart/alpine-node:12.13

RUN apk update && apk upgrade

WORKDIR /
ADD . .

EXPOSE 5000
CMD ["node", "app.js"]

