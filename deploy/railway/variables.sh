#!/usr/bin/env sh
# Prints the variables for each Railway service, ready to paste into its Variables → Raw Editor.
# Secrets are generated fresh on every run, on this machine; nothing is saved or sent anywhere.
#
#   sh deploy/railway/variables.sh https://<web domain> https://<admin domain>
#
# The service names must match those in deploy/railway/README.md (postgis, nurserylink-api,
# nurserylink-web, nurserylink-admin): the ${{service.VAR}} references below point at them.
set -eu
if [ $# -ne 2 ]; then
  echo "usage: sh deploy/railway/variables.sh https://<web domain> https://<admin domain>" >&2
  exit 1
fi
WEB=${1%/}
ADMIN=${2%/}
hex() { openssl rand -hex 32; }

cat <<VARS
===== postgis =====
POSTGRES_USER=nurserylink
POSTGRES_PASSWORD=$(hex)
POSTGRES_DB=nurserylink
PGDATA=/var/lib/postgresql/data/pgdata

===== nurserylink-api =====
PORT=4000
DATABASE_URL=postgresql://\${{postgis.POSTGRES_USER}}:\${{postgis.POSTGRES_PASSWORD}}@\${{postgis.RAILWAY_PRIVATE_DOMAIN}}:5432/\${{postgis.POSTGRES_DB}}
PUBLIC_WEB_URL=$WEB
CORS_ORIGINS=$WEB,$ADMIN
TRUST_PROXY=1
JWT_ACCESS_SECRET=$(hex)
QUOTE_TOKEN_SECRET=$(hex)
OTP_HMAC_SECRET=$(hex)
PHONE_VERIFICATION=off
PAYMENTS=off
PAYMENT_PROVIDER_MODE=mock
DEMO_NOTICE=on
DIRECTIONS_PROVIDER=osrm-public
ADMIN_FULL_NAME=
ADMIN_PHONE=
ADMIN_EMAIL=
ADMIN_PASSWORD=

===== nurserylink-web =====
PORT=8080
API_UPSTREAM=http://\${{nurserylink-api.RAILWAY_PRIVATE_DOMAIN}}:\${{nurserylink-api.PORT}}

===== nurserylink-admin =====
PORT=8080
API_UPSTREAM=http://\${{nurserylink-api.RAILWAY_PRIVATE_DOMAIN}}:\${{nurserylink-api.PORT}}
WEB_UPSTREAM=http://\${{nurserylink-web.RAILWAY_PRIVATE_DOMAIN}}:\${{nurserylink-web.PORT}}
VARS
echo
echo "Fill in the four ADMIN_ lines (phone like 0772123456, password of 12+ characters) before saving." >&2
