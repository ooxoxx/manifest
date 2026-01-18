import { toast } from "sonner"

const useCustomToast = () => {
  const showSuccessToast = (description: string) => {
    toast.success("成功！", {
      description,
    })
  }

  const showErrorToast = (description: string) => {
    toast.error("出错了！", {
      description,
    })
  }

  return { showSuccessToast, showErrorToast }
}

export default useCustomToast
