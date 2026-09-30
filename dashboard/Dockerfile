# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines these at build time, so they must be supplied as build args
# (a runtime env var on the container would be too late).
ARG VITE_API_URL=http://localhost:8000/api
ARG VITE_BASE_DOMAIN=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_BASE_DOMAIN=$VITE_BASE_DOMAIN
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
