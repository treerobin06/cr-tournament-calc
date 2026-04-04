import { useEffect, useRef } from "react"
import katex from "katex"
import "katex/dist/katex.min.css"

interface FormulaBlockProps {
  latex: string
  display?: boolean
  description?: string
}

function FormulaBlock({ latex, display = true, description }: FormulaBlockProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      katex.render(latex, ref.current, {
        displayMode: display,
        throwOnError: false,
        output: "html",
      })
    }
  }, [latex, display])

  return (
    <div className="space-y-1">
      <div
        ref={ref}
        className="overflow-x-auto py-2 px-3 bg-[#0F0F23]/50 rounded-lg text-sm"
      />
      {description && (
        <p className="text-xs text-muted-foreground px-1">{description}</p>
      )}
    </div>
  )
}

export function MathInsights() {
  return (
    <div className="card-premium p-6" style={{ background: 'linear-gradient(180deg, rgba(25,23,50,0.95), rgba(20,18,42,0.98))' }}>
      <h3 className="section-title text-gold text-base mb-5">数学原理</h3>
      <div className="space-y-5">
        {/* NegBin PMF */}
        <div className="space-y-2">
          <h4 className="text-amber-400/90 text-sm font-semibold uppercase tracking-wider">
            负二项分布 PMF
          </h4>
          <FormulaBlock
            latex={String.raw`W \sim \mathrm{NegBin}(r,\, p=0.5)`}
            description="玩家胜场数 W 服从负二项分布，r 为最大失败次数，p=0.5 为胜率"
          />
          <FormulaBlock
            latex={String.raw`P(W=k) = \binom{k+r-1}{k} \left(\frac{1}{2}\right)^{k+r}`}
            description="PMF：恰好赢 k 场的概率"
          />
        </div>

        {/* 递推公式 */}
        <div className="space-y-2">
          <h4 className="text-amber-400/90 text-sm font-semibold uppercase tracking-wider">
            递推关系
          </h4>
          <FormulaBlock
            latex={String.raw`P(0) = \left(\frac{1}{2}\right)^r, \quad P(k+1) = P(k) \cdot \frac{k+r}{2(k+1)}`}
            description="高效递推计算，避免大数阶乘"
          />
        </div>

        {/* 衰减比 */}
        <div className="space-y-2">
          <h4 className="text-amber-400/90 text-sm font-semibold uppercase tracking-wider">
            衰减比解读
          </h4>
          <FormulaBlock
            latex={String.raw`\rho(k) = \frac{P(W=k)}{P(W=k-1)} = \frac{k+r-1}{2k}`}
            description="衰减比趋近 1/2（50%）说明每多赢一场的玩家数量约减半"
          />
          <FormulaBlock
            latex={String.raw`\lim_{k \to \infty} \rho(k) = \frac{1}{2}`}
            description="渐近性质：高胜场段的衰减趋向几何分布"
          />
        </div>

        {/* 晋级概率 */}
        <div className="space-y-2">
          <h4 className="text-amber-400/90 text-sm font-semibold uppercase tracking-wider">
            晋级概率（二项分布近似）
          </h4>
          <FormulaBlock
            latex={String.raw`X_k \sim \mathrm{Binomial}(N,\; S(k{+}1))`}
            description="X_k = 比 k 胜者排名更靠前的人数，S(k+1) = P(W > k)"
          />
          <FormulaBlock
            latex={String.raw`\Pr[\text{晋级}] = \Pr[X_k \leq m-1] \approx \Phi\!\left(\frac{m - \frac{1}{2} - N \cdot S(k{+}1)}{\sqrt{N \cdot S(k{+}1)(1-S(k{+}1))}}\right)`}
            description="正态近似（含连续性修正），m = 目标排名，Φ 为标准正态 CDF"
          />
        </div>

        {/* 混合分布 */}
        <div className="space-y-2">
          <h4 className="text-amber-400/90 text-sm font-semibold uppercase tracking-wider">
            混合分布（κ 插值）
          </h4>
          <FormulaBlock
            latex={String.raw`P_{\text{mix}}(k) = \alpha \cdot P_{\mathrm{NB}(r,\,0.5)}(k) + (1-\alpha) \cdot P_{\mathrm{NB}(r-1,\,0.5)}(k)`}
            description="κ = r - (1-α)，允许连续调节分布形状参数"
          />
        </div>
      </div>
    </div>
  )
}
