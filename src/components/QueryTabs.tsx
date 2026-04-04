import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  queryRankFromWins,
  queryWinsToRank,
  querySafePlayerCount,
  promotionProbability,
} from "@/lib/math"
import type { TournamentParams } from "@/components/ParameterPanel"
import { paramsToMathArgs } from "@/components/ParameterPanel"

interface QueryTabsProps {
  params: TournamentParams
}

export function QueryTabs({ params }: QueryTabsProps) {
  const { rFull, alpha, n } = paramsToMathArgs(params)

  // 模式1：胜场→排名
  const [wins1, setWins1] = useState(12)
  // 模式3：鲁棒性分析
  const [wins3, setWins3] = useState(12)
  const [nMin, setNMin] = useState(100000)
  const [nMax, setNMax] = useState(500000)
  // 模式4：安全人数
  const [wins4, setWins4] = useState(12)

  // 模式1 计算
  const rankResult =
    wins1 >= 0
      ? queryRankFromWins(wins1, rFull, alpha, n)
      : null

  const promoProb =
    wins1 >= 0
      ? promotionProbability(wins1, rFull, alpha, n, params.targetRank)
      : 0

  // 模式2：名次→胜场
  const winsToRankResult = queryWinsToRank(rFull, alpha, n, params.targetRank, 0.95)

  // 模式3：N 范围扫描（10 点）
  const sweepPoints: Array<{
    N: number
    prob: number
    safe: boolean
  }> = (() => {
    if (nMin >= nMax) return []
    const step = (nMax - nMin) / 9
    return Array.from({ length: 10 }, (_, i) => {
      const N = Math.round(nMin + i * step)
      const prob = promotionProbability(wins3, rFull, alpha, N, params.targetRank)
      return { N, prob, safe: prob >= 0.95 }
    })
  })()

  // 模式4：安全人数
  const safeCount =
    wins4 >= 0
      ? querySafePlayerCount(wins4, rFull, alpha, params.targetRank, 0.95)
      : null

  return (
    <Tabs defaultValue="mode1">
      <TabsList className="grid grid-cols-4 w-full">
        <TabsTrigger value="mode1" className="text-xs">胜场→排名</TabsTrigger>
        <TabsTrigger value="mode2" className="text-xs">名次→胜场</TabsTrigger>
        <TabsTrigger value="mode3" className="text-xs">鲁棒性分析</TabsTrigger>
        <TabsTrigger value="mode4" className="text-xs">安全人数</TabsTrigger>
      </TabsList>

      {/* 模式1：给定胜场，查询期望排名 */}
      <TabsContent value="mode1">
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mode1-wins-input">胜场数</Label>
              <Input
                id="mode1-wins-input"
                type="number"
                min={0}
                max={100}
                value={wins1}
                onChange={(e) => setWins1(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-32 h-8"
              />
            </div>

            {rankResult && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold text-blue-400">
                      #{rankResult.optimisticRank.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">乐观排名（期望）</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold text-orange-400">
                      #{rankResult.conservativeRank.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">保守排名（95% 置信）</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">晋级概率：</span>
                  <Badge
                    variant={promoProb >= 0.95 ? "default" : promoProb >= 0.5 ? "secondary" : "destructive"}
                    className="text-sm"
                  >
                    {(promoProb * 100).toFixed(1)}%
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    （进入前 {params.targetRank.toLocaleString()} 名）
                  </span>
                </div>

                <div className="text-sm text-muted-foreground">
                  百分位：你超过了{" "}
                  <strong>{rankResult.percentile.toFixed(1)}%</strong> 的玩家
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* 模式2：名次→胜场，概率条 */}
      <TabsContent value="mode2">
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="text-sm text-muted-foreground">
              目标排名：<strong>前 {params.targetRank.toLocaleString()} 名</strong>
              所需胜场分析（95% 安全胜场：
              <strong className="text-green-600 ml-1">
                {winsToRankResult.safeWins} 胜
              </strong>
              ）
            </div>

            <div className="space-y-1 max-h-64 overflow-y-auto">
              {winsToRankResult.probByWins
                .filter((_, i) => i <= winsToRankResult.safeWins + 5)
                .map(({ wins, probability }) => (
                  <div key={wins} className="flex items-center gap-2">
                    <span className="w-16 text-xs text-right text-muted-foreground shrink-0">
                      {wins} 胜
                    </span>
                    <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden">
                      <div
                        className={`h-full rounded-sm transition-all ${
                          wins === winsToRankResult.safeWins
                            ? "bg-green-500"
                            : probability >= 0.95
                            ? "bg-green-400"
                            : probability >= 0.5
                            ? "bg-yellow-400"
                            : "bg-red-400"
                        }`}
                        style={{ width: `${Math.min(probability * 100, 100)}%` }}
                      />
                    </div>
                    <span className="w-16 text-xs text-muted-foreground shrink-0">
                      {(probability * 100).toFixed(1)}%
                    </span>
                    {wins === winsToRankResult.safeWins && (
                      <Badge variant="outline" className="text-xs shrink-0 text-green-600 border-green-600">
                        95% 安全
                      </Badge>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* 模式3：鲁棒性分析 */}
      <TabsContent value="mode3">
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="mode3-wins-input" className="text-xs">胜场数</Label>
                <Input
                  id="mode3-wins-input"
                  type="number"
                  min={0}
                  value={wins3}
                  onChange={(e) => setWins3(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mode3-n-min-input" className="text-xs">N 最小值</Label>
                <Input
                  id="mode3-n-min-input"
                  type="number"
                  min={1000}
                  value={nMin}
                  onChange={(e) => setNMin(Math.max(1000, parseInt(e.target.value) || 1000))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mode3-n-max-input" className="text-xs">N 最大值</Label>
                <Input
                  id="mode3-n-max-input"
                  type="number"
                  min={1000}
                  value={nMax}
                  onChange={(e) => setNMax(Math.max(nMin + 1, parseInt(e.target.value) || nMin + 1))}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="grid grid-cols-3 text-xs text-muted-foreground font-medium pb-1 border-b">
                <span>参与人数</span>
                <span>晋级概率</span>
                <span>状态</span>
              </div>
              {sweepPoints.map(({ N, prob, safe }) => (
                <div key={N} className="grid grid-cols-3 text-sm py-0.5">
                  <span>{N.toLocaleString()}</span>
                  <span className={safe ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                    {(prob * 100).toFixed(1)}%
                  </span>
                  <span>
                    <Badge
                      variant={safe ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {safe ? "安全" : "危险"}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* 模式4：安全人数上限 */}
      <TabsContent value="mode4">
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mode4-wins-input">胜场数</Label>
              <Input
                id="mode4-wins-input"
                type="number"
                min={0}
                value={wins4}
                onChange={(e) => setWins4(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-32 h-8"
              />
            </div>

            {safeCount && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {wins4} 胜能稳进前 {params.targetRank.toLocaleString()} 名的最大参与人数：
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-xl font-bold text-green-600">
                      {safeCount.maxPlayers80.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">80% 置信</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center bg-muted/30">
                    <div className="text-xl font-bold text-blue-400">
                      {safeCount.maxPlayers.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">95% 置信</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-xl font-bold text-orange-400">
                      {safeCount.maxPlayers99.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">99% 置信</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  即：当参与人数不超过上述数值时，{wins4} 胜有对应置信度能进入前{" "}
                  {params.targetRank.toLocaleString()} 名
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
