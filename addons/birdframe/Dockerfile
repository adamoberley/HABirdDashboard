# Built FROM the Playwright Python image (see build.yaml) - Chromium and its
# system deps are already present. We (re)install the Playwright pip package and
# browser into the SAME interpreter run.sh uses (`python3 -m ...`), because the
# image's preinstalled copy lives in a different interpreter on Ubuntu noble.
ARG BUILD_FROM
FROM ${BUILD_FROM}

# Build steps need root; HA add-ons run as root anyway.
USER root

ENV LANG=C.UTF-8 \
    PYTHONUNBUFFERED=1 \
    # noble marks the system Python "externally managed" (PEP 668); allow pip.
    PIP_BREAK_SYSTEM_PACKAGES=1 \
    # Reuse the browser baked into the base image (same revision as the pin).
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

# Python deps + the matching Chromium, bound to this image's `python3`.
COPY requirements.txt /app/requirements.txt
RUN python3 -m pip install --no-cache-dir -r /app/requirements.txt \
 && python3 -m playwright install chromium

# The renderer harness (served by our static server) and the app code.
COPY www/ /app/www/
COPY app/ /app/

COPY run.sh /run.sh
RUN chmod a+x /run.sh

# No s6/bashio here (non-HA base, init: false) - run our process directly.
CMD [ "/run.sh" ]
