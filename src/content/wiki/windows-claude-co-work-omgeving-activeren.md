---
title: "Windows Claude Cowork-omgeving activeren"
description: "De Claude Cowork-omgeving reproduceerbaar opzetten op een Windows-machine: VirtualMachinePlatform activeren, Claude Desktop installeren en de Chrome-extensie verbinden."
category: "Windows Server & Client"
order: 1
clients: []
draft: false
---

*Standard Operating Procedure — Windows Cowork-omgeving opzetten*

| | |
|---|---|
| **Frequentie** | Eenmalig per machine, of opnieuw na een herinstallatie |
| **Doelgroep** | Technisch beheerder, consultant |
| **Vereiste rol** | Lokale administrator op de Windows-machine |
| **Versie** | 1.0 — juni 2025, Dennis Schiphorst |

Deze SOP beschrijft het reproduceerbaar opzetten van de Claude Cowork-omgeving op een Windows-machine, in drie stappen: VirtualMachinePlatform activeren (vereist voor WSL2 en de browser-extensie), Claude Desktop installeren of bijwerken, en de verbinding verifiëren via de Chrome-extensie.

## Vereisten

### Toegang en rechten

- Lokale administrator, of lid van de groep "Administrators"
- PowerShell 5.1 of hoger (ingebouwd in Windows 10/11)
- Internetverbinding voor het downloaden van Claude Desktop

### Software

- Windows 10 (build 19041+) of Windows 11
- Google Chrome met de Claude-extensie — installeer deze vooraf via de Chrome Web Store

## Procedure

<ol class="phases">
<li><b>PowerShell openen als administrator.</b> Druk op <code>Win + X</code> en kies "Terminal (Administrator)" of "Windows PowerShell (Administrator)". Alternatief: zoek op "PowerShell" in het Startmenu, klik rechts en kies "Als administrator uitvoeren".</li>
<li><b>VirtualMachinePlatform inschakelen.</b> Schakelt de Windows-feature in die WSL2 en de Cowork-omgeving nodig hebben.</li>
<li><b>Claude Desktop installeren of bijwerken.</b> Nieuwe installatie via de officiële download, of de ingebouwde updatefunctie als de app al aanwezig is.</li>
<li><b>Chrome-extensie verbinden.</b> Koppelt de browser aan de Cowork-sessie zodat browseracties kunnen worden uitgevoerd.</li>
</ol>

### Stap 2 in detail — VirtualMachinePlatform inschakelen

Voer in de elevated PowerShell-sessie uit:

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart
```

Verwacht resultaat: de output toont `RestartNeeded: False` of `True` — de feature wordt in beide gevallen ingeschakeld. Controleer de status na activatie:

```powershell
Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform
```

Verwacht resultaat: `State : Enabled`. Herstart de machine na activatie — ook al meldt `-NoRestart` geen fout, WSL2 en de Cowork-omgeving vereisen een herstart:

```powershell
Restart-Computer
```

<div class="call warn"><div class="ct"><span>&#9670;</span> Feature blijft uit of het commando faalt</div><p>Controleer eerst of PowerShell echt als administrator is gestart. Lukt het via <code>Enable-WindowsOptionalFeature</code> nog niet, gebruik dan: <code>dism /online /enable-feature /featurename:VirtualMachinePlatform /all</code>.</p></div>

### Stap 3 in detail — Claude Desktop installeren of bijwerken

Download de installer via <a href="https://claude.ai/download">claude.ai/download</a> en voer hem uit als administrator. Claude Desktop installeert in `%LOCALAPPDATA%\AnthropicClaude\`.

Staat Claude Desktop er al, gebruik dan de ingebouwde update: open Claude Desktop, klik linksboven op het Claude-menu en kies "Check for Updates".

Verwacht resultaat: Claude Desktop start op en toont de meest recente versie.

<div class="call warn"><div class="ct"><span>&#9670;</span> Installatie of update lukt niet</div><p>Verwijder de bestaande installatie via Instellingen &gt; Apps, herstart de machine en installeer opnieuw.</p></div>

### Stap 4 in detail — Chrome-extensie verbinden

Open Google Chrome en ga naar claude.ai, of open de Claude Desktop-zijbalk. Klik in de Cowork-sessie op "Verbinden" en selecteer het juiste browservenster.

Verwacht resultaat: de extensie toont de status "Verbonden" in de Cowork-interface.

<div class="call warn"><div class="ct"><span>&#9670;</span> Verbinding lukt niet</div><p>Controleer of de extensie geïnstalleerd en ingeschakeld is via <code>chrome://extensions/</code>. Herstart Chrome indien nodig.</p></div>

## Verificatie

- VirtualMachinePlatform toont `State : Enabled`
- Claude Desktop start zonder fouten
- Chrome-extensie toont status "Verbonden"
- Cowork kan een browseractie uitvoeren (bijvoorbeeld een tab openen)

## Troubleshooting

| Symptoom | Oorzaak | Oplossing |
|---|---|---|
| `Enable-WindowsOptionalFeature` geeft een fout | Sessie niet elevated, of Group Policy blokkeert | Start PowerShell als administrator. Controleer GP via `gpedit.msc` > Computer Configuration > Administrative Templates |
| Status blijft `Disabled` na herstart | Windows-licentie of -editie ondersteunt de feature niet | Controleer de editie via `winver`. Home ondersteunt Hyper-V niet volledig — gebruik DISM als alternatief |
| Claude Desktop start niet | Corrupte installatie of ontbrekende runtime | Verwijder via Apps & Onderdelen, verwijder `%LOCALAPPDATA%\AnthropicClaude\` en herinstalleer |
| Chrome-extensie niet zichtbaar | Extensie niet geïnstalleerd of uitgeschakeld | Ga naar `chrome://extensions/` en schakel de Claude-extensie in |
| Verbinding mislukt in Cowork | Browser niet geselecteerd, of meerdere instanties open | Sluit overtollige Chrome-vensters. Gebruik `list_connected_browsers` in de sessie om te verifiëren |

## Rollback

VirtualMachinePlatform uitschakelen is zelden nodig, maar kan via:

```powershell
Disable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart
```

Claude Desktop verwijderen: Instellingen > Apps > zoek op "Claude" > Verwijderen, en verwijder eventuele restanten in `%LOCALAPPDATA%\AnthropicClaude\`.
