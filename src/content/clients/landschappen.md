---
title: "Stichting Landschap Noord-Holland"
description: "Landschapsbeheerder, gebruikt Azure + Microsoft 365 via Axians-subscription; CMSi- en Workbase-omgeving."
order: 1
facts:
  - label: "Subscription"
    value: "Landschappen 365 - Axians Azure Subscription"
    mono: true
  - label: "Belangrijkste omgevingen"
    value: "CMSi (weu-p1-cmsi), Workbase"
  - label: "Entra-beheerder"
    value: "aazlnh@landschappen.nl"
    mono: true
  - label: "Contactpersoon"
    value: "Dimitri (keurt wijzigingen goed)"
gatePassphraseHash: "3ff7aef09223fec0a04b07b549e00842c99ee6a8d6791640dae7509dbb145f15" # "boomkikker-nh-26"
---

## Omgeving

Landschappen draait workloads in Azure onder de subscription **Landschappen 365 -
Axians Azure Subscription**. De belangrijkste resourcegroepen:

| Resourcegroup | Omgeving |
| --- | --- |
| `weu-p1-cmsi` | CMSi-applicatieservers (o.a. `weup1cmsivm01`, `weup1cmsivm02`) |
| `WEU-P1-CMSI-01` | CMSi-01 |
| `WEU-P1-WORKBASE` | Workbase |
| `weu-p1-bck-01` | Backup - Recovery Services vault `weup1bck01rsv01` |

De Azure SQL Managed Instances (`weup1cmsisql01lnh`, `weup1cmsisql02lnh`) draaien
in resourcegroep `weu-p1-cmsi`, met `aazlnh@landschappen.nl` als Microsoft
Entra-beheerder.

## Contactpersonen

- **Dimitri** - keurt wijzigingen aan het Intune-beleid en vergelijkbare
  aanpassingen goed.

## Bijzonderheden

<div class="call info"><div class="ct"><span>&#9670;</span> Externe partijen met toegang</div><p>IDOX beheert een applicatie voor Landschappen en heeft daarvoor beheerderstoegang tot de Azure SQL-database nodig. Zie de gerelateerde wiki-pagina over IDOX-toegang hieronder voor de volledige procedure.</p></div>
