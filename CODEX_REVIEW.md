# Codex Review Report

**审查类型**: 计划/方案审查
**审查对象**: 皇室战争锦标赛排名计算器设计文档
**文件路径**: `docs/superpowers/specs/2026-04-05-cr-tournament-calculator-design.md`
**开始时间**: 2026-04-05
**配置**: MAX_ROUNDS=3, THRESHOLD=7, AUTO_FIX=true

---

## Round 1 — 2026-04-05

**Codex 评分**: 4/10
**来源**: Codex (gpt-5.4, xhigh reasoning)

### 问题列表
| # | 严重程度 | 问题 | Claude 判定 | 处置 |
|---|---------|------|------------|------|
| 1 | CRITICAL | 验证是同模型自证，不是外部有效性验证 | PARTIALLY_AGREE | 已修复: 加入模型局限性说明和使用建议 |
| 2 | CRITICAL | 输出语义超过模型能力（确定性阈值 vs 概率命题） | AGREE | 已修复: 改用 Binomial 晋级概率输出 |
| 3 | MAJOR | 排名定义在无限时和有截止之间摇摆 | PARTIALLY_AGREE | 已修复: 明确 v1 以"赛前/赛后估算"为主，live 查询加 disclaimer |
| 4 | MAJOR | 退赛模型过于简化 | PARTIALLY_AGREE | 已修复: 明确 α 是敏感性分析参数 |
| 5 | MAJOR | 缺少里程碑和退出准则 | AGREE | 已修复: 加入三阶段实现计划 |
| 6 | MAJOR | 数值稳定性和前端细节被低估 | AGREE | 已修复: 改用递推公式，热力图换 Canvas，MC 限制规模 |
| 7 | MAJOR | "预测最终排名"统计上危险 | AGREE | 已修复: 加 disclaimer + 个人胜率滑块 |
| 8 | SUGGESTION | 科研定位偏弱，应定位为产品 | AGREE | 已修复: 概述改为产品定位，去掉"稳进"措辞 |

### Codex 原始回复
<details><summary>展开</summary>

Codex 评分 4/10，核心问题是"当前证据不足以支持当前 claim"。主要指出：
1. 同模型自证不算外部验证
2. 期望值不等于概率保证，输出"稳进"是假确定性
3. 无限时模型和有截止赛事之间定义不一致
4. 退赛模型过于简化
5. 缺乏实现阶段和退出准则
6. 递推公式优于直接组合数
7. 15-0 玩家的后续预测不应用 50% 胜率
8. 建议定位为产品而非科研

亮点：问题定义清楚、NegBin 零阶基线选择正确、模式 3/4 比模式 2 更有价值。

</details>

---
