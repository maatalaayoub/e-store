"use client";

import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

/**
 * Reusable confirmation dialog rendered via React portal.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {string}  props.title
 * @param {string}  [props.description]
 * @param {string}  [props.confirmText="Confirm"]
 * @param {string}  [props.cancelText="Cancel"]
 * @param {() => void | Promise<void>} props.onConfirm
 * @param {() => void} props.onCancel
 * @param {boolean} [props.isLoading=false]      Shows "…" on confirm button and disables both buttons
 * @param {boolean} [props.isDangerous=true]     Renders the confirm button in red (e.g. for delete/cancel)
 * @param {React.ReactNode} [props.icon]         Override the default warning icon
 */
export default function ConfirmationDialog({
  isOpen,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isLoading = false,
  isDangerous = true,
  icon,
}) {
  if (!isOpen || typeof document === "undefined") return null;

  const confirmClass = isDangerous
    ? "bg-red-600 hover:bg-red-700 text-white"
    : "bg-zinc-900 hover:bg-zinc-800 text-white";
  const iconWrapClass = isDangerous ? "bg-red-50 text-red-500" : "bg-zinc-100 text-zinc-700";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4"
      onClick={isLoading ? undefined : onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${iconWrapClass}`}>
          {icon ?? <AlertTriangle className="h-6 w-6" />}
        </div>
        <div className="text-center">
          <p className="font-semibold text-zinc-900 text-base">{title}</p>
          {description && (
            <p className="mt-1 text-sm text-zinc-500">{description}</p>
          )}
        </div>
        <div className="flex w-full gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-75 ${confirmClass} inline-flex items-center justify-center gap-2`}
          >
            {isLoading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span>{confirmText}</span>
              </>
            ) : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
