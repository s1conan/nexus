"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      expand={true}
      gap={12}
      icons={{
        success: <CircleCheckIcon className="size-6" />,
        info: <InfoIcon className="size-6" />,
        warning: <TriangleAlertIcon className="size-6" />,
        error: <OctagonXIcon className="size-6" />,
        loading: <Loader2Icon className="size-6 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast !bg-transparent !rounded-3xl !p-4 !shadow-2xl !backdrop-blur-sm !border-white/10 !min-w-[320px] !max-w-[450px] transition-all duration-300",
          title: "!text-base !font-bold !tracking-tight ml-2",
          description:
            "!text-sm !opacity-90 !font-medium !mt-1 !ml-2 !text-foreground",
          success: "success-toast",
          error: "error-toast",
          warning: "warning-toast",
          info: "info-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
