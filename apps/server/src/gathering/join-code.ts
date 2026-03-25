import { randomBytes } from 'node:crypto'

export function generateJoinCode(): string {
  return randomBytes(4).toString('hex').toUpperCase()
}
