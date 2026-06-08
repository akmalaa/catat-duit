export default function AppLogo({ size = 40, className = '' }) {
  return (
    <img
      src="/logo.jpg"
      alt="CatatDuit"
      className={['app-logo', className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      decoding="async"
    />
  )
}
