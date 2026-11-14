import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Activity,
  AlertCircle,
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
  ShieldCheck,
  TrendingUp,
  UserRound,
} from 'lucide-react'
import { login } from './api'

// ── Compact Feature Highlights (Inline Chips) ───────────────────
const FEATURES = [
  { icon: Activity, text: 'روند فروش روزانه و ماهانه', color: '#0071E3' },
  { icon: Building2, text: 'عملکرد شعبه‌ها و ویزیتورها', color: '#E4A53A' },
  { icon: TrendingUp, text: 'تحلیل رشد، افت و پارتو', color: '#2F9A88' },
]

/**
 * 60fps Interactive HTML5 Canvas: "نبض فروش" Live Reactive Field
 * Constellation of glowing data nodes + 3 flowing harmonic waves
 * with spring physics, cursor gravity/repulsion, and keystroke ripples.
 */
function SalesPulseCanvas({ mouse, focusedField, typingPulseRef, isMobile }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId
    let width = 0
    let height = 0
    let dpr = window.devicePixelRatio || 1

    // Node constellation
    const nodeCount = isMobile ? 22 : 44
    const nodes = []
    const ripples = []

    // Security mode interpolation factor (0 = default blue/saffron, 1 = security emerald/gold)
    let currentSecurity = 0

    const initNodes = (w, h) => {
      nodes.length = 0
      const colors = ['#0071E3', '#38BDF8', '#E4A53A', '#2F9A88', '#60A5FA']
      for (let i = 0; i < nodeCount; i++) {
        const ox = Math.random() * w
        const oy = Math.random() * h
        nodes.push({
          x: ox,
          y: oy,
          originX: ox,
          originY: oy,
          vx: 0,
          vy: 0,
          radius: 1.5 + Math.random() * 2.2,
          baseColor: colors[i % colors.length],
          alpha: 0.35 + Math.random() * 0.45,
          phase: Math.random() * Math.PI * 2,
          speed: 0.5 + Math.random() * 1.2,
        })
      }
    }

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      width = rect.width
      height = rect.height
      dpr = window.devicePixelRatio || 1

      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
      initNodes(width, height)
    }

    resize()
    const ro = new ResizeObserver(() => resize())
    ro.observe(canvas.parentElement)

    // Keystroke typing pulse trigger
    if (typingPulseRef) {
      typingPulseRef.current = (type) => {
        const originX = mouse.active ? mouse.x : width * 0.5
        const originY = mouse.active ? mouse.y : height * 0.55

        ripples.push({
          x: originX,
          y: originY,
          radius: 6,
          maxRadius: Math.max(width, height) * (type === 'password' ? 0.95 : 0.75),
          speed: type === 'password' ? 9.5 : 7.5,
          alpha: 0.9,
          type,
        })

        // Impulse force to nearby nodes
        for (const n of nodes) {
          const dx = n.x - originX
          const dy = n.y - originY
          const dist = Math.hypot(dx, dy) || 1
          if (dist < 260) {
            const push = (1 - dist / 260) * 14
            n.vx += (dx / dist) * push
            n.vy += (dy / dist) * push
          }
        }
      }
    }

    let time = 0

    const render = () => {
      time += 0.016
      ctx.clearRect(0, 0, width, height)

      // Smooth security palette interpolation
      const targetSecurity = focusedField === 'password' ? 1 : 0
      currentSecurity += (targetSecurity - currentSecurity) * 0.08

      // ── 1. Soft Mouse Radial Trail ───────────────────────────────
      if (mouse.active) {
        const auraGrad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 160)
        const c1 = currentSecurity > 0.4 ? 'rgba(47, 154, 136, 0.22)' : 'rgba(56, 189, 248, 0.20)'
        const c2 = currentSecurity > 0.4 ? 'rgba(228, 165, 58, 0.08)' : 'rgba(0, 113, 227, 0.06)'
        auraGrad.addColorStop(0, c1)
        auraGrad.addColorStop(0.5, c2)
        auraGrad.addColorStop(1, 'transparent')
        ctx.fillStyle = auraGrad
        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, 160, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── 2. Harmonic "Sales Pulse" Flowing Waves ──────────────────
      const waveConfigs = [
        // Wave 1: Saffron Gold Target Baseline
        {
          baseY: height * 0.44,
          freq1: 0.009,
          freq2: 0.004,
          speed1: 1.1,
          speed2: 0.6,
          amp1: 18,
          amp2: 10,
          color: '#E4A53A',
          alpha: 0.45,
          width: 1.6,
        },
        // Wave 2: Primary Sales Pulse (Sky Blue <-> Security Emerald)
        {
          baseY: height * 0.62,
          freq1: 0.013,
          freq2: 0.021,
          speed1: 1.5,
          speed2: 0.9,
          amp1: 28,
          amp2: 14,
          color: currentSecurity > 0.5 ? '#2F9A88' : '#38BDF8',
          alpha: 0.85,
          width: 2.8,
          glow: true,
        },
        // Wave 3: Growth / Momentum (Teal / Sapphire)
        {
          baseY: height * 0.74,
          freq1: 0.008,
          freq2: 0.015,
          speed1: 1.3,
          speed2: 0.5,
          amp1: 22,
          amp2: 12,
          color: currentSecurity > 0.5 ? '#10B981' : '#0071E3',
          alpha: 0.6,
          width: 2.0,
        },
      ]

      for (const w of waveConfigs) {
        ctx.save()
        ctx.beginPath()
        const step = 6

        for (let x = 0; x <= width + step; x += step) {
          const t1 = time * w.speed1
          const t2 = time * w.speed2
          let y = w.baseY + Math.sin(t1 + x * w.freq1) * w.amp1 + Math.cos(t2 + x * w.freq2) * w.amp2

          // Mouse proximity wave bending
          if (mouse.active) {
            const dx = x - mouse.x
            const influence = Math.exp(-(dx * dx) / (2 * 110 * 110))
            const dy = (mouse.y - w.baseY) * influence * 0.42
            y += dy
          }

          // Active keystroke ripples bending the wave
          for (const rip of ripples) {
            const dist = Math.abs(x - rip.x)
            if (Math.abs(dist - rip.radius) < 70) {
              const ripWave = Math.sin((dist - rip.radius) * 0.1) * (rip.alpha * 16)
              y += ripWave
            }
          }

          if (x === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }

        ctx.strokeStyle = w.color
        ctx.globalAlpha = w.alpha
        ctx.lineWidth = w.width
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        if (w.glow) {
          ctx.shadowColor = w.color
          ctx.shadowBlur = 14
        }
        ctx.stroke()
        ctx.restore()
      }

      // ── 3. Constellation Nodes & Spring Physics ──────────────────
      const maxConnDist = isMobile ? 65 : 85

      // Node proximity lines
      ctx.lineWidth = 1
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i]
          const n2 = nodes[j]
          const dx = n1.x - n2.x
          const dy = n1.y - n2.y
          const d = Math.hypot(dx, dy)
          if (d < maxConnDist) {
            const lineAlpha = (1 - d / maxConnDist) * 0.22 * (n1.alpha + n2.alpha) * 0.5
            ctx.strokeStyle = currentSecurity > 0.5 ? '#2F9A88' : '#38BDF8'
            ctx.globalAlpha = lineAlpha
            ctx.beginPath()
            ctx.moveTo(n1.x, n1.y)
            ctx.lineTo(n2.x, n2.y)
            ctx.stroke()
          }
        }
      }

      // Update & Draw Nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]

        // Spring force returning node to resting origin
        const springK = 0.025
        const damping = 0.88
        const ax = (n.originX - n.x) * springK
        const ay = (n.originY - n.y) * springK

        // Mouse attraction/repulsion
        if (mouse.active) {
          const dx = mouse.x - n.x
          const dy = mouse.y - n.y
          const dist = Math.hypot(dx, dy)
          const radius = 130
          if (dist < radius && dist > 1) {
            const factor = 1 - dist / radius
            const pull = factor * 1.8
            n.vx += (dx / dist) * pull * 0.6
            n.vy += (dy / dist) * pull * 0.6
          }
        }

        n.vx = (n.vx + ax) * damping
        n.vy = (n.vy + ay) * damping
        n.x += n.vx
        n.y += n.vy

        // Breathing pulse
        const pulse = Math.sin(time * n.speed + n.phase) * 0.25 + 0.75
        const nodeColor = currentSecurity > 0.5
          ? (i % 2 === 0 ? '#2F9A88' : '#E4A53A')
          : n.baseColor

        ctx.save()
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.radius * (0.85 + pulse * 0.2), 0, Math.PI * 2)
        ctx.fillStyle = nodeColor
        ctx.globalAlpha = n.alpha * pulse
        ctx.shadowColor = nodeColor
        ctx.shadowBlur = 8
        ctx.fill()
        ctx.restore()
      }

      // ── 4. Typing Ripples Draw & Expand ──────────────────────────
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i]
        r.radius += r.speed
        r.alpha *= 0.94

        if (r.alpha < 0.02 || r.radius > r.maxRadius) {
          ripples.splice(i, 1)
          continue
        }

        ctx.save()
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
        ctx.strokeStyle = r.type === 'password' || currentSecurity > 0.5 ? '#2F9A88' : '#38BDF8'
        ctx.lineWidth = 2.2
        ctx.globalAlpha = r.alpha * 0.85
        ctx.shadowColor = r.type === 'password' ? '#2F9A88' : '#0071E3'
        ctx.shadowBlur = 12
        ctx.stroke()
        ctx.restore()
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrameId)
      ro.disconnect()
    }
  }, [mouse.active, focusedField, isMobile])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none select-none"
    />
  )
}

export default function LoginPage({ onSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [focusedField, setFocusedField] = useState(null) // 'username' | 'password' | null

  // Mouse & 3D Tilt State
  const [mouse, setMouse] = useState({ x: 0, y: 0, active: false })
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const cardRef = useRef(null)
  const typingPulseRef = useRef(null)

  // Track responsive screen size
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Mouse move handler for dynamic spotlight and desktop 3D parallax tilt
  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setMouse({ x, y, active: true })

    // Subtle 3D Parallax Tilt (Desktop only: max ±3deg rotateX, ±4deg rotateY)
    if (window.innerWidth >= 1024) {
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const normX = (x - centerX) / centerX
      const normY = (y - centerY) / centerY

      setTilt({
        x: -normY * 3, // rotateX max ±3deg
        y: normX * 4,  // rotateY max ±4deg
      })
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    setMouse((prev) => ({ ...prev, active: false }))
    setTilt({ x: 0, y: 0 })
  }, [])

  // Input keystroke handlers that trigger the canvas ripple pulse
  const handleUsernameChange = (e) => {
    setUsername(e.target.value)
    typingPulseRef.current?.('username')
  }

  const handlePasswordChange = (e) => {
    setPassword(e.target.value)
    typingPulseRef.current?.('password')
  }

  // Untouched authentication & API logic
  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const failure = await login(username.trim(), password)
    setBusy(false)
    if (failure) {
      setError(failure)
      setPassword('')
      return
    }
    onSuccess()
  }

  const isPasswordFocused = focusedField === 'password'

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-[#070B19] relative overflow-hidden select-none font-sans antialiased text-right selection:bg-[#0071E3]/30"
    >
      {/* ── Background Atmospheric Ambient Mesh Orbs ────────────── */}
      <div className="absolute top-[-15%] right-[-10%] w-[640px] h-[640px] rounded-full bg-gradient-to-br from-[#0071E3]/25 via-[#38BDF8]/15 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[700px] h-[700px] rounded-full bg-gradient-to-tr from-[#2F9A88]/20 via-[#1D3557]/30 to-[#E4A53A]/15 blur-[150px] pointer-events-none" />
      <div className="absolute top-[35%] left-[20%] w-[380px] h-[380px] rounded-full bg-[#0071E3]/10 blur-[120px] pointer-events-none" />

      {/* Subtle background tech grid */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)`,
          backgroundSize: '36px 36px',
        }}
      />

      <div className="w-full max-w-[1040px] flex flex-col items-center relative z-10">
        {/* ── Main Glass Card ─────────────────────────────────────── */}
        <motion.div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          initial={{ opacity: 0, scale: 0.96, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="relative z-10 w-full min-h-[560px] grid grid-cols-1 lg:grid-cols-12 rounded-[32px] sm:rounded-[40px] bg-white/[0.06] backdrop-blur-3xl border border-white/15 shadow-[0_32px_80px_rgba(0,0,0,0.55)] overflow-hidden"
          style={{
            perspective: 1200,
          }}
        >
          {/* ── Dynamic Radial Spotlight Layer on Card Border ──────── */}
          <div
            className="pointer-events-none absolute -inset-px rounded-[inherit] transition-opacity duration-500 z-30"
            style={{
              opacity: mouse.active ? 1 : 0,
              background: `radial-gradient(600px circle at ${mouse.x}px ${mouse.y}px, ${
                isPasswordFocused
                  ? 'rgba(47, 154, 136, 0.28)'
                  : 'rgba(56, 189, 248, 0.22)'
              }, transparent 40%)`,
            }}
          />

          {/* ── Form Side (lg:col-span-5) ─────────────────────────── */}
          <div className="order-2 lg:order-1 lg:col-span-5 bg-white/95 text-[#1D1D1F] p-7 sm:p-10 lg:p-12 flex flex-col justify-between relative z-20 backdrop-blur-2xl">
            <div>
              {/* Form State Reactive Badge */}
              <div className="mb-4">
                <AnimatePresence mode="wait">
                  {isPasswordFocused ? (
                    <motion.div
                      key="security-mode"
                      initial={{ opacity: 0, y: -4, scale: 0.94 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.94 }}
                      transition={{ duration: 0.18 }}
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold bg-[#2F9A88]/15 text-[#1b6b5e] border border-[#2F9A88]/30 shadow-sm"
                    >
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2F9A88] opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2F9A88]" />
                      </span>
                      <LockKeyhole size={13} className="text-[#2F9A88]" />
                      <span>حالت احراز هویت امن فعال است</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="standard-mode"
                      initial={{ opacity: 0, y: -4, scale: 0.94 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.94 }}
                      transition={{ duration: 0.18 }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20"
                    >
                      <ShieldCheck size={14} />
                      <span>ورود امن به سامانه</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1D1D1F]">
                خوش آمدید
              </h1>
              <p className="text-xs sm:text-sm text-[#86868B] mt-1 mb-7 font-medium">
                برای مشاهدهٔ گزارش‌ها وارد حساب خود شوید
              </p>

              {/* Form Element */}
              <form onSubmit={submit} className="space-y-4">
                {/* Username Input */}
                <div>
                  <label className="block text-xs font-bold text-[#1D1D1F] mb-1.5">
                    نام کاربری
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute right-3.5 text-[#86868B] pointer-events-none">
                      <UserRound size={18} />
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={handleUsernameChange}
                      onFocus={() => setFocusedField('username')}
                      onBlur={() => setFocusedField(null)}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      dir="ltr"
                      placeholder="نام کاربری"
                      className="w-full bg-black/[0.03] border border-black/[0.06] focus:bg-white focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/20 rounded-2xl pr-11 pl-11 py-3 text-sm text-[#1D1D1F] placeholder:text-[#86868B]/50 transition-all outline-none font-medium text-left [&:-webkit-autofill]:shadow-[0_0_0_1000px_#f8fafc_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#1D1D1F]"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-[#1D1D1F]">
                      رمز عبور
                    </label>
                    {password.length > 0 && (
                      <span className="text-[10px] text-[#2F9A88] font-bold">
                        {password.length} کاراکتر
                      </span>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute right-3.5 text-[#86868B] pointer-events-none transition-colors">
                      <LockKeyhole size={18} className={isPasswordFocused ? 'text-[#2F9A88]' : ''} />
                    </span>
                    <input
                      type={show ? 'text' : 'password'}
                      value={password}
                      onChange={handlePasswordChange}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      autoComplete="current-password"
                      dir="ltr"
                      placeholder="••••••••"
                      className={`w-full bg-black/[0.03] border rounded-2xl pr-11 pl-11 py-3 text-sm text-[#1D1D1F] placeholder:text-[#86868B]/50 transition-all outline-none font-medium text-left [&:-webkit-autofill]:shadow-[0_0_0_1000px_#f8fafc_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#1D1D1F] ${
                        isPasswordFocused
                          ? 'bg-white border-[#2F9A88] ring-4 ring-[#2F9A88]/20'
                          : 'border-black/[0.06] focus:bg-white focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/20'
                      }`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      className="absolute left-3.5 text-[#86868B] hover:text-[#1D1D1F] transition-colors p-1 rounded-lg"
                      aria-label={show ? 'پنهان کردن رمز' : 'نمایش رمز'}
                    >
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-700 flex items-center gap-2"
                    role="alert"
                  >
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={busy || !username || !password}
                  className="w-full mt-2 py-3.5 rounded-2xl bg-[#0071E3] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 hover:bg-[#0077ED] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/35 active:translate-y-0 transition-all disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none cursor-pointer"
                >
                  <LogIn size={18} />
                  <span>{busy ? 'در حال ورود به سامانه…' : 'ورود به داشبورد'}</span>
                </button>
              </form>
            </div>

            {/* Bottom Form Footnote */}
            <div className="mt-6 pt-4 border-t border-black/[0.06] flex items-center justify-center gap-1.5 text-xs text-[#86868B]">
              <ShieldCheck size={14} className="text-[#2F9A88]" />
              <span>دسترسی محافظت‌شده ویژهٔ کاربران مجاز</span>
            </div>
          </div>

          {/* ── Interactive Brand Showcase (lg:col-span-7) ────────── */}
          <div className="order-1 lg:order-2 lg:col-span-7 relative flex flex-col justify-between p-6 sm:p-8 lg:p-12 text-white overflow-hidden bg-gradient-to-br from-[#060D24] via-[#0B173B] to-[#122856]">
            {/* 60fps Interactive HTML5 Canvas Reactive Field */}
            <SalesPulseCanvas
              mouse={mouse}
              focusedField={focusedField}
              typingPulseRef={typingPulseRef}
              isMobile={isMobile}
            />

            {/* Ambient Lighting Orbs inside Dark Showcase */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-[#0071E3]/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#2F9A88]/20 rounded-full blur-3xl pointer-events-none" />

            {/* 3D Tilt Wrapper for Brand Highlights (Desktop only, smooth damping) */}
            <div
              className="relative z-10 flex flex-col justify-between h-full transition-transform duration-200 ease-out"
              style={{
                transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                transformStyle: 'preserve-3d',
              }}
            >
              <div>
                {/* Sleek Floating Glass Squircle Logo */}
                <div className="flex items-center justify-between">
                  <div className="w-16 h-16 rounded-2xl bg-white/95 p-2 shadow-xl shadow-black/40 border border-white/30 flex items-center justify-center backdrop-blur-md">
                    <img
                      src="/login-logo.jpg"
                      alt="شرکت کوپا گستر طلایی"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Live Pulse Status Chip */}
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.08] border border-white/15 backdrop-blur-md text-[11px] font-medium text-white/80 shadow-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34C759] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#34C759]" />
                    </span>
                    <span>سامانه برخط پایش داده‌ها</span>
                  </div>
                </div>

                {/* Brand Titles */}
                <div className="mt-4 sm:mt-5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                      نبض فروش
                    </h2>
                    <span className="px-2 py-0.5 rounded-md bg-[#0071E3]/30 border border-[#0071E3]/40 text-[#38BDF8] text-[10px] font-bold">
                      PRO
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-white/70 mt-1 font-medium">
                    سامانه هوشمند پایش، تحلیل و پیش‌بینی فروش
                  </p>
                </div>

                {/* Compact Feature Chips (Inline, NOT Giant Bars!) */}
                <div className="flex flex-wrap gap-2.5 my-5 sm:my-8">
                  {FEATURES.map(({ icon: Icon, text, color }) => (
                    <div
                      key={text}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 backdrop-blur-md text-xs font-semibold text-white/90 transition-all shadow-sm group cursor-default"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0 transition-transform group-hover:scale-125"
                        style={{ backgroundColor: color }}
                      />
                      <Icon size={14} className="text-white/75 group-hover:text-white transition-colors" />
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Glass Showcase Footer */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E4A53A]" />
                  <span>شرکت <strong className="text-white font-bold">کوپا گستر طلایی</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 text-[10px] font-medium border border-white/10">
                    سال مالی ۱۴۰۵
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Footer Copyright ─────────────────────────────────── */}
        <p className="text-xs text-[#86868B] mt-5 text-center font-medium">
          © ۱۴۰۵ <bdi dir="ltr">M.Kharaji</bdi> · تمامی حقوق محفوظ است
        </p>
      </div>
    </div>
  )
}
