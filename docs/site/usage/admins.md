# For administrators

Admins are parents with extra rights: they manage the accounts of this installation and its access settings. The first account, created on the [setup page](../getting-started/docker.md#4-create-the-first-admin), is an admin. An admin can also have kid profiles.

Open **Administration** from the account menu (person icon) or from the parent area. It is behind the same parent gate as the parent area. Admin pages never show kid data, only accounts and counts.

## Overview
The start page shows three numbers: **Accounts**, **Kid profiles** and **Active kids (7 days)**.

## Users
**Administration → Users** lists all accounts, 20 per page by default. **Search by email** filters the list. Badges mark accounts with an **unverified** email address and accounts with two-factor sign-in (**2FA**). The table also shows the number of kid profiles and the last sign-in.

| Action | What happens |
|---|---|
| **Role** | Switch between **Parent** and **Admin**. The user's sessions end, so the new role applies at their next sign-in. |
| **Status** | Disable or enable the account. A disabled account can't sign in, and its sessions end at once. Its data stays. |
| Resend confirmation (send icon) | Sends the confirmation email again to an unverified account. Needs email. |
| Delete (bin icon) | Deletes the account, all its kid profiles and all their progress for good. |

At least one active admin must remain: Murmeli refuses to demote, disable or delete the last one. You can't delete your own account from this page; use **Parent area → Account** instead.

## Invitations
**Administration → Invitations → Invite** creates an invitation for an email address, with the role **Parent** or **Admin**.

- Murmeli shows the invitation link right away, with a **Copy** button. If email is set up, the link is also emailed; if not, send it yourself, for example by message.
- The link is valid for 7 days and works once. Opening it lets the person choose a password. The invitation counts as a confirmed email address.
- A new invitation for the same address replaces the pending one. Inviting an address that already has an account fails.
- **Revoke** (bin icon) makes a pending link stop working.

Invitations work even while registration is closed. That makes them the way to add families to a private installation.

## Settings
**Administration → Settings** has two switches and shows whether email sending is set up.

- **Registration open:** when on, anyone can create a parent account on the sign-up page. New accounts must confirm their email address before they can sign in, so only turn this on when email works. When off, new families can only join by invitation. The `REGISTRATION_ENABLED` variable only sets the starting value; once you change the switch here, your choice wins.
- **Require two-factor sign-in for admins:** when on, admins without two-factor sign-in can only reach the page where they set it up. Turn it on for your own account first, under **Parent area → Account → Two-factor sign-in**.

Email itself (SMTP) is configured in `.env`, not in the UI. See [Set up email](../getting-started/docker.md#6-set-up-email-smtp).

## Audit log
**Administration → Audit log** lists security-relevant events, newest first. **Action** filters by type. Each entry shows the time, the action, the target, the IP address (shortened) and details.

| Action | Recorded when |
|---|---|
| `auth.login`, `auth.login_failed`, `auth.logout` | someone signs in, fails to sign in, or signs out |
| `auth.session_compromised` | a stolen refresh token was detected and the sessions were ended |
| `auth.password_reset`, `auth.password_changed`, `auth.email_changed` | account credentials change |
| `auth.totp_enabled`, `auth.totp_disabled` | two-factor sign-in is turned on or off |
| `account.deleted` | a parent deletes their own account |
| `admin.user_updated`, `admin.user_deleted` | an admin changes or deletes an account |
| `admin.invite_created`, `admin.invite_revoked` | an admin creates or revokes an invitation |
| `admin.settings_updated` | an admin changes a setting |
| `kid.created`, `kid.deleted`, `kid.pin_locked` | a kid profile is created or deleted, or locked after wrong picture PINs |

The log never contains kid nicknames, passwords or tokens. IP addresses are cut to the first three parts of an IPv4 address (/24) or the first three groups of an IPv6 address (/48). When an account is deleted, its entries lose every reference to the account, its kids and its IPs. Entries older than 180 days are deleted every night.

## Things only the server operator can do
- Change secrets, SMTP and rate limits: edit `.env` and run `docker compose up -d`. See the [configuration reference](../reference/configuration.md).
- Back up and restore the database: see [Backups](../deployment/backups.md).
- Reset a password when email isn't set up: there is no admin action for that. A parent who forgot their password and can't use "Forgot your password?" needs a new invitation after you delete the old account, which deletes its kid profiles and progress.
