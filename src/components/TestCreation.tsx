import { useState, useEffect, useCallback } from 'react'
import { blink } from '../blink/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { 
  Plus, 
  Trash2, 
  Save, 
  FileText,
  HelpCircle,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { useToast } from '../hooks/use-toast'

type User = {
  id: string
  email: string
  displayName?: string
}

type Group = {
  id: string
  name: string
  description: string
}

type Question = {
  id: string
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctAnswer: 'A' | 'B' | 'C' | 'D'
  groupId: string
}

interface TestCreationProps {
  user: User
  onNavigate: (view: string) => void
}

export default function TestCreation({ user, onNavigate }: TestCreationProps) {
  const [testTitle, setTestTitle] = useState('')
  const [testDescription, setTestDescription] = useState('')
  const [groups, setGroups] = useState<Group[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDescription, setNewGroupDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const loadGroups = useCallback(async () => {
    try {
      const groupsData = await blink.db.groups.list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' }
      })
      setGroups(groupsData)
    } catch (error) {
      console.error('Error loading groups:', error)
      toast({
        title: "Error",
        description: "Failed to load question groups",
        variant: "destructive"
      })
    }
  }, [user.id, toast])

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  const createGroup = async () => {
    if (!newGroupName.trim()) return

    try {
      const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await blink.db.groups.create({
        id: groupId,
        name: newGroupName,
        description: newGroupDescription,
        userId: user.id
      })

      setGroups(prev => [...prev, {
        id: groupId,
        name: newGroupName,
        description: newGroupDescription
      }])

      setNewGroupName('')
      setNewGroupDescription('')
      
      toast({
        title: "Success",
        description: "Question group created successfully"
      })
    } catch (error) {
      console.error('Error creating group:', error)
      toast({
        title: "Error",
        description: "Failed to create question group",
        variant: "destructive"
      })
    }
  }

  const addQuestion = () => {
    const newQuestion: Question = {
      id: `question_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      questionText: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctAnswer: 'A',
      groupId: groups[0]?.id || ''
    }
    setQuestions(prev => [...prev, newQuestion])
  }

  const updateQuestion = (id: string, field: keyof Question, value: string) => {
    setQuestions(prev => prev.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    ))
  }

  const removeQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  const saveTest = async () => {
    if (!testTitle.trim()) {
      toast({
        title: "Error",
        description: "Please enter a test title",
        variant: "destructive"
      })
      return
    }

    if (questions.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one question",
        variant: "destructive"
      })
      return
    }

    // Validate all questions
    const invalidQuestions = questions.filter(q => 
      !q.questionText.trim() || 
      !q.optionA.trim() || 
      !q.optionB.trim() || 
      !q.optionC.trim() || 
      !q.optionD.trim() ||
      !q.groupId
    )

    if (invalidQuestions.length > 0) {
      toast({
        title: "Error",
        description: "Please fill in all question fields",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      // Create test
      const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await blink.db.tests.create({
        id: testId,
        title: testTitle,
        description: testDescription,
        userId: user.id,
        isActive: "1"
      })

      // Create questions
      for (const question of questions) {
        await blink.db.questions.create({
          id: question.id,
          testId: testId,
          groupId: question.groupId,
          questionText: question.questionText,
          optionA: question.optionA,
          optionB: question.optionB,
          optionC: question.optionC,
          optionD: question.optionD,
          correctAnswer: question.correctAnswer,
          userId: user.id
        })
      }

      toast({
        title: "Success",
        description: "Test created successfully!"
      })

      // Reset form
      setTestTitle('')
      setTestDescription('')
      setQuestions([])
      
      // Navigate to dashboard
      onNavigate('dashboard')
    } catch (error) {
      console.error('Error saving test:', error)
      toast({
        title: "Error",
        description: "Failed to save test",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Test Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Test Details
          </CardTitle>
          <CardDescription>
            Enter the basic information for your test
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Test Title</Label>
            <Input
              id="title"
              value={testTitle}
              onChange={(e) => setTestTitle(e.target.value)}
              placeholder="Enter test title..."
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={testDescription}
              onChange={(e) => setTestDescription(e.target.value)}
              placeholder="Enter test description..."
              className="mt-1"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Question Groups */}
      <Card>
        <CardHeader>
          <CardTitle>Question Groups</CardTitle>
          <CardDescription>
            Create groups to organize your questions by topic or difficulty
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <Badge key={group.id} variant="secondary" className="px-3 py-1">
                {group.name}
              </Badge>
            ))}
            {groups.length === 0 && (
              <p className="text-sm text-slate-500">No groups created yet</p>
            )}
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="groupName">New Group Name</Label>
              <Input
                id="groupName"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g., Mathematics, History..."
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="groupDesc">Description (Optional)</Label>
              <Input
                id="groupDesc"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                placeholder="Brief description..."
                className="mt-1"
              />
            </div>
          </div>
          
          <Button onClick={createGroup} disabled={!newGroupName.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            Create Group
          </Button>
        </CardContent>
      </Card>

      {/* Questions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <HelpCircle className="h-5 w-5 mr-2" />
              Questions ({questions.length})
            </div>
            <Button onClick={addQuestion} disabled={groups.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </Button>
          </CardTitle>
          <CardDescription>
            {groups.length === 0 
              ? "Create at least one group before adding questions"
              : "Add multiple choice questions to your test"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {questions.length === 0 ? (
            <div className="text-center py-8">
              <HelpCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 mb-4">No questions added yet</p>
              <Button onClick={addQuestion} disabled={groups.length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Question
              </Button>
            </div>
          ) : (
            questions.map((question, index) => (
              <Card key={question.id} className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Question {index + 1}</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeQuestion(question.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Question Text</Label>
                    <Textarea
                      value={question.questionText}
                      onChange={(e) => updateQuestion(question.id, 'questionText', e.target.value)}
                      placeholder="Enter your question..."
                      className="mt-1"
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>Group</Label>
                    <Select
                      value={question.groupId}
                      onValueChange={(value) => updateQuestion(question.id, 'groupId', value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select a group" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="flex items-center">
                        Option A
                        {question.correctAnswer === 'A' && (
                          <CheckCircle className="h-4 w-4 ml-2 text-green-600" />
                        )}
                      </Label>
                      <Input
                        value={question.optionA}
                        onChange={(e) => updateQuestion(question.id, 'optionA', e.target.value)}
                        placeholder="Option A..."
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="flex items-center">
                        Option B
                        {question.correctAnswer === 'B' && (
                          <CheckCircle className="h-4 w-4 ml-2 text-green-600" />
                        )}
                      </Label>
                      <Input
                        value={question.optionB}
                        onChange={(e) => updateQuestion(question.id, 'optionB', e.target.value)}
                        placeholder="Option B..."
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="flex items-center">
                        Option C
                        {question.correctAnswer === 'C' && (
                          <CheckCircle className="h-4 w-4 ml-2 text-green-600" />
                        )}
                      </Label>
                      <Input
                        value={question.optionC}
                        onChange={(e) => updateQuestion(question.id, 'optionC', e.target.value)}
                        placeholder="Option C..."
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="flex items-center">
                        Option D
                        {question.correctAnswer === 'D' && (
                          <CheckCircle className="h-4 w-4 ml-2 text-green-600" />
                        )}
                      </Label>
                      <Input
                        value={question.optionD}
                        onChange={(e) => updateQuestion(question.id, 'optionD', e.target.value)}
                        placeholder="Option D..."
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Correct Answer</Label>
                    <Select
                      value={question.correctAnswer}
                      onValueChange={(value) => updateQuestion(question.id, 'correctAnswer', value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">Option A</SelectItem>
                        <SelectItem value="B">Option B</SelectItem>
                        <SelectItem value="C">Option C</SelectItem>
                        <SelectItem value="D">Option D</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      {/* Save Test */}
      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={() => onNavigate('dashboard')}>
          Cancel
        </Button>
        <Button onClick={saveTest} disabled={saving || !testTitle.trim() || questions.length === 0}>
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Test
            </>
          )}
        </Button>
      </div>
    </div>
  )
}