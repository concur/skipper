FROM mhart/alpine-node:13.0.1

WORKDIR /
ADD . .

EXPOSE 5000
CMD ["node", "app.js"]

