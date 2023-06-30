#
# BUILD CONTAINER
#
FROM node:18.16 as base
USER node
ENV NODE_ENV production
WORKDIR /app
COPY --chown=node:node package.json yarn.lock .yarnrc.yml tsconfig*.json ./
COPY --chown=node:node .yarn/releases ./.yarn/releases
RUN yarn install --immutable 
COPY --chown=node:node . .
RUN yarn run build

#
# PRODUCTION CONTAINER
#
FROM node:18.16-alpine as production
USER node

ARG VERSION
ARG BUILD_NUMBER

ENV APPLICATION_VERSION=${VERSION} \
    APPLICATION_BUILD_NUMBER=${BUILD_NUMBER}

COPY --chown=node:node --from=base /app/node_modules ./node_modules
COPY --chown=node:node --from=base /app/dist ./dist
CMD [ "node", "dist/main.js" ]
