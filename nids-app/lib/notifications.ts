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

const dispatchNotificationUpdate = (id: string, description: string) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nids-notification-update", {
        detail: { id, description },
      })
    )
  }
}

/**
 * Replaces the description of an already-shown toast (and its notification
 * history entry) once a translation promise resolves. Used together with
 * aiTranslate: the original text is shown immediately, then swapped for the
 * translated text when it arrives.
 */
const applyTranslation = (
  toastId: string | number,
  notificationId: string,
  title: string,
  translation: Promise<string> | string | undefined
) => {
  if (!translation) return
  Promise.resolve(translation)
    .then((translated) => {
      if (!translated) return
      // Sonner: re-invoking toast with the same id updates it in place
      toast(title, { id: toastId, description: translated })
      dispatchNotificationUpdate(notificationId, translated)
    })
    .catch(() => {
      /* translation is best-effort; original text stays */
    })
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

  error: (
    title: string,
    description?: string,
    translation?: Promise<string> | string,
    duration = 7000
  ) => {
    const notificationId = Math.random().toString(36).substring(2, 9)
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("nids-notification", {
          detail: {
            id: notificationId,
            type: "error",
            title,
            description: description || "",
            timestamp: new Date().toISOString(),
            isDb: false,
          },
        })
      )
    }
    const toastId = toast.error(title, {
      description,
      duration,
    })
    applyTranslation(toastId, notificationId, title, translation)
    return toastId
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
