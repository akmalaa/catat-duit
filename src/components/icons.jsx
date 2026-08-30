import {
  Wallet,
  Bank,
  DeviceMobile,
  ShoppingBagOpen,
  GearSix,
  CloudArrowUp,
  Receipt,
  ChartBar,
  TrendUp,
  TrendDown,
  WarningCircle,
} from '@phosphor-icons/react'

// Ikon per metode pembayaran — dipetakan berdasarkan nama metode (lihat METODE_LIST di lib/constants.js)
const METHOD_ICONS = {
  Cash: Wallet,
  Mandiri: Bank,
  Gopay: DeviceMobile,
  Shopeepay: ShoppingBagOpen,
}

export function MethodIcon({ metode, size = 18, weight = 'bold', color, className }) {
  const Icon = METHOD_ICONS[metode] || Wallet
  return <Icon size={size} weight={weight} color={color} className={className} aria-hidden="true" />
}

export { GearSix, CloudArrowUp, Receipt, ChartBar, TrendUp, TrendDown, WarningCircle }
