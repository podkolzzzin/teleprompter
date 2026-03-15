import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isSupportedFile, convertFileToMarkdown } from './fileConverter'

// Mock mammoth
vi.mock('mammoth', () => ({
  default: {
    convertToHtml: vi.fn(() =>
      Promise.resolve({ value: '<h1>Title</h1><p>Hello world</p>' }),
    ),
  },
}))

// Mock turndown
vi.mock('turndown', () => ({
  default: vi.fn().mockImplementation(() => ({
    turndown: vi.fn((html: string) => {
      // Simple mock conversion
      return html.replace(/<h1>/g, '# ').replace(/<\/h1>/g, '\n').replace(/<p>/g, '').replace(/<\/p>/g, '\n').trim()
    }),
  })),
}))

// Mock pdfjs-dist
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 2,
      getPage: vi.fn((pageNum: number) =>
        Promise.resolve({
          getTextContent: vi.fn(() =>
            Promise.resolve({
              items: [
                { str: `Page ${pageNum}` },
                { str: ` content here` },
              ],
            }),
          ),
        }),
      ),
    }),
  })),
  GlobalWorkerOptions: { workerSrc: '' },
}))

// Mock the worker URL import
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: '',
}))

function createMockFile(name: string, content = ''): File {
  return new File([content], name, { type: 'application/octet-stream' })
}

describe('isSupportedFile', () => {
  it('returns true for .docx files', () => {
    expect(isSupportedFile(createMockFile('doc.docx'))).toBe(true)
  })

  it('returns true for .pdf files', () => {
    expect(isSupportedFile(createMockFile('doc.pdf'))).toBe(true)
  })

  it('returns false for unsupported extensions', () => {
    expect(isSupportedFile(createMockFile('doc.txt'))).toBe(false)
    expect(isSupportedFile(createMockFile('doc.doc'))).toBe(false)
    expect(isSupportedFile(createMockFile('image.png'))).toBe(false)
  })

  it('is case-insensitive for extensions', () => {
    expect(isSupportedFile(createMockFile('doc.DOCX'))).toBe(true)
    expect(isSupportedFile(createMockFile('doc.PDF'))).toBe(true)
  })

  it('returns false for files without extension', () => {
    expect(isSupportedFile(createMockFile('noextension'))).toBe(false)
  })
})

describe('convertFileToMarkdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('converts a .docx file to markdown with correct title', async () => {
    const file = createMockFile('My Document.docx')
    const result = await convertFileToMarkdown(file)

    expect(result.title).toBe('My Document')
    expect(result.content).toContain('# Title')
    expect(result.content).toContain('Hello world')
  })

  it('converts a .pdf file to markdown with correct title', async () => {
    const file = createMockFile('Presentation.pdf')
    const result = await convertFileToMarkdown(file)

    expect(result.title).toBe('Presentation')
    expect(result.content).toContain('Page 1')
    expect(result.content).toContain('Page 2')
  })

  it('throws for unsupported file types', async () => {
    const file = createMockFile('file.txt')
    await expect(convertFileToMarkdown(file)).rejects.toThrow('Unsupported file type')
  })

  it('extracts title from filename without extension', async () => {
    const file = createMockFile('Complex.Name.With.Dots.docx')
    const result = await convertFileToMarkdown(file)
    expect(result.title).toBe('Complex.Name.With.Dots')
  })
})
