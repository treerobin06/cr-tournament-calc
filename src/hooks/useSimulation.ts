/**
 * useSimulation - 管理 Web Worker 生命周期的 React Hook
 * 提供 run / cancel / running / progress / result 接口
 */
import { useState, useRef, useCallback } from 'react'
import type { SimConfig, SimResult } from '@/workers/simulation.worker'

interface SimulationState {
  running: boolean
  progress: number         // 0~1
  result: SimResult | null
}

export function useSimulation() {
  const [state, setState] = useState<SimulationState>({
    running: false,
    progress: 0,
    result: null,
  })

  // 持有当前 Worker 引用，以便 cancel 时终止
  const workerRef = useRef<Worker | null>(null)

  const cancel = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }
    setState(prev => ({ ...prev, running: false }))
  }, [])

  const run = useCallback((config: SimConfig) => {
    // 先取消之前可能在跑的 Worker
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }

    setState({ running: true, progress: 0, result: null })

    // Vite 的 Worker import 语法
    const worker = new Worker(
      new URL('../workers/simulation.worker.ts', import.meta.url),
      { type: 'module' }
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent) => {
      const data = e.data as { type: string; progress?: number; result?: SimResult }
      if (data.type === 'progress') {
        setState(prev => ({ ...prev, progress: data.progress ?? prev.progress }))
      } else if (data.type === 'result') {
        workerRef.current = null
        setState({
          running: false,
          progress: 1,
          result: data.result ?? null,
        })
      }
    }

    worker.onerror = (err) => {
      console.error('[simulation.worker] 错误:', err)
      workerRef.current = null
      setState(prev => ({ ...prev, running: false }))
    }

    worker.postMessage(config)
  }, [])

  return {
    run,
    cancel,
    running: state.running,
    progress: state.progress,
    result: state.result,
  }
}
