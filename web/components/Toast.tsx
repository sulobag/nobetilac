"use client";

import { useCallback, useEffect, useState } from "react";

export interface ToastMessage {
  id: string;
  title: string;
  body: string;
  type?: "info" | "success" | "warning";
}

interface ToastProps {
  messages: ToastMessage[];
  onDismiss: (id: string) => void;
}

function ToastItem({
  msg,
  onDismiss,
}: {
  msg: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // slide-in animasyonu
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(msg.id), 350);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [msg.id, onDismiss]);

  const handleClose = () => {
    setExiting(true);
    setTimeout(() => onDismiss(msg.id), 350);
  };

  const borderColor =
    msg.type === "success"
      ? "border-emerald-400"
      : msg.type === "warning"
        ? "border-amber-400"
        : "border-sky-400";

  const iconBg =
    msg.type === "success"
      ? "bg-emerald-500"
      : msg.type === "warning"
        ? "bg-amber-500"
        : "bg-sky-500";

  return (
    <div
      className={`
        pointer-events-auto flex w-[calc(100vw-2rem)] sm:w-96 items-start gap-3 rounded-xl border ${borderColor}
        bg-white px-4 py-3 shadow-xl transition-all duration-300
        ${visible && !exiting ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"}
      `}
    >
      {/* İkon */}
      <div
        className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${iconBg}`}
      >
        {msg.type === "success" ? (
          <svg
            className="h-4 w-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <svg
            className="h-4 w-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        )}
      </div>

      {/* İçerik */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">{msg.title}</p>
        <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
          {msg.body}
        </p>
      </div>

      {/* Kapat */}
      <button
        type="button"
        onClick={handleClose}
        className="mt-0.5 flex-shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer({ messages, onDismiss }: ToastProps) {
  return (
    <div className="pointer-events-none fixed top-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-3">
      {messages.map((msg) => (
        <ToastItem key={msg.id} msg={msg} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

/**
 * Toast hook — bileşen içinde kullanmak için
 */
export function useToast() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (toast: Omit<ToastMessage, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setMessages((prev) => [...prev, { ...toast, id }]);
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return { messages, addToast, dismissToast };
}
