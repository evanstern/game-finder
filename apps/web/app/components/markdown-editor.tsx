import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap } from '@codemirror/commands'
import { Button } from '@game-finder/ui/components/button'
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
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor')

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
    if (activeTab === 'editor') {
      createEditor()
      return () => viewRef.current?.destroy()
    }
  }, [activeTab, createEditor])

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
      <div className="overflow-hidden rounded-md border border-border bg-card/40 backdrop-blur-sm">
        <div className="flex border-b border-border bg-muted/30">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab('editor')}
            className={`rounded-none text-xs font-semibold tracking-[0.15em] uppercase ${
              activeTab === 'editor'
                ? 'text-primary border-b-2 border-primary -mb-px'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Editor
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab('preview')}
            className={`rounded-none text-xs font-semibold tracking-[0.15em] uppercase ${
              activeTab === 'preview'
                ? 'text-primary border-b-2 border-primary -mb-px'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Preview
          </Button>
        </div>
        {activeTab === 'editor' ? (
          <div ref={editorRef} className="min-h-[300px] bg-background/60" />
        ) : (
          <div className="min-h-[300px] overflow-auto bg-card/60 p-4 prose-themed">
            {value ? (
              <Markdown>{value}</Markdown>
            ) : (
              <p className="text-sm text-muted-foreground italic">Preview will appear here...</p>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <label className="cursor-pointer rounded border border-border bg-muted/20 px-3 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground hover:border-primary/30">
          Upload .md / .txt
          <input
            type="file"
            accept=".md,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setVimEnabled(!vimEnabled)}
          className={`text-[11px] font-medium tracking-wide uppercase ${vimEnabled ? 'border-primary/30 text-primary' : 'text-muted-foreground hover:border-primary/30'}`}
        >
          vim mode: {vimEnabled ? 'on' : 'off'}
        </Button>
      </div>
    </div>
  )
}
