#!/bin/sh
# Sun study screenshots at fixed dates and times, for each balcony orientation.
# Usage: CHROME_PATH=... sh scripts/sun-shots.sh [outDir] [baseUrl] [facing ...]
out=${1:-test-results/sun}
base=${2:-http://localhost:5173}
shift 2 2>/dev/null
facings=${*:-N W}
for facing in $facings; do
  for when in 2026-06-21@09:00 2026-06-21@12:00 2026-06-21@16:00 2026-06-21@17:40 2025-12-21@08:00 2025-12-21@13:00 2025-12-21@19:30; do
    date=${when%@*}
    time=${when#*@}
    DECOR=${DECOR:-furn} QUERY="date=$date&sun=$time&facing=$facing" TAG="$facing-$date-$(echo "$time" | tr -d :)" \
      node scripts/shoot.mjs "$out" "$base" ${VIEWS:-from-entry iso-balcony}
  done
done
