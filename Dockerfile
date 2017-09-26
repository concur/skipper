FROM mhart/alpine-node:8.3

WORKDIR /
ADD . .

EXPOSE 5000
CMD ["node", "app.js"]

