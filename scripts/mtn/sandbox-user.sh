#!/usr/bin/env bash
# Creates an MTN MoMo *sandbox* API user and key for one product and prints the .env lines.
#
#   scripts/mtn/sandbox-user.sh collection   <collection subscription key>   [callback host]
#   scripts/mtn/sandbox-user.sh disbursement <disbursement subscription key> [callback host]
#
# Subscription keys come from your profile at https://momodeveloper.mtn.com after subscribing to
# the Collections and Disbursements products (each product has its own key). The callback host
# is the host MTN may post callbacks to (e.g. api.example.ug); it defaults to "localhost".
# Sandbox only: production API users are issued by MTN through the partner portal.
set -euo pipefail

product="${1:-}"
key="${2:-}"
host="${3:-localhost}"
base="https://sandbox.momodeveloper.mtn.com"

if [[ "$product" != "collection" && "$product" != "disbursement" ]] || [[ -z "$key" ]]; then
  sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
fi

user_id="$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen | tr 'A-Z' 'a-z')"

status="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$base/v1_0/apiuser" \
  -H "X-Reference-Id: $user_id" -H "Ocp-Apim-Subscription-Key: $key" -H 'Content-Type: application/json' \
  -d "{\"providerCallbackHost\": \"$host\"}")"
if [[ "$status" != "201" ]]; then
  echo "Creating the API user failed (HTTP $status). Check the subscription key and product." >&2
  exit 1
fi

api_key="$(curl -sS -X POST "$base/v1_0/apiuser/$user_id/apikey" -H "Ocp-Apim-Subscription-Key: $key" \
  | sed -n 's/.*"apiKey"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
if [[ -z "$api_key" ]]; then
  echo "Creating the API key failed." >&2
  exit 1
fi

upper="$(echo "$product" | tr 'a-z' 'A-Z')"
cat <<OUT
# Add to .env (sandbox, $product):
MTN_${upper}_SUBSCRIPTION_KEY=$key
MTN_${upper}_API_USER=$user_id
MTN_${upper}_API_KEY=$api_key
OUT
