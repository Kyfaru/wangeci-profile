/**
 * Layout for the `(auth)` route group (login/signup/verify/reset-password).
 *
 * Deliberately minimal — each page renders its own `AuthShell` (title and
 * description differ per page), so this layout just needs to exist for the
 * group's routes to render. Not a root layout: it nests under
 * `app/layout.tsx`, which already sets up `<html>`/`<body>`, fonts, and
 * the TanStack Query provider.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
