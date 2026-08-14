---
title: "Learn-ClaudeCode"
date: 2026-08-11T10:00:00+08:00
draft: false
tags: ["CC", "Learn"]
categories: ["技术"]
summary: "Learn-ClaudeCode"
---



## s03 Permission

- 被拦截的工具调用仍然要让循环状态保持一致。用户和模型都需要知道为什么没有执行，才能决定下一步。
具体的表现就是，即使tooluse被拦截，除了打印日志告诉用户发生了什么，同样要在结果result中保存相关的信息，告诉llm发生了什么
if not check_permission(block):
    results.append({"type": "tool_result", "tool_use_id": block.id,
                    "content": "Permission denied."})



## s04 Hooks

python中的生成器表达式语法，完整的语法为 (表达式 for 变量 in 可迭代对象 if 条件)
- 相比较使用列表，生成器不存储所有的值，所以占用内存很少，但是只会进行一次遍历，所以对于需要多次遍历或者随机存取的场景，则可以使用列表。

这里是使用了多层的循环，最后的if判断是过滤条件，只有通过才会产生1
```python
 tool_count = sum(1 for m in messages
                     for b in (m.get("content") if isinstance(m.get("content"), list) else [])
                     if isinstance(b, dict) and b.get("type") == "tool_result")
```


```python
tool_count = sum(                           # 第5层：求和
    1 for m in messages                     # 第4层：外层循环（遍历每条消息）
    for b in (                              # 第3层：内层循环（遍历每个 block）
        m.get("content")                    # 第2层：取出 content 字段
        if isinstance(m.get("content"), list) 
        else []
    )
    if isinstance(b, dict)                  # 第1层：过滤条件
    and b.get("type") == "tool_result"
)
```


## s05 TODO

这里是一个字段的查找 t["status"]取出当前代办的状态值，完整的语句是一个字典查找，返回状态对应的图标
```python
    [t["status"]]

    icon = {"pending": " ", "in_progress": "▸", "completed": "✓"}[t["status"]]
```



## s06 subAgent

- subAgent一个重要的点在于 subAgent拥有一个干净的上下文环境，用来隔离子任务之间的上下文，尽量保证主任务注意力不偏移
- 同时，subAgent对于主agent来说是作为一个tool一样的存在，可以通过工具进行调用
- subAgent同样拥有tools可以使用，但是其中不能包含创建subAgent的task工具，防止递归重复调用，
- subAgent执行结束后，只返回最后一条的文本信息，中间结果信息等直接抛弃掉了


cc中包含三种subAgent： 
- Normal Subagent
指定了 subagent_type（normal path）  

- Fork Subagent
没指定 subagent_type，fork gate 开启

- General-Purpose
没指定 subagent_type，fork gate 关闭

forkAgent
<!-- 它使用的不是完整的空白上下文，而是充分利用主agent的上下文（system_prompt、和tools完全相同，历史对话message则是去一部分作为前缀），使用这种方式能够保证缓存命中，这样成本更低，响应速度也会变快 -->

它使用的不是空白上下文，而是直接克隆一份主agent的完整上下文，再在后边添加子agent的新消息，使用这种方式能够保证缓存命中，这样成本更低，响应速度也会变快。

注意如果主agent的历史对话已经比较多了的情况下，那么forkAgent的上下文会被压缩


```py
# 父 Agent 的上下文
父上下文 = {
    "system_prompt": "你是一个编程助手...",  # 很长（几千字）
    "tools": [bash, read_file, write_file, ...],  # 工具定义
    "messages": [  # 历史对话
        {"role": "user", "content": "重构整个项目"},
        {"role": "assistant", "content": "好的，我计划..."},
        # ... 很多轮对话
    ]
}

# Fork Agent（共享缓存）
子上下文 = {
    "system_prompt": "你是一个编程助手...",  # ← 完全一致
    "tools": [bash, read_file, write_file, ...],  # ← 完全一致
    "messages": [
        # ← 保留父 Agent 的前缀消息（缓存命中！）
        {"role": "user", "content": "重构整个项目"},
        {"role": "assistant", "content": "好的，我计划..."},
        # 然后追加新的消息
        {"role": "user", "content": "检查测试文件（子任务）"}
    ]
}
# 优势：API 识别出前缀完全一致，直接使用缓存结果，跳过重复计算
```


## s07 Skill

对于skill的内容，Skill.md的完整内容是在系统加载时就完整加载到系统内存当中了，但是放入systemPrompt的只有name以及description的部分，当执行对应skill的时候从内存中取出skill完整的content，不需要再去遍历目录，减少风险

核心： 懒加载机制



## s08 content compact

设计的规则：
1. 便宜的先跑，贵的后跑
2. 能改文本，不删整条
3. 能删整条，不调llm

一个主要的压缩的流程，注意步骤之间的执行顺序： 

CC 源码 query.ts 中的真实顺序：

applyToolResultBudget（L379）：先处理大结果，确保完整内容落盘
snipCompact（L403）：裁中间消息
microcompact（L414）：旧结果占位
contextCollapse（L441）：独立的上下文管理系统（教学版无）
autoCompact（L454）：LLM 全量摘要
教学版的 budget → snip → micro 顺序与此一致。教学版没有 contextCollapse 机制。

## s09 memory

通过对于记忆进行管理，保证一些约束等信息不会因为压缩而丢失，比如对话中添加约束“用tab进行缩进而非空格”可能被摘要压缩为“用户有代码风格偏好” 导致细节丢失，
同时，使用memory能够实现上下文跨项目。

对话启动，将memory的索引注入到系统提示词，每次llm选择所关联的memory，将完整内容注入，每轮结束后对最近对话片段是否添加新的memory，再判断是否需要对memory进行dream整理

## s10 Task System

相较于todo list，Task System关注的是整个项目的任务划分？任务Task以json文件的形式存储在/.task文件夹下，归属于项目，而非对话，除了任务项，还包含任务项之间的依赖关系。可以为后续的multi agent打下基础，

## s11 Background Tasks

Background Tasks一个主要的思路是让等待部分任务执行的同时，去执行其他的任务，不需要将整个agentLoop阻塞。而对于后台执行的task，在后续轮次开始时再收集前边的后台task的执行结果。

要实现后续的收集，使用BackgroundManager来管理后台任务，保存后台任务的执行状态和结果，BackgroundManager用多个列表管理正在后台执行的操作，以及保存了已经执行完成（成功及运行结果，或者失败及失败原因），等待下一次AgentLoop循坏的开始收集执行的结果。
另外，对于后台运行的tool_use，会即刻返回tool_result，而工具真实的执行结果使用<task_notification>（不复用 tool_use_id）包括添加到上下文。

## s12 Cron task

想要扩展agent定时执行任务的能力，引入cron机制，cron是一个单独的daemon线程，包含有一个任务列表存放定时任务信息，每过一段时间（比如1s）进行一次检查是否到达了某些任务的执行时间，是的话将任务放置到执行队列，等待agent空闲时执行对应的任务。

1. cron线程只负责是否有定时任务需要执行，不负责具体的执行，真正的执行由agent空闲时操作。
2. 定时任务也还划分为一次性任务和循环任务，session-only任务和durable任务。
3. 任务中包含了last_fired字段，防止重复的入队。
