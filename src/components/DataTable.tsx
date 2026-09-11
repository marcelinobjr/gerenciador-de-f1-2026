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
        'w-full overflow-hidden rounded-xl border border-[#1F2733] bg-[#11161F]',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          {/* Header Sticky */}
          <thead className="sticky top-0 z-10 bg-[#0E131B] border-b border-[#1F2733] text-[#8B95A7]">
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
                      'px-3 py-2.5 font-semibold text-[11px] uppercase tracking-wider select-none text-[#8B95A7]',
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

          <tbody className="divide-y divide-[#1F2733]/60 text-[#F5F7FA]">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-8 text-center text-xs text-[#8B95A7]"
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
                      isPlayer ? 'bg-[#E10600]/10 hover:bg-[#E10600]/15' : 'hover:bg-[#161D29]',
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
                            isPlayer && 'font-medium',
                            col.className,
                          )}
                        >
                          {content}
                          {isPlayer && col.key === columns[0]?.key && playerBadgeLabel && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-[#E10600]/20 text-red-300 border border-[#E10600]/40 align-middle">
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
