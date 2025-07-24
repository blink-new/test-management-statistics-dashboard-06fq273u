import React, { useState, useEffect, useCallback } from 'react'
import { blink } from '../blink/client'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Area, AreaChart
} from 'recharts'
import { 
  TrendingUp, Users, FileText, Target, Download, Calendar,
  Award, Clock, BarChart3, PieChart as PieChartIcon
} from 'lucide-react'
import { toast } from 'sonner'

interface Test {
  id: string
  title: string
  description: string
  created_at: string
}

interface TestAttempt {
  id: string
  test_id: string
  user_id: string
  score: number
  total_questions: number
  started_at: string
  completed_at: string
}

interface Question {
  id: string
  test_id: string
  question_text: string
  group_name: string
  correct_answer: string
}

interface UserAnswer {
  id: string
  attempt_id: string
  question_id: string
  selected_answer: string
  is_correct: string
}

interface StatsSummary {
  totalTests: number
  totalAttempts: number
  totalQuestions: number
  averageScore: number
  completionRate: number
  totalUsers: number
}

interface TestPerformance {
  test_id: string
  test_title: string
  attempts: number
  average_score: number
  completion_rate: number
}

interface QuestionAnalysis {
  question_id: string
  question_text: string
  group_name: string
  correct_rate: number
  total_attempts: number
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export default function Statistics() {
  const [user, setUser] = useState<any>(null)
  const [tests, setTests] = useState<Test[]>([])
  const [selectedTest, setSelectedTest] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<string>('30')
  const [statsSummary, setStatsSummary] = useState<StatsSummary>({
    totalTests: 0,
    totalAttempts: 0,
    totalQuestions: 0,
    averageScore: 0,
    completionRate: 0,
    totalUsers: 0
  })
  const [testPerformance, setTestPerformance] = useState<TestPerformance[]>([])
  const [questionAnalysis, setQuestionAnalysis] = useState<QuestionAnalysis[]>([])
  const [scoreDistribution, setScoreDistribution] = useState<any[]>([])
  const [dailyAttempts, setDailyAttempts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
    })
    return unsubscribe
  }, [])

  const loadStatistics = useCallback(async () => {
    if (!user) return
    
    setLoading(true)
    try {
      // Load tests
      const testsData = await blink.db.tests.list({
        orderBy: { created_at: 'desc' }
      })
      setTests(testsData)

      // Load all attempts
      const attempts = await blink.db.test_attempts.list({
        where: { completed_at: { not: null } },
        orderBy: { completed_at: 'desc' }
      })

      // Load all questions
      const questions = await blink.db.questions.list()

      // Load all user answers
      const userAnswers = await blink.db.user_answers.list()

      // Calculate summary statistics
      const uniqueUsers = new Set(attempts.map(a => a.user_id)).size
      const totalScore = attempts.reduce((sum, a) => sum + a.score, 0)
      const averageScore = attempts.length > 0 ? totalScore / attempts.length : 0
      const completedAttempts = attempts.filter(a => a.completed_at).length
      const completionRate = attempts.length > 0 ? (completedAttempts / attempts.length) * 100 : 0

      setStatsSummary({
        totalTests: testsData.length,
        totalAttempts: attempts.length,
        totalQuestions: questions.length,
        averageScore: Math.round(averageScore),
        completionRate: Math.round(completionRate),
        totalUsers: uniqueUsers
      })

      // Calculate test performance
      const testStats = testsData.map(test => {
        const testAttempts = attempts.filter(a => a.test_id === test.id)
        const avgScore = testAttempts.length > 0 
          ? testAttempts.reduce((sum, a) => sum + a.score, 0) / testAttempts.length 
          : 0
        const completed = testAttempts.filter(a => a.completed_at).length
        const completionRate = testAttempts.length > 0 ? (completed / testAttempts.length) * 100 : 0

        return {
          test_id: test.id,
          test_title: test.title,
          attempts: testAttempts.length,
          average_score: Math.round(avgScore),
          completion_rate: Math.round(completionRate)
        }
      })
      setTestPerformance(testStats)

      // Calculate question analysis
      const questionStats = questions.map(question => {
        const questionAnswers = userAnswers.filter(ua => ua.question_id === question.id)
        const correctAnswers = questionAnswers.filter(ua => Number(ua.is_correct) > 0).length
        const correctRate = questionAnswers.length > 0 ? (correctAnswers / questionAnswers.length) * 100 : 0

        return {
          question_id: question.id,
          question_text: question.question_text.substring(0, 50) + '...',
          group_name: question.group_name,
          correct_rate: Math.round(correctRate),
          total_attempts: questionAnswers.length
        }
      }).filter(q => q.total_attempts > 0)
      setQuestionAnalysis(questionStats)

      // Calculate score distribution
      const scoreRanges = [
        { range: '0-20%', count: 0, color: '#ef4444' },
        { range: '21-40%', count: 0, color: '#f59e0b' },
        { range: '41-60%', count: 0, color: '#eab308' },
        { range: '61-80%', count: 0, color: '#10b981' },
        { range: '81-100%', count: 0, color: '#2563eb' }
      ]

      attempts.forEach(attempt => {
        if (attempt.score <= 20) scoreRanges[0].count++
        else if (attempt.score <= 40) scoreRanges[1].count++
        else if (attempt.score <= 60) scoreRanges[2].count++
        else if (attempt.score <= 80) scoreRanges[3].count++
        else scoreRanges[4].count++
      })
      setScoreDistribution(scoreRanges)

      // Calculate daily attempts for the last 30 days
      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - (29 - i))
        return {
          date: date.toISOString().split('T')[0],
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          attempts: 0
        }
      })

      attempts.forEach(attempt => {
        if (attempt.completed_at) {
          const attemptDate = new Date(attempt.completed_at).toISOString().split('T')[0]
          const dayData = last30Days.find(d => d.date === attemptDate)
          if (dayData) {
            dayData.attempts++
          }
        }
      })
      setDailyAttempts(last30Days)

    } catch (error) {
      console.error('Error loading statistics:', error)
      toast.error('Failed to load statistics')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadStatistics()
    }
  }, [user, loadStatistics])

  const exportData = async () => {
    try {
      const data = {
        summary: statsSummary,
        testPerformance,
        questionAnalysis,
        scoreDistribution,
        dailyAttempts,
        exportedAt: new Date().toISOString()
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `test-statistics-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success('Statistics exported successfully!')
    } catch (error) {
      console.error('Error exporting data:', error)
      toast.error('Failed to export data')
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Please sign in to view statistics</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Statistics & Analytics</h1>
        <div className="flex items-center space-x-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportData} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Tests</p>
                <p className="text-2xl font-bold">{statsSummary.totalTests}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Attempts</p>
                <p className="text-2xl font-bold">{statsSummary.totalAttempts}</p>
              </div>
              <Target className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Questions</p>
                <p className="text-2xl font-bold">{statsSummary.totalQuestions}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Score</p>
                <p className="text-2xl font-bold">{statsSummary.averageScore}%</p>
              </div>
              <Award className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completion</p>
                <p className="text-2xl font-bold">{statsSummary.completionRate}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-indigo-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Users</p>
                <p className="text-2xl font-bold">{statsSummary.totalUsers}</p>
              </div>
              <Users className="w-8 h-8 text-cyan-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Test Performance</TabsTrigger>
          <TabsTrigger value="questions">Question Analysis</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Score Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChartIcon className="w-5 h-5 mr-2" />
                  Score Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={scoreDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ range, count }) => count > 0 ? `${range}: ${count}` : ''}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {scoreDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Daily Attempts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Daily Test Attempts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dailyAttempts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="attempts" stroke="#2563eb" fill="#2563eb" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Performance Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={testPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="test_title" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="average_score" fill="#2563eb" name="Average Score %" />
                  <Bar dataKey="attempts" fill="#10b981" name="Total Attempts" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Question Difficulty Analysis</CardTitle>
              <p className="text-sm text-gray-600">Questions with lowest correct rates may need review</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {questionAnalysis
                  .sort((a, b) => a.correct_rate - b.correct_rate)
                  .slice(0, 10)
                  .map((question, index) => (
                    <div key={question.question_id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <Badge variant="outline">{question.group_name}</Badge>
                          <span className="text-sm text-gray-500">
                            {question.total_attempts} attempts
                          </span>
                        </div>
                        <p className="text-sm">{question.question_text}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${
                          question.correct_rate < 50 ? 'text-red-600' :
                          question.correct_rate < 75 ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {question.correct_rate}%
                        </div>
                        <div className="text-xs text-gray-500">correct rate</div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={dailyAttempts}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="attempts" stroke="#2563eb" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}