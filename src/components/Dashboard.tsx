import { useState, useEffect, useCallback } from 'react'
import { blink } from '../blink/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { 
  FileText, 
  HelpCircle, 
  BarChart3, 
  Plus,
  Clock,
  CheckCircle,
  Users,
  TrendingUp
} from 'lucide-react'

type User = {
  id: string
  email: string
  displayName?: string
}

type Test = {
  id: string
  title: string
  description: string
  isActive: string
  createdAt: string
}

type DashboardStats = {
  totalTests: number
  totalQuestions: number
  totalAttempts: number
  averageScore: number
}

interface DashboardProps {
  user: User
  onNavigate: (view: string) => void
}

export default function Dashboard({ user, onNavigate }: DashboardProps) {
  const [tests, setTests] = useState<Test[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    totalTests: 0,
    totalQuestions: 0,
    totalAttempts: 0,
    averageScore: 0
  })
  const [loading, setLoading] = useState(true)

  const loadDashboardData = useCallback(async () => {
    try {
      // Load recent tests
      const testsData = await blink.db.tests.list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        limit: 5
      })
      setTests(testsData)

      // Load statistics
      const allTests = await blink.db.tests.list({
        where: { userId: user.id }
      })

      const allQuestions = await blink.db.questions.list({
        where: { userId: user.id }
      })

      const allAttempts = await blink.db.testAttempts.list({
        where: { userId: user.id }
      })

      const totalScore = allAttempts.reduce((sum, attempt) => sum + attempt.score, 0)
      const averageScore = allAttempts.length > 0 ? Math.round((totalScore / allAttempts.length) * 100) / 100 : 0

      setStats({
        totalTests: allTests.length,
        totalQuestions: allQuestions.length,
        totalAttempts: allAttempts.length,
        averageScore
      })
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-slate-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTests}</div>
            <p className="text-xs text-muted-foreground">
              Tests created by you
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalQuestions}</div>
            <p className="text-xs text-muted-foreground">
              Questions in your tests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Test Attempts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAttempts}</div>
            <p className="text-xs text-muted-foreground">
              Total attempts made
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageScore}%</div>
            <p className="text-xs text-muted-foreground">
              Across all attempts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('create-test')}>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Plus className="h-5 w-5 mr-2 text-blue-600" />
              Create New Test
            </CardTitle>
            <CardDescription>
              Build a new test with multiple choice questions
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('questions')}>
          <CardHeader>
            <CardTitle className="flex items-center">
              <HelpCircle className="h-5 w-5 mr-2 text-green-600" />
              Manage Questions
            </CardTitle>
            <CardDescription>
              Add, edit, and organize your questions by groups
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('statistics')}>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-purple-600" />
              View Statistics
            </CardTitle>
            <CardDescription>
              Analyze test performance and user results
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Recent Tests */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Tests</CardTitle>
          <CardDescription>Your latest created tests</CardDescription>
        </CardHeader>
        <CardContent>
          {tests.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 mb-4">No tests created yet</p>
              <Button onClick={() => onNavigate('create-test')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Test
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {tests.map((test) => (
                <div key={test.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900">{test.title}</h3>
                    <p className="text-sm text-slate-600 mt-1">{test.description}</p>
                    <div className="flex items-center mt-2 space-x-4">
                      <div className="flex items-center text-xs text-slate-500">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(test.createdAt).toLocaleDateString()}
                      </div>
                      <Badge variant={Number(test.isActive) > 0 ? "default" : "secondary"}>
                        {Number(test.isActive) > 0 ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => onNavigate('take-test')}>
                      Take Test
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onNavigate('statistics')}>
                      View Stats
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}