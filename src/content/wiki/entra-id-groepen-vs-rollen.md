---
title: "Entra ID: groepen versus rollen"
description: "Het verschil tussen een Microsoft Entra-groep en een rol, en wanneer je welke gebruikt."
category: "Entra ID"
order: 1
---

Entra ID kent twee mechanismen die vaak door elkaar worden gehaald: **groepen**
en **rollen**. Ze lossen een ander probleem op.

| Mechanisme | Waarvoor | Voorbeeld |
| --- | --- | --- |
| Groep | Gebruikers bundelen om er samen rechten aan toe te kennen | `sec-azure-readers` als lid van een RBAC-roltoewijzing |
| Rol (RBAC) | Rechten op een Azure-resource | Reader op een resourcegroep |
| Rol (Entra ID-rol) | Beheerrechten binnen Entra ID zelf | Global Administrator, User Administrator |

<div class="call info">
<div class="ct"><span>&#9670;</span> Vuistregel</div>
<p>Ken rechten (RBAC-rollen, Entra ID-rollen) altijd toe aan een <b>groep</b>,
niet aan een los account. Een nieuwe medewerker voeg je dan toe aan de
groep, in plaats van dat je losse toewijzingen uitzoekt en herhaalt.</p>
</div>

## Groep aanmaken en koppelen

<ol class="phases">
<li>Maak in Entra ID een <b>beveiligingsgroep</b> aan met een duidelijke naam
(bijvoorbeeld <code>sec-azure-readers</code>).</li>
<li>Voeg de juiste gebruikers toe als lid.</li>
<li>Ken de gewenste rol toe aan de <b>groep</b>, niet aan de individuele
gebruikers.</li>
</ol>

<div class="call caution">
<div class="ct"><span>&#9670;</span> Let op</div>
<p>Een <b>Entra ID-rol</b> (zoals Global Administrator) is iets anders dan een
<b>Azure RBAC-rol</b> (zoals Reader of Contributor). De eerste regelt beheer
over de tenant zelf, de tweede regelt toegang tot Azure-resources. Verwar ze
niet: iemand met Global Administrator heeft niet automatisch Reader op een
abonnement.</p>
</div>
