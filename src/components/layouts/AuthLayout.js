/**
 * AuthLayout
 *
 * Shell component for authentication pages (login, signup, password reset…).
 * Add a centred card wrapper and branding here when ready.
 *
 * @param {{ children: React.ReactNode }} props
 */
export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center">
      {/* <BrandLogo /> */}
      <main className="w-full">{children}</main>
    </div>
  );
}
