@echo off
REM Start zowel de Desite-website (dev-server) als de beheertool (upload +
REM klanten), elk in een eigen venster. Dubbelklikken volstaat - dit script
REM vindt de projectmap zelf, ongeacht van waar je het aanklikt.
REM
REM Automatisch starten bij het opstarten van Windows:
REM 1. Druk Win+R, typ "shell:startup" en druk Enter.
REM 2. Maak in die map een snelkoppeling naar dit bestand
REM    (rechtsklik dit bestand > "Snelkoppeling maken", verplaats die
REM    snelkoppeling naar de zojuist geopende map).
REM Vanaf de volgende keer inloggen starten beide onderdelen automatisch, elk
REM in een eigen terminalvenster. Sluit een venster om dat onderdeel te
REM stoppen (het andere blijft gewoon draaien).

cd /d "%~dp0.."
echo Desite wordt gestart vanuit %cd%
start "Desite - website" cmd /k npm run dev
start "Desite - beheer (upload en klanten)" cmd /k npm run beheer
