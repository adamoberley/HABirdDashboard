# Bird Card standalone page in a container - no Home Assistant needed.
#
# Downloads only the page itself (about 4 MB) for HABIRD_REF, not the
# repository: the 1.1 GB of artwork is fetched by nginx from the same CDN
# the card uses, on demand, unless you mount a local copy. See README.md.
#
#   docker compose up -d --build
FROM alpine:3.20 AS fetch
ARG HABIRD_REF=HABirdDashboard
ARG HABIRD_REPO=adamoberley/HABirdDashboard
RUN apk add --no-cache curl jq
WORKDIR /out
# Every file in homeassistant/www (and its i18n/), as listed by GitHub for
# this ref - so new languages arrive without editing this file.
RUN set -eu; \
    api="https://api.github.com/repos/${HABIRD_REPO}/contents/homeassistant/www"; \
    raw="https://raw.githubusercontent.com/${HABIRD_REPO}/${HABIRD_REF}/homeassistant/www"; \
    for dir in "" "i18n"; do \
      mkdir -p "./${dir}"; \
      curl -fsSL "${api}${dir:+/$dir}?ref=${HABIRD_REF}" \
        | jq -r '.[] | select(.type == "file") | .name' \
        | while read -r name; do \
            curl -fsSL -o "./${dir:+$dir/}${name}" "${raw}/${dir:+$dir/}${name}"; \
          done; \
    done; \
    test -s index.html && test -s apt.js && test -s i18n/en.js; \
    # Same origin as BirdNET-Go (nginx proxies /api/v2/), so no CORS and no
    # hard-coded :8080. A config.js you mount over this one wins.
    sed -i "s|^  birdnetGoUrl: '',|  birdnetGoUrl: location.origin,|" config.js; \
    grep -q "birdnetGoUrl: location.origin" config.js; \
    echo "${HABIRD_REF}" > .habird-ref

FROM nginx:1.27-alpine
ARG HABIRD_REF=HABirdDashboard
ARG HABIRD_REPO=adamoberley/HABirdDashboard
# Runtime settings (compose.yaml sets them). The nginx image fills
# templates/*.template from these at start.
ENV BIRDNET_GO_URL=http://birdnet-go:8080 \
    BIRDNET_GO_TOKEN="" \
    ART_ORIGIN=https://cdn.jsdelivr.net \
    ART_PATH=/gh/${HABIRD_REPO}@${HABIRD_REF}/avian/assets \
    NGINX_ENVSUBST_FILTER="^(BIRDNET_GO_|ART_)"
COPY --from=fetch /out/ /usr/share/nginx/html/
COPY default.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
