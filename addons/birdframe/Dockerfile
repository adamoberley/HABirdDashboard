# Built FROM the Playwright Python image (see build.yaml) - Chromium and its
# system deps are already present, so we only add the Python packages that talk
# to the TV and process images.
ARG BUILD_FROM
FROM ${BUILD_FROM}

ENV LANG=C.UTF-8 \
    PYTHONUNBUFFERED=1 \
    # Use the browser already baked into the base image.
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

# Python deps first for layer caching.
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# The renderer harness (served by our tiny static server) and the app code.
COPY www/ /app/www/
COPY app/ /app/

COPY run.sh /run.sh
RUN chmod a+x /run.sh

# No s6/bashio here (non-HA base, init: false) - run our process directly.
CMD [ "/run.sh" ]
