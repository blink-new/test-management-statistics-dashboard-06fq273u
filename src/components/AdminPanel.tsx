import React, { useState, useEffect, useCallback } from 'react'
import { blink } from '../blink/client'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Switch } from './ui/switch'
import { 
  Settings, Users, FileText, BarChart3, Trash2, Edit, 
  Download, Upload, RefreshCw, Shield, Database, 
  Activity, Clock, CheckCircle, XCircle, AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'

interface Test {
  id: string
  title: string
  description: string
  created_at: string
  is_active?: boolean
}

interface TestAttempt {
  id: string
  test_id: string
  user_id: string
  score: number
  total_questions: number
  started_at: string
  completed_at: string | null
}

interface Question {
  id: string
  test_id: string
  question_text: string
  group_name: string
  created_at: string
}

interface SystemStats {
  totalTests: number
  totalQuestions: number
  totalAttempts: number
  totalUsers: number
  averageScore: number
  completionRate: number
  activeTests: number
  recentActivity: number
}

interface UserActivity {
  user_id: string
  user_email: string
  total_attempts: number
  average_score: number
  last_activity: string
  status: 'active' | 'inactive'
}

export default function AdminPanel() {
  const [user, setUser] = useState<any>(null)
  const [tests, setTests] = useState<Test[]>([])
  const [attempts, setAttempts] = useState<TestAttempt[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalTests: 0,
    totalQuestions: 0,
    totalAttempts: 0,
    totalUsers: 0,
    averageScore: 0,
    completionRate: 0,
    activeTests: 0,
    recentActivity: 0
  })
  const [userActivity, setUserActivity] = useState<UserActivity[]>([])
  const [selectedTimeRange, setSelectedTimeRange] = useState('30')
  const [loading, setLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
    })
    return unsubscribe
  }, [])

  const loadAdminData = useCallback(async () => {
    if (!user) return
    
    setLoading(true)
    try {
      // Load all data
      const [testsData, attemptsData, questionsData] = await Promise.all([
        blink.db.tests.list({ orderBy: { created_at: 'desc' } }),
        blink.db.test_attempts.list({ orderBy: { started_at: 'desc' } }),
        blink.db.questions.list({ orderBy: { created_at: 'desc' } })
      ])

      setTests(testsData)
      setAttempts(attemptsData)
      setQuestions(questionsData)

      // Calculate system statistics
      const uniqueUsers = new Set(attemptsData.map(a => a.user_id)).size
      const completedAttempts = attemptsData.filter(a => a.completed_at)
      const totalScore = completedAttempts.reduce((sum, a) => sum + a.score, 0)
      const averageScore = completedAttempts.length > 0 ? totalScore / completedAttempts.length : 0
      const completionRate = attemptsData.length > 0 ? (completedAttempts.length / attemptsData.length) * 100 : 0
      
      // Recent activity (last 7 days)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const recentActivity = attemptsData.filter(a => 
        new Date(a.started_at) > sevenDaysAgo
      ).length

      setSystemStats({
        totalTests: testsData.length,
        totalQuestions: questionsData.length,
        totalAttempts: attemptsData.length,
        totalUsers: uniqueUsers,
        averageScore: Math.round(averageScore),
        completionRate: Math.round(completionRate),
        activeTests: testsData.filter(t => t.is_active !== false).length,
        recentActivity
      })

      // Calculate user activity
      const userMap = new Map<string, UserActivity>()
      
      attemptsData.forEach(attempt => {
        const existing = userMap.get(attempt.user_id)
        if (existing) {
          existing.total_attempts++
          existing.average_score = (existing.average_score + attempt.score) / 2
          if (new Date(attempt.started_at) > new Date(existing.last_activity)) {
            existing.last_activity = attempt.started_at
          }
        } else {
          userMap.set(attempt.user_id, {
            user_id: attempt.user_id,
            user_email: attempt.user_id, // In real app, you'd fetch user details
            total_attempts: 1,
            average_score: attempt.score,
            last_activity: attempt.started_at,
            status: 'active'
          })
        }
      })

      // Determine user status based on last activity
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const userActivityData = Array.from(userMap.values()).map(user => ({
        ...user,
        average_score: Math.round(user.average_score),
        status: new Date(user.last_activity) > thirtyDaysAgo ? 'active' : 'inactive'
      }))

      setUserActivity(userActivityData)

    } catch (error) {
      console.error('Error loading admin data:', error)
      toast.error('Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadAdminData()
    }
  }, [user, loadAdminData])

  const toggleTestStatus = async (testId: string, isActive: boolean) => {
    try {
      await blink.db.tests.update(testId, { is_active: isActive })
      toast.success(`Test ${isActive ? 'activated' : 'deactivated'} successfully!`)
      loadAdminData()
    } catch (error) {
      console.error('Error updating test status:', error)
      toast.error('Failed to update test status')
    }
  }

  const deleteTest = async (testId: string) => {
    try {
      // Delete related questions first
      const testQuestions = questions.filter(q => q.test_id === testId)
      for (const question of testQuestions) {
        await blink.db.questions.delete(question.id)
      }
      
      // Delete test attempts
      const testAttempts = attempts.filter(a => a.test_id === testId)
      for (const attempt of testAttempts) {
        await blink.db.test_attempts.delete(attempt.id)
      }
      
      // Delete the test
      await blink.db.tests.delete(testId)
      
      toast.success('Test and all related data deleted successfully!')
      loadAdminData()
    } catch (error) {
      console.error('Error deleting test:', error)
      toast.error('Failed to delete test')
    }
  }

  const exportAllData = async () => {
    setIsExporting(true)
    try {
      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: user.email,
          version: '1.0'
        },
        systemStats,
        tests,
        questions,
        attempts: attempts.map(a => ({
          ...a,
          user_id: 'anonymized' // Anonymize user data for privacy
        })),
        userActivity: userActivity.map(u => ({
          ...u,
          user_id: 'anonymized',
          user_email: 'anonymized'
        }))
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `admin-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success('Admin data exported successfully!')
    } catch (error) {
      console.error('Error exporting data:', error)
      toast.error('Failed to export data')
    } finally {
      setIsExporting(false)
    }
  }

  const clearOldData = async () => {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const oldAttempts = attempts.filter(a => 
        new Date(a.started_at) < thirtyDaysAgo && !a.completed_at
      )
      
      for (const attempt of oldAttempts) {
        await blink.db.test_attempts.delete(attempt.id)
      }
      
      toast.success(`Cleared ${oldAttempts.length} old incomplete attempts`)
      loadAdminData()
    } catch (error) {
      console.error('Error clearing old data:', error)
      toast.error('Failed to clear old data')
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Please sign in to access admin panel</p>
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
        <div className="flex items-center space-x-3">
          <Shield className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Admin Panel</h1>
        </div>
        <div className="flex items-center space-x-4">
          <Button onClick={loadAdminData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportAllData} disabled={isExporting}>
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export All'}
          </Button>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Health</p>
                <p className="text-2xl font-bold text-green-600">Healthy</p>
              </div>
              <Activity className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Tests</p>
                <p className="text-2xl font-bold">{systemStats.activeTests}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold">{systemStats.totalUsers}</p>
              </div>
              <Users className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Recent Activity</p>
                <p className="text-2xl font-bold">{systemStats.recentActivity}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Tabs */}
      <Tabs defaultValue="tests" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="tests">Test Management</TabsTrigger>
          <TabsTrigger value="users">User Activity</TabsTrigger>
          <TabsTrigger value="attempts">Test Attempts</TabsTrigger>
          <TabsTrigger value="system">System Settings</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="tests" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Management</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test Name</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Avg Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tests.map((test) => {
                    const testQuestions = questions.filter(q => q.test_id === test.id)
                    const testAttempts = attempts.filter(a => a.test_id === test.id)
                    const avgScore = testAttempts.length > 0 
                      ? Math.round(testAttempts.reduce((sum, a) => sum + a.score, 0) / testAttempts.length)
                      : 0
                    
                    return (
                      <TableRow key={test.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{test.title}</div>
                            <div className="text-sm text-gray-500">{test.description}</div>
                          </div>
                        </TableCell>
                        <TableCell>{testQuestions.length}</TableCell>
                        <TableCell>{testAttempts.length}</TableCell>
                        <TableCell>{avgScore}%</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={test.is_active !== false}
                              onCheckedChange={(checked) => toggleTestStatus(test.id, checked)}
                            />
                            <Badge variant={test.is_active !== false ? "default" : "secondary"}>
                              {test.is_active !== false ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button variant="outline" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Test</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the test, all its questions, and all attempt data. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteTest(test.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete Permanently
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Activity Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Total Attempts</TableHead>
                    <TableHead>Average Score</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userActivity.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell>
                        <div className="font-medium">{user.user_email}</div>
                        <div className="text-sm text-gray-500">ID: {user.user_id.substring(0, 8)}...</div>
                      </TableCell>
                      <TableCell>{user.total_attempts}</TableCell>
                      <TableCell>{user.average_score}%</TableCell>
                      <TableCell>{new Date(user.last_activity).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={user.status === 'active' ? "default" : "secondary"}>
                          {user.status === 'active' ? (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 mr-1" />
                              Inactive
                            </>
                          )}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attempts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Test Attempts</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.slice(0, 20).map((attempt) => {
                    const test = tests.find(t => t.id === attempt.test_id)
                    return (
                      <TableRow key={attempt.id}>
                        <TableCell>
                          <div className="font-medium">{test?.title || 'Unknown Test'}</div>
                        </TableCell>
                        <TableCell>{attempt.user_id.substring(0, 8)}...</TableCell>
                        <TableCell>
                          <Badge variant={attempt.score >= 70 ? "default" : attempt.score >= 50 ? "secondary" : "destructive"}>
                            {attempt.score}%
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(attempt.started_at).toLocaleString()}</TableCell>
                        <TableCell>
                          {attempt.completed_at 
                            ? new Date(attempt.completed_at).toLocaleString()
                            : 'In Progress'
                          }
                        </TableCell>
                        <TableCell>
                          <Badge variant={attempt.completed_at ? "default" : "secondary"}>
                            {attempt.completed_at ? (
                              <>
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Completed
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 mr-1" />
                                In Progress
                              </>
                            )}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>System Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Tests:</span>
                  <span className="font-semibold">{systemStats.totalTests}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Questions:</span>
                  <span className="font-semibold">{systemStats.totalQuestions}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Attempts:</span>
                  <span className="font-semibold">{systemStats.totalAttempts}</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Score:</span>
                  <span className="font-semibold">{systemStats.averageScore}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Completion Rate:</span>
                  <span className="font-semibold">{systemStats.completionRate}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Allow Guest Access</Label>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Auto-Save Progress</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Email Notifications</Label>
                  <Switch defaultChecked />
                </div>
                <div className="space-y-2">
                  <Label>Default Time Limit (minutes)</Label>
                  <Input type="number" defaultValue="60" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="w-5 h-5 mr-2" />
                  Database Maintenance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Clear Old Data</p>
                    <p className="text-sm text-gray-500">Remove incomplete attempts older than 30 days</p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Clean Up
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear Old Data</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete incomplete test attempts older than 30 days. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={clearOldData}>
                          Clear Data
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  System Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm">System is running normally</span>
                  </div>
                  <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <span className="text-sm">Database performance is optimal</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}