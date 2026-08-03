---
title: "Hugo + PaperMod 主题配置指南"
date: 2026-08-01T10:00:00+08:00
draft: false
tags: ["Hugo", "PaperMod", "教程"]
categories: ["技术"]
summary: "详细介绍如何配置 Hugo 的 PaperMod 主题，包括导航菜单、搜索功能、归档页面等常用功能的设置方法。"
---

PaperMod 是 Hugo 最受欢迎的主题之一，本文介绍它的常用配置。

## 安装主题

```bash
git submodule add https://github.com/adityatelange/hugo-PaperMod themes/PaperMod
```

## 配置菜单

在 `hugo.yaml` 中添加菜单项：

```yaml
menu:
  main:
    - identifier: posts
      name: Posts
      url: /posts/
      weight: 10
```

## 开启搜索

PaperMod 内置了基于 Fuse.js 的搜索功能，只需要：

1. 创建 `content/search.md`，设置 `layout: "search"`
2. 在 outputs 中为 home 添加 JSON 输出

## 归档页面

创建 `content/archives.md`，设置 `layout: "archives"` 即可。
