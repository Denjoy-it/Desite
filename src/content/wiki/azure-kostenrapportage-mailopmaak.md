---
title: "Azure Kostenrapportage: ontwerpgeschiedenis van de mailopmaak"
description: "Van v1.11 naar v1.17 van Runbook-AzureKostenRapportage.ps1 bij Landschappen: een matching-bug die historie liet verdwijnen, vier iteraties van de mailopmaak, een ruisfilter tegen centen-niveau afwijkingen, en een UTF-8-fix voor het eurosymbool in de onderwerpregel."
category: "Azure"
order: 5
clients: ["landschappen"]
---

Dit artikel bouwt voort op [Azure Kostenrapportage: inrichtingssjabloon voor een nieuwe klant](/wiki/azure-kostenrapportage-sjabloon/) (de architectuur met de Service Principal) en documenteert de ontwerpgeschiedenis van de mailopmaak zelf: welke problemen elke versie oploste, en welke keuzes bij een volgende klant-inrichting terugkomen.

## Het matching-probleem: naam versus SubscriptionId

Tot en met v1.14 toonde de mail een trend: de kosten van de gerapporteerde maand naast die van de twee voorgaande maanden. Om dat te bouwen moest het runbook kostendata uit verschillende periodes aan elkaar koppelen — en dat gebeurde op **Klant + Subscription-naam**.

Bij Landschappen bleek dat een probleem. De trendtabel toonde voor een van de grootste subscriptions consequent "€ 0,00" in de voorgaande maanden, terwijl de huidige maand een reëel, hoog bedrag toonde. Het bleek de koppeling: als een subscription tussentijds hernoemd wordt — na een migratie, of omdat een andere partij het beheer overneemt — staat de historie nog onder de oude naam en de actuele data onder de nieuwe. Beide datasets bevatten dezelfde kosten, maar de matching op naam zag ze als twee verschillende subscriptions. Erger nog: de afwijkingendetectie meldde de oude naam als **verdwenen** en de nieuwe naam als **nieuw** — twee valse meldingen voor een subscription die gewoon is blijven bestaan.

<div class="call warn"><div class="ct"><span>&#9670;</span> Twee situaties die op elkaar lijken, maar niet hetzelfde zijn</div><p>"€ 0,00 in de historie" kan twee dingen betekenen: een subscription die werkelijk nog geen kosten had, of een matching die faalt door een naamswijziging. Zonder onderscheid daartussen is elke lege kolom verdacht, ook de terechte.</p></div>

De oplossing: elke koppeling tussen periodes gebeurt sindsdien op **SubscriptionId** (een GUID die nooit verandert), met de naam als los weergavegegeven dat wordt ververst naar de meest recente bron (ADR-0006, zie Besluiten).

<div class="call info"><div class="ct"><span>&#9670;</span> Wat dit niet oplost</div><p>Is de historie werkelijk leeg - een nieuwe of net overgenomen omgeving - dan blijft "€ 0,00" gewoon staan, en terecht. Het runbook logt sinds v1.8 per subscription expliciet welke maanden daadwerkelijk kostendata opleverden; die joblog-regel is het verschil tussen gokken en weten welk van de twee gevallen je voor je hebt.</p></div>

## Vier ontwerpiteraties van de mailopmaak

De mailopmaak veranderde vier keer op rij, en niet toevallig: elke versie loste een concreet probleem van de vorige op.

| Versie | Vorm | Wat er misging (of wat de klant wilde) |
|---|---|---|
| v1.11 en eerder | Body met totaal + 3-maands trend, volledig HTML-rapport als bijlage bij afwijkingen | De bijlage was overbodig zodra alle detail ook in de body kon; niemand opende hem apart |
| v1.12 | Bijlage weg, trend blijft in de body | Werkte, maar gaf geen verhaal bij de cijfers — alleen een tabel |
| v1.13 | Trend + automatische samenvattende zin + MoM-vergelijking + aparte sectie voor RI/Savings Plan-afwijkingen + per subscription een vlag met ingesprongen detailregels | In de praktijk te druk: bij veel losse netwerk-/beveiligingsservices verdronk de mail in kleine, laag-relevante regels |
| v1.14 | Zelfde als v1.13, maar zonder vlag/detailregels: platte tabel + trendkolommen + ondergrens in EUR voor afwijkingen | Beter leesbaar, maar de klant wilde uiteindelijk geen trend of afwijkingen — puur de kosten |
| **v1.15 (huidig)** | Totaal + tabel met kosten per subscription van de gerapporteerde maand. Geen trend, geen percentages, geen samenvattende zin | Dit is wat er nu staat: minimaal, op expliciet verzoek |

Wat in elke versie **niet** veranderde: de QUBE-huisstijl (wit, oranje accent `#ee7214`, navy `#03295a`), en dat bedragen altijd in nl-NL-notatie met een echt eurosymbool worden getoond in plaats van de letters "EUR".

## De ruisfilter: waarom een %-drempel niet genoeg is

Een les uit v1.13/v1.14, uit de periode toen het runbook nog afwijkingen detecteerde (in v1.15 is die detectie er op klantverzoek helemaal uit — maar zodra een volgende klant wel een trend/afwijkingenweergave wil, is dit precies het probleem dat opnieuw opduikt).

De afwijkingendetectie vergeleek de kosten van een service in de gerapporteerde maand met het gemiddelde van de voorgaande maanden, en meldde het verschil zodra dat een ingestelde procentuele drempel overschreed (bijvoorbeeld 20%). Dat werkte goed voor echte kostenposten, maar niet voor de kleine, vrijwel gratis netwerk-/beveiligingsservices die Azure standaard meelevert: NAT Gateway, Load Balancer, Bandwidth. Die hebben elke maand een fractie van een cent aan afronding of proratie.

<div class="call warn"><div class="ct"><span>&#9670;</span> Een %-drempel zonder ondergrens is geen filter</div><p>Een sprong van € 0,004 naar € 0,001 is procentueel -75%. Dat haalt elke zinnige drempel, terwijl het bedrag in de mail gewoon als "€ 0,00" verschijnt. Het resultaat: tientallen betekenisloze meldingen naast de paar die er echt toe doen, wat de echte signalen juist minder opvallen.</p></div>

De les: een percentage-drempel voor kostenafwijkingen heeft altijd een **absolute ondergrens in euro's** nodig, los van het percentage. Een sprong telt alleen mee als minstens een van de twee bedragen (huidig of gemiddeld) boven die ondergrens ligt — bijvoorbeeld € 5. Dat filtert precies de centen-ruis weg zonder een echte stijging van € 2.380 naar € 6.120 te missen.

<ol class="phases"><li>Bereken het percentage zoals altijd.</li><li>Voordat je het meldt: is het huidige bedrag óf het gemiddelde hoger dan de ondergrens?</li><li>Alleen als dat zo is, telt de afwijking mee. Anders: negeren, ook al is het percentage indrukwekkend.</li></ol>

## Rijke of minimale rapportvorm kiezen

Er is geen QUBE-brede standaard die voorschrijft welke vorm een kostenrapportage moet hebben. Beide varianten zijn geldig; welke je kiest hangt af van wie de mail leest en wat diegene ermee doet.

<div class="call info"><div class="ct"><span>&#9670;</span> Rijke vorm (trend + afwijkingen)</div><p>Een 3-maands trend per subscription, een automatisch gegenereerde samenvattende zin, een aparte sectie voor RI/Savings Plan-afwijkingen, en een ondergrens in euro's naast de procentuele drempel. Geschikt voor een ontvanger die maandelijks wil weten <b>wat er veranderd is</b>, en bereid is een iets langere mail te lezen.</p></div>

<div class="call caution"><div class="ct"><span>&#9670;</span> Minimale vorm (huidig, sinds v1.15)</div><p>Totale kosten + een tabel met kosten per subscription van de gerapporteerde maand. Geen trend, geen percentages, geen verhaal. Geschikt voor een ontvanger die simpelweg <b>het bedrag</b> wil zien, zonder analyse erbovenop.</p></div>

Beide vormen bestaan al in de versiegeschiedenis van dit script: v1.14 is de meest complete implementatie van de rijke vorm (inclusief de ruisfilter-fix), v1.15 is de minimale vorm. Een volgende klant-inrichting kiest een van beide als uitgangspunt in plaats van opnieuw te ontwerpen.

## Efficiëntiewinst: van twee naar een aanroep per subscription

Zolang het runbook een trend toonde, deed het per subscription **twee** Cost Management-aanroepen: een voor de resource-niveau data van de gerapporteerde maand, en een tweede voor de maandaggregatie over de voorgaande 2-3 maanden. Zodra de trend uit de mail verdween (v1.15), verdween ook de noodzaak voor die tweede aanroep.

<div class="call info"><div class="ct"><span>&#9670;</span> Waarom dit meer is dan alleen sneller</div><p>De Cost Management Query API hanteert een tenant-brede quota (queries per 10 seconden/minuut/uur), niet per subscription. Bij een tenant met veel subscriptions kon de tweede aanroep per subscription die quota laten overlopen, met throttling (HTTP 429) tot gevolg. Door de aanroep te schrappen in plaats van hem beter te laten falen, verdwijnt een deel van dat risico structureel. Kiest een volgende klant voor de rijke vorm met trend, dan komt deze tweede aanroep - en dit aandachtspunt - automatisch terug.</p></div>

## Valkuilen: 403 op sendMail en een kapotte onderwerpregel

<div class="call ok"><div class="ct"><span>&#9670;</span> Opgelost tijdens het testen: 403 (Forbidden) op sendMail</div><p>Bij de eerste testrun kwam consequent een 403 terug op de Graph <code>sendMail</code>-aanroep. De oorzaak: <code>Mail.Send</code> was nog niet (of niet succesvol) toegekend aan de identity die de mail verstuurt - een Managed Identity heeft geen "API permissions"-scherm in de portal, dus die toekenning moet via PowerShell, een stap die makkelijk wordt overgeslagen. <code>Get-GraphToken</code> gebruikt sinds v1.16 een Service Principal (<code>Connect-AzAccount -ServicePrincipal</code>), niet meer de Managed Identity.</p></div>

Diagnose, van snel naar grondig:

<ol class="phases"><li>Bevestig dat de identity daadwerkelijk <code>Mail.Send</code> heeft: <code>Get-MgServicePrincipalAppRoleAssignment -ServicePrincipalId '&lt;ObjectId&gt;' | Select AppRoleId, ResourceDisplayName</code> - moet een regel tonen met <code>ResourceDisplayName: Microsoft Graph</code>.</li><li>Test of de identity specifiek de afzendmailbox mag gebruiken: <code>Test-ApplicationAccessPolicy -AppId '&lt;AppId&gt;' -Identity '&lt;afzenderadres&gt;'</code> - geeft direct <code>Granted</code> of <code>Denied</code> terug.</li><li>Geen policy geconfigureerd? <code>Get-ApplicationAccessPolicy</code> gooit dan een cryptische "object couldn't be found"-fout in plaats van een lege lijst - dat is normaal gedrag bij nul policy's, geen apart probleem.</li><li>Sluit een typefout in het afzenderadres uit: een mailbox die niet bestaat geeft ook een 403 i.p.v. een duidelijkere 404.</li></ol>

<div class="call ok"><div class="ct"><span>&#9670;</span> Opgelost tijdens het testen: onderwerpregel toonde "?" i.p.v. het eurosymbool</div><p>Nadat de 403 was opgelost, kwam de eerste echte testmail door, maar met "? 452,98" in het onderwerp in plaats van "€ 452,98". De HTML-body toonde het bedrag wel correct. Oorzaak: de HTML-body gebruikt de HTML-entity <code>&amp;#8364;</code> voor het eurosymbool (pure ASCII-tekst), maar de onderwerpregel gebruikt het letterlijke teken. <code>Send-GraphMail</code> gaf de JSON-body als kale <code>[string]</code> mee aan <code>Invoke-RestMethod</code>, met alleen <code>Content-Type</code> in de Headers-hashtable - de omzetting naar bytes-op-de-lijn is dan niet betrouwbaar UTF-8, waardoor het multi-byte eurosymbool corrumpeerde. Fix (v1.17): de JSON wordt expliciet met <code>[System.Text.Encoding]::UTF8.GetBytes()</code> naar bytes omgezet, met het charset expliciet in <code>-ContentType</code>.</p></div>

## Besluiten

| ADR | Besluit | Status |
|---|---|---|
| **ADR-0006 — SubscriptionId als matching-sleutel** | Elke matching van kostendata tussen periodes (huidige maand tegen historie, of service-niveau vergelijking) gebeurt op SubscriptionId, nooit op naam — een subscriptienaam kan wijzigen, de GUID niet. | <span class="badge b-ok">Accepted</span> |

De Service Principal-architectuur voor mail en kostendata (ADR-0004, ingehaald door ADR-0005) staat beschreven in [Azure Kostenrapportage: inrichtingssjabloon voor een nieuwe klant](/wiki/azure-kostenrapportage-sjabloon/).
