import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap } from '@codemirror/commands'
import { useCallback, useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [vimEnabled, setVimEnabled] = useState(false)
  const [vimModule, setVimModule] = useState<typeof import('@replit/codemirror-vim') | null>(null)

  useEffect(() => {
    import('@replit/codemirror-vim').then(setVimModule)
  }, [])

  const createEditor = useCallback(() => {
    if (!editorRef.current) return

    if (viewRef.current) {
      viewRef.current.destroy()
    }

    const extensions = [
      lineNumbers(),
      markdown(),
      oneDark,
      keymap.of(defaultKeymap),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString())
        }
      }),
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto' },
      }),
    ]

    if (vimEnabled && vimModule) {
      extensions.unshift(vimModule.vim())
    }

    if (placeholder) {
      extensions.push(EditorView.contentAttributes.of({ 'aria-placeholder': placeholder }))
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    })

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    })
  }, [vimEnabled, vimModule, placeholder])

  useEffect(() => {
    createEditor()
    return () => viewRef.current?.destroy()
  }, [createEditor])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const currentDoc = view.state.doc.toString()
    if (currentDoc !== value) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      })
    }
  }, [value])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      onChange(text)
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-0 overflow-hidden rounded-md border border-border">
        <div ref={editorRef} className="min-h-[300px] bg-background" />
        <div className="min-h-[300px] overflow-auto border-l border-border bg-card p-4 prose prose-invert prose-sm max-w-none">
          {value ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="text-muted-foreground">Preview will appear here...</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="cursor-pointer rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          Upload .md / .txt
          <input
            type="file"
            accept=".md,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
        <button
          type="button"
          onClick={() => setVimEnabled(!vimEnabled)}
          className="rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          vim mode: {vimEnabled ? 'on' : 'off'}
        </button>
      </div>
    </div>
  )
}
