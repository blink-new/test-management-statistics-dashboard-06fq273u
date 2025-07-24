import React, { useState, useEffect, useCallback } from 'react'
import { blink } from '../blink/client'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { 
  Plus, Edit, Trash2, Search, Filter, BookOpen, 
  CheckCircle, XCircle, Eye, Copy, Download, Upload
} from 'lucide-react'
import { toast } from 'sonner'
import ImportQuestions from './ImportQuestions'

interface Test {
  id: string
  title: string
  description: string
  created_at: string
}

interface Question {
  id: string
  test_id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: string
  group_name: string
  created_at: string
}

interface QuestionGroup {
  name: string
  count: number
}

export default function QuestionManagement() {
  const [user, setUser] = useState<any>(null)
  const [tests, setTests] = useState<Test[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([])
  const [groups, setGroups] = useState<QuestionGroup[]>([])
  const [selectedTest, setSelectedTest] = useState<string>('all')
  const [selectedGroup, setSelectedGroup] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Form state for new/edit question
  const [formData, setFormData] = useState({
    test_id: '',
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'A',
    group_name: ''
  })

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
    })
    return unsubscribe
  }, [])

  const loadData = useCallback(async () => {
    if (!user) return
    
    setLoading(true)
    try {
      // Load tests
      const testsData = await blink.db.tests.list({
        orderBy: { created_at: 'desc' }
      })
      setTests(testsData)

      // Load questions
      const questionsData = await blink.db.questions.list({
        orderBy: { created_at: 'desc' }
      })
      setQuestions(questionsData)

      // Calculate groups
      const groupMap = new Map<string, number>()
      questionsData.forEach(q => {
        groupMap.set(q.group_name, (groupMap.get(q.group_name) || 0) + 1)
      })
      const groupsData = Array.from(groupMap.entries()).map(([name, count]) => ({
        name,
        count
      }))
      setGroups(groupsData)

    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user, loadData])

  // Filter questions based on selected filters and search
  useEffect(() => {
    let filtered = questions

    if (selectedTest !== 'all') {
      filtered = filtered.filter(q => q.test_id === selectedTest)
    }

    if (selectedGroup !== 'all') {
      filtered = filtered.filter(q => q.group_name === selectedGroup)
    }

    if (searchTerm) {
      filtered = filtered.filter(q => 
        q.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.group_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredQuestions(filtered)
  }, [questions, selectedTest, selectedGroup, searchTerm])

  const resetForm = () => {
    setFormData({
      test_id: '',
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'A',
      group_name: ''
    })
    setEditingQuestion(null)
  }

  const openEditDialog = (question: Question) => {
    setEditingQuestion(question)
    setFormData({
      test_id: question.test_id,
      question_text: question.question_text,
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
      correct_answer: question.correct_answer,
      group_name: question.group_name
    })
    setIsDialogOpen(true)
  }

  const openCreateDialog = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.test_id || !formData.question_text || !formData.option_a || 
        !formData.option_b || !formData.option_c || !formData.option_d || !formData.group_name) {
      toast.error('Please fill in all fields')
      return
    }

    try {
      if (editingQuestion) {
        // Update existing question
        await blink.db.questions.update(editingQuestion.id, formData)
        toast.success('Question updated successfully!')
      } else {
        // Create new question
        const questionId = `question_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        await blink.db.questions.create({
          id: questionId,
          ...formData,
          created_at: new Date().toISOString()
        })
        toast.success('Question created successfully!')
      }

      setIsDialogOpen(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving question:', error)
      toast.error('Failed to save question')
    }
  }

  const handleDelete = async (questionId: string) => {
    try {
      await blink.db.questions.delete(questionId)
      toast.success('Question deleted successfully!')
      loadData()
    } catch (error) {
      console.error('Error deleting question:', error)
      toast.error('Failed to delete question')
    }
  }

  const duplicateQuestion = async (question: Question) => {
    try {
      const questionId = `question_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await blink.db.questions.create({
        id: questionId,
        test_id: question.test_id,
        question_text: `${question.question_text} (Copy)`,
        option_a: question.option_a,
        option_b: question.option_b,
        option_c: question.option_c,
        option_d: question.option_d,
        correct_answer: question.correct_answer,
        group_name: question.group_name,
        created_at: new Date().toISOString()
      })
      toast.success('Question duplicated successfully!')
      loadData()
    } catch (error) {
      console.error('Error duplicating question:', error)
      toast.error('Failed to duplicate question')
    }
  }

  const exportQuestions = () => {
    try {
      const exportData = {
        questions: filteredQuestions,
        tests: tests.filter(t => filteredQuestions.some(q => q.test_id === t.id)),
        exportedAt: new Date().toISOString(),
        totalQuestions: filteredQuestions.length
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `questions-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success('Questions exported successfully!')
    } catch (error) {
      console.error('Error exporting questions:', error)
      toast.error('Failed to export questions')
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Please sign in to manage questions</p>
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
        <h1 className="text-3xl font-bold">Question Management</h1>
        <div className="flex items-center space-x-4">
          <Button onClick={exportQuestions} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setIsImportOpen(true)} variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingQuestion ? 'Edit Question' : 'Create New Question'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="test_id">Test</Label>
                    <Select value={formData.test_id} onValueChange={(value) => setFormData({...formData, test_id: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a test" />
                      </SelectTrigger>
                      <SelectContent>
                        {tests.map(test => (
                          <SelectItem key={test.id} value={test.id}>
                            {test.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="group_name">Group/Category</Label>
                    <Input
                      id="group_name"
                      value={formData.group_name}
                      onChange={(e) => setFormData({...formData, group_name: e.target.value})}
                      placeholder="e.g., Mathematics, Science"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="question_text">Question Text</Label>
                  <Textarea
                    id="question_text"
                    value={formData.question_text}
                    onChange={(e) => setFormData({...formData, question_text: e.target.value})}
                    placeholder="Enter your question here..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="option_a">Option A</Label>
                    <Input
                      id="option_a"
                      value={formData.option_a}
                      onChange={(e) => setFormData({...formData, option_a: e.target.value})}
                      placeholder="First option"
                    />
                  </div>
                  <div>
                    <Label htmlFor="option_b">Option B</Label>
                    <Input
                      id="option_b"
                      value={formData.option_b}
                      onChange={(e) => setFormData({...formData, option_b: e.target.value})}
                      placeholder="Second option"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="option_c">Option C</Label>
                    <Input
                      id="option_c"
                      value={formData.option_c}
                      onChange={(e) => setFormData({...formData, option_c: e.target.value})}
                      placeholder="Third option"
                    />
                  </div>
                  <div>
                    <Label htmlFor="option_d">Option D</Label>
                    <Input
                      id="option_d"
                      value={formData.option_d}
                      onChange={(e) => setFormData({...formData, option_d: e.target.value})}
                      placeholder="Fourth option"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="correct_answer">Correct Answer</Label>
                  <Select value={formData.correct_answer} onValueChange={(value) => setFormData({...formData, correct_answer: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A - {formData.option_a || 'Option A'}</SelectItem>
                      <SelectItem value="B">B - {formData.option_b || 'Option B'}</SelectItem>
                      <SelectItem value="C">C - {formData.option_c || 'Option C'}</SelectItem>
                      <SelectItem value="D">D - {formData.option_d || 'Option D'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingQuestion ? 'Update Question' : 'Create Question'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search questions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
            
            <Select value={selectedTest} onValueChange={setSelectedTest}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by test" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tests</SelectItem>
                {tests.map(test => (
                  <SelectItem key={test.id} value={test.id}>
                    {test.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {groups.map(group => (
                  <SelectItem key={group.name} value={group.name}>
                    {group.name} ({group.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Badge variant="outline">
              {filteredQuestions.length} questions
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Questions List */}
      <Tabs defaultValue="list" className="space-y-6">
        <TabsList>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="groups">By Groups</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {filteredQuestions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No Questions Found</h3>
                <p className="text-gray-500">
                  {questions.length === 0 
                    ? "No questions have been created yet." 
                    : "No questions match your current filters."
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredQuestions.map((question) => {
              const test = tests.find(t => t.id === question.test_id)
              return (
                <Card key={question.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant="secondary">{question.group_name}</Badge>
                          <Badge variant="outline">{test?.title || 'Unknown Test'}</Badge>
                          <Badge variant={question.correct_answer === 'A' ? 'default' : 'outline'}>
                            Correct: {question.correct_answer}
                          </Badge>
                        </div>
                        
                        <h3 className="font-semibold text-lg mb-3">{question.question_text}</h3>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className={`p-2 rounded ${question.correct_answer === 'A' ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                            <span className="font-semibold">A.</span> {question.option_a}
                            {question.correct_answer === 'A' && <CheckCircle className="w-4 h-4 text-green-600 inline ml-2" />}
                          </div>
                          <div className={`p-2 rounded ${question.correct_answer === 'B' ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                            <span className="font-semibold">B.</span> {question.option_b}
                            {question.correct_answer === 'B' && <CheckCircle className="w-4 h-4 text-green-600 inline ml-2" />}
                          </div>
                          <div className={`p-2 rounded ${question.correct_answer === 'C' ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                            <span className="font-semibold">C.</span> {question.option_c}
                            {question.correct_answer === 'C' && <CheckCircle className="w-4 h-4 text-green-600 inline ml-2" />}
                          </div>
                          <div className={`p-2 rounded ${question.correct_answer === 'D' ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                            <span className="font-semibold">D.</span> {question.option_d}
                            {question.correct_answer === 'D' && <CheckCircle className="w-4 h-4 text-green-600 inline ml-2" />}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => duplicateQuestion(question)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(question)}
                        >
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
                              <AlertDialogTitle>Delete Question</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this question? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(question.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        <TabsContent value="groups" className="space-y-6">
          {groups.map(group => {
            const groupQuestions = filteredQuestions.filter(q => q.group_name === group.name)
            if (groupQuestions.length === 0) return null
            
            return (
              <Card key={group.name}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{group.name}</span>
                    <Badge>{groupQuestions.length} questions</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {groupQuestions.map(question => {
                      const test = tests.find(t => t.id === question.test_id)
                      return (
                        <div key={question.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <Badge variant="outline" className="text-xs">{test?.title}</Badge>
                              <Badge variant={question.correct_answer === 'A' ? 'default' : 'outline'} className="text-xs">
                                {question.correct_answer}
                              </Badge>
                            </div>
                            <p className="text-sm">{question.question_text}</p>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Button variant="ghost" size="sm" onClick={() => duplicateQuestion(question)}>
                              <Copy className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(question)}>
                              <Edit className="w-3 h-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="w-3 h-3 text-red-600" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Question</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this question?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(question.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>
      </Tabs>

      {/* Import Questions Modal */}
      {isImportOpen && (
        <ImportQuestions
          onImportComplete={loadData}
          onClose={() => setIsImportOpen(false)}
        />
      )}
    </div>
  )
}