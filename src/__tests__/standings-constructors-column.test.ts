/**
 * standings-constructors-column.test.ts
 *
 * Teste para a MUDANÇA 2:
 * Na tabela de CLASSIFICAÇÃO DE CONSTRUTORES (/campeonato), a coluna PILOTOS deve ser removida.
 * - Header <th>PILOTOS</th> não deve existir no bloco de construtores.
 * - Colunas remanescentes no cabeçalho de construtores: POS, EQUIPE, VITÓRIAS, PÓDIOS, PONTOS.
 * - Tabela de pilotos (activeTab === 'drivers') mantém a coluna PILOTO intacta.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('MUDANÇA 2: Tabela de Construtores sem coluna PILOTOS', () => {
  const standingsFilePath = path.resolve(process.cwd(), 'src', 'pages', 'Standings.tsx')

  it('SC-01: Standings.tsx não possui mais <th>PILOTOS</th> na tabela de construtores', () => {
    const fileContent = fs.readFileSync(standingsFilePath, 'utf-8')

    // Procura a seção de construtores
    const constructorsHeaderIdx = fileContent.indexOf('CLASSIFICAÇÃO DE CONSTRUTORES')
    expect(constructorsHeaderIdx).toBeGreaterThan(0)

    const afterConstructorsHeader = fileContent.slice(constructorsHeaderIdx)

    // O header <th>PILOTOS</th> não existe na seção de construtores
    expect(afterConstructorsHeader).not.toContain('<th className="py-3 px-4">PILOTOS</th>')
    expect(afterConstructorsHeader).not.toContain('pilotsDisplay')

    // As outras colunas essenciais continuam presentes
    expect(afterConstructorsHeader).toContain('>POS</th>')
    expect(afterConstructorsHeader).toContain('>EQUIPE</th>')
    expect(afterConstructorsHeader).toContain('>VITÓRIAS</th>')
    expect(afterConstructorsHeader).toContain('>PÓDIOS</th>')
    expect(afterConstructorsHeader).toContain('>PONTOS</th>')
  })

  it('SC-02: A aba de pilotos (CLASSIFICAÇÃO DE PILOTOS) mantém intacta a coluna PILOTO', () => {
    const fileContent = fs.readFileSync(standingsFilePath, 'utf-8')
    const driversHeaderIdx = fileContent.indexOf('CLASSIFICAÇÃO DE PILOTOS')
    expect(driversHeaderIdx).toBeGreaterThan(0)

    const driversSection = fileContent.slice(
      driversHeaderIdx,
      fileContent.indexOf('CLASSIFICAÇÃO DE CONSTRUTORES'),
    )
    expect(driversSection).toContain('<th className="py-3 px-4">PILOTO</th>')
  })
})
