#!/bin/sh
set -euf

CONF_DIR=/tmp/nginx
TEMPLATE_DIR=/etc/murmeli
NL='
'
CR="$(printf '\r')"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

# BusyBox grep has no -z, so multi-line values are rejected before the line-based match.
matches() {
  case "$2" in
    *"${NL}"* | *"${CR}"*) return 1 ;;
  esac
  printf '%s\n' "$2" | grep -Eq "$1"
}

parse_bool() {
  case "$2" in
    true | 1 | yes) echo true ;;
    false | 0 | no | '') echo false ;;
    *) fail "$1 must be true or false, got '$2'" ;;
  esac
}

OCTET='(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])'
IPV4="${OCTET}(\.${OCTET}){3}"
IPV4_CIDR="^${IPV4}(/([1-9]|[12][0-9]|3[0-2]))?$"
IPV6_CIDR='^[0-9A-Fa-f]{0,4}(:[0-9A-Fa-f]{0,4}){2,7}(/([1-9]|[1-9][0-9]|1[01][0-9]|12[0-8]))?$'

export PERMISSIONS_POLICY="accelerometer=(), autoplay=(self), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), publickey-credentials-get=(), screen-wake-lock=(), usb=(), xr-spatial-tracking=()"

BACKEND_URL="${BACKEND_URL:-http://backend:3000}"
BACKEND_URL="${BACKEND_URL%/}"
matches '^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?$' "${BACKEND_URL}" ||
  fail "BACKEND_URL must look like http://host:port (no path), got '${BACKEND_URL}'"
export BACKEND_URL

HSTS_ENABLED="$(parse_bool HSTS_ENABLED "${HSTS_ENABLED:-false}")"
HSTS_INCLUDE_SUBDOMAINS="$(parse_bool HSTS_INCLUDE_SUBDOMAINS "${HSTS_INCLUDE_SUBDOMAINS:-false}")"
HSTS_HEADER=""
if [ "${HSTS_ENABLED}" = true ]; then
  HSTS_MAX_AGE="${HSTS_MAX_AGE:-31536000}"
  matches '^[0-9]{1,9}$' "${HSTS_MAX_AGE}" ||
    fail "HSTS_MAX_AGE must be a number of seconds, got '${HSTS_MAX_AGE}'"
  HSTS_VALUE="max-age=${HSTS_MAX_AGE}"
  if [ "${HSTS_INCLUDE_SUBDOMAINS}" = true ]; then
    HSTS_VALUE="${HSTS_VALUE}; includeSubDomains"
  fi
  HSTS_HEADER="add_header Strict-Transport-Security \"${HSTS_VALUE}\" always;"
else
  echo "WARNING: HSTS is disabled (HSTS_ENABLED=false). Enable it, or set HSTS at the TLS reverse proxy." >&2
fi
export HSTS_HEADER

# upgrade-insecure-requests is only sent with HSTS_ENABLED=true, i.e. once the operator says
# TLS is in front. It does not make plain http a supported setup: in production the backend
# requires an https APP_URL and sets Secure cookies, so sign-in only works over https.
UPGRADE_INSECURE=""
if [ "${HSTS_ENABLED}" = true ]; then
  UPGRADE_INSECURE="; upgrade-insecure-requests"
fi
export CSP="default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'${UPGRADE_INSECURE}"

if [ -z "${NGINX_RESOLVER:-}" ]; then
  NGINX_RESOLVER="$(awk '/^nameserver/ { print $2; exit }' /etc/resolv.conf)"
  case "${NGINX_RESOLVER}" in
    *:*) NGINX_RESOLVER="[${NGINX_RESOLVER}]" ;;
  esac
fi
NGINX_RESOLVER="${NGINX_RESOLVER:-127.0.0.11}"
matches '^([0-9A-Za-z.-]+|\[[0-9A-Fa-f:]+\])(:[0-9]{1,5})?$' "${NGINX_RESOLVER}" ||
  fail "NGINX_RESOLVER is not a valid address: '${NGINX_RESOLVER}'"
export NGINX_RESOLVER

mkdir -p "${CONF_DIR}"
: >"${CONF_DIR}/real-ip.conf"
: >"${CONF_DIR}/trusted-proxies.conf"
if [ -z "${TRUSTED_PROXIES:-}" ]; then
  echo "WARNING: TRUSTED_PROXIES is empty. Behind a reverse proxy every client then shares the proxy's IP, so per-IP rate limits (login, register, PIN) hit all users together. Set it to the proxy's IP or CIDR." >&2
fi
if [ -n "${TRUSTED_PROXIES:-}" ]; then
  case "${TRUSTED_PROXIES}" in
    *"${NL}"* | *"${CR}"*) fail "TRUSTED_PROXIES must be a single line" ;;
  esac
  for entry in $(printf '%s' "${TRUSTED_PROXIES}" | tr ',' ' '); do
    if ! matches "${IPV4_CIDR}" "${entry}" && ! matches "${IPV6_CIDR}" "${entry}"; then
      fail "TRUSTED_PROXIES entry '${entry}' is not an IP address or CIDR (a /0 prefix is not allowed)"
    fi
    echo "set_real_ip_from ${entry};" >>"${CONF_DIR}/real-ip.conf"
    echo "${entry} 1;" >>"${CONF_DIR}/trusted-proxies.conf"
  done
  printf 'real_ip_header X-Forwarded-For;\nreal_ip_recursive on;\n' >>"${CONF_DIR}/real-ip.conf"
fi

CORP=same-origin envsubst '${CSP} ${PERMISSIONS_POLICY} ${HSTS_HEADER} ${CORP}' \
  <"${TEMPLATE_DIR}/security-headers.conf.template" >"${CONF_DIR}/security-headers.conf"
CORP=cross-origin envsubst '${CSP} ${PERMISSIONS_POLICY} ${HSTS_HEADER} ${CORP}' \
  <"${TEMPLATE_DIR}/security-headers.conf.template" >"${CONF_DIR}/security-headers-cross-origin.conf"
envsubst '${BACKEND_URL} ${NGINX_RESOLVER}' \
  <"${TEMPLATE_DIR}/nginx.conf.template" >"${CONF_DIR}/nginx.conf"

exec nginx -c "${CONF_DIR}/nginx.conf" -e stderr -g 'daemon off;'
