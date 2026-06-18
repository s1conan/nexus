import { toast } from "sonner"

/**
 * Standardized Notification Utility for NIDS
 * 
 * Visually: Uses the "Android-style" rounded floating design defined in globals.css
 * Semantically: Uses the success/error/warning/info colors defined in globals.css
 */
export const notify = {
  success: (title: string, description?: string, duration = 5000) => {
    return toast.success(title, {
      description,
      duration,
    })
  },

  error: (title: string, description?: string, duration = 7000) => {
    return toast.error(title, {
      description,
      duration,
    })
  },

  warning: (title: string, description?: string, duration = 6000) => {
    return toast.warning(title, {
      description,
      duration,
    })
  },

  info: (title: string, description?: string, duration = 5000) => {
    return toast.info(title, {
      description,
      duration,
    })
  },

  deleted: (title: string, description?: string, duration = 5000) => {
    return toast.error(title, {
      description,
      duration,
    })
  },

  /**
   * Special high-importance notification (e.g., Security links)
   */
  security: (title: string, description: string) => {
    return toast.success(title, {
      description,
      duration: 10000, // Longer duration for critical info
    })
  }
}
