import { DefaultLayout } from "@/ui/layouts/default"
import { QueryClient } from "@tanstack/react-query"
import {
  createRootRouteWithContext,
  createRoute,
  lazyRouteComponent,
  Outlet,
  redirect,
  ScrollRestoration,
} from "@tanstack/react-router"
import { HTTPError } from "ky"

import ErrorView from "@/ui/components/ErrorView"
import HostForm from "@/ui/components/host-form"
import { extractPathParts } from "@/ui/utils/common"
import { filesQueryOptions } from "@/ui/utils/queryOptions"

const RootComponent = () => {
  return (
    <DefaultLayout>
      <ScrollRestoration />
      <Outlet />
    </DefaultLayout>
  )
}

export const root = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: RootComponent,
  wrapInSuspense: true,
})

const indexRoute = createRoute({
  getParentRoute: () => root,
  path: "/",
  validateSearch: (search) => search as { redirect?: string },
  beforeLoad: async () => {
    const host = localStorage.getItem("RCD_HOST")
    if (host)
      throw redirect({
        to: "/*",
        params: { "*": "fs" },
        replace: true,
      })
  },
  component: HostForm,
})

export const filesSplatRoute = createRoute({
  getParentRoute: () => root,
  path: "/*",
  beforeLoad: async ({ location }) => {
    const host = localStorage.getItem("RCD_HOST")
    if (!host)
      throw redirect({
        to: "/",
        replace: true,
        search: {
          redirect: location.href,
        },
      })
  },
  component: lazyRouteComponent(() => import("@/ui/components/FileBrowser")),
  errorComponent: ({ error }) => {
    if (error instanceof HTTPError) {
      const err =
        error.response.status === 404
          ? new Error("invalid path")
          : new Error("server error")
      return <ErrorView error={err} />
    }
    return <ErrorView error={error as Error} />
  },
  loader: async ({ context: { queryClient }, preload, params }) => {
    if (preload) {
      const [remote, path] = extractPathParts(
        (params as Record<string, string>)["*"]
      )
      await queryClient.fetchQuery(filesQueryOptions({ remote, path }))
    }
  },
})

export const routeTree = root.addChildren([indexRoute, filesSplatRoute])
