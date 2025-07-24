import { useState, useEffect } from 'react'
import { blink } from './blink/client'
import { Sidebar, SidebarContent, SidebarProvider, SidebarTrigger } from './components/ui/sidebar'
import { Button } from './components/ui/button'
import { Toaster } from './components/ui/toaster'
import { 
  LayoutDashboard, 
  FileText, 
  HelpCircle, 
  BarChart3, 
  Settings,
  Plus,
  Users
} from 'lucide-react'
import Dashboard from './components/Dashboard'
import TestCreation from './components/TestCreation'
import QuestionManagement from './components/QuestionManagement'
import TestTaking from './components/TestTaking'
import Statistics from './components/Statistics'
import AdminPanel from './components/AdminPanel'

type User = {
  id: string
  email: string
  displayName?: string
}

type ActiveView = 'dashboard' | 'create-test' | 'questions' | 'take-test' | 'statistics' | 'admin'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<ActiveView>('dashboard')

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      setLoading(state.isLoading)
    })
    return unsubscribe
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <FileText className="h-16 w-16 text-blue-600 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Test Management Dashboard</h1>
          <p className="text-slate-600 mb-8">Create and manage tests with detailed analytics and statistics.</p>
          <Button onClick={() => blink.auth.login()} size="lg" className="w-full">
            Sign In to Continue
          </Button>
        </div>
      </div>
    )
  }

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'create-test', label: 'Create Test', icon: Plus },
    { id: 'questions', label: 'Questions', icon: HelpCircle },
    { id: 'take-test', label: 'Take Test', icon: FileText },
    { id: 'statistics', label: 'Statistics', icon: BarChart3 },
    { id: 'admin', label: 'Admin Panel', icon: Settings },
  ]

  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard user={user} onNavigate={setActiveView} />
      case 'create-test':
        return <TestCreation user={user} onNavigate={setActiveView} />
      case 'questions':
        return <QuestionManagement user={user} onNavigate={setActiveView} />
      case 'take-test':
        return <TestTaking user={user} onNavigate={setActiveView} />
      case 'statistics':
        return <Statistics user={user} onNavigate={setActiveView} />
      case 'admin':
        return <AdminPanel user={user} onNavigate={setActiveView} />
      default:
        return <Dashboard user={user} onNavigate={setActiveView} />
    }
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-slate-50 flex w-full">
        <Sidebar className="border-r border-slate-200">
          <SidebarContent className="p-4">
            <div className="mb-8">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Test Manager</h2>
              <p className="text-sm text-slate-600">Welcome, {user.displayName || user.email}</p>
            </div>
            
            <nav className="space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon
                return (
                  <Button
                    key={item.id}
                    variant={activeView === item.id ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveView(item.id as ActiveView)}
                  >
                    <Icon className="h-4 w-4 mr-3" />
                    {item.label}
                  </Button>
                )
              })}
            </nav>

            <div className="mt-auto pt-8">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => blink.auth.logout()}
              >
                <Users className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="mb-6 flex items-center">
              <SidebarTrigger className="lg:hidden mr-4" />
              <h1 className="text-2xl font-bold text-slate-900">
                {navigationItems.find(item => item.id === activeView)?.label}
              </h1>
            </div>
            {renderActiveView()}
          </div>
        </main>
      </div>
      <Toaster />
    </SidebarProvider>
  )
}

export default App