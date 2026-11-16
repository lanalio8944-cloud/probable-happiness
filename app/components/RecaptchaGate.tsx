"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

type RecaptchaParameters = {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
  tabindex: number;
};

declare global {
  interface Window {
    grecaptcha?: {
      render: (container: HTMLElement, parameters: RecaptchaParameters) => number;
      reset: (widgetId?: number) => void;
    };
  }
}

type Props = {
  siteKey: string;
  disabled?: boolean;
};

export default function RecaptchaGate({ siteKey, disabled = false }: Props) {
  const widgetContainer = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const resetCaptcha = useCallback(() => {
    setCaptchaToken("");
    setVerified(false);
    if (widgetId.current !== null && window.grecaptcha) {
      window.grecaptcha.reset(widgetId.current);
    }
  }, []);

  useEffect(() => {
    if (!scriptReady || !widgetContainer.current || !window.grecaptcha || widgetId.current !== null) return;

    widgetId.current = window.grecaptcha.render(widgetContainer.current, {
      sitekey: siteKey,
      tabindex: 0,
      callback: (token) => {
        setCaptchaToken(token);
        setMessage("");
      },
      "expired-callback": () => {
        setCaptchaToken("");
        setVerified(false);
        setMessage("CAPTCHA kedaluwarsa. Silakan centang ulang.");
      },
      "error-callback": () => {
        setCaptchaToken("");
        setVerified(false);
        setMessage("CAPTCHA tidak dapat dimuat. Periksa koneksi lalu coba lagi.");
      },
    });
  }, [scriptReady, siteKey]);

  async function handleVerify() {
    if (!captchaToken || busy || disabled) return;
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: captchaToken }),
        cache: "no-store",
      });
      const data = await response.json() as { success?: boolean; error?: string };

      if (!response.ok || data.success !== true) {
        throw new Error(data.error || "Verifikasi CAPTCHA gagal.");
      }

      setVerified(true);
      setCaptchaToken("");
      setMessage("Verifikasi berhasil. Tekan tombol di bawah untuk melanjutkan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verifikasi gagal. Silakan coba lagi.");
      resetCaptcha();
    } finally {
      setBusy(false);
    }
  }

  function continueToSite() {
    if (verified) window.location.assign("/r");
  }

  return (
    <div className="captcha-form">
      <Script
        src="https://www.google.com/recaptcha/api.js?render=explicit&hl=id"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => setMessage("Skrip Google reCAPTCHA gagal dimuat. Periksa koneksi atau pengaturan pemblokir konten.")}
      />

      {!verified && <>
        <p className="field-help" id="captcha-help">
          Selesaikan kotak reCAPTCHA. Anda dapat menggunakan keyboard untuk berinteraksi dengan widget.
        </p>
        <div className="captcha-container" ref={widgetContainer} aria-describedby="captcha-help" />
        <button className="primary-button" type="button" onClick={() => void handleVerify()} disabled={disabled || busy || !captchaToken}>
          {busy ? "Memverifikasi…" : "Verifikasi CAPTCHA"}
        </button>
      </>}

      {verified && <button className="primary-button" type="button" onClick={continueToSite}>
        Lanjutkan ke situs utama
      </button>}

      {message && <p className="form-message" role="status" aria-live="polite">{message}</p>}
    </div>
  );
}
