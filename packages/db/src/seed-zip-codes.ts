import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
import { createDb } from './client.js'

const CSV_PATH = resolve(import.meta.dirname, '../data/us-zip-codes.csv')

interface ZipRow {
  zip_code: string
  city: string
  state: string
  latitude: number
  longitude: number
}

function parseCsvLine(header: string[], line: string): Record<string, string> {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim())

  const record: Record<string, string> = {}
  for (let i = 0; i < header.length; i++) {
    record[header[i]] = values[i] ?? ''
  }
  return record
}

async function main() {
  const db = createDb()

  const existing = await db
    .selectFrom('zip_code_location')
    .select('zip_code')
    .limit(1)
    .executeTakeFirst()

  if (existing) {
    console.log('ZIP code data already seeded, skipping.')
    await db.destroy()
    return
  }

  console.log('Loading ZIP code data from CSV...')

  const rl = createInterface({
    input: createReadStream(CSV_PATH, 'utf-8'),
    crlfDelay: Number.POSITIVE_INFINITY,
  })

  let header: string[] = []
  const rows: ZipRow[] = []
  let lineNum = 0

  for await (const line of rl) {
    lineNum++
    if (lineNum === 1) {
      header = line.split(',').map((h) => h.replace(/"/g, '').trim())
      continue
    }

    const record = parseCsvLine(header, line)

    const zipCode = (record.code ?? '').replace(/"/g, '').padStart(5, '0')
    const lat = Number.parseFloat(record.lat ?? '')
    const lng = Number.parseFloat(record.lon ?? '')
    const city = record.city ?? ''
    const state = record.state ?? ''

    if (
      zipCode.length !== 5 ||
      Number.isNaN(lat) ||
      Number.isNaN(lng) ||
      !city ||
      !state
    ) {
      continue
    }

    rows.push({
      zip_code: zipCode,
      city,
      state,
      latitude: lat,
      longitude: lng,
    })
  }

  console.log(`Parsed ${rows.length} ZIP codes. Inserting...`)

  const BATCH_SIZE = 1000
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    await db.insertInto('zip_code_location').values(batch).execute()
  }

  console.log(`Seeded ${rows.length} ZIP codes.`)
  await db.destroy()
}

main().catch((err) => {
  console.error('Failed to seed ZIP codes:', err)
  process.exit(1)
})
