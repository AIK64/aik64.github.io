---
title: "Hugo 命令使用指南"
date: 2026-08-03T10:00:00+08:00
draft: false
tags: ["Hugo", "教程", "PaperMod"]
categories: ["技术"]
summary: "从零开始搭建基于 Hugo 与 PaperMod 主题的个人博客，涵盖仓库创建、Hugo 安装、主题配置、本地调试与文章创建等完整流程。"
---


## 前言

[Hugo](https://gohugo.io/) 是一款使用 Go 语言编写的静态网站生成器，以**构建速度快**、**部署简单**著称。本文记录使用 Hugo 搭配 [PaperMod](https://github.com/adityatelange/hugo-PaperMod) 主题搭建个人博客的完整流程，方便日后查阅。

> 阅读本文前，请确保本地已安装 [Git](https://git-scm.com/) 与 [Hugo](https://gohugo.io/installation/)。

---

## 一、创建 GitHub Page 仓库

1. 登录 GitHub，新建一个名为 `<username>.github.io` 的仓库（`<username>` 为你的 GitHub 用户名）。
2. 该仓库将作为博客源码与静态页面的托管地址。

---

## 二、安装 Hugo

### 1. 拉取仓库到本地

```bash
git clone https://github.com/<username>/<username>.github.io.git
```

### 2. 创建新站点

```bash
hugo new site MyFreshWebsite --format yaml
```

> `--format yaml` 表示使用 YAML 格式生成配置文件（`hugo.yaml`）。

### 3. 安装 PaperMod 主题

以 Git 子模块的方式引入主题：

```bash
git submodule add --depth=1 https://github.com/adityatelange/hugo-PaperMod.git themes/PaperMod

# 重新克隆仓库时，子模块可能不会自动拉取，需执行以下命令
git submodule update --init --recursive
```

### 4. 启用主题

在 `hugo.yaml` 中添加：

```yaml
theme: ["PaperMod"]
```

---

## 三、使用 Hugo

### 1. 使用命令创建新文章

```bash
hugo new posts/my-first-post.md
```

Hugo 会在 `content/posts/` 目录下生成带有默认 [Front Matter](https://gohugo.io/content-management/front-matter/) 的 Markdown 文件。

### 2. 直接创建 Markdown 文件

也可以手动在 `content/posts/` 目录下新建 `.md` 文件，并在文件头部添加 Front Matter，例如：

```yaml
---
title: "文章标题"
date: 2026-08-03T10:00:00+08:00
draft: false
tags: ["标签"]
categories: ["分类"]
---
```

> `draft: false` 表示该文章为正式发布状态；设为 `true` 则为草稿，默认不会被构建。

---

## 四、本地调试与预览

```bash
hugo server
```

启动后，默认访问地址为：<http://localhost:1313/>

常用参数：

| 参数 | 说明 |
| --- | --- |
| `-D` / `--buildDrafts` | 构建时包含草稿文章 |
| `--disableFastRender` | 禁用快速渲染，确保页面完整刷新 |
| `-p <port>` | 指定本地服务端口 |

示例：

```bash
hugo server -D --disableFastRender
```

---

## 五、构建与部署

生成静态文件（默认输出到 `public/` 目录）：

```bash
hugo
```

将构建产物推送到 GitHub 仓库后，即可通过 GitHub Pages 访问你的博客。

---

## 参考链接

- [Hugo 官方文档](https://gohugo.io/documentation/)
- [PaperMod 主题文档](https://github.com/adityatelange/hugo-PaperMod/wiki)