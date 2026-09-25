import React from 'react'
import { cn } from '@/lib/utils'

export interface DataTableColumn<T> {
  key: string
  header: React.ReactNode
  render?: (row: T, index: number) => React.ReactNode
  align?: 'left' | 'center' | 'right'
  isNumeric?: boolean
  className?: string
  width?: string
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  keyExtractor: (row: T, index: number) => string | number
  playerRowPredicate?: (row: T) => boolean
  playerRowTeamColor?: string
  playerBadgeLabel?: string
  emptyMessage?: React.ReactNode
  className?: string
  onRowClick?: (row: T) => void
}

/**
 * DataTable padronizada — Race Operations
 * - Header sticky com superfície Camada 1 / Camada 2
 * - Números alinhados à direita em tabular-nums mono (.font-num / text-num)
 * - Hover de linha discreto em Camada 2 (#161D29)
 * - Linha destacada para a equipe do jogador (fundo sutil + selo)
 * - Barra lateral de 3px com a cor da equipe
 * - Superfícies Camada 1 (#11161F) com borda #1F2733
 */
export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  playerRowPredicate,
  playerRowTeamColor = '#E10600',
  playerBadgeLabel = 'SUA EQUIPE',
  emptyMessage = 'Nenhum dado disponível',
  className,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-xs',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          {/* Header Sticky Claro */}
          <thead className="sticky top-0 z-10 bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B]">
            <tr>
              {/* Espaço para a barra lateral de 3px */}
              <th className="w-[3px] p-0" />
              {columns.map((col) => {
                const isRight = col.align === 'right' || col.isNumeric
                const isCenter = col.align === 'center'
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={{ width: col.width }}
                    className={cn(
                      'px-3 py-2.5 font-semibold text-[11px] uppercase tracking-wider select-none text-[#64748B]',
                      isRight && 'text-right',
                      isCenter && 'text-center',
                      col.className,
                    )}
                  >
                    {col.header}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E2E8F0] text-[#0F172A]">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-8 text-center text-xs text-[#64748B]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                const isPlayer = playerRowPredicate ? playerRowPredicate(row) : false
                const rowKey = keyExtractor(row, index)

                return (
                  <tr
                    key={rowKey}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'group transition-colors duration-150',
                      onRowClick && 'cursor-pointer',
                      isPlayer ? 'bg-red-50/70 hover:bg-red-50' : 'hover:bg-[#F8FAFC]',
                    )}
                  >
                    {/* Barra lateral de 3px com a cor da equipe */}
                    <td className="w-[3px] p-0 relative">
                      <div
                        className="w-[3px] h-full absolute inset-0 transition-opacity"
                        style={{
                          backgroundColor: isPlayer ? playerRowTeamColor : 'transparent',
                        }}
                      />
                    </td>

                    {columns.map((col) => {
                      const isRight = col.align === 'right' || col.isNumeric
                      const isCenter = col.align === 'center'
                      const content = col.render ? col.render(row, index) : (row as any)[col.key]

                      return (
                        <td
                          key={col.key}
                          className={cn(
                            'px-3 py-2.5 text-xs whitespace-nowrap',
                            col.isNumeric && 'font-num tabular-nums text-right font-medium',
                            isRight && 'text-right',
                            isCenter && 'text-center',
                            isPlayer && 'font-medium text-[#0F172A]',
                            col.className,
                          )}
                        >
                          {content}
                          {isPlayer && col.key === columns[0]?.key && playerBadgeLabel && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-red-100 text-[#E10600] border border-red-200 align-middle">
                              {playerBadgeLabel}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DataTable
