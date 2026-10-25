---
layout: single
title: "研究"
permalink: /zh/research/
lang: zh-Hans
twin: /research/
og_locale: zh_CN
og_locale_alt: en_US
author_profile: true
description: "多模态感知、生成式模型与智能体，以及决定这些研究能否复现的那层基础设施。"
---

我活跃在 AI 的全栈——感知、生成、智能体，以及数据治理与基础设施——执着于可复现以及持久化。范围可以求宽：把注意力都放在接缝上，一次微调便可以反复迭代。

模型每半年换一批。实验室留下来的其实是 harness、检查项和数据集——正是这一层，决定了上面那些东西算研究还是一场演示。

我是香港中文大学（深圳）人工智能学院的博士研究生，导师是 [Prof. Jianhua Huang](https://sai.cuhk.edu.cn/en/teacher/108)，也是 [港中大（深圳）–CROSS 联合实验室](https://github.com/CUHKSZ-CROSS-Lab) 的科研人员。在此之前：曾就读于本校数据科学硕士项目、在曼彻斯特取得经济学学士，以及四年量化交易系统的开发工作。

## 我在做什么

**跨帧的感知。** 模型得看懂一帧接一帧里发生了什么，而不只是单帧：一个微调过的 [InstructPix2Pix](https://github.com/CAI991108/Robotic-Action-Frame-Prediction-with-InstructPix2Pix)，从当前观测和一条指令预测机器人下一帧的动作；还有[商品搜索](https://github.com/CAI991108/JD_search_agent)，文字查询得和 OCR 出来的商品信息对上。我在意的失败不是一张静图上标错了类别，而是一帧看起来很合理、却说错了接下来会发生什么。

**付得起的生成模型。** 把扩散模型的微调压到便宜得可以反复迭代：[LoRA adapter](https://huggingface.co/jimchoi/simpletuner-lora)，Stable Diffusion 3 Medium 配 SimpleTuner，权重公开，而不是只公开结论；也如实标注第一次评测是目视的，不是量化的。要的不是更便宜的演示，而是同一个想法能多走几轮。

**智能体与它们周围的基础设施。** 有状态的多模态智能体，以及让它们可测的那套 harness：一个 [LangGraph 购物助手](https://github.com/CAI991108/JD_search_agent)，得把用户的要求跨轮次记牢；还有评测、工具链和流水线——决定上面这些能不能复现的东西。多数时候看不见，偶尔扛着重量。

## 我怎么工作

**先能重跑，再谈相信。** 这些东西是按「能被重跑」来造的：机器人帧模型记录了自己的硬件与预处理，SD3M 的 adapter 带着权重一起发，这个站在推送前跑 preflight、部署后跑线上检查。重跑不了的结果，只是传闻。

**先有覆盖，再谈严格。** 只覆盖一半代码的严格检查比没有检查更糟，因为它会变绿。这个教训来自一条[视频流水线](https://github.com/CAI991108/dsh-studios)：它的类型检查器从来没看过影片源文件；修法不是把检查器变严，而是把它变宽。

**机器查机械，人查判断。** 自动闸门能抓住丢文件、坏路径和泄漏的凭据；抓不住一句错的论断、一帧错的画面、一句歪曲了数据的图注。这两者之间的边界，才是值得设计的地方。

这就是标准：一个结果，换数据集、换机器、换作者，都还站得住。

## 实验室里的系统

为港中大（深圳）–CROSS 联合实验室做的两个系统。两个都由我端到端设计并实现——架构、实现、验收。架构与技术栈公开；源码、客户相关工作，以及任何涉及数据与部署的部分都不公开。

{% include lab-systems.html %}

## 这套工作建立在什么之上

影响上面这些工作的四处来源，以及它们各自在其中起什么作用：

- **[InstructPix2Pix](https://arxiv.org/abs/2211.09800)** —— 指令条件下的图像编辑，是机器人帧模型的底子：同一个想法，指向时间。
- **[Stable Diffusion 3](https://arxiv.org/abs/2403.03206) 与 [SimpleTuner](https://github.com/bghira/SimpleTuner)** —— LoRA 那一跑背后的模型与工具链。LoRA 是「别人还能加载」的最小单位。
- **[RoboTwin](https://github.com/TianxingChen/RoboTwin)** —— 那些 episode 是合成的，这件事该写出来而不是藏起来；机器人模型上的每个数字都由这个选择决定。
- **[LangGraph](https://github.com/langchain-ai/langgraph)** —— 智能体先是状态机，然后才是人格；难的是跨过一轮之后还剩下什么。

## 别处

[项目页]({{ '/projects/' | relative_url }}) 是我能公开的代码，[CV]({{ '/cv/' | relative_url }}) 是时间线。
