import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
])

const isOrgSelectionRoute = createRouteMatcher(['/select-org'])
const isSettingsRoute = createRouteMatcher(['/settings(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return

  await auth.protect()

  const { orgId, orgRole } = await auth()

  if (isOrgSelectionRoute(req)) return

  if (!orgId) {
    return Response.redirect(new URL('/select-org', req.url))
  }

  if (isSettingsRoute(req) && orgRole !== 'org:admin') {
    return Response.redirect(new URL('/', req.url))
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
