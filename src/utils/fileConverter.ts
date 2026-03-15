import mammoth from 'mammoth'
import TurndownService from 'turndown'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfjsWorker

const SUPPORTED_EXTENSIONS = ['.docx', '.pdf']

export interface FileConversionResult {
  title: string
  content: string
}

function getFileExtension(name: string): string {
  const dotIndex = name.lastIndexOf('.')
  return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : ''
}

function getFileTitle(name: string): string {
  const dotIndex = name.lastIndexOf('.')
  return dotIndex >= 0 ? name.slice(0, dotIndex) : name
}

async function convertDocxToMarkdown(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer })
  const turndown = new TurndownService({ headingStyle: 'atx' })
  return turndown.turndown(result.value)
}

async function convertPdfToMarkdown(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise
  const pages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .filter((item): item is typeof item & { str: string } => 'str' in item)
      .map((item) => item.str)
      .join(' ')
    if (pageText.trim()) {
      pages.push(pageText.trim())
    }
  }

  return pages.join('\n\n')
}

export function isSupportedFile(file: File): boolean {
  const ext = getFileExtension(file.name)
  return SUPPORTED_EXTENSIONS.includes(ext)
}

export async function convertFileToMarkdown(file: File): Promise<FileConversionResult> {
  const ext = getFileExtension(file.name)
  const title = getFileTitle(file.name)

  let content: string
  switch (ext) {
    case '.docx':
      content = await convertDocxToMarkdown(file)
      break
    case '.pdf':
      content = await convertPdfToMarkdown(file)
      break
    default:
      throw new Error(`Unsupported file type: ${ext}. Supported types: ${SUPPORTED_EXTENSIONS.join(', ')}`)
  }

  return { title, content }
}
