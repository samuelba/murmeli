# Murmeli user manual

Murmeli is a self-hosted learning platform for kids from kindergarten to the end of 2nd class. Kids practice math, reading and writing on an Alpine trail, in Swiss German (de-CH, Standard German with Swiss spelling) or American English (en-US). The content is aligned with the Swiss Lehrplan 21, Zyklus 1. Murmeli is not affiliated with Lehrplan 21, and "Murmeli" is a working name.

You run it yourself with Docker Compose. Nothing is sent to third parties: no analytics, no CDNs, no external fonts.

## Features
- **Trail map:** each subject is a trail of worlds and levels. A level opens when the one before it is passed, and a world opens when the worlds it builds on are done.
- **Stars and practice:** a run of exercises earns 0 to 3 stars. Practice mode mixes the skills that are due for repetition or still weak.
- **Show me:** the first time a kid opens a level, Murmeli the marmot shows step by step how the exercise works.
- **Read-aloud:** prompts, hints and feedback can be read aloud for kids who can't read yet. The narration is pre-rendered offline with an open-weights AI voice.
- **Family accounts:** one parent account, up to 8 kid profiles with drawn animal avatars. Kids need no email address and no password, only an optional picture PIN.
- **Parent controls:** a password-protected parent area, a daily learning time limit, and read-aloud and sound settings per kid.
- **Administration:** users, invitations, an open-registration switch, optional mandatory two-factor sign-in for admins, an audit log and simple counts.
- **Security and privacy:** httpOnly cookies, refresh token rotation, rate limits and lockouts, optional TOTP, a least-privileged database role, read-only containers and a strict CSP. Kid profiles hold no real names and no photos.

## Contents

**Run it**
- [Quick start with Docker Compose](getting-started/docker.md)
- [Reverse proxy and HTTPS](deployment/reverse-proxy.md)
- [Security](deployment/security.md)
- [Backups and restore](deployment/backups.md)
- [Upgrades](deployment/upgrades.md)
- [Configuration reference](reference/configuration.md)

**Use it**
- [For parents](usage/parents.md)
- [For kids](usage/kids.md) (written for parents to explain to their kids)
- [For administrators](usage/admins.md)

**Learning**
- [Curriculum and progression](learning/curriculum.md)
- [Narration audio](learning/audio.md)

**More**
- [Privacy](privacy.md)
- [API](reference/api.md)

Developers start with [DEVELOPMENT.md](../../DEVELOPMENT.md).
