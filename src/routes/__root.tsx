import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { Home, Users, Trophy, LogOut, LogIn } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "fahhhh" },
      { name: "description", content: "fahhh" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "fahhhh" },
      { property: "og:description", content: "fahhh" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "fahhhh" },
      { name: "twitter:description", content: "fahhh" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/dabf1e0b-d1d2-45a8-b37e-3867fb48faf0/id-preview-69023920--9a424140-e4be-4525-a9ff-fcbbfd4b622c.lovable.app-1780388826747.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/dabf1e0b-d1d2-45a8-b37e-3867fb48faf0/id-preview-69023920--9a424140-e4be-4525-a9ff-fcbbfd4b622c.lovable.app-1780388826747.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppShell />
        <Toaster position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppShell() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-background pb-20">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <Trophy className="h-5 w-5 text-primary" />
            <span>MatchPad</span>
          </Link>
          {user ? (
            <button onClick={() => signOut()} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          ) : (
            <Link to="/auth" className="text-sm text-primary inline-flex items-center gap-1">
              <LogIn className="h-4 w-4" /> Sign in
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-card">
        <div className="mx-auto max-w-3xl grid grid-cols-3 text-xs">
          <Link to="/" className="flex flex-col items-center gap-1 py-3 text-muted-foreground [&.active]:text-primary" activeOptions={{ exact: true }} activeProps={{ className: "active" }}>
            <Home className="h-5 w-5" /> Home
          </Link>
          <Link to="/teams" className="flex flex-col items-center gap-1 py-3 text-muted-foreground [&.active]:text-primary" activeProps={{ className: "active" }}>
            <Users className="h-5 w-5" /> Teams
          </Link>
          <Link to="/tournaments" className="flex flex-col items-center gap-1 py-3 text-muted-foreground [&.active]:text-primary" activeProps={{ className: "active" }}>
            <Trophy className="h-5 w-5" /> Tournaments
          </Link>
        </div>
      </nav>
    </div>
  );
}
