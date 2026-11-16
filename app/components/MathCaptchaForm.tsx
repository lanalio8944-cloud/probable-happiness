"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Challenge = { challengeId: string; question: string; expiresIn: number };
type ApiError = { error?: string; code?: string; attemptsLeft?: number };

export default function MathCaptchaForm({ disabled = false }: { disabled?: boolean }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadChallenge = useCallback(async () => {
    setLoading(true);
    setMessage("");
    setAnswer("");
    try {
      const response = await fetch("/api/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        cache: "no-store",
      });
      const data = await response.json() as Challenge & ApiError;
      if (!response.ok) throw new Error(data.error || "Soal tidak tersedia.");
      setChallenge(data);
    } catch (error) {
      setChallenge(null);
      setMessage(error instanceof Error ? error.message : "Soal tidak tersedia.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChallenge();
  }, [loadChallenge]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge || submitting || disabled) return;

    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.challengeId, answer }),
        cache: "no-store",
      });
      const data = await response.json() as ApiError & { success?: boolean };

      if (response.ok && data.success) {
        window.location.assign("/r");
        return;
      }

      setMessage(data.error || "Verifikasi gagal. Silakan coba lagi.");
      setAnswer("");
      if (data.code === "expired" || data.code === "locked") {
        await loadChallenge();
      }
    } catch {
      setMessage("Verifikasi tidak tersedia saat ini. Silakan coba kembali.");
    } finally {
      setSubmitting(false);
    }
  }

  const busy = disabled || loading || submitting;

  return (
    <form className="captcha-form" onSubmit={handleSubmit}>
      <div className="question-box" aria-live="polite" aria-atomic="true">
        <span className="question-label">Soal penjumlahan</span>
        <span className="question" aria-label={challenge ? `Berapakah ${challenge.question}?` : "Soal sedang dimuat"}>
          {loading ? "Memuat soal…" : challenge ? `${challenge.question} = ?` : "Soal belum tersedia"}
        </span>
      </div>

      <label htmlFor="answer">Jawaban Anda</label>
      <p className="field-help" id="answer-help">Masukkan hasil penjumlahan sebagai angka.</p>
      <input
        id="answer"
        name="answer"
        type="text"
        inputMode="numeric"
        pattern="[0-9]{1,2}"
        autoComplete="off"
        value={answer}
        onChange={(event) => setAnswer(event.target.value.replace(/\D/g, "").slice(0, 2))}
        aria-describedby="answer-help"
        required
        disabled={busy || !challenge}
      />

      <button className="primary-button" type="submit" disabled={busy || !challenge || !answer}>
        {submitting ? "Memeriksa…" : "Verifikasi & lanjutkan"}
      </button>
      <button className="secondary-button" type="button" onClick={() => void loadChallenge()} disabled={busy}>
        Muat soal baru
      </button>

      {message && <p className="form-message" role="alert">{message}</p>}
    </form>
  );
}
