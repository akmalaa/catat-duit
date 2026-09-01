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
  MagnifyingGlass,
  Target,
  Trash,
  FileText,
  UploadSimple,
  ArrowSquareOut,
  Link,
  Plug,
  BookOpen,
  Info,
  CheckCircle,
  XCircle,
  PencilSimple,
  X,
  HandCoins,
  Handshake,
  PiggyBank,
  ArrowLineUp,
  ArrowLineDown,
  CaretLeft,
  CaretRight,
  NotePencil,
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

// Ikon per kategori transaksi — dipetakan berdasarkan label (lihat CATEGORIES di lib/constants.js)
const CATEGORY_ICONS = {
  'Pengeluaran': TrendDown,
  'Pemasukan': TrendUp,
  'Hutang (Masuk)': HandCoins,
  'Hutang (Keluar)': Handshake,
  'Investasi/Nabung': PiggyBank,
  'Topup Gopay': ArrowLineUp,
  'Topup Shopeepay': ArrowLineUp,
  'Tarik Cash': ArrowLineDown,
}

export function CategoryIcon({ kategori, size = 16, weight = 'bold', color, className }) {
  const Icon = CATEGORY_ICONS[kategori] || Receipt
  return <Icon size={size} weight={weight} color={color} className={className} aria-hidden="true" />
}

export {
  GearSix, CloudArrowUp, Receipt, ChartBar, TrendUp, TrendDown, WarningCircle,
  MagnifyingGlass, Target, Trash, FileText, UploadSimple, ArrowSquareOut,
  Link, Plug, BookOpen, Info, CheckCircle, XCircle, PencilSimple, X, CaretLeft, CaretRight,
  NotePencil,
}
