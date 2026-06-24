"use client"

import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer, InputRule, Editor } from "@tiptap/react"
import { Node, mergeAttributes } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Underline from "@tiptap/extension-underline"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  ChevronUp,
  ChevronDown,
  X,
  Plus,
  Type,
  Tag
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

// Helper functions for storage transformation
const toStorage = (html: string) => {
  if (!html) return html
  // Convert visual capsules back to {VariableID} format for database
  // Extracts the stable variable ID from data-variable attribute
  return html.replace(/<span[^>]*data-type="capsule"[^>]*data-variable="([^"]*)"[^>]*>.*?<\/span>/g, '{$1}')
}

const fromStorage = (val: string, variables: { id: string, label: string }[], variableValues: Record<string, string> = {}) => {
  if (!val) return val
  // Convert {VariableID} to capsule span with variable ID and current resolved display label
  return val.replace(/\{([^{}]+)\}/g, (match, variableId) => {
    // Try to find the current localized label for this ID, or fallback to the ID itself
    const varDef = variables.find(v => v.id === variableId)
    const displayValue = variableValues[variableId] || varDef?.label || variableId
    return `<span data-type="capsule" data-variable="${variableId}" data-label="${displayValue}">${displayValue}</span>`
  })
}

// Custom Capsule Node Extension
const Capsule = Node.create({
  name: 'capsule',
  group: 'inline',
  inline: true,
  selectable: true,
  atom: true,
  marks: 'bold italic underline',

  addAttributes() {
    return {
      variable: { // This is the STABLE ID (e.g., "quotation_number")
        default: '',
      },
      label: { // This is the CURRENT DISPLAY VALUE (e.g., "QTN-001")
        default: '',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="capsule"]',
        getAttrs: element => ({
          variable: (element as HTMLElement).getAttribute('data-variable'),
          label: (element as HTMLElement).getAttribute('data-label') || (element as HTMLElement).textContent,
        }),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-type': 'capsule',
      'data-variable': HTMLAttributes.variable,
      'data-label': HTMLAttributes.label
    }), HTMLAttributes.label]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CapsuleComponent)
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\{([^}]+)\}\s$/,
        handler: ({ state, range, match }) => {
          const { tr } = state
          const start = range.from
          const end = range.to
          const variableId = match[1]

          if (variableId) {
            tr.replaceWith(start, end, this.type.create({ variable: variableId, label: variableId }))
          }
        },
      }),
    ]
  },
})

const CapsuleComponent = ({ node, selected, deleteNode, editor, getPos }: { node: any, selected: boolean, deleteNode: () => void, editor: Editor, getPos: () => number | undefined }) => {
  const displayValue = node.attrs.label || node.attrs.variable

  const pos = getPos()
  const marks = typeof pos === 'number' ? editor.state.doc.nodeAt(pos)?.marks || [] : []

  const isBold = marks.some(m => m.type.name === 'bold') || (editor.isActive('bold') && selected)
  const isItalic = marks.some(m => m.type.name === 'italic') || (editor.isActive('italic') && selected)
  const isUnderline = marks.some(m => m.type.name === 'underline') || (editor.isActive('underline') && selected)

  return (
    <NodeViewWrapper className="inline-block align-middle mx-0.5">
      <Badge
        variant="secondary"
        className={cn(
          "gap-1 pr-1 py-0 h-6 cursor-default transition-all border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 select-none",
          selected && "ring-2 ring-primary ring-offset-1",
          isBold && "font-bold border-primary/40 text-foreground",
          isItalic && "italic",
          isUnderline && "underline underline-offset-2"
        )}
      >
        <span className="truncate max-w-[200px]">{displayValue}</span>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            deleteNode()
          }}
          className="hover:bg-primary/20 rounded-full p-0.5 transition-colors cursor-pointer"
          title="Remove"
        >
          <X className="size-3" />
        </button>
      </Badge>
    </NodeViewWrapper>
  )
}

interface RichTextEditorProps {
  value: string
  onChange: (value: string | null) => void
  placeholder?: string
  isEnabled?: boolean
  onToggleEnabled?: (enabled: boolean) => void
  label?: string
  variables?: { id: string, label: string }[]
  variableValues?: Record<string, string>
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  isEnabled = true,
  onToggleEnabled,
  label,
  variables = [],
  variableValues = {}
}: RichTextEditorProps) {
  const [isShrunk, setIsShrunk] = useState(true)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Capsule,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: fromStorage(value, variables, variableValues),
    editable: isEnabled,
    onUpdate: ({ editor }) => {
      onChange(toStorage(editor.getHTML()))
    },
  })

  // Synchronize internal capsule labels when external variableValues change
  useEffect(() => {
    if (editor && variableValues) {
      const { tr } = editor.state
      let changed = false
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'capsule') {
          const varId = node.attrs.variable
          const newVal = variableValues[varId] || variables.find(v => v.id === varId)?.label || varId
          if (node.attrs.label !== newVal) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, label: newVal })
            changed = true
          }
        }
      })
      if (changed) {
        editor.view.dispatch(tr)
      }
    }
  }, [variableValues, variables, editor])

  // Handle external content updates
  useEffect(() => {
    if (editor) {
      const currentStorage = toStorage(editor.getHTML())
      if (value !== currentStorage) {
        editor.commands.setContent(fromStorage(value, variables, variableValues))
      }
    }
  }, [value, editor])

  useEffect(() => {
    if (editor && editor.isEditable !== isEnabled) {
      editor.setEditable(isEnabled)
    }
  }, [editor, isEnabled])

  if (!editor) return null

  const insertCapsule = (varId: string) => {
    const newVal = variableValues[varId] || variables.find(v => v.id === varId)?.label || varId
    editor.chain().focus().insertContent({
      type: 'capsule',
      attrs: { variable: varId, label: newVal }
    }).insertContent(' ').run()
  }

  return (
    <div className={cn("flex flex-col border rounded-md p-2 transition-all", !isEnabled && "opacity-50 grayscale bg-muted/20")}>
      <div className="relative z-20 flex items-center justify-between gap-4 mb-1">
        <div className="flex items-center gap-2">
          {label && <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>}
          <Button
            variant="ghost"
            size="icon"
            className="size-6 rounded-sm"
            onClick={() => setIsShrunk(!isShrunk)}
            title={isShrunk ? "Expand" : "Shrink"}
            type="button"
          >
            {isShrunk ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
          </Button>
        </div>

        {onToggleEnabled && (
          <div className="flex items-center gap-2">
            <Switch
              checked={isEnabled}
              onCheckedChange={onToggleEnabled}
              className="scale-75"
            />
          </div>
        )}
      </div>

      <div className={cn("relative z-0 transition-all overflow-hidden", isShrunk ? "max-h-12" : "max-h-fit")}>
        {isEnabled && !isShrunk && (
          <>
            {variables && variables.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 mb-2 p-1.5 bg-muted/30 rounded-sm border border-dashed border-muted-foreground/20">
                <span className="text-[10px] font-bold text-muted-foreground mr-1 uppercase tracking-tight flex items-center gap-1">
                  <Type className="size-3" /> Data:
                </span>
                {variables.map((v) => (
                  <Button
                    key={v.id}
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[11px] rounded-md gap-1 bg-background hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all font-medium"
                    onClick={() => insertCapsule(v.id)}
                    type="button"
                  >
                    <Plus className="size-2.5" />
                    {v.label || v.id}
                  </Button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1 border-b pb-1 mb-1 overflow-x-auto no-scrollbar">
              <Button
                variant="ghost"
                size="icon"
                className={cn("size-8", editor.isActive("bold") && "bg-muted text-primary")}
                onClick={() => editor.chain().focus().toggleBold().run()}
                type="button"
                title="Bold"
              >
                <Bold className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("size-8", editor.isActive("italic") && "bg-muted text-primary")}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                type="button"
                title="Italic"
              >
                <Italic className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("size-8", editor.isActive("underline") && "bg-muted text-primary")}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                type="button"
                title="Underline"
              >
                <UnderlineIcon className="size-4" />
              </Button>
              <div className="w-px h-4 bg-border mx-1" />
              <Button
                variant="ghost"
                size="icon"
                className={cn("size-8", editor.isActive("bulletList") && "bg-muted text-primary")}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                type="button"
                title="Bullet List"
              >
                <List className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("size-8", editor.isActive("orderedList") && "bg-muted text-primary")}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                type="button"
                title="Ordered List"
              >
                <ListOrdered className="size-4" />
              </Button>
              <div className="w-px h-4 bg-border mx-1" />
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:text-primary"
                onClick={() => {
                  const { from, to } = editor.state.selection
                  const text = editor.state.doc.textBetween(from, to)
                  if (text) {
                    editor.chain().focus().deleteSelection().insertContent({
                      type: 'capsule',
                      attrs: { variable: text, label: text }
                    }).insertContent(' ').run()
                  }
                }}
                type="button"
                title="Convert selection to Capsule"
              >
                <Tag className="size-4" />
              </Button>
            </div>
          </>
        )}

        <div className={cn(
          "min-h-[2rem] prose prose-sm max-w-none focus:outline-none",
          isShrunk && "line-clamp-1 pointer-events-none opacity-60"
        )}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
