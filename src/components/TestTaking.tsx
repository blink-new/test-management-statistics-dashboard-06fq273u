import React, { useState, useEffect, useCallback } from 'react';
import { Clock, ChevronLeft, ChevronRight, Flag, CheckCircle, AlertCircle, Trophy, RotateCcw } from 'lucide-react';
import { blink } from '../blink/client';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';

interface Test {
  id: string;
  title: string;
  description: string;
  created_at: string;
}

interface Question {
  id: string;
  test_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  group_name: string;
}

interface UserAnswer {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  timeSpent: number;
}

interface TestResult {
  score: number;
  totalQuestions: number;
  percentage: number;
  timeSpent: number;
  answers: UserAnswer[];
}

export default function TestTaking() {
  const [user, setUser] = useState<any>(null);
  const [tests, setTests] = useState<Test[]>([]);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Map<string, string>>(new Map());
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [testStartTime, setTestStartTime] = useState<number | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [timeSpent, setTimeSpent] = useState<Map<string, number>>(new Map());
  const [showResults, setShowResults] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user);
    });
    return unsubscribe;
  }, []);

  const loadTests = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const testsData = await blink.db.tests.list({
        orderBy: { created_at: 'desc' }
      });
      setTests(testsData);
    } catch (error) {
      console.error('Error loading tests:', error);
      toast.error('Failed to load tests');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadTests();
    }
  }, [user, loadTests]);

  const startTest = async (test: Test) => {
    try {
      const questionsData = await blink.db.questions.list({
        where: { test_id: test.id },
        orderBy: { created_at: 'asc' }
      });
      
      if (questionsData.length === 0) {
        toast.error('This test has no questions');
        return;
      }

      setSelectedTest(test);
      setQuestions(questionsData);
      setCurrentQuestionIndex(0);
      setUserAnswers(new Map());
      setFlaggedQuestions(new Set());
      setTestStartTime(Date.now());
      setQuestionStartTime(Date.now());
      setTimeSpent(new Map());
      setShowResults(false);
      setTestResult(null);
    } catch (error) {
      console.error('Error starting test:', error);
      toast.error('Failed to start test');
    }
  };

  const selectAnswer = (answer: string) => {
    if (!selectedTest || !questions[currentQuestionIndex]) return;

    const questionId = questions[currentQuestionIndex].id;
    const now = Date.now();
    const questionTime = now - questionStartTime;
    
    // Update time spent on current question
    setTimeSpent(prev => new Map(prev.set(questionId, questionTime)));
    
    // Update user answer
    setUserAnswers(prev => new Map(prev.set(questionId, answer)));
  };

  const navigateToQuestion = (index: number) => {
    if (index < 0 || index >= questions.length) return;
    
    setCurrentQuestionIndex(index);
    setQuestionStartTime(Date.now());
  };

  const toggleFlag = () => {
    if (!questions[currentQuestionIndex]) return;
    
    const questionId = questions[currentQuestionIndex].id;
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const submitTest = async () => {
    if (!selectedTest || !testStartTime) return;
    
    setSubmitting(true);
    try {
      const totalTime = Date.now() - testStartTime;
      let correctAnswers = 0;
      const answers: UserAnswer[] = [];

      questions.forEach(question => {
        const userAnswer = userAnswers.get(question.id) || '';
        const isCorrect = userAnswer === question.correct_answer;
        const questionTime = timeSpent.get(question.id) || 0;
        
        if (isCorrect) correctAnswers++;
        
        answers.push({
          questionId: question.id,
          selectedAnswer: userAnswer,
          isCorrect,
          timeSpent: questionTime
        });
      });

      const result: TestResult = {
        score: correctAnswers,
        totalQuestions: questions.length,
        percentage: Math.round((correctAnswers / questions.length) * 100),
        timeSpent: totalTime,
        answers
      };

      // Save test attempt to database
      const attemptId = `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await blink.db.testAttempts.create({
        id: attemptId,
        test_id: selectedTest.id,
        user_id: user.id,
        score: correctAnswers,
        total_questions: questions.length,
        time_spent: totalTime,
        completed_at: new Date().toISOString()
      });

      setTestResult(result);
      setShowResults(true);
      toast.success('Test submitted successfully!');
    } catch (error) {
      console.error('Error submitting test:', error);
      toast.error('Failed to submit test');
    } finally {
      setSubmitting(false);
    }
  };

  const resetTest = () => {
    setSelectedTest(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers(new Map());
    setFlaggedQuestions(new Set());
    setTestStartTime(null);
    setTimeSpent(new Map());
    setShowResults(false);
    setTestResult(null);
  };

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Please sign in to take tests</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Test Results View
  if (showResults && testResult) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Trophy className="w-16 h-16 text-yellow-500" />
            </div>
            <CardTitle className="text-2xl text-green-800">Test Completed!</CardTitle>
            <p className="text-green-600">Congratulations on completing the test</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-white rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{testResult.score}</div>
                <div className="text-sm text-gray-600">Correct Answers</div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">{testResult.percentage}%</div>
                <div className="text-sm text-gray-600">Score</div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-600">{testResult.totalQuestions}</div>
                <div className="text-sm text-gray-600">Total Questions</div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{formatTime(testResult.timeSpent)}</div>
                <div className="text-sm text-gray-600">Time Spent</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Results */}
        <Card>
          <CardHeader>
            <CardTitle>Question Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {questions.map((question, index) => {
                const answer = testResult.answers.find(a => a.questionId === question.id);
                const isCorrect = answer?.isCorrect || false;
                const userAnswer = answer?.selectedAnswer || '';
                
                return (
                  <div key={question.id} className={`p-4 rounded-lg border ${isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">Q{index + 1}</Badge>
                        <Badge variant={isCorrect ? 'default' : 'destructive'}>
                          {isCorrect ? 'Correct' : 'Incorrect'}
                        </Badge>
                        <Badge variant="secondary">{question.group_name}</Badge>
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatTime(answer?.timeSpent || 0)}
                      </div>
                    </div>
                    
                    <h3 className="font-medium mb-3">{question.question_text}</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {[
                        { key: 'A', text: question.option_a },
                        { key: 'B', text: question.option_b },
                        { key: 'C', text: question.option_c },
                        { key: 'D', text: question.option_d }
                      ].map(option => {
                        const isUserAnswer = userAnswer === option.key;
                        const isCorrectAnswer = question.correct_answer === option.key;
                        
                        let className = 'p-2 rounded border ';
                        if (isCorrectAnswer) {
                          className += 'border-green-500 bg-green-100 text-green-800';
                        } else if (isUserAnswer && !isCorrectAnswer) {
                          className += 'border-red-500 bg-red-100 text-red-800';
                        } else {
                          className += 'border-gray-200 bg-gray-50';
                        }
                        
                        return (
                          <div key={option.key} className={className}>
                            <span className="font-semibold">{option.key}.</span> {option.text}
                            {isCorrectAnswer && <CheckCircle className="w-4 h-4 text-green-600 inline ml-2" />}
                            {isUserAnswer && !isCorrectAnswer && <AlertCircle className="w-4 h-4 text-red-600 inline ml-2" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button onClick={resetTest} className="flex items-center">
            <RotateCcw className="w-4 h-4 mr-2" />
            Take Another Test
          </Button>
        </div>
      </div>
    );
  }

  // Test Taking View
  if (selectedTest && questions.length > 0) {
    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    const answeredCount = userAnswers.size;
    const flaggedCount = flaggedQuestions.size;
    
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Test Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">{selectedTest.title}</CardTitle>
                <p className="text-gray-600">{selectedTest.description}</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="w-4 h-4 mr-1" />
                  {testStartTime && formatTime(Date.now() - testStartTime)}
                </div>
                <Badge variant="outline">
                  {currentQuestionIndex + 1} of {questions.length}
                </Badge>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Progress: {Math.round(progress)}%</span>
                <span>Answered: {answeredCount}/{questions.length}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardHeader>
        </Card>

        {/* Question */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Badge variant="outline">Question {currentQuestionIndex + 1}</Badge>
                <Badge variant="secondary">{currentQuestion.group_name}</Badge>
                {flaggedQuestions.has(currentQuestion.id) && (
                  <Badge variant="destructive">Flagged</Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFlag}
                className={flaggedQuestions.has(currentQuestion.id) ? 'bg-red-50 border-red-200' : ''}
              >
                <Flag className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <h2 className="text-lg font-medium mb-6">{currentQuestion.question_text}</h2>
            
            <div className="space-y-3">
              {[
                { key: 'A', text: currentQuestion.option_a },
                { key: 'B', text: currentQuestion.option_b },
                { key: 'C', text: currentQuestion.option_c },
                { key: 'D', text: currentQuestion.option_d }
              ].map(option => {
                const isSelected = userAnswers.get(currentQuestion.id) === option.key;
                
                return (
                  <button
                    key={option.key}
                    onClick={() => selectAnswer(option.key)}
                    className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center ${
                        isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`}>
                        {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <span className="font-semibold mr-2">{option.key}.</span>
                      <span>{option.text}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => navigateToQuestion(currentQuestionIndex - 1)}
            disabled={currentQuestionIndex === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="flex items-center space-x-2">
            {questions.map((_, index) => {
              const isAnswered = userAnswers.has(questions[index].id);
              const isFlagged = flaggedQuestions.has(questions[index].id);
              const isCurrent = index === currentQuestionIndex;
              
              return (
                <button
                  key={index}
                  onClick={() => navigateToQuestion(index)}
                  className={`w-8 h-8 rounded text-sm font-medium transition-all ${
                    isCurrent
                      ? 'bg-blue-600 text-white'
                      : isAnswered
                      ? 'bg-green-100 text-green-800 border border-green-300'
                      : isFlagged
                      ? 'bg-red-100 text-red-800 border border-red-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          {currentQuestionIndex === questions.length - 1 ? (
            <Button
              onClick={submitTest}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Submitting...
                </>
              ) : (
                'Submit Test'
              )}
            </Button>
          ) : (
            <Button
              onClick={() => navigateToQuestion(currentQuestionIndex + 1)}
              disabled={currentQuestionIndex === questions.length - 1}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>

        {/* Test Summary */}
        <Card className="bg-gray-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                <span>Answered: {answeredCount}/{questions.length}</span>
                {flaggedCount > 0 && (
                  <span className="text-red-600">Flagged: {flaggedCount}</span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={resetTest}>
                  Exit Test
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Test Selection View
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Take a Test</h1>
        <Badge variant="outline">{tests.length} tests available</Badge>
      </div>

      {tests.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No Tests Available</h3>
            <p className="text-gray-500">
              No tests have been created yet. Please contact your instructor.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tests.map(test => (
            <Card key={test.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">{test.title}</CardTitle>
                <p className="text-gray-600 text-sm">{test.description}</p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Created: {new Date(test.created_at).toLocaleDateString()}
                  </div>
                  <Button onClick={() => startTest(test)}>
                    Start Test
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}