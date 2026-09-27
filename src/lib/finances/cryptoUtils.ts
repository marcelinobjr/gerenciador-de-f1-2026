import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export interface MaterializedJsonFileInfo {
  fileName: string
  sha256: string
  byteLength: number
  declaredDeliveryVersion: string
  workScope: string
}

export function computeSha256OfFile(filePath: string): { sha256: string; byteLength: number } {
  const content = fs.readFileSync(filePath)
  const hash = crypto.createHash('sha256').update(content).digest('hex')
  return { sha256: hash, byteLength: content.byteLength }
}

export function computeSha256OfBuffer(buffer: Buffer | Uint8Array | string): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}
