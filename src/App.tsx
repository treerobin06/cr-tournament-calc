import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

function App() {
  return (
    <div className="min-h-screen bg-background p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">皇室战争锦标赛排名计算器</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">正在加载计算器...</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default App
