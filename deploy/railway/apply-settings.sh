#!/usr/bin/env sh
# Applies each app service's build and deploy settings (Dockerfile, health check, restart policy,
# watch paths) from deploy/railway/<service>.json through the Railway API. Railway no longer accepts
# railway.json as a service's config file, so these files are the settings' source of truth instead.
#
#   railway link   # the nursery-link-uganda project
#   sh deploy/railway/apply-settings.sh
set -eu
cd "$(dirname "$0")"
# The CLI can print tips after its JSON, so read only the JSON part
json_of() { python3 -c "import json,sys; t=sys.stdin.read(); i=min(x for x in (t.find('{'), t.find('[')) if x >= 0); print(json.dumps(json.JSONDecoder().raw_decode(t[i:])[0]))"; }
env_id=$(railway status --json | json_of | python3 -c "import json,sys; print(json.load(sys.stdin)['environments']['edges'][0]['node']['id'])")
services=$(railway service status --all --json | json_of)
for name in api web admin; do
  service_id=$(printf '%s' "$services" | python3 -c "import json,sys; print(next(s['id'] for s in json.load(sys.stdin) if s['name'] == 'nurserylink-$name'))")
  input=$(python3 -c "
import json
c = json.load(open('$name.json'))
print(json.dumps({
  'dockerfilePath': c['build']['dockerfilePath'], 'watchPatterns': c['build']['watchPatterns'],
  'healthcheckPath': c['deploy']['healthcheckPath'], 'healthcheckTimeout': c['deploy']['healthcheckTimeout'],
  'restartPolicyType': c['deploy']['restartPolicyType'], 'restartPolicyMaxRetries': c['deploy']['restartPolicyMaxRetries'],
}))")
  railway api 'mutation($s: String!, $e: String!, $i: ServiceInstanceUpdateInput!) { serviceInstanceUpdate(serviceId: $s, environmentId: $e, input: $i) }' \
    --variables "{\"s\":\"$service_id\",\"e\":\"$env_id\",\"i\":$input}" >/dev/null
  echo "nurserylink-$name: settings applied"
done
