# Changelog

## 0.1.0 (2026-11-28)


### Features

* add components for times tables, sharing, clock, money, tracing, dictation and sentences ([621d53a](https://github.com/samuelba/murmeli/commit/621d53a8474f40d9a4d2847d46fed4a7b3a59b95))
* **audio:** add offline Qwen3-TTS pipeline with ASR verification ([8d9762a](https://github.com/samuelba/murmeli/commit/8d9762a382a5517c35982fdf3ffd9774d5c86ad6))
* **backend:** add accounts, parent gate, kid profiles, admin and email ([0e55202](https://github.com/samuelba/murmeli/commit/0e55202b03b9f9b9b8e51c5db9a724d86a774b4c))
* **backend:** add admin account recovery, operator legal info and attempts retention ([d8c54c6](https://github.com/samuelba/murmeli/commit/d8c54c6692255543cd93785c7644abc5743b08fc))
* **backend:** add learning engine with runs, scoring, unlocking and practice ([1a3080f](https://github.com/samuelba/murmeli/commit/1a3080f490c5ff2a095cfd4a52120ffdcc98a72e))
* **backend:** add NestJS foundation with config validation, health, rate limiting and safe migrations ([ec4937e](https://github.com/samuelba/murmeli/commit/ec4937e039b71620a638a77bdc9e05b3963f5b21))
* **brand:** add Murmeli logo, mascot, avatars and design tokens ([227aeaa](https://github.com/samuelba/murmeli/commit/227aeaaa5f591a6fd361c7e1decc5b3a6313fb77))
* **content:** add curriculum package with exercise schemas and first worlds ([6256a35](https://github.com/samuelba/murmeli/commit/6256a354d8cd127a01f491e0daf6d961f22934d0))
* **content:** add deterministic exercise runtime and shared learning API types ([c323fd6](https://github.com/samuelba/murmeli/commit/c323fd6360f1fde8a0a81fee41fee5177eb2f5a3))
* **content:** add times tables, clock, money, letter tracing, dictation and sentences ([0ec5659](https://github.com/samuelba/murmeli/commit/0ec5659882ee68f49254e6b310504f0a1bb11fd7))
* **frontend:** add accounts, kid profiles, parent area and admin UI ([75ddd90](https://github.com/samuelba/murmeli/commit/75ddd9076085896da86e0f6f2dbc27dd2ae679f7))
* **frontend:** add Angular app foundation with kid theme, i18n and hardened nginx ([4165c61](https://github.com/samuelba/murmeli/commit/4165c61b3be9470027ebacb27934646d2422ca19))
* **frontend:** add parent progress page, badges, offline PWA and about page ([00b97cc](https://github.com/samuelba/murmeli/commit/00b97cccb9629c087dfccb9ac97e64681fba64a7))
* **frontend:** add trail map, exercise player and audio narration ([0bbfe28](https://github.com/samuelba/murmeli/commit/0bbfe282c395f90af5428730bd39dafd7bc1bddd))
* **frontend:** show the trail map one world at a time ([93ccca1](https://github.com/samuelba/murmeli/commit/93ccca1d988231d81900d642a848af585a6c4258))
* join world trails and switch German narrator to timbre-only clone ([02c1d82](https://github.com/samuelba/murmeli/commit/02c1d82652d9136ca2354db487e8e6b096b6cddf))


### Bug Fixes

* **backend:** drop npm from the image and update the active-run e2e test ([9790dc1](https://github.com/samuelba/murmeli/commit/9790dc14aa35b90dd459aede00b8cbb7b2d0a706))
* **backend:** ignore process.env fallback so empty env values stay unset ([6285c53](https://github.com/samuelba/murmeli/commit/6285c53298af5dc37f2420943a12d2edadc2b24f))
* **frontend:** address final accessibility and security review findings ([cb3a33b](https://github.com/samuelba/murmeli/commit/cb3a33b19a958266da9af95fca35169f1fb9091b))
* **frontend:** stack badge content so text no longer overlaps buttons ([7ad6df4](https://github.com/samuelba/murmeli/commit/7ad6df4ccf7198c37f4e9793861b688a0fe5907e))
* **frontend:** stack badge content so text no longer overlaps buttons ([42c4898](https://github.com/samuelba/murmeli/commit/42c48983316f3ccd0b41f07b67aca294e6248f82))
* **frontend:** tie learning language to the kid profile ([b427a71](https://github.com/samuelba/murmeli/commit/b427a71a0848a677d76da4259532a121e1ed53f2))
* **frontend:** upgrade Alpine packages in the production image ([7bdc866](https://github.com/samuelba/murmeli/commit/7bdc86607119ccb4f8b3b1bdb26ec566c49f79f2))
* resume an unfinished run instead of starting over on reload ([b85ee78](https://github.com/samuelba/murmeli/commit/b85ee78384623616b2a1aaff11f6a2661a952b58))
* speak letter names in carrier phrases and add audio gap check ([f717d6b](https://github.com/samuelba/murmeli/commit/f717d6be867146d0deaaf2f8384bf96f1acce201))
