import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { type MinIOInstancePublic, MinioInstancesService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

const formSchema = z.object({
  name: z.string().min(1, "请输入名称"),
  endpoint: z.string().min(1, "请输入端点"),
  access_key: z.string().optional(),
  secret_key: z.string().optional(),
  secure: z.boolean(),
})

type FormData = z.infer<typeof formSchema>

interface Props {
  instance: MinIOInstancePublic | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function EditMinIOInstance({
  instance,
  open,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: "",
      endpoint: "",
      access_key: "",
      secret_key: "",
      secure: true,
    },
  })

  useEffect(() => {
    if (instance && open) {
      form.reset({
        name: instance.name,
        endpoint: instance.endpoint,
        access_key: "",
        secret_key: "",
        secure: instance.secure,
      })
    }
  }, [instance, open, form])

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      if (!instance) throw new Error("No instance to update")
      return MinioInstancesService.updateMinioInstanceEndpoint({
        id: instance.id,
        requestBody: {
          name: data.name,
          endpoint: data.endpoint,
          secure: data.secure,
          access_key: data.access_key || null,
          secret_key: data.secret_key || null,
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["minio-instances"] })
      onOpenChange(false)
    },
  })

  if (!instance) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑 MinIO 实例</DialogTitle>
          <DialogDescription>
            修改实例配置。凭据留空表示保持原有值不变。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => mutation.mutate(d))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>名称</FormLabel>
                  <FormControl>
                    <Input placeholder="My MinIO" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endpoint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>端点</FormLabel>
                  <FormControl>
                    <Input placeholder="minio:9000" {...field} />
                  </FormControl>
                  <FormDescription>
                    Docker 环境请使用容器名，如 minio:9000
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="access_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Access Key (留空保持不变)</FormLabel>
                  <FormControl>
                    <Input placeholder="留空保持原有值" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="secret_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Secret Key (留空保持不变)</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="留空保持原有值"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="secure"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">使用 HTTPS</FormLabel>
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="w-full"
            >
              {mutation.isPending ? "保存中..." : "保存修改"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
