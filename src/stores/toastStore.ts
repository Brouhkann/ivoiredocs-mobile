import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  show: (type: ToastType, message: string) => void;
  hide: (id: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  show: (type: ToastType, message: string) => {
    const id = Date.now().toString();
    set((state) => ({
      toasts: [...state.toasts, { id, type, message }],
    }));

    // Auto-hide après 3 secondes
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id),
      }));
    }, 3000);
  },

  hide: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },

  success: (message: string) => {
    useToastStore.getState().show('success', message);
  },

  error: (message: string) => {
    useToastStore.getState().show('error', message);
  },

  warning: (message: string) => {
    useToastStore.getState().show('warning', message);
  },

  info: (message: string) => {
    useToastStore.getState().show('info', message);
  },
}));

// Helper pour utiliser facilement dans les composants
export const toast = {
  success: (message: string) => useToastStore.getState().success(message),
  error: (message: string) => useToastStore.getState().error(message),
  warning: (message: string) => useToastStore.getState().warning(message),
  info: (message: string) => useToastStore.getState().info(message),
};
