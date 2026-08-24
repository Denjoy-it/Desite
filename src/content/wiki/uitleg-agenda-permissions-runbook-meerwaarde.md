---
title: 'Uitleg: Agenda Permissions runbook Meerwaarde'
description: Uitleg inrichting Azure runbook automation agenda permissions
category: Algemeen
order: 2
clients:
  - meerwaarde
draft: false
---

**Standard Operating Procedure**

Exchange Online — Automatisering agenda-permissies

_Set-DefaultCalendarPermissions via Azure Automation + Microsoft Graph API_

**Documentgegevens**

| **Documentnummer** | SOP-EXO-001 |
| --- | --- |
| **Versie** | 1.0 |
| **Datum** | 22 mei 2026 |
| **Auteur** | Dennis Schiphorst, Modern Workplace Consultant |
| **Klant** | Stichting Meerwaarde |
| **Status** | Definitief |
| **Classificatie** | Vertrouwelijk — intern gebruik |

**1\. Doel**

Deze SOP beschrijft het geautomatiseerde proces voor het instellen van standaard agenda-permissies (LimitedDetails) voor alle gebruikersmailboxen in Exchange Online via een Azure Automation Runbook en de Microsoft Graph API.

Zonder automatisering wijkt elke nieuw aangemaakte mailbox af van het gewenste beleid. Dit Runbook corrigeert bestaande afwijkingen en kan periodiek worden uitgevoerd zodat nieuwe mailboxen automatisch worden opgepakt.

**2\. Scope en uitsluitingen**

**In scope**

*   Alle gelicentieerde gebruikersaccounts (userType: Member) in de Meerwaarde-tenant
*   Primaire agenda van elke gebruiker — Default-permissie wordt ingesteld op LimitedDetails

**Uitgesloten**

*   martijn.kool@meerwaarde.nl — vaste uitsluiting
*   larissa.wladimiroff@meerwaarde.nl — vaste uitsluiting
*   Aanvullende uitsluitingen mogelijk via de $ExcludedMailboxes Runbook-parameter

**3\. Vereisten en toegangen**

**Azure Automation**

*   Automation Account: DefaultCalendarPermissions (RG-MeerWaarde-DC)
*   System-Assigned Managed Identity ingeschakeld
*   PowerShell 7.2 runtime
*   Geen externe modules vereist

**Microsoft Graph API — permissies Managed Identity**

*   Calendars.ReadWrite — agenda-permissies lezen en schrijven
*   User.Read.All — lijst van alle gebruikers ophalen

| _Let op: Graph API application permissions moeten worden toegewezen aan de Managed Identity via Entra ID → Enterprise Applications → \[naam Managed Identity\] → Permissions. Dit kan niet via de Azure Portal UI — gebruik PowerShell of Graph Explorer._ |
| --- |

**Permissies toewijzen (eenmalig, PowerShell)**

Voer onderstaande commando's uit als Global Administrator of Privileged Role Administrator:

| $miObjectId = "<Object ID Managed Identity>"  
$graphAppId = "00000003-0000-0000-c000-000000000000"  
$graph = Get-MgServicePrincipal -Filter "appId eq '$graphAppId'"  
foreach ($role in @("Calendars.ReadWrite","User.Read.All")) {  
$appRole = $graph.AppRoles | Where-Object { $\_.Value -eq $role }  
New-MgServicePrincipalAppRoleAssignment \\  
\-ServicePrincipalId $miObjectId -PrincipalId $miObjectId \\  
\-ResourceId $graph.Id -AppRoleId $appRole.Id } |
| --- |

**4\. Procedure — uitvoering Runbook**

**4.1 Dry-run uitvoeren (verplicht vóór live)**

1.  Navigeer naar Azure Portal → Automation Accounts → DefaultCalendarPermissions → Runbooks.
2.  Open het Runbook Set-DefaultCalendarPermissions-LimitedDetails.
3.  Klik op Start.
4.  Stel de parameters in: DryRun = True, AccessRights = LimitedDetails. Overige parameters leeg laten.
5.  Klik Start en wacht tot de job is voltooid (status: Completed).
6.  Controleer de job-output: verifieer dat het verwachte aantal gebruikers wordt vermeld en dat de uitsluitingen correct zijn doorgevoerd.
7.  Controleer de samenvatting onderaan de output op het aantal DryRun, Overgeslagen en Fouten.

**4.2 Live uitvoering**

| _Voer de live uitvoering bij voorkeur buiten kantooruren uit (na 18:00 of in het weekend) om impact op gebruikers te minimaliseren._ |
| --- |

1.  Herhaal stappen 1 t/m 3 uit 4.1.
2.  Stel de parameters in: DryRun = False, AccessRights = LimitedDetails.
3.  Klik Start.
4.  Monitor de job-output tijdens uitvoering via Refresh job streams.
5.  Controleer na afloop de samenvatting: alle gebruikers moeten status OK hebben. Fouten worden gelogd met foutmelding in de kolom Notes.
6.  Verifieer steekproefsgewijs via Outlook (of Graph Explorer) of de Default-permissie correct is ingesteld op LimitedDetails bij 2-3 willekeurige gebruikers.

**5\. Periodieke uitvoering (schedule)**

Om nieuwe mailboxen automatisch op te pakken zonder handmatige interventie wordt het Runbook gekoppeld aan een schedule:

*   Navigeer naar het Runbook → Schedules → Add a schedule.
*   Frequentie: wekelijks, bijvoorbeeld elke maandag om 07:00 UTC.
*   Parameters: DryRun = False, AccessRights = LimitedDetails.
*   Na koppeling wordt het Runbook automatisch uitgevoerd — geen handmatige actie vereist voor nieuwe gebruikers.

| _Nieuwe mailboxen worden opgepakt bij de eerstvolgende scheduled run. De maximale drift is daarmee gelijk aan de schedule-frequentie (bij wekelijkse schedule maximaal 7 dagen)._ |
| --- |

**6\. Troubleshooting**

| **Symptoom** | **Oorzaak** | **Oplossing** |
| --- | --- | --- |
| 401 Unauthorized bij Graph API | Managed Identity mist Graph permissions | Voer de permissietoewijzing uit (zie §3) en wacht 5-10 min. |
| 400 Bad Request bij PATCH | Permissie-ID niet gevonden via GET | Controleer of de gebruiker een primaire agenda heeft en of Calendars.ReadWrite is toegewezen. |
| Gebruiker niet uitgesloten terwijl verwacht | UPN verschil (hoofdletters/domein) | Controleer de exacte UPN in Entra ID en pas $FixedExclusions aan in het script. |
| Job timeout na 3 uur | Te veel mailboxen / trage Graph responses | Splits de uitvoering via $ExcludedMailboxes als filter of voer in batches uit. |
| IDENTITY\_ENDPOINT leeg / null | Managed Identity niet ingeschakeld op Automation Account | Automation Account → Identity → System assigned → Status: On → Save. |

**7\. Versiebeheer**

| **Versie** | **Datum** | **Auteur** | **Wijziging** |
| --- | --- | --- | --- |
| 1.0 | 22 mei 2026 | Dennis Schiphorst | Initiële versie — Graph API oplossing na EXO module-incompatibiliteit |

**Vragen of aanpassingen:**

Dennis Schiphorst | Modern Workplace Consultant | QUBE ICT Solutions

dennis@denjoy.nl | www.denjoy.nl
