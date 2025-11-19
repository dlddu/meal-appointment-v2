// Implemented for spec: agent/specs/meal-appointment-create-appointment-frontend-spec.md

import { useEffect, useMemo, useState } from 'react';
import type { CreateAppointmentResult } from '../types.js';
import { createAppointmentStrings } from '../strings.js';
import { getClipboard } from '../utils/clipboard.js';

type CreateSuccessPanelProps = {
  result: CreateAppointmentResult | null;
  onCopyError: (message: string) => void;
};

export function CreateSuccessPanel({ result, onCopyError }: CreateSuccessPanelProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  const absoluteShareUrl = useMemo(() => {
    if (!result) {
      return '';
    }
    try {
      return new URL(result.response.shareUrl, window.location.origin).toString();
    } catch (error) {
      return result.response.shareUrl;
    }
  }, [result]);

  useEffect(() => {
    if (!toastMessage) return;
    const timeout = window.setTimeout(() => setToastMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const copyToClipboard = async () => {
    if (!result) return;
    const text = absoluteShareUrl;
    setCopying(true);
    try {
      const clipboard = getClipboard();
      if (clipboard && clipboard.writeText) {
        await clipboard.writeText(text);
        setToastMessage(createAppointmentStrings.success.copiedToast);
        return;
      }
      throw new Error('Clipboard API not available');
    } catch (error) {
      const fallbackSucceeded = fallbackCopy(text);
      if (fallbackSucceeded) {
        setToastMessage(createAppointmentStrings.success.copiedToast);
      } else {
        onCopyError(createAppointmentStrings.success.copyFailed);
      }
    } finally {
      setCopying(false);
    }
  };

  const fallbackCopy = (text: string) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return successful;
    } catch (error) {
      return false;
    }
  };

  return (
    <div
      data-testid="create-success-panel"
      className={`transition-[max-height] duration-500 ease-in-out overflow-hidden ${
        result ? 'max-h-[480px]' : 'max-h-0'
      }`}
      aria-hidden={!result}
    >
      <div className="mt-8 bg-white rounded-[16px] shadow-[0_12px_24px_rgba(15,23,42,0.12)] p-6 border border-border flex flex-col gap-4">
        <div>
          <p className="text-sm font-semibold text-success uppercase tracking-wide">{createAppointmentStrings.success.sectionTitle}</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">{createAppointmentStrings.success.headline}</h3>
          <p className="text-slate-600 mt-1">{createAppointmentStrings.success.body}</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 items-stretch">
          <div className="flex-1 border border-border rounded-[12px] px-4 py-3 bg-background">
            <p className="text-xs text-slate-500">{createAppointmentStrings.success.shareLabel}</p>
            <p
              className="mt-1 font-medium text-slate-900 leading-6 max-h-[3rem] overflow-hidden text-ellipsis break-words"
              data-testid="share-url-text"
            >
              {absoluteShareUrl}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="h-[48px] px-5 bg-secondary text-slate-900 rounded-[12px] font-semibold shadow-[0_8px_16px_rgba(244,162,97,0.32)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={copyToClipboard}
              aria-label={createAppointmentStrings.success.copyButton}
              disabled={copying}
            >
              {copying ? createAppointmentStrings.success.copying : createAppointmentStrings.success.copyButton}
            </button>
            <a
              href={result ? absoluteShareUrl : '#'}
              target="_blank"
              rel="noreferrer"
              className="h-[48px] px-5 border border-primary text-primary rounded-[12px] font-semibold flex items-center justify-center hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {createAppointmentStrings.success.viewDetails}
            </a>
          </div>
        </div>
        {toastMessage && (
          <div
            role="status"
            aria-live="assertive"
            className="mt-2 inline-flex items-center gap-2 text-sm text-success bg-success/10 px-4 py-2 rounded-full"
          >
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}
