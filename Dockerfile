#
# BUILD CONTAINER
#
FROM node:20.10.0 as base
ENV NODE_ENV production
WORKDIR /app
COPY --chown=node:node .yarn/releases ./.yarn/releases
COPY --chown=node:node .yarn/plugins ./.yarn/plugins
COPY --chown=node:node .yarn/patches ./.yarn/patches
COPY --chown=node:node package.json yarn.lock .yarnrc.yml tsconfig*.json ./
RUN --mount=type=cache,target=/root/.yarn YARN_CACHE_FOLDER=/root/.yarn yarn workspaces focus --production
COPY --chown=node:node assets ./assets
COPY --chown=node:node src ./src
RUN yarn run build

#
# PRODUCTION CONTAINER
#
FROM node:20.10.0-alpine as production
USER node

ARG VERSION
ARG BUILD_NUMBER

ENV APPLICATION_VERSION=${VERSION} \
    APPLICATION_BUILD_NUMBER=${BUILD_NUMBER}

COPY --chown=node:node --from=base /app/node_modules ./node_modules
COPY --chown=node:node --from=base /app/dist ./dist
COPY --chown=node:node --from=base /app/assets ./assets
CMD [ "node", "dist/main.js" ]
