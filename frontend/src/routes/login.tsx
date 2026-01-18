import { zodResolver } from "@hookform/resolvers/zod"
import {
  createFileRoute,
  Link as RouterLink,
  redirect,
} from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { z } from "zod"

import type { Body_login_login_access_token as AccessToken } from "@/client"
import { AuthLayout } from "@/components/Common/AuthLayout"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { PasswordInput } from "@/components/ui/password-input"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"

const formSchema = z.object({
  username: z.email(),
  password: z
    .string()
    .min(1, { message: "Password is required" })
    .min(8, { message: "Password must be at least 8 characters" }),
}) satisfies z.ZodType<AccessToken>

type FormData = z.infer<typeof formSchema>

export const Route = createFileRoute("/login")({
  component: Login,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      throw redirect({
        to: "/",
      })
    }
  },
  head: () => ({
    meta: [
      {
        title: "Log In - Manifest",
      },
    ],
  }),
})

function Login() {
  const { loginMutation } = useAuth()
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      username: "",
      password: "",
    },
  })

  const onSubmit = (data: FormData) => {
    if (loginMutation.isPending) return
    loginMutation.mutate(data)
  }

  return (
    <AuthLayout>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col items-center gap-3 text-center mb-2">
            <div className="flex items-center gap-2 text-xs font-mono tracking-wider text-muted-foreground uppercase">
              <div className="h-px w-6 bg-gradient-to-r from-transparent to-primary" />
              <span>Access Terminal</span>
              <div className="h-px w-6 bg-gradient-to-l from-transparent to-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Login to your account
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter credentials to access the system
            </p>
          </div>

          <div className="grid gap-5">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                    Email
                  </FormLabel>
                  <FormControl>
                    <Input
                      data-testid="email-input"
                      placeholder="user@example.com"
                      type="email"
                      className="border-primary/20 focus:border-primary transition-colors"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                      Password
                    </FormLabel>
                    <RouterLink
                      to="/recover-password"
                      className="text-xs text-primary hover:text-accent transition-colors underline-offset-4 hover:underline font-medium"
                    >
                      Forgot password?
                    </RouterLink>
                  </div>
                  <FormControl>
                    <PasswordInput
                      data-testid="password-input"
                      placeholder="Enter password"
                      className="border-primary/20 focus:border-primary transition-colors"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <LoadingButton
              type="submit"
              loading={loginMutation.isPending}
              className="mt-2 glow-cyan-sm hover:glow-cyan transition-all"
            >
              {loginMutation.isPending ? "Authenticating..." : "Access System"}
            </LoadingButton>
          </div>

          <div className="text-center text-sm pt-4 border-t border-border/50">
            <span className="text-muted-foreground">
              Don't have an account?{" "}
            </span>
            <RouterLink
              to="/signup"
              className="text-primary hover:text-accent transition-colors font-semibold underline-offset-4 hover:underline"
            >
              Register
            </RouterLink>
          </div>
        </form>
      </Form>
    </AuthLayout>
  )
}
