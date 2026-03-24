import type * as React from 'react'
import { cn } from '../lib/utils.js'

interface LogoProps {
  size: 'sm' | 'md' | 'lg'
  className?: string
}

const dims = {
  sm: { fontSize: 18, die: 13, swordH: 20, swordW: 9 },
  md: { fontSize: 36, die: 24, swordH: 38, swordW: 17 },
  lg: { fontSize: 48, die: 32, swordH: 50, swordW: 22 },
}

const PIP_POSITIONS = [
  { id: 'tl', xFactor: -0.28, yFactor: -0.28 },
  { id: 'tr', xFactor: 0.28, yFactor: -0.28 },
  { id: 'c', xFactor: 0, yFactor: 0 },
  { id: 'bl', xFactor: -0.28, yFactor: 0.28 },
  { id: 'br', xFactor: 0.28, yFactor: 0.28 },
]

function DieSvg({ size }: { size: number }) {
  const r = size * 0.18
  const pipR = size * 0.09
  const c = size / 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        display: 'inline-block',
        verticalAlign: 'baseline',
        transform: 'rotate(-5deg)',
        filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.5))',
        flexShrink: 0,
        position: 'relative',
        top: size * 0.05,
      }}
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width={size - 2}
        height={size - 2}
        rx={r}
        ry={r}
        fill="#ffbf47"
      />
      {PIP_POSITIONS.map((p) => (
        <circle
          key={p.id}
          cx={c + size * p.xFactor}
          cy={c + size * p.yFactor}
          r={pipR}
          fill="#0a1628"
        />
      ))}
    </svg>
  )
}

function SwordSvg({ width, height }: { width: number; height: number }) {
  const bladeW = width * 0.28
  const highlightW = bladeW * 0.3
  const crossW = width
  const crossH = height * 0.08
  const gripW = width * 0.32
  const gripH = height * 0.22
  const pommelW = width * 0.55
  const pommelH = height * 0.07
  const bladeH = height - crossH - gripH - pommelH

  const bladeX = (width - bladeW) / 2
  const highlightX = bladeX + bladeW * 0.15
  const crossY = bladeH
  const gripX = (width - gripW) / 2
  const gripY = crossY + crossH
  const pommelY = gripY + gripH

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        display: 'inline-block',
        verticalAlign: 'baseline',
        filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.4))',
        flexShrink: 0,
        position: 'relative',
        top: height * 0.04,
      }}
      aria-hidden="true"
    >
      <rect
        x={bladeX}
        y={0}
        width={bladeW}
        height={bladeH}
        rx={bladeW * 0.3}
        fill="#c0c8d4"
      />
      <rect
        x={highlightX}
        y={bladeH * 0.05}
        width={highlightW}
        height={bladeH * 0.8}
        rx={highlightW * 0.4}
        fill="#dce3ed"
        opacity={0.8}
      />
      <rect
        x={0}
        y={crossY}
        width={crossW}
        height={crossH}
        rx={crossH * 0.35}
        fill="#ffbf47"
      />
      <rect
        x={gripX}
        y={gripY}
        width={gripW}
        height={gripH}
        rx={gripW * 0.2}
        fill="#8B5E3C"
      />
      <rect
        x={gripX + gripW * 0.1}
        y={gripY + gripH * 0.3}
        width={gripW * 0.8}
        height={gripH * 0.12}
        rx={1}
        fill="#a06e42"
        opacity={0.7}
      />
      <rect
        x={gripX + gripW * 0.1}
        y={gripY + gripH * 0.58}
        width={gripW * 0.8}
        height={gripH * 0.12}
        rx={1}
        fill="#a06e42"
        opacity={0.7}
      />
      <ellipse
        cx={width / 2}
        cy={pommelY + pommelH / 2}
        rx={pommelW / 2}
        ry={pommelH / 2}
        fill="#ffbf47"
      />
      <circle
        cx={width / 2}
        cy={pommelY + pommelH / 2}
        r={pommelH * 0.25}
        fill="#0a1628"
      />
    </svg>
  )
}

export function Logo({ size, className }: LogoProps) {
  const isLg = size === 'lg'
  const { fontSize, die, swordH, swordW } = dims[size]

  const textStyle: React.CSSProperties = {
    fontFamily: 'system-ui, sans-serif',
    fontSize,
    fontWeight: 700,
    lineHeight: 1,
  }

  return (
    <div className={cn('inline-flex flex-col items-center', className)}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: fontSize * 0.04,
        }}
      >
        <span style={{ ...textStyle, color: '#e8edf5' }}>g</span>
        <DieSvg size={die} />
        <span style={{ ...textStyle, color: '#e8edf5' }}>me</span>
        <span style={{ ...textStyle, color: '#ffbf47' }}>f</span>
        <SwordSvg width={swordW} height={swordH} />
        <span style={{ ...textStyle, color: '#ffbf47' }}>nder</span>
      </span>
      {isLg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: fontSize * 0.25,
            marginTop: fontSize * 0.2,
          }}
        >
          <div
            style={{
              height: 1,
              width: fontSize * 1.2,
              background: 'rgba(255,191,71,0.4)',
            }}
          />
          <span
            style={{
              color: '#ffbf47',
              fontSize: fontSize * 0.28,
              letterSpacing: fontSize * 0.15,
              lineHeight: 1,
            }}
          >
            ●●●
          </span>
          <div
            style={{
              height: 1,
              width: fontSize * 1.2,
              background: 'rgba(255,191,71,0.4)',
            }}
          />
        </div>
      )}
    </div>
  )
}
