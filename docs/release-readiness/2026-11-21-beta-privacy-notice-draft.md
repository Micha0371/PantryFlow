# PantryFlow supervised beta — privacy notice (draft, beta line B5)

**Status:** draft, 2026-11-21; deletion and retention wording corrected 2026-11-26. Not published. Before publication it needs:
- **owner review** and a **legal check**: KAN-72 requires privacy content to match the app's actual collection and retention and to have review ownership. Nothing here is legal advice;
- the **placeholders** marked `[…]` filled in;
- review of the deletion and retention wording corrected on 2026-11-26 ("How long we keep it" and "Deleting your account"), against the [retention boundaries](2026-11-26-deletion-retention-boundaries.md). **Owner and legal review:** whether to name the remaining records and their periods (sign-in records, also in the app's own database; provider logs; email-provider records), the email provider's retention, how long the support correspondence is kept (OD-B4: the owner recommends 90 days after case closure, subject to legal review), the Supabase log retention terms, and Resend's terms (owner decisions, 2026-11-26).

**Facts behind this draft:**
- the app's database schema (migrations 00001–00004);
- its on-device storage;
- the [FV-A1 hosted read](../testing/2026-11-21-hosted-auth-read-fv-a1.md): Frankfurt region, Free plan without backups, Auth audit entries not stored in the database; magic links and email OTP turned off by the owner afterwards (follow-up in the same record);
- the [interim support runbook](2026-11-21-interim-reset-deletion-runbook.md);
- the owner's Free-plan decision.

**Placeholders to fill:**
- `[Email provider]`: **filled 2026-11-26 with Resend.** The owner configured Resend as the custom SMTP sender ([2026-11-09 record](2026-11-09.md)); the [sender check of 2026-11-10](2026-11-10-email-authentication.md) shows its DKIM selector `resend`. **The owner confirmed on 2026-11-26** that Resend is still the sender. Still open: **legal review** of where Resend processes data and how long it keeps delivery records.
- `[Web address]`: once a page exists (KAN-71/72).

**Correction 2026-11-26:** earlier wording, replaced in the text below:
- "There are no backups during the beta, so deleted data is gone immediately." / "Während der Beta gibt es keine Sicherungen, gelöschte Daten sind also sofort weg."
- "then delete your account and all its data" / "löschen dann dein Konto mit allen Daten"
- "Confirmation emails are sent through [Email provider]" / "Bestätigungs-E-Mails werden über [Email provider] versendet" (placeholder filled)

Reason: not every record is removed at once or at all. See the [retention boundaries](2026-11-26-deletion-retention-boundaries.md).

---

## English

**Who is responsible.** Michael Würthner, MW Software Solutions, Neuköllner Weg 15, 78056 Villingen-Schwenningen, Germany. Contact for privacy questions and requests: **contact@mwsoftworks.com**. We reply within **3 days**.

**What PantryFlow is during this beta.** A test version of a household pantry app, used by a small group of invited testers. Features, data and availability can change.

**What we store**
- **Your account:** your email address and your password, stored only as a secure hash, never readable.
- **Your profile:** the name you enter and your language setting.
- **Your household data:** your household, your pantry items (name, status, category, storage location) and your shopping list, each with creation and change times.
- **On your phone:** your sign-in session, so you stay signed in, and your language choice.

Please don't put sensitive personal information into item names.

**What we don't do.** No advertising, no tracking, no analytics, no selling or sharing of your data. The beta has no crash reporting. If that changes, we tell you first.

**Where your data is processed**
- The app's database and sign-in run on **Supabase**, in the **EU region Frankfurt (Germany)**, as our processor. Supabase is a US company; some service and account metadata may be processed outside the EU under its data processing terms.
- Confirmation emails are sent through **Resend**.

**Why we process it.** To provide the app you signed up for: your account, your household data and its synchronization. This is the performance of our agreement with you (Art. 6(1)(b) GDPR). The service provider keeps technical logs, such as sign-in events and IP addresses, to run and secure the service; this is our legitimate interest (Art. 6(1)(f) GDPR). On the current plan these logs are kept for about one day.

**How long we keep it**
- Your data stays until you delete your account or the beta ends without the app being launched; we then delete the tester accounts.
- **There are no backups during the beta.** Deleted data cannot be restored, and **data can be lost** if the service has a fault.
- The beta runs on a free hosting plan and **may pause** after about a week without activity.

**Deleting your account, or if you can't sign in**
- Email **contact@mwsoftworks.com** from your registered address. We confirm by writing to that address, then delete your account with your profile, household, pantry items and shopping list, and confirm when done. Some technical records stay for a time after that, such as sign-in records and records of the emails we sent. We keep our correspondence about your request.
- During the beta, a forgotten password is handled the same way: we delete the account, and you can register again with the same address. Your beta data is lost in that case.

**Your rights.** You can ask for access to your data, its correction or deletion, restriction of processing, a copy in a portable format, and you can object to processing based on legitimate interest. Write to contact@mwsoftworks.com. You can also complain to a data protection supervisory authority.

**Changes.** If this notice changes during the beta, we tell testers before the change applies.

---

## Deutsch

**Verantwortlich.** Michael Würthner, MW Software Solutions, Neuköllner Weg 15, 78056 Villingen-Schwenningen, Deutschland. Kontakt für Datenschutzfragen und Anfragen: **contact@mwsoftworks.com**. Wir antworten innerhalb von **3 Tagen**.

**Was PantryFlow in dieser Beta ist.** Eine Testversion einer Haushalts-Vorratsapp für eine kleine Gruppe eingeladener Tester. Funktionen, Daten und Verfügbarkeit können sich ändern.

**Was wir speichern**
- **Dein Konto:** deine E-Mail-Adresse und dein Passwort, nur als sicherer Hash gespeichert, nie lesbar.
- **Dein Profil:** den Namen, den du eingibst, und deine Spracheinstellung.
- **Deine Haushaltsdaten:** deinen Haushalt, deine Vorräte (Name, Status, Kategorie, Lagerort) und deine Einkaufsliste, jeweils mit Erstellungs- und Änderungszeit.
- **Auf deinem Handy:** deine Anmeldesitzung, damit du angemeldet bleibst, und deine Sprachwahl.

Bitte trage keine sensiblen persönlichen Informationen in Artikelnamen ein.

**Was wir nicht tun.** Keine Werbung, kein Tracking, keine Analyse, kein Verkauf und keine Weitergabe deiner Daten. Die Beta hat keine Absturzberichte. Ändert sich das, sagen wir es dir vorher.

**Wo deine Daten verarbeitet werden**
- Datenbank und Anmeldung der App laufen bei **Supabase**, in der **EU-Region Frankfurt (Deutschland)**, als unser Auftragsverarbeiter. Supabase ist ein US-Unternehmen; einige Dienst- und Kontometadaten können nach dessen Auftragsverarbeitungsbedingungen außerhalb der EU verarbeitet werden.
- Bestätigungs-E-Mails werden über **Resend** versendet.

**Warum wir sie verarbeiten.** Um dir die App bereitzustellen, für die du dich registriert hast: dein Konto, deine Haushaltsdaten und deren Synchronisierung. Das ist die Erfüllung unserer Vereinbarung mit dir (Art. 6 Abs. 1 lit. b DSGVO). Der Dienstleister führt technische Protokolle, etwa Anmeldeereignisse und IP-Adressen, um den Dienst zu betreiben und abzusichern; das ist unser berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO). Im aktuellen Tarif werden diese Protokolle etwa einen Tag aufbewahrt.

**Wie lange wir sie aufbewahren**
- Deine Daten bleiben, bis du dein Konto löschst oder die Beta endet, ohne dass die App veröffentlicht wird; dann löschen wir die Testerkonten.
- **Während der Beta gibt es keine Sicherungen.** Gelöschte Daten lassen sich nicht wiederherstellen, und **Daten können verloren gehen**, wenn der Dienst einen Fehler hat.
- Die Beta läuft auf einem kostenlosen Hosting-Tarif und **kann pausieren**, wenn sie etwa eine Woche nicht genutzt wird.

**Konto löschen, oder wenn du dich nicht anmelden kannst**
- Schreib an **contact@mwsoftworks.com** von deiner registrierten Adresse. Wir bestätigen per E-Mail an diese Adresse, löschen dann dein Konto mit deinem Profil, deinem Haushalt, deinen Vorräten und deiner Einkaufsliste und bestätigen, wenn es erledigt ist. Einige technische Aufzeichnungen bleiben danach noch eine Zeit lang bestehen, etwa Aufzeichnungen über Anmeldungen und über die versendeten E-Mails. Unseren Schriftverkehr zu deiner Anfrage bewahren wir auf.
- Während der Beta wird ein vergessenes Passwort genauso behandelt: Wir löschen das Konto, und du kannst dich mit derselben Adresse neu registrieren. Deine Beta-Daten gehen dabei verloren.

**Deine Rechte.** Du kannst Auskunft über deine Daten verlangen, ihre Berichtigung oder Löschung, die Einschränkung der Verarbeitung und eine Kopie in einem übertragbaren Format; der Verarbeitung aufgrund berechtigten Interesses kannst du widersprechen. Schreib an contact@mwsoftworks.com. Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren.

**Änderungen.** Ändert sich dieser Hinweis während der Beta, informieren wir die Tester, bevor die Änderung gilt.
