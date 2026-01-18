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
    .min(1, { message: "请输入密码" })
    .min(8, { message: "密码至少需要 8 个字符" }),
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
        title: "登录 - Manifest",
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
              <span>系统登录</span>
              <div className="h-px w-6 bg-gradient-to-l from-transparent to-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              登录您的账户
            </h1>
            <p className="text-sm text-muted-foreground">
              输入凭据以访问系统
            </p>
          </div>

          <div className="grid gap-5">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                    邮箱
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
                      密码
                    </FormLabel>
                    <RouterLink
                      to="/recover-password"
                      className="text-xs text-primary hover:text-accent transition-colors underline-offset-4 hover:underline font-medium"
                    >
                      忘记密码？
                    </RouterLink>
                  </div>
                  <FormControl>
                    <PasswordInput
                      data-testid="password-input"
                      placeholder="输入密码"
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
              {loginMutation.isPending ? "验证中..." : "登录系统"}
            </LoadingButton>
          </div>

          <div className="text-center text-sm pt-4 border-t border-border/50">
            <span className="text-muted-foreground">
              还没有账户？{" "}
            </span>
            <RouterLink
              to="/signup"
              className="text-primary hover:text-accent transition-colors font-semibold underline-offset-4 hover:underline"
            >
              注册
            </RouterLink>
          </div>
        </form>
      </Form>
    </AuthLayout>
  )
}
