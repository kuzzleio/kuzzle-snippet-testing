FROM node:10-alpine

LABEL io.kuzzle.vendor="Kuzzle <support@kuzzle.io>"
LABEL description="Language agnostic code snippets tests"

WORKDIR /var/app

ENV DOCKER_HOST=unix:///var/run/docker.sock
ENV DOCKER_DRIVER=overlay2

COPY . /var/app

RUN set -eux \
  \
  && mkdir -p /var/snippets \
  && npm install

CMD ["tail", "-f", "/dev/null"]
