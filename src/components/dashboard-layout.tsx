"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { CrlLogoFull } from "@/components/logo";
import { OfflineStatus } from "@/components/offline-status";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserButton } from "@clerk/nextjs";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;
import {
  LayoutDashboard,
  Send,
  ListChecks,
  TrendingUp,
  Coins,
  Activity,
  Moon,
  Sun,
  Globe,
  BarChart3,
  Map as MapIcon,
  GitCompare,
  Bell,
  Trophy,
  Search,
  Activity as ActivityIcon,
  User,
  Building2,
  Settings,
  Shield,
  FileText,
  Cookie,
  Newspaper,
  Users,
  Briefcase,
  ShieldCheck,
} from "lucide-react";

const navSections = [
  {
    label: "Main",
    items: [
      { path: "/", label: "Dashboard", icon: LayoutDashboard },
      { path: "/search", label: "Search", icon: Search },
      { path: "/submit", label: "Submit Truth", icon: Send },
      { path: "/feeds", label: "Feeds", icon: Newspaper },
      { path: "/activity", label: "Activity", icon: ActivityIcon },
    ],
  },
  {
    label: "Insights",
    items: [
      { path: "/trends", label: "Trends", icon: BarChart3 },
      { path: "/map", label: "Geo Map", icon: MapIcon },
      { path: "/compare", label: "Compare", icon: GitCompare },
      { path: "/alerts", label: "Alerts", icon: Bell },
      { path: "/predictions", label: "Predictions", icon: TrendingUp },
      { path: "/rewards", label: "Rewards", icon: Coins },
      { path: "/leaderboard", label: "Leaderboard", icon: Trophy },
    ],
  },
  {
    label: "Account",
    items: [
      { path: "/profile", label: "Profile", icon: User },
      { path: "/organizations", label: "Organizations", icon: Building2 },
      { path: "/agency-auth", label: "Agency Login", icon: Shield },
      { path: "/account", label: "Account Settings", icon: Settings },
    ],
  },
  {
    label: "Dashboards",
    items: [
      { path: "/admin", label: "Admin Dashboard", icon: ShieldCheck },
      { path: "/user", label: "User Dashboard", icon: User },
      { path: "/org", label: "Org Dashboard", icon: Building2 },
    ],
  },
  {
    label: "Legal",
    items: [
      { path: "/privacy", label: "Privacy Policy", icon: Shield },
      { path: "/terms", label: "Terms of Use", icon: FileText },
      { path: "/cookies", label: "Cookie Policy", icon: Cookie },
      { path: "/operations", label: "Operations", icon: Activity },
    ],
  },
];

function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 h-16 flex flex-row items-center justify-center group-data-[collapsible=icon]:px-2">
        <Link href="/" onClick={() => setOpenMobile(false)}>
          <div className="text-sidebar-foreground hover-elevate rounded-md p-1 -m-1 transition-colors">
            <CrlLogoFull />
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-2 py-4 overflow-y-auto scrollbar-thin">
        {navSections.map((section) => (
          <SidebarMenu key={section.label}>
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 group-data-[collapsible=icon]:hidden">
              {section.label}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.path ||
                (item.path !== "/" && pathname.startsWith(item.path));
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.label}
                    onClick={() => setOpenMobile(false)}
                  >
                    <Link href={item.path}>
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-sidebar-foreground/50">
          <div className="h-2 w-2 rounded-full bg-status-online status-glow-green animate-pulse-soft" />
          <span className="group-data-[collapsible=icon]:hidden">Mesh network active</span>
        </div>
        <div className="mt-1.5 text-[10px] text-sidebar-foreground/40 font-mono group-data-[collapsible=icon]:hidden">
          Nigeria Digital Ecosystem
        </div>
        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-sidebar-foreground/40 group-data-[collapsible=icon]:hidden">
          <Link href="/privacy" className="hover:underline">Privacy</Link>
          <span>·</span>
          <Link href="/terms" className="hover:underline">Terms</Link>
          <span>·</span>
          <Link href="/cookies" className="hover:underline">Cookies</Link>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function TopBar() {
  return (
    <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="flex items-center gap-2 md:gap-3">
        <SidebarTrigger className="md:hidden" />
        <SidebarTrigger className="hidden md:flex" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Globe className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">Nigeria Digital Ecosystem</span>
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <OfflineStatus />
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {new Date().toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
          </span>
          <span className="text-border">|</span>
          <span className="tabular-nums">
            {new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })} WAT
          </span>
        </div>
        <ThemeToggle />
        {isClerkConfigured && (
          <UserButton afterSignOutUrl="/sign-in" />
        )}
        {!isClerkConfigured && (
          <Link href="/sign-in" className="text-sm text-primary hover:underline">
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto scrollbar-thin">{children}</main>
      </div>
    </SidebarProvider>
  );
}
