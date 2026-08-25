---
title: "NUNC Capital / COBBS Industries"
description: "Gedeelde AVD-omgeving voor Exact Globe en Elvy DS, on-prem AD-domein COBBSINDUSTRIES."
order: 2
facts:
  - label: "Omgeving"
    value: "Gedeelde Azure Virtual Desktop (AVD)"
  - label: "On-prem AD-domein"
    value: "COBBSINDUSTRIES (AD.cobbsindustries.com)"
    mono: true
  - label: "Sessionhost"
    value: "SRV-NUN-AVD-1"
    mono: true
  - label: "Contactpersoon"
    value: "Steven Rooijers (NUNC Capital)"
gatePassphraseHash: "7d1d597505e2df83e9515b7247dbe6e02e49768e54770fba0b44dc25539a560a" # "cobalt-staal-26"
---

## Omgeving

NUNC Capital B.V. en COBBS Industries B.V. delen een Azure Virtual Desktop
(AVD)-omgeving. Medewerkers werken er in **Exact Globe** en **Elvy DS**, met
bestanden die automatisch synchen naar OneDrive zolang de sessie ingelogd
blijft.

De sessionhost (`SRV-NUN-AVD-1`) is domain-joined aan het on-prem
AD-domein **COBBSINDUSTRIES**, met FSLogix profile containers voor
profielbeheer.

## Contactpersonen

- **Steven Rooijers** (NUNC Capital) - meldt issues rond de AVD-omgeving.

## Bijzonderheden

<div class="call caution"><div class="ct"><span>&#9670;</span> Let op de servernaam</div><p>Communiceer altijd de <b>Azure-resourcenaam</b> van de VM, niet een oude on-prem naam - die bestaat niet in de portal.</p></div>
