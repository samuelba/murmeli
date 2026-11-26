# Murmeli

Murmeli is a self-hosted learning platform for kids from kindergarten to the end of 2nd class. It teaches **math, reading and writing**, follows the Swiss Lehrplan 21 (Zyklus 1), and is available in **German (de-CH)** and **American English**.

> Murmeli is aligned with Lehrplan 21 but not affiliated with it. "Murmeli" is a working name.

## Features
- **Levels:** kids climb an Alpine trail from the valley to the summit. Each level unlocks once the one before it is mastered, and an optional practice mode repeats the skills that need more work.
- **Read-aloud:** every instruction can be read aloud, for kids who can't read yet. The audio is generated offline with open-weights TTS.
- **Family accounts:** a parent signs up and creates kid profiles with funny avatars. There are no photos, and kids don't need an email address or a password.
- **Admin:** user management, invites, and a switch to turn registration on or off.
- **Works everywhere:** a touch-friendly web app for phones, tablets and computers, with light and dark themes.
- **Security:** secure cookies, refresh token rotation, rate limits, optional TOTP, a strict CSP, and no third-party requests.

## Quick start (Docker)
```bash
cp .env.sample .env      # fill in the passwords, the secrets and APP_URL
docker compose up -d
```
Then open http://localhost:8080. The first visit walks you through creating the admin account.

The full manual is in [docs/site/](docs/site/), and [DEVELOPMENT.md](DEVELOPMENT.md) covers local development.
