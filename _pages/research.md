---
layout: single
title: "Research"
permalink: /research/
author_profile: true
---

I am a PhD student in Artificial Intelligence at CUHK-Shenzhen, supervised by [Prof. Jianhua Huang](https://sai.cuhk.edu.cn/en/teacher/108), and a Research Fellow at the [CUHK(SZ)–CROSS Joint Laboratory](https://github.com/CUHKSZ-CROSS-Lab) — a joint lab of the School of Artificial Intelligence and Shenzhen Kuafu-Yundun Technology. Before that: an MSc in Data Science here, and a BSc in Economics at Manchester.

## What I work on

**Multimodal perception.** Models that have to understand what they see over time: a fine-tuned InstructPix2Pix that predicts a robot's future action frames, and product search where text queries meet OCR'd listings.

**Generative models.** Making diffusion fine-tuning affordable. LoRA adapters for Stable Diffusion 3 Medium, with the weights published rather than only the claim.

**Research infrastructure.** The part that decides whether the first two reproduce: pipelines, agent tooling and evaluation harnesses. Mostly invisible, occasionally load-bearing.

## Systems at the lab

Architecture and stack are shown; the source stays closed.

| System | What it does | Stack |
| :-- | :-- | :-- |
| **CrossLedger** | Three-surface ledger automation — API, workbench and desktop executor — with SSO, object storage, persisted task state and scripted acceptance | `NestJS` `Vue` `Postgres` `Keycloak` `MinIO` |
| **CrossBooks** | Document intake and verification: per-company authorisation, versioned originals, conflict-safe drafts | `Vue` `Postgres` `Docker` |

## Elsewhere

The [projects page](/projects/) has the code I can show, and the [CV](/cv/) has the timeline.
