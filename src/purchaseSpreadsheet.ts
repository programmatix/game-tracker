import { createSignal } from 'solid-js'

const PURCHASE_SPREADSHEET_ID = '13JZBDosdmzhTYSbvok9N8qJqdbiVzoUoID2uxF_k53g'
const PURCHASE_SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${PURCHASE_SPREADSHEET_ID}/export?format=csv`

type PurchaseSpreadsheetState = {
  cells: Record<string, string>
}

const [purchaseSpreadsheetState, setPurchaseSpreadsheetState] = createSignal<PurchaseSpreadsheetState>({
  cells: {},
})

let purchaseSpreadsheetPromise: Promise<void> | null = null

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let index = 0
  let inQuotes = false

  while (index < text.length) {
    const char = text[index]

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"'
          index += 2
          continue
        }
        inQuotes = false
        index += 1
        continue
      }

      cell += char
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = true
      index += 1
      continue
    }

    if (char === ',') {
      row.push(cell)
      cell = ''
      index += 1
      continue
    }

    if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      index += 1
      continue
    }

    if (char === '\r') {
      index += 1
      continue
    }

    cell += char
    index += 1
  }

  if (cell || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}

function toColumnLabel(index: number): string {
  let value = index + 1
  let label = ''

  while (value > 0) {
    const remainder = (value - 1) % 26
    label = String.fromCharCode(65 + remainder) + label
    value = Math.floor((value - 1) / 26)
  }

  return label
}

function buildSpreadsheetCells(rows: string[][]): Record<string, string> {
  const cells: Record<string, string> = {}

  rows.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      cells[`${toColumnLabel(columnIndex)}${rowIndex + 1}`] = value
    })
  })

  return cells
}

export function loadPurchaseSpreadsheet(): Promise<void> {
  if (purchaseSpreadsheetPromise) return purchaseSpreadsheetPromise

  purchaseSpreadsheetPromise = fetch(PURCHASE_SPREADSHEET_URL)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(
          `Failed to fetch purchase spreadsheet (${response.status} ${response.statusText}).`,
        )
      }
      const csv = await response.text()
      const rows = parseCsv(csv)
      setPurchaseSpreadsheetState({ cells: buildSpreadsheetCells(rows) })
    })
    .catch((error) => {
      purchaseSpreadsheetPromise = null
      throw error
    })

  return purchaseSpreadsheetPromise
}

export function trackPurchaseSpreadsheetCells(): Readonly<Record<string, string>> {
  return purchaseSpreadsheetState().cells
}

export function getPurchaseSpreadsheetCell(reference: string): string | undefined {
  const cells = trackPurchaseSpreadsheetCells()
  return cells[reference.toUpperCase()]
}

