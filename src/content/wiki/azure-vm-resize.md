---
title: "Azure VM Resize: vier VM's naar een nieuwe size"
description: "Vier Azure-VM's van size wijzigen volgens Microsoft best practices - vooraf controleren, dealloceren, resizen en valideren, met een backup-vangnet vooraf - waarbij twee VM's vastliepen omdat de doelsize D2s_v6 alleen op Gen2-hardware draait."
category: "Azure"
order: 2
clients: ["landschappen"]
---

## Opdracht

Stichting Landschap Noord-Holland wil vier Azure-VM's naar een nieuwere, goedkopere VM-serie. Uitdrukkelijk **niet** naar de v7-serie: die is 20% duurder dan de v6-serie die we hier gebruiken.

| Server | Resource group | Van | Naar |
|---|---|---|---|
| weup1cmsivm01 | weu-p1-cmsi | D2s_v3 | D2s_v6 |
| weup1cmsivm02 | weu-p1-cmsi | D2s_v3 | D2s_v6 |
| weup1cmsi01vm01 | WEU-P1-CMSI-01 | B2ms | B2as_v2 |
| weup1workbasevm01 | WEU-P1-WORKBASE | B2s | B2ls_v2 |

Subscription: Landschappen 365 - Axians Azure Subscription.

<div class="call warn"><div class="ct"><span>&#9670;</span> Twee van de vier liepen vast</div><p>Tijdens de uitvoering bleek dat weup1cmsivm01, en vermoedelijk ook weup1cmsivm02, niet zomaar naar D2s_v6 kunnen. Zie het hoofdstuk "Bevinding: Gen1 blokkeert D2s_v6".</p></div>

## De methode

Een Azure-VM draait op een specifiek stuk hardware: een "cluster". Wil je een grotere of nieuwere size, dan moet dat cluster die size ook aanbieden. Staat de VM alleen "Stopped", dan blijft hij op hetzelfde cluster en is de keuze beperkt tot wat daar staat. **Dealloceren** maakt de VM los van dat cluster; bij het opnieuw starten of resizen mag Azure daarna elk cluster in de regio kiezen dat de nieuwe size wel heeft.

<ol class="phases"><li>Sluit de VM netjes af vanuit het besturingssysteem zelf, voor een consistente schijfstatus.</li><li>Dealloceer de VM in Azure. Dit is iets anders dan alleen stoppen.</li><li>Wijzig de size.</li><li>Start de VM weer.</li></ol>

<div class="call caution"><div class="ct"><span>&#9670;</span> Temp disk</div><p>Bij deallocatie gaat de inhoud van de tijdelijke schijf (meestal D:\ op Windows) verloren. Controleer of daar iets op staat dat je nodig hebt, voor je dealloceert.</p></div>

## Vooraf-controles

Vier dingen checken we altijd voor we een wijzigingsvenster plannen.

| # | Check | Commando |
|---|---|---|
| 1 | Staat de doelsize op het huidige cluster? | `az vm list-vm-resize-options --resource-group <rg> --name <vm> -o table` |
| 2 | Bestaat de SKU überhaupt in de regio, los van deze VM? | `az vm list-skus --location westeurope --size <size> --all --output table` |
| 3 | Welke generatie (Gen1/Gen2) draait de VM? | `az vm get-instance-view --resource-group <rg> --name <vm> --query "instanceView.hyperVGeneration" -o tsv` |
| 4 | Is er voldoende vCPU-quota voor de nieuwe familie? | Portal: Subscriptions -> Usage + quotas |

<div class="call info"><div class="ct"><span>&#9670;</span> Waarom check 2 los van check 1</div><p>Check 1 toont alleen wat past op het huidige cluster. Staat de doelsize er niet tussen, dan weet je nog niet of dat komt door het cluster of doordat de SKU nergens in de regio bestaat. Check 2 beantwoordt dat apart.</p></div>

## Backup-vangnet

Alle 4 doel-VM's zitten al in de Recovery Services vault **weup1bck01rsv01** (resource group `weu-p1-bck-01`). Voor we ook maar een VM dealloceren, triggeren we een on-demand backup, los van het reguliere schema.

```bash
az backup protection backup-now --resource-group weu-p1-bck-01 --vault-name weup1bck01rsv01 --container-name <vm> --item-name <vm> --backup-management-type AzureIaasVM --retain-until 31-08-2026
```

| Server | Backup-job | Status bij laatste check |
|---|---|---|
| weup1cmsivm01 | d27517ad-216f-4e41-a98b-8134b53251af | InProgress |
| weup1cmsivm02 | 8c621659-add8-4464-bab2-735732b9fe29 | InProgress |
| weup1cmsi01vm01 | 01da353a-6def-44f0-959c-0eb12992a1ab | InProgress |
| weup1workbasevm01 | fd12583c-096c-45ac-981c-b537f05ce940 | InProgress |

<div class="call caution"><div class="ct"><span>&#9670;</span> Wacht op Completed</div><p>Ga pas verder met dealloceren voor een VM zodra de bijbehorende backup-job op <code>Completed</code> staat. Check met <code>az backup job show ... --query "properties.status"</code>.</p></div>

## Bevinding: Gen1 blokkeert D2s_v6

Elke Azure-VM draait op een "generatie": Gen1 of Gen2. Dat is de manier waarop de virtuele hardware opstart, niet het besturingssysteem. Gen1 gebruikt de oude schijfindeling MBR; Gen2 gebruikt GPT met een aparte opstartpartitie. Nieuwe VM-series draaien vaak alleen op Gen2. D2s_v6 is zo'n serie.

weup1cmsivm01 bleek Gen1:

```powershell
Get-AzVM -ResourceGroupName "weu-p1-cmsi" -Name "weup1cmsivm01" -Status | Select-Object HyperVGeneration
```

Uitkomst: `V1`. D2s_v6 stond daardoor niet in de resize-lijst, ook niet na dealloceren. Een losse check bevestigde dat de SKU zelf gewoon bestaat in West Europe:

```bash
az vm list-skus --location westeurope --size Standard_D2s_v6 --all --output table
```

Resultaat: `Restrictions: None`, beschikbaar in zones 1, 2 en 3. De regio is dus geen probleem. De generatie van de VM wel.

<div class="call caution"><div class="ct"><span>&#9670;</span> Onomkeerbaar</div><p>De enige door Microsoft ondersteunde weg van Gen1 naar Gen2 is een upgrade naar "Trusted Launch". Eenmaal geupgraded kan een VM niet terug naar Gen1; herstel kan dan alleen via een backup van voor de upgrade.</p></div>

Drie opties, met wat elke optie kost en oplevert:

| Optie | Wat het betekent | Impact |
|---|---|---|
| 1. Trusted Launch-upgrade | MBR naar GPT, dan Trusted Launch aan, dan pas resizen naar D2s_v6 | Hoog: onomkeerbaar, vereist Enhanced backup-policy, geen BitLocker tijdens de conversie |
| 2. D2s_v5 in plaats van v6 | Werkt op Gen1, geen conversie nodig | Middel: wijkt af van de opdracht, terugkoppelen naar de opdrachtgever |
| 3. Nieuwe Gen2-VM | Nieuwe VM, workload verhuizen, oude uitfaseren | Meeste werk en langste onderhoudsvenster, meest toekomstvast |

<div class="call info"><div class="ct"><span>&#9670;</span> Status op moment van schrijven</div><p>weup1cmsivm01 en weup1cmsivm02 staan nog op hun oorspronkelijke size. Er is nog geen keuze gemaakt tussen de drie opties; die keuze ligt bij de opdrachtgever. Voer niets uit dit hoofdstuk uit voor die keuze er is.</p></div>

## De drie opties, stap voor stap

Alle drie de opties uitgewerkt: wat elke stap doet, hoe het in de Azure portal gaat, en de commando's in PowerShell en Azure CLI.

### Optie 1: Trusted Launch-upgrade

De enige door Microsoft ondersteunde weg van Gen1 naar Gen2.

<div class="call caution"><div class="ct"><span>&#9670;</span> Onomkeerbaar - lees dit eerst</div><p>Eenmaal Trusted Launch, geen weg terug naar Gen1. Herstel kan dan alleen via de backup of het restorepoint van voor de upgrade. Test deze procedure eerst op een niet-kritieke VM.</p></div>

**Vooraf checken**

| Vereiste | Check |
|---|---|
| OS-versie ondersteund (niet Server 2016, Debian, Azure Linux) | in-guest: `(Get-ComputerInfo).WindowsProductName` |
| Backup-policy op Enhanced, niet Standard | zie hieronder |
| Geen BitLocker op de C-schijf | in-guest: `manage-bde -status C:` |

Backup-policy checken:

```bash
az backup item show --resource-group weu-p1-bck-01 --vault-name weup1bck01rsv01 --container-name weup1cmsivm01 --name weup1cmsivm01 --backup-management-type AzureIaasVM --query "{policy:properties.policyName}" -o table

az backup policy show --resource-group weu-p1-bck-01 --vault-name weup1bck01rsv01 --name <policyName-uit-vorige-commando> --query "properties.policyType" -o tsv
```

Staat de uitkomst op `V1`, dan is dat Standard. Migreer dan eerst naar Enhanced (Microsoft Learn: "Migrate Azure VM backups from Standard to Enhanced policy") voor je verdergaat.

**Stap A - schijfindeling omzetten, terwijl de VM nog draait**

Dit gebeurt in-guest, dus voor je dealloceert.

<ol class="phases"><li>Verbind via RDP met de VM.</li><li>Valideer: <code>MBR2GPT /validate /allowFullOS</code>. Gaat dit niet goed, stop en los dat eerst op.</li><li>Voer uit: <code>MBR2GPT /convert /allowFullOS</code>.</li></ol>

**Stap B - Trusted Launch inschakelen**

<div class="call info"><div class="ct"><span>&#9670;</span> Azure portal</div><ol class="phases"><li>Open de VM in de Azure portal.</li><li>Controleer op <b>Overview</b> dat de VM-generatie <b>V1</b> is en de status <b>Running</b>.</li><li>Ga naar <b>Configuration</b>, zet <b>Security type</b> naar het dropdown-menu.</li><li>Kies <b>Trusted launch</b>. Bevestig dat de Guest OS Volume-update (stap A) is gedaan.</li><li>Vink <b>Secure Boot</b> en <b>vTPM</b> aan, klik <b>Save</b>.</li><li>De portal vraagt om te dealloceren om de upgrade af te ronden: bevestig met <b>Yes</b>.</li><li>Controleer op <b>Overview</b> dat <b>Security type</b> nu Trusted launch toont.</li><li>Start de VM, verifieer dat RDP werkt.</li></ol></div>

<div class="call info"><div class="ct"><span>&#9670;</span> PowerShell / Azure CLI</div><p>PowerShell:</p><pre><code>Connect-AzAccount -SubscriptionId 21d5c384-78de-438f-9f55-efabd2f99947
Stop-AzVM -ResourceGroupName "weu-p1-cmsi" -Name "weup1cmsivm01"

Get-AzVM -ResourceGroupName "weu-p1-cmsi" -VMName "weup1cmsivm01" | Update-AzVM -SecurityType TrustedLaunch -EnableSecureBoot $true -EnableVtpm $true

Start-AzVM -ResourceGroupName "weu-p1-cmsi" -Name "weup1cmsivm01"</code></pre><p>Azure CLI:</p><pre><code>az login
az account set --subscription 21d5c384-78de-438f-9f55-efabd2f99947

az vm deallocate --resource-group weu-p1-cmsi --name weup1cmsivm01
az vm update --resource-group weu-p1-cmsi --name weup1cmsivm01 --security-type TrustedLaunch --enable-secure-boot true --enable-vtpm true
az vm start --resource-group weu-p1-cmsi --name weup1cmsivm01</code></pre></div>

Controleer de output van `az vm update` of van de PowerShell-validatie: er moet een `securityProfile`-blok in staan met `"securityType": "TrustedLaunch"`.

**Stap C - de resize zelf**

Nu de VM Gen2 (Trusted Launch) is, volgt de gewone resize naar D2s_v6 uit het hoofdstuk "Uitvoering per VM" hieronder.

<div class="call caution"><div class="ct"><span>&#9670;</span> Bekende valkuilen</div><ul><li><b>MBR2GPT faalt met "Cannot find room for the EFI system partition"</b>: geen vrije ruimte op het systeemvolume, of het volume heeft al 4 MBR-partities.</li><li><b>D-schijfletter verspringt na de upgrade</b>: tijdelijke opslag krijgt soms letter E in plaats van D, met de oude D toegewezen aan "System Reserved". Herconfigureer het pagefile naar C:, herstart, verwijder letter D van de system-reserved-partitie, herstart nogmaals.</li></ul></div>

### Optie 2: D2s_v5 in plaats van D2s_v6

Wijkt af van de opdracht (v6 was gevraagd; v5 is een verdere afwijking). Alleen doorvoeren na akkoord van de opdrachtgever. D2s_v5 ondersteunt wel Gen1: geen conversie nodig.

<div class="call info"><div class="ct"><span>&#9670;</span> Azure portal</div><ol class="phases"><li>Open de VM, ga naar <b>Settings > Size</b>.</li><li>Zoek <code>D2s_v5</code> in de lijst.</li><li>Staat de size in de lijst: selecteer 'm en klik <b>Resize</b>.</li><li>Staat de size niet in de lijst: stop eerst de VM via <b>Overview > Stop</b> (dit dealloceert 'm), ga terug naar <b>Size</b> en probeer opnieuw.</li><li>Start de VM na de resize als dat niet automatisch gebeurt.</li></ol></div>

<div class="call info"><div class="ct"><span>&#9670;</span> PowerShell / Azure CLI</div><p>PowerShell:</p><pre><code>Stop-AzVM -ResourceGroupName "weu-p1-cmsi" -Name "weup1cmsivm01" -Force

$vm = Get-AzVM -ResourceGroupName "weu-p1-cmsi" -Name "weup1cmsivm01"
$vm.HardwareProfile.VmSize = "Standard_D2s_v5"
Update-AzVM -ResourceGroupName "weu-p1-cmsi" -VM $vm

Start-AzVM -ResourceGroupName "weu-p1-cmsi" -Name "weup1cmsivm01"</code></pre><p>Azure CLI:</p><pre><code>az vm deallocate --resource-group weu-p1-cmsi --name weup1cmsivm01
az vm resize --resource-group weu-p1-cmsi --name weup1cmsivm01 --size Standard_D2s_v5
az vm start --resource-group weu-p1-cmsi --name weup1cmsivm01</code></pre></div>

Zelfde blokken voor weup1cmsivm02, met de eigen VM-naam.

### Optie 3: Nieuwe Gen2-VM uitrollen

Meeste werk, langste onderhoudsvenster, meest toekomstvast. Dit is een sjabloon op hoofdlijnen: de precieze stappen voor de CMSI-applicatie zelf (installatie, configuratie, data) zijn nog niet uitgezocht en vragen een aparte intake voor dit wordt ingepland.

<ol class="phases"><li>Nieuwe VM aanmaken met een Gen2-image en de gewenste size (Standard_D2s_v6).</li><li>Netwerkconfiguratie overnemen: zelfde VNet/subnet, en indien nodig hetzelfde priv-IP.</li><li>Applicatie en data migreren of herinstalleren op de nieuwe VM.</li><li>Testen op de nieuwe VM voor je omschakelt.</li><li>Oude VM afsluiten en pas na een observatieperiode verwijderen.</li></ol>

Beschikbare Gen2-images opzoeken:

```powershell
Get-AzVMImageSku -Location westeurope -PublisherName MicrosoftWindowsServer -Offer WindowsServer
```

```bash
az vm image list --publisher MicrosoftWindowsServer --offer WindowsServer --sku "*gensecond*" --all --output table
```

<div class="call info"><div class="ct"><span>&#9670;</span> Welke image?</div><p>Zoek de SKU die bij de huidige Windows-versie van weup1cmsivm01 hoort, met een Gen2-variant (naam eindigt vaak op <code>-g2</code> of <code>-gensecond</code>). Welke Windows-versie er precies op weup1cmsivm01 draait, is nog niet vastgesteld; check dit eerst in-guest voor je een image kiest.</p></div>

<div class="call info"><div class="ct"><span>&#9670;</span> Azure portal</div><ol class="phases"><li><b>Virtual machines > Create > Virtual machine</b>.</li><li>Kies resource group, naam, regio (West Europe, zelfde als de huidige VM's).</li><li>Bij <b>Image</b>: kies <b>See all images</b>, filter op <b>Image type: Gen 2</b>, selecteer de juiste Windows Server-versie.</li><li>Bij <b>Size</b>: kies Standard_D2s_v6.</li><li>Onder <b>Security type</b>: Trusted launch staat vaak al aan bij een Gen2-image; laat dit aan.</li><li>Netwerk: zelfde VNet/subnet als de huidige VM.</li><li><b>Review + Create</b>, dan <b>Create</b>.</li></ol></div>

<div class="call info"><div class="ct"><span>&#9670;</span> Azure CLI</div><pre><code>az vm create --resource-group weu-p1-cmsi --name weup1cmsivm01-new --image &lt;gen2-image-sku-uit-de-zoekopdracht-hierboven&gt; --size Standard_D2s_v6 --security-type TrustedLaunch --enable-secure-boot true --enable-vtpm true --vnet-name &lt;bestaand-vnet&gt; --subnet &lt;bestaand-subnet&gt; --admin-username &lt;gebruiker&gt;</code></pre><p>Na deployment valt de applicatie-specifieke inrichting (CMSI-installatie, data, configuratie) buiten dit runbook en moet apart worden gescoped.</p></div>

<div class="call caution"><div class="ct"><span>&#9670;</span> Aandachtspunten</div><ul><li>Een nieuwe VM krijgt een nieuw private IP tenzij je dat expliciet meegeeft; controleer of andere systemen op het huidige IP van weup1cmsivm01 leunen (DNS, firewallregels, applicatie-configuratie elders).</li><li>De oude VM niet meteen verwijderen na de overstap; houd 'm een tijd gedealloceerd achter de hand als terugvaloptie.</li></ul></div>

## Uitvoering per VM

Stap 1, de nette OS-shutdown, is voor elke VM hetzelfde: sluit af vanuit het besturingssysteem zelf (`Start > Power > Shut down`, of via RDP `shutdown /s /t 0`), voor een consistente schijfstatus. Daarna volgen per server de echte commando's, in PowerShell en Azure CLI.

<div class="call info"><div class="ct"><span>&#9670;</span> Volgorde-advies</div><p>Begin met weup1workbasevm01: kleinste impact, goede test van de procedure voor je aan de andere drie begint.</p></div>

### weup1workbasevm01 - B2s naar B2ls_v2 - rg WEU-P1-WORKBASE

```
Stop-AzVM -ResourceGroupName "WEU-P1-WORKBASE" -Name "weup1workbasevm01" -Force
az vm deallocate --resource-group WEU-P1-WORKBASE --name weup1workbasevm01

$vm = Get-AzVM -ResourceGroupName "WEU-P1-WORKBASE" -Name "weup1workbasevm01"
$vm.HardwareProfile.VmSize = "Standard_B2ls_v2"
Update-AzVM -ResourceGroupName "WEU-P1-WORKBASE" -VM $vm
az vm resize --resource-group WEU-P1-WORKBASE --name weup1workbasevm01 --size Standard_B2ls_v2

Start-AzVM -ResourceGroupName "WEU-P1-WORKBASE" -Name "weup1workbasevm01"
az vm start --resource-group WEU-P1-WORKBASE --name weup1workbasevm01
```

### weup1cmsi01vm01 - B2ms naar B2as_v2 - rg WEU-P1-CMSI-01

```
Stop-AzVM -ResourceGroupName "WEU-P1-CMSI-01" -Name "weup1cmsi01vm01" -Force
az vm deallocate --resource-group WEU-P1-CMSI-01 --name weup1cmsi01vm01

$vm = Get-AzVM -ResourceGroupName "WEU-P1-CMSI-01" -Name "weup1cmsi01vm01"
$vm.HardwareProfile.VmSize = "Standard_B2as_v2"
Update-AzVM -ResourceGroupName "WEU-P1-CMSI-01" -VM $vm
az vm resize --resource-group WEU-P1-CMSI-01 --name weup1cmsi01vm01 --size Standard_B2as_v2

Start-AzVM -ResourceGroupName "WEU-P1-CMSI-01" -Name "weup1cmsi01vm01"
az vm start --resource-group WEU-P1-CMSI-01 --name weup1cmsi01vm01
```

<div class="call caution"><div class="ct"><span>&#9670;</span> weup1cmsivm01 en weup1cmsivm02 - geblokkeerd</div><p>Voer onderstaande twee blokken pas uit na een besluit uit het hoofdstuk "Bevinding: Gen1 blokkeert D2s_v6". Ze staan hier klaar voor zodra dat besluit er is.</p></div>

### weup1cmsivm01 - D2s_v3 naar D2s_v6 - rg weu-p1-cmsi

```
Stop-AzVM -ResourceGroupName "weu-p1-cmsi" -Name "weup1cmsivm01" -Force
az vm deallocate --resource-group weu-p1-cmsi --name weup1cmsivm01

$vm = Get-AzVM -ResourceGroupName "weu-p1-cmsi" -Name "weup1cmsivm01"
$vm.HardwareProfile.VmSize = "Standard_D2s_v6"
Update-AzVM -ResourceGroupName "weu-p1-cmsi" -VM $vm
az vm resize --resource-group weu-p1-cmsi --name weup1cmsivm01 --size Standard_D2s_v6

Start-AzVM -ResourceGroupName "weu-p1-cmsi" -Name "weup1cmsivm01"
az vm start --resource-group weu-p1-cmsi --name weup1cmsivm01
```

### weup1cmsivm02 - D2s_v3 naar D2s_v6 - rg weu-p1-cmsi

```
Stop-AzVM -ResourceGroupName "weu-p1-cmsi" -Name "weup1cmsivm02" -Force
az vm deallocate --resource-group weu-p1-cmsi --name weup1cmsivm02

$vm = Get-AzVM -ResourceGroupName "weu-p1-cmsi" -Name "weup1cmsivm02"
$vm.HardwareProfile.VmSize = "Standard_D2s_v6"
Update-AzVM -ResourceGroupName "weu-p1-cmsi" -VM $vm
az vm resize --resource-group weu-p1-cmsi --name weup1cmsivm02 --size Standard_D2s_v6

Start-AzVM -ResourceGroupName "weu-p1-cmsi" -Name "weup1cmsivm02"
az vm start --resource-group weu-p1-cmsi --name weup1cmsivm02
```

<div class="call caution"><div class="ct"><span>&#9670;</span> Als "Size wijzigen" faalt</div><p>Faalt de resize met een melding dat de size niet beschikbaar is? Dan is de deallocatie niet correct doorgekomen, of de size is in deze regio/zone niet beschikbaar. Controleer opnieuw de checks uit "Vooraf-controles".</p></div>

## Validatie en rollback

<ol class="phases"><li>Status: VM op "Running", nieuwe size zichtbaar in <code>az vm show</code>.</li><li>Connectiviteit: RDP werkt.</li><li>Netwerk: IP-adres ongewijzigd, Accelerated Networking nog aan indien van toepassing.</li><li>Schijven: alle data-disks aangekoppeld.</li><li>Diensten: de relevante applicaties starten en zijn bereikbaar.</li><li>Monitoring: geen nieuwe alerts, CPU- en memory-metrics passen bij de nieuwe size.</li></ol>

<div class="call caution"><div class="ct"><span>&#9670;</span> Rollback</div><p>Terug naar de oude size: dealloceer, resize terug naar de oorspronkelijke waarde, start, valideer. Blijven de problemen bestaan, herstel dan vanaf de backup of het restorepoint van voor de wijziging.</p></div>

## Openstaand

<ol class="phases"><li>Besluit voorleggen aan de opdrachtgever over de drie opties voor de Gen1-VM's.</li><li>Backup-policy van vault weup1bck01rsv01 checken: Standard of Enhanced.</li><li>HyperVGeneration van weup1cmsivm02 los bevestigen.</li><li>weup1cmsi01vm01 en weup1workbasevm01 daadwerkelijk resizen.</li><li>Live status van weup1cmsivm01 bevestigen: terug op Standard_D2s_v3 en draaiend.</li></ol>

## Besluiten

Elk besluit heeft een eigen pagina met de volledige onderbouwing: de context, wat het oplevert, wat het kost, en wat we hebben afgewogen maar niet gekozen.

| ADR | Besluit | Status |
|---|---|---|
| **ADR-0003 — VM resize volgens Microsoft best practices** | Bij elke VM-resize volgen we deze vaste volgorde, voor we een onderhoudsvenster plannen. | <span class="badge b-ok">Accepted</span> |

## Bronnen

De aanpak in dit document is gebaseerd op de officiële Microsoft-documentatie.

- [Resize a Windows VM](https://learn.microsoft.com/en-us/azure/virtual-machines/resize-vm)
- [Upgrade Gen1 VMs to Trusted launch](https://learn.microsoft.com/en-us/azure/virtual-machines/trusted-launch-existing-vm-gen-1)
