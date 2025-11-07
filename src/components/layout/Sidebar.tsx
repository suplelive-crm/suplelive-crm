import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  MessageSquare,
  Target,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
  Inbox,
  Zap,
  Building2,
  ChevronLeft,
  ChevronRight,
  Kanban,
  Bot,
  Bell,
  Search,
  HelpCircle,
  Package,
  Truck,
  ShoppingBag,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Inbox', href: 'https://chat.suplelive.com.br/app/accounts/1/inbox/1', icon: Inbox, badge: 3, target: '_blank' },
  { name: 'Clientes', href: '/clients', icon: Users },
  /*{ name: 'Kanban', href: '/kanban', icon: Kanban },*/
  { name: 'Pedidos', href: '/orders', icon: ShoppingCart },
  /*{ name: 'Mensagens', href: '/messages', icon: MessageSquare },*/
  { name: 'Campanhas', href: '/campaigns', icon: Target },
  { name: 'Automação', href: '/automation', icon: Bot },
  /*{ name: 'Integrações', href: '/integrations', icon: Zap },*/
  /*{ name: 'Analytics', href: '/analytics', icon: BarChart3 },*/
  { name: 'Acompanhamento', href: '/tracking', icon: Truck },
  { name: 'Jobs & Logs', href: '/jobs', icon: Activity },
  { name: 'Configurações', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const signOut = useAuthStore(state => state.signOut);
  const { currentWorkspace } = useWorkspaceStore();
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const sidebarWidth = isCollapsed ? 'w-20' : 'w-72';

  const NavItem = ({ item, isCollapsed }: { item: typeof navigation[0], isCollapsed: boolean }) => {
    const isActive = location.pathname === item.href;
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <NavLink
              to={item.href}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 mb-1",
                  isCollapsed ? "justify-center" : "justify-between",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
              onClick={() => setIsOpen(false)}
            >
              <div className="flex items-center gap-3">
                <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden whitespace-nowrap"
                    >
                      {item.name}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              {item.badge && !isCollapsed && (
                <Badge variant="default" className="text-xs">
                  {item.badge}
                </Badge>
              )}
              {item.badge && isCollapsed && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></div>
              )}
            </NavLink>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right">
              <p>{item.name}</p>
              {item.badge && <Badge variant="default" className="ml-2 text-xs">{item.badge}</Badge>}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="outline"
        size="icon"
        className="lg:hidden fixed top-4 left-4 z-50 bg-background shadow-sm border"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Desktop Sidebar */}
      <motion.div
        animate={{ width: isCollapsed ? 80 : 288 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={cn(
          "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-30 border-r bg-background",
          sidebarWidth
        )}
      >
        <div className="flex flex-col flex-grow h-full">
          {/* Logo & Workspace */}
          <div className={cn("flex flex-col", isCollapsed ? "px-3" : "px-6", "py-6")}>
            <div className="flex items-center justify-between">
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
                      <Zap className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <h1 className="text-xl font-bold">OmniCRM</h1>
                  </motion.div>
                )}
              </AnimatePresence>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="h-8 w-8 rounded-md hover:bg-muted"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            <AnimatePresence>
              {!isCollapsed && currentWorkspace && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 mt-4 px-2 py-2 rounded-md bg-muted/50"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {currentWorkspace.name}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User Profile */}
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="px-6 mb-6"
              >
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {currentWorkspace?.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {currentWorkspace?.name || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {currentWorkspace?.plan?.name || 'Free Plan'}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search */}
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="px-6 mb-6"
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    className="w-full pl-10 pr-4 py-2 text-sm rounded-md bg-muted/50 border-0 focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className={cn("flex-1 overflow-y-auto", isCollapsed ? "px-3" : "px-6")}>
            <nav className="space-y-1">
              {navigation.map((item) => (
                <NavItem key={item.name} item={item} isCollapsed={isCollapsed} />
              ))}
            </nav>
          </div>

          {/* Footer */}
          <div className={cn(isCollapsed ? "p-3" : "p-6", "mt-auto border-t")}>
            <div className="flex flex-col gap-3">
              {!isCollapsed && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Notificações</span>
                  </div>
                  <Badge variant="outline" className="text-xs">3</Badge>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                {!isCollapsed && (
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Ajuda</span>
                  </div>
                )}
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size={isCollapsed ? "icon" : "sm"}
                        onClick={handleSignOut}
                        className={cn(
                          "text-muted-foreground hover:text-foreground",
                          isCollapsed ? "w-full" : ""
                        )}
                      >
                        <LogOut className={cn("h-4 w-4", isCollapsed ? "" : "mr-2")} />
                        {!isCollapsed && "Sair"}
                      </Button>
                    </TooltipTrigger>
                    {isCollapsed && (
                      <TooltipContent side="right">
                        <p>Sair</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="lg:hidden fixed inset-y-0 left-0 z-40 w-72 bg-background shadow-xl"
            >
              <div className="flex flex-col h-full">
                {/* Logo & Workspace */}
                <div className="flex items-center justify-between p-6 border-b">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
                      <Zap className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <h1 className="text-xl font-bold">OmniCRM</h1>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                {/* User Profile */}
                <div className="p-6 border-b">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {currentWorkspace?.name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{currentWorkspace?.name || 'User'}</p>
                      <p className="text-sm text-muted-foreground">
                        {currentWorkspace?.plan?.name || 'Free Plan'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto p-6">
                  <nav className="space-y-1">
                    {navigation.map((item) => (
                      <NavLink
                        key={item.name}
                        to={item.href}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg transition-colors",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )
                        }
                        onClick={() => setIsOpen(false)}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.name}</span>
                        {item.badge && (
                          <Badge variant="default" className="ml-auto text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </NavLink>
                    ))}
                  </nav>
                </div>

                {/* Footer */}
                <div className="p-6 border-t">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={handleSignOut}
                  >
                    <LogOut className="mr-2 h-5 w-5" />
                    Sair
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Spacer for desktop sidebar */}
      <div className={cn("hidden lg:block", sidebarWidth, "flex-shrink-0")} />
    </>
  );
}