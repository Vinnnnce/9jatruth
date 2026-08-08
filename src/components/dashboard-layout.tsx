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
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";
import { SokeLogoFull, SokeLogo } from "@/components/logo";
import { OfflineStatus } from "@/components/offline-status";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserButton, SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isSuperAdminProfile, getDashboardType } from "@/lib/admin-auth-client";
import { NotificationBell } from "@/components/notification-bell";
import { NewUserTour } from "@/components/new-user-tour";

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
  Download,
} from "lucide-react";

type UserProfile = {
  id: string;
  email?: string;
  name?: string;
  isAdmin?: boolean;
  is_admin?: boolean;
  isOrgAdmin?: boolean;
  is_org_admin?: boolean;
  organizationId?: number | null;
};

function useNavSections() {
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/user/profile"],
  });

  const dashboardType = getDashboardType(profile);

  const sections = [
    {
      label: "Main",
      items: [
        { path: "/feeds", label: "Feeds", icon: Newspaper },
        { path: "/", label: "Portfolio", icon: LayoutDashboard },
        { path: "/search", label: "Search", icon: Search },
        { path: "/submit", label: "Submit Truth", icon: Send },
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
        // Only show admin dashboard to super admin
        ...(dashboardType === "admin"
          ? [{ path: "/admin", label: "Super Admin Dashboard", icon: ShieldCheck }]
          : []),
        // Show user dashboard for all authenticated users
        { path: "/user", label: "Portfolio", icon: User },
        // Show org dashboard only for org admins
        ...(dashboardType === "org"
          ? [{ path: "/org", label: "Org Dashboard", icon: Building2 }]
          : []),
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

  return sections;
}

function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile, setOpen, openMobile, open } = useSidebar();
  const navSections = useNavSections();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 h-16 flex flex-row items-center justify-center group-data-[collapsible=icon]:px-2">
        <Link
          href="/"
          onClick={() => {
            setOpenMobile(false);
            // On desktop, collapse after navigation
            if (window.innerWidth >= 768) setOpen(false);
          }}
        >
          <div className="text-sidebar-foreground hover-elevate rounded-md p-1 -m-1 transition-colors">
            <SokeLogoFull />
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
                    onClick={() => {
                      setOpenMobile(false);
                      // On desktop, collapse after navigation
                      if (window.innerWidth >= 768) setOpen(false);
                    }}
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
          Soke — Eyes on the Street
        </div>
        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-sidebar-foreground/40 group-data-[collapsible=icon]:hidden">
          <Link href="/privacy" className="hover:underline">Privacy</Link>
          <span>·</span>
          <Link href="/terms" className="hover:underline">Terms</Link>
          <span>·</span>
          <Link href="/cookies" className="hover:underline">Cookies</Link>
        </div>
        <a
          href="/manifest.webmanifest"
          download
          className="mt-2 flex items-center gap-1.5 text-[10px] text-primary hover:underline group-data-[collapsible=icon]:hidden"
          onClick={(e) => {
            e.preventDefault();
            if (typeof window !== "undefined" && "serviceWorker" in navigator) {
              const event = new Event("beforeinstallprompt");
              window.dispatchEvent(event);
            }
          }}
        >
          <Download className="h-3 w-3" />
          Download App
        </a>
      </SidebarFooter>
    </Sidebar>
  );
}

function TopBar() {
  return (
    <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="flex items-center gap-2 md:gap-3">
        <SidebarTrigger className="md:hidden" />
        <SidebarTrigger className="hidden md:flex" />
        <div className="flex items-center gap-2">
          <SokeLogo className="h-5 w-5 text-primary" />
          <span className="font-display font-700 text-sm tracking-tight">Soke</span>
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
          <>
            <SignedIn>
              <NotificationBell />
              <UserButton afterSignOutUrl="/sign-in" />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-muted">
                  Log In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors px-4 py-1.5 rounded-md">
                  Sign Up
                </button>
              </SignUpButton>
            </SignedOut>
          </>
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
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset>
        <TopBar />
        <NewUserTour />
        <main className="flex-1 overflow-y-auto scrollbar-thin">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
