# syntax=docker/dockerfile:1
#
# php-cli + `artisan serve` rather than php-apache: this is meant for local
# parity and small/trial deployments (see docker-compose.yml and the Railway
# trial deploy), not tuned for production traffic — a real production image
# would swap this for php-fpm behind nginx or a proper Apache MPM setup.
FROM php:8.4-cli

RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libzip-dev libicu-dev libpng-dev libjpeg-dev libfreetype6-dev libonig-dev \
    && rm -rf /var/lib/apt/lists/* \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql mbstring bcmath exif intl zip gd

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY composer.json composer.lock ./
RUN composer install --no-interaction --no-dev --no-scripts --no-autoloader --prefer-dist

COPY . .
RUN composer dump-autoload --optimize \
    && chown -R www-data:www-data storage bootstrap/cache

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
COPY docker/php-uploads.ini /usr/local/etc/php/conf.d/php-uploads.ini

ENTRYPOINT ["entrypoint.sh"]
# ROLE=worker (set on the queue-worker service; docker-compose overrides this
# entirely with its own `command:` anyway) runs the queue instead of serving HTTP.
CMD ["sh", "-c", "if [ \"$ROLE\" = \"worker\" ]; then php artisan queue:work --sleep=3 --tries=3; else php artisan serve --host=0.0.0.0 --port=${PORT:-80}; fi"]
