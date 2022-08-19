#
# BUILD CONTAINER
#
FROM node:16 as base
USER node
ENV NODE_ENV production
WORKDIR /usr/src/app
COPY --chown=node:node package.json yarn.lock .yarnrc.yml tsconfig*.json ./
COPY --chown=node:node .yarn/releases ./.yarn/releases
RUN yarn install --immutable 
COPY --chown=node:node . .
RUN yarn run build

#
# PRODUCTION CONTAINER
#
FROM node:16-alpine as production
USER node
COPY --chown=node:node --from=base /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=base /usr/src/app/dist ./dist
CMD [ "node", "dist/main.js" ]
