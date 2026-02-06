/**
 * Toast notification utilities
 * Wrapper around sonner for consistent toast notifications
 */

import { toast as sonnerToast, ExternalToast } from 'sonner';

export const toast = {
  success: (message: string, options?: ExternalToast) => {
    return sonnerToast.success(message, options);
  },

  error: (message: string, options?: ExternalToast) => {
    return sonnerToast.error(message, options);
  },

  info: (message: string, options?: ExternalToast) => {
    return sonnerToast.info(message, options);
  },

  warning: (message: string, options?: ExternalToast) => {
    return sonnerToast.warning(message, options);
  },

  custom: (
    component: (id: string | number) => React.ReactElement,
    options?: ExternalToast
  ) => {
    return sonnerToast.custom(component, options);
  },

  dismiss: (toastId?: string | number) => {
    return sonnerToast.dismiss(toastId);
  },
};
