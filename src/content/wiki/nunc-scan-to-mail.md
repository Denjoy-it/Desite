---
title: "Scan-to-Mail: Ricoh 3010A naar Microsoft 365"
description: "Inrichting van de Ricoh 3010A-scanner bij NUNC Capital: relay via AntispamCloud, een gedeelde scanner-mailbox met zes domein-aliassen, en een gevonden zwak wachtwoord op het relay-account."
category: "Exchange Online"
order: 2
clients: ["nunc-capital"]
---

Deze inrichting volgt de algemene procedure uit [Scan-to-Mail: MX-relay of Microsoft 365](../scan-to-mail-sjabloon/) — dit artikel documenteert alleen de concrete waarden en bevindingen specifiek voor NUNC Capital.

## Situatie

De Ricoh 3010A meldt zich aan bij een SMTP-server (poort `587`, STARTTLS) en geeft de scan mee. Dat kan bij de MX-relay **AntispamCloud** — die de mail cleant en doorzet naar de tenant — of rechtstreeks bij Microsoft 365. Zolang het AntispamCloud-abonnement loopt is de relay-route (A) de veilige keuze: de tenant blijft dan volledig MFA-beschermd. Een gedeelde **scanner-mailbox** (`scanner@nunccapital.com`) mailt namens zes domein-aliassen.

<div class="call ok"><div class="ct"><span>&#9670;</span> Route A - AntispamCloud is de veilige keuze zolang NUNC ervoor betaalt</div><p>De Ricoh authenticeert bij de relay, niet rechtstreeks bij Microsoft 365 - in de tenant hoeft <b>geen</b> SMTP AUTH open en <b>geen</b> MFA-uitzondering. <code>scanner@nunccapital.com</code> blijft volledig MFA-beschermd.</p></div>

## Afzender-account: zes domeinen

| Adres | Rol |
|---|---|
| `scanner@nunccapital.com` | Primair — hiermee logt de Ricoh in |
| `scanner@angardmicrowave.com` | Alias |
| `scanner@vearco.com` | Alias |
| `scanner@pacprotect.com` | Alias |
| `scanner@sofworx.com` | Alias |
| `scanner@cobbsindustries.com` | Alias |

## Route A: AntispamCloud

| Veld | Waarde |
|---|---|
| SMTP Server Name | `smtp.antispamcloud.com` |
| SMTP Port Number | `587` |
| Secure Connection (SSL/TLS) | On |
| SMTP Authentication | On |
| Auth. User Name | `scanner@nunccapital.com` |
| Auth. Password | sterk wachtwoord uit Keeper |
| Email Address / From | domein-alias, bijv. `scanner@angardmicrowave.com` |

<div class="call caution"><div class="ct"><span>&#9670;</span> Bevinding - het relay-wachtwoord in Keeper is zwak</div><p>De AntispamCloud-credentials staan in Keeper (login <code>scanner@nunccapital.com</code>, notities: mx relay / smtp.antispamcloud.com / port 587), maar het wachtwoord is als <b>Zwak</b> gemarkeerd. Een <i>Invalid credentials</i> bij het testen wees dus niet op een verdwenen dienst, maar op een verkeerd/zwak wachtwoord. <b>Actie:</b> zet een sterk, uniek wachtwoord - dit account mag legacy auth en is een gewild doelwit.</p></div>

## Ricoh-instellingen

Webinterface (IP in de browser), inloggen met de gegevens uit **Keeper**. In de aangetroffen configuratie stond **Secure Connection** uit.

<ol class="phases"><li>Typ het IP van de Ricoh in de browser.</li><li>Log in met de beheergegevens uit Keeper.</li><li>Vul het SMTP-profiel in (Route A hierboven, of Route B — zie het algemene sjabloon).</li><li>Zet onder <i>Printing Services → [DEFAULT]</i> <b>Auto Specify Sender = On</b> met het afzenderadres.</li></ol>

## DNS

| Route | SPF-include |
|---|---|
| A · AntispamCloud | `v=spf1 include:_spf.mx-relay.com ~all` |
| B · M365-direct | `v=spf1 include:spf.protection.outlook.com -all` |

<div class="call info"><div class="ct"><span>&#9670;</span> Controleren</div><p>Vergelijk met een domein dat al goed staat - de records bij <code>cobbsindustries.com</code> staan goed.</p></div>

## Testen

```powershell
$recipient = "gebruiker@domein.com"
$from      = "scanner@angardmicrowave.com"
$secpasswd = ConvertTo-SecureString "STERK_KEEPER_WACHTWOORD" -AsPlainText -Force
$creds     = New-Object System.Management.Automation.PSCredential ($from, $secpasswd)
Send-MailMessage -From $from -To $recipient -Subject "MX-relay test" -Body "Test via relay" -SmtpServer "smtp.antispamcloud.com" -Port 587 -UseSsl -Credential $creds
```

## Checklist

<ol class="phases"><li>AntispamCloud-abonnement actief bevestigd.</li><li>Sterk wachtwoord in Keeper (vervang het zwakke).</li><li>Ricoh: <code>smtp.antispamcloud.com</code>:587, Secure Connection On, auth aan.</li><li>SPF per domein (zes stuks) &#8594; relay-include.</li><li>M365-tenant ongewijzigd (geen SMTP AUTH / MFA-uitzondering).</li><li>Adresboek: Use Name As &#8594; alleen Destination, Sender uit.</li><li>DKIM en DMARC gepubliceerd voor alle zes domeinen.</li><li>Aanmeldbewaking op <code>scanner@nunccapital.com</code>.</li></ol>

<div class="call ok"><div class="ct"><span>&#9670;</span> Eindresultaat</div><p>De Ricoh 3010A verstuurt scan-to-email via AntispamCloud zolang het abonnement loopt (tenant blijft dicht), namens het juiste domein-alias, met DMARC-pass en een sterk afgeschermd scanner-account.</p></div>
