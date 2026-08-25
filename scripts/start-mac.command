#!/bin/bash
# Start zowel de Desite-website (dev-server) als de beheertool (upload +
# klanten), elk in een eigen Terminalvenster. Dubbelklikken in Finder
# volstaat - dit script vindt de projectmap zelf vanaf zijn eigen locatie.
#
# Eerste keer: maak het uitvoerbaar met (eenmalig, in Terminal):
#   chmod +x scripts/start-mac.command
#
# Automatisch starten bij inloggen:
# 1. Open Systeeminstellingen > Algemeen > Inlogitems.
# 2. Klik op "+" en kies dit bestand (scripts/start-mac.command).
# Vanaf de volgende keer inloggen starten beide onderdelen automatisch, elk
# in een eigen Terminalvenster. Sluit een venster (of druk Ctrl+C erin) om
# dat onderdeel te stoppen (het andere blijft gewoon draaien).

DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "Desite wordt gestart vanuit $DIR"
osascript -e "tell application \"Terminal\" to do script \"cd '$DIR' && npm run dev\""
osascript -e "tell application \"Terminal\" to do script \"cd '$DIR' && npm run beheer\""
