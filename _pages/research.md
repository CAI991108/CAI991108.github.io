---
layout: single
title: "Research"
permalink: /research/
lang: en
twin: /zh/research/
author_profile: true
description: "Research across multimodal perception, generative models and agents — and the infrastructure that decides whether any of it reproduces."
---

I work across the AI stack — perception, generation, agents, and the infrastructure underneath them — on the part that has to survive the demo. The work is deliberately broad: the questions I care about live at the seams, where a model has to keep seeing correctly a second later, where a fine-tune has to be cheap enough to iterate on, where an agent's state has to hold across turns, and where a result has to be rerunnable by someone who is not me.

The models change every six months. What a lab keeps is the harness, the check and the dataset — and that is the layer that decides whether any of this is research rather than a demo. It is the layer I build in.

I am a PhD student in Artificial Intelligence at CUHK-Shenzhen, supervised by [Prof. Jianhua Huang](https://sai.cuhk.edu.cn/en/teacher/108), and a Research Fellow at the [CUHK(SZ)–CROSS Joint Laboratory](https://github.com/CUHKSZ-CROSS-Lab) — a joint lab of the School of Artificial Intelligence and Shenzhen Kuafu-Yundun Technology. Before that: an MSc in Data Science here, a BSc in Economics at Manchester, and four years building quantitative trading systems.

## What I work on

**Perception over time.** Models that have to understand what they see across frames, not just in one: a fine-tuned [InstructPix2Pix](https://github.com/CAI991108/Robotic-Action-Frame-Prediction-with-InstructPix2Pix) that predicts a robot's next action frame from the current observation and an instruction, and [product search](https://github.com/CAI991108/JD_search_agent) where a text query has to meet OCR'd listings. The failure I care about is not a wrong label on a still image; it is a plausible frame that is wrong about what happens next.

**Generative models you can afford.** Making diffusion fine-tuning cheap enough to iterate on: [LoRA adapters](https://huggingface.co/jimchoi/simpletuner-lora) for Stable Diffusion 3 Medium with SimpleTuner, the weights published rather than only the claim, and an honest note that the first evaluation was visual rather than quantitative. The point is not a cheaper demo; it is more iterations per idea.

**Agents and the infrastructure around them.** Stateful multimodal agents and the harnesses that make them testable: a [LangGraph shopping assistant](https://github.com/CAI991108/JD_search_agent) that has to hold a requirement across turns, and the evaluation, tooling and pipelines that decide whether any of the above reproduces. Mostly invisible, occasionally load-bearing.

## How I work

**Rerun before you trust.** The work is built to be rerun: the robot-frame model records its hardware and preprocessing, the SD3M adapter ships its weights, this site runs a preflight before a push and a live check after a deploy. A result I cannot rerun is a rumour.

**Coverage before strictness.** A strict check that covers half the code is worse than no check, because it goes green. I learned that on [a video pipeline](https://github.com/CAI991108/dsh-studios) whose type checker had never looked at the film source; the fix was not a stricter checker, it was a wider one.

**Machines check mechanics; people check judgement.** Automated gates catch missing files, broken paths and leaked credentials. They cannot catch a wrong claim, a bad frame, or a caption that misrepresents the data. The boundary between the two is the part worth designing.

That is the bar: a result that survives a change of dataset, a change of machine and a change of author.

## Systems at the lab

Two systems for the CUHK(SZ)–CROSS Joint Laboratory. I design and build both end to end — architecture, implementation, acceptance. The architecture and stack are public; the source, client work, and anything about data or deployment stay closed.

{% include lab-systems.html %}

## What this builds on

Four sources that shaped the work above, and what each one is doing in it:

- **[InstructPix2Pix](https://arxiv.org/abs/2211.09800)** — instruction-conditioned image editing is the base of the robot-frame model: the same idea, pointed at time.
- **[Stable Diffusion 3](https://arxiv.org/abs/2403.03206) and [SimpleTuner](https://github.com/bghira/SimpleTuner)** — the model and the toolkit behind the LoRA run. LoRA is the smallest unit that still produces a weight someone else can load.
- **[RoboTwin](https://github.com/TianxingChen/RoboTwin)** — the episodes are synthetic, and that is a claim to state rather than hide; every number on the robot model is downstream of that choice.
- **[LangGraph](https://github.com/langchain-ai/langgraph)** — an agent is a state machine before it is a personality; the hard part is what survives a turn.

## Elsewhere

The [projects page](/projects/) has the code I can show, and the [CV](/cv/) has the timeline.
