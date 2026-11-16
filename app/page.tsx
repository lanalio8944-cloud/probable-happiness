import MathCaptchaForm from "@/app/components/MathCaptchaForm";
import { getRedirectDestination } from "@/lib/security";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const destination = getRedirectDestination();

  return (
    <main className="page-shell">
      <section className="verification-card" aria-labelledby="page-title">
        <div className="icon" aria-hidden="true">✓</div>
        <p className="eyebrow">GERBANG TAUTAN</p>
        <h1 id="page-title">Verifikasi sebelum melanjutkan</h1>
        <p className="intro">
          Selesaikan soal penjumlahan sederhana untuk membuka tautan. Tujuan
          ditampilkan terlebih dahulu agar Anda tahu ke mana tautan akan membawa.
        </p>

        {destination ? (
          <div className="destination" aria-label="Tujuan tautan">
            <span>Tujuan</span>
            <strong>{destination.hostname}</strong>
          </div>
        ) : (
          <p className="setup-notice" role="status">
            Layanan belum dikonfigurasi. Admin perlu mengatur tujuan HTTPS dan
            allowlist domain di environment Vercel.
          </p>
        )}

        <MathCaptchaForm disabled={!destination} />
        <p className="privacy-note">
          Soal berlaku 5 menit. Anda memiliki maksimal 5 jawaban untuk setiap
          soal. Verifikasi yang berhasil berlaku singkat dan hanya dapat dipakai
          sekali.
        </p>
      </section>
    </main>
  );
}
