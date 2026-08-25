---
title: "Brouwershoff"
description: "SharePoint Online-tenant met 44 sites; versiegeschiedenisbeheer ingericht na een tenant-brede opschoonscan."
order: 4
facts:
  - label: "Tenant"
    value: "brouwershoff.sharepoint.com"
    mono: true
  - label: "Admin-URL"
    value: "brouwershoff-admin.sharepoint.com"
    mono: true
  - label: "Sites"
    value: "44"
gatePassphraseHash: "078b7cc22f06f7c2e77290408827e9ff36b14799bc59165688ab9c7dd744ce41" # "zeilboot-sp-26"
---

## Omgeving

Brouwershoff draait SharePoint Online met 44 sites, in totaal 2.632 GB opslag. Een tenant-brede scan bracht de versiegeschiedenis in kaart: 385 GB (14,6% van de totale opslag), waarvan 384,7 GB alleen al op de hoofdsite (`brouwershoff.sharepoint.com/`).

## Bijzonderheden

<div class="call caution"><div class="ct"><span>&#9670;</span> Hoofdsite als aandachtspunt</div><p>De hoofdsite bevat verreweg de meeste versie-opslag van de tenant, maar haalt net niet de standaard-signaleringsdrempel (14,7% tegen een drempel van 15%). Zie de wiki-pagina over SharePoint versiegeschiedenis hieronder voor het volledige advies en de gebruikte scripts.</p></div>
