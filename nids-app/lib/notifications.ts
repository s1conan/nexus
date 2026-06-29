import { toast } from "sonner"

const dispatchNotification = (
  type: string,
  title: string,
  description?: string,
  isDb = false
) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nids-notification", {
        detail: {
          id: Math.random().toString(36).substring(2, 9),
          type,
          title,
          description: description || "",
          timestamp: new Date().toISOString(),
          isDb,
        },
      })
    )
  }
}

/**
 * Standardized Notification Utility for NIDS
 *
 * Visually: Uses the "Android-style" rounded floating design defined in globals.css
 * Semantically: Uses the success/error/warning/info colors defined in globals.css
 */
export const notify = {
  success: (
    title: string,
    description?: string,
    duration = 5000,
    isDb = false
  ) => {
    dispatchNotification("success", title, description, isDb)
    return toast.success(title, {
      description,
      duration,
    })
  },

  error: (title: string, description?: string, duration = 7000) => {
    dispatchNotification("error", title, description, false)
    return toast.error(title, {
      description,
      duration,
    })
  },

  warning: (title: string, description?: string, duration = 6000) => {
    dispatchNotification("warning", title, description, false)
    return toast.warning(title, {
      description,
      duration,
    })
  },

  info: (title: string, description?: string, duration = 5000) => {
    dispatchNotification("info", title, description, false)
    return toast.info(title, {
      description,
      duration,
    })
  },

  deleted: (
    title: string,
    description?: string,
    duration = 5000,
    isDb = false
  ) => {
    dispatchNotification("deleted", title, description, isDb)
    return toast.error(title, {
      description,
      duration,
    })
  },

  /**
   * Special high-importance notification (e.g., Security links)
   */
  security: (title: string, description: string) => {
    dispatchNotification("success", title, description, false)
    return toast.success(title, {
      description,
      duration: 10000, // Longer duration for critical info
    })
  },
}
