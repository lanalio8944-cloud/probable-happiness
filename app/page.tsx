import RecaptchaGate from "@/app/components/RecaptchaGate";
import { getRedirectDestination } from "@/lib/security";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const destination = getRedirectDestination();
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  return (
    <main className="page-shell">
      <section className="verification-card" aria-labelledby="page-title">
        <div className="icon" aria-hidden="true">✓</div>
        <p className="eyebrow">GERBANG TAUTAN</p>
        <h1 id="page-title">Verifikasi sebelum melanjutkan</h1>
        <p className="intro">
          Selesaikan verifikasi reCAPTCHA untuk membuka tombol menuju situs utama.
          Tujuan ditampilkan terlebih dahulu agar Anda tahu ke mana tautan akan membawa.
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

        {siteKey ? (
          <RecaptchaGate siteKey={siteKey} disabled={!destination} />
        ) : (
          <p className="setup-notice" role="status">
            reCAPTCHA belum dikonfigurasi. Admin perlu menambahkan Site Key di environment.
          </p>
        )}

        <p className="privacy-note">
          Verifikasi dilakukan di server dengan Google. Setelah berhasil, tekan tombol untuk melanjutkan.
        </p>
      </section>
    </main>
  );
}
