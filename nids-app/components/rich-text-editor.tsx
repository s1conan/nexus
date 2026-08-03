"use client"

import {
  useEditor,
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  InputRule,
  Editor,
} from "@tiptap/react"
import { Node, mergeAttributes } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
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
  Tag,
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
  return html.replace(
    /<span[^>]*data-type="capsule"[^>]*data-variable="([^"]*)"[^>]*>.*?<\/span>/g,
    "{$1}"
  )
}

const fromStorage = (
  val: string,
  variables: { id: string; label: string }[],
  variableValues: Record<string, string> = {}
) => {
  if (!val) return val
  // Convert {VariableID} to capsule span with variable ID and current resolved display label
  return val.replace(/\{([^{}]+)\}/g, (match, variableId) => {
    // Try to find the current localized label for this ID, or fallback to the ID itself
    const varDef = variables.find((v) => v.id === variableId)
    const displayValue =
      variableValues[variableId] || varDef?.label || variableId
    return `<span data-type="capsule" data-variable="${variableId}" data-label="${displayValue}">${displayValue}</span>`
  })
}

// Custom Capsule Node Extension
const Capsule = Node.create({
  name: "capsule",
  group: "inline",
  inline: true,
  selectable: true,
  atom: true,
  marks: "bold italic underline",

  addAttributes() {
    return {
      variable: {
        // This is the STABLE ID (e.g., "quotation_number")
        default: "",
      },
      label: {
        // This is the CURRENT DISPLAY VALUE (e.g., "QTN-001")
        default: "",
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="capsule"]',
        getAttrs: (element) => ({
          variable: (element as HTMLElement).getAttribute("data-variable"),
          label:
            (element as HTMLElement).getAttribute("data-label") ||
            (element as HTMLElement).textContent,
        }),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "capsule",
        "data-variable": HTMLAttributes.variable,
        "data-label": HTMLAttributes.label,
      }),
      HTMLAttributes.label,
    ]
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
            tr.replaceWith(
              start,
              end,
              this.type.create({ variable: variableId, label: variableId })
            )
          }
        },
      }),
    ]
  },
})

const CapsuleComponent = ({
  node,
  selected,
  deleteNode,
  editor,
  getPos,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any
  selected: boolean
  deleteNode: () => void
  editor: Editor
  getPos: () => number | undefined
}) => {
  const displayValue = node.attrs.label || node.attrs.variable

  const pos = getPos()
  const marks =
    typeof pos === "number" ? editor.state.doc.nodeAt(pos)?.marks || [] : []

  const isBold =
    marks.some((m) => m.type.name === "bold") ||
    (editor.isActive("bold") && selected)
  const isItalic =
    marks.some((m) => m.type.name === "italic") ||
    (editor.isActive("italic") && selected)
  const isUnderline =
    marks.some((m) => m.type.name === "underline") ||
    (editor.isActive("underline") && selected)

  return (
    <NodeViewWrapper className="mx-0.5 inline-block align-middle">
      <Badge
        variant="secondary"
        className={cn(
          "h-6 cursor-default gap-1 border-primary/20 bg-primary/5 py-0 pr-1 text-primary transition-all select-none hover:bg-primary/10",
          selected && "ring-2 ring-primary ring-offset-1",
          isBold && "border-primary/40 font-bold text-foreground",
          isItalic && "italic",
          isUnderline && "underline underline-offset-2"
        )}
      >
        <span className="max-w-[200px] truncate">{displayValue}</span>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            deleteNode()
          }}
          className="cursor-pointer rounded-full p-0.5 transition-colors hover:bg-primary/20"
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
  variables?: { id: string; label: string }[]
  variableValues?: Record<string, string>
  readOnly?: boolean
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  isEnabled = true,
  onToggleEnabled,
  label,
  variables = [],
  variableValues = {},
  readOnly = false,
}: RichTextEditorProps) {
  const [isShrunk, setIsShrunk] = useState(true)

  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      StarterKit,
      Capsule,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: fromStorage(value, variables, variableValues),
    editable: isEnabled && !readOnly,
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
        if (node.type.name === "capsule") {
          const varId = node.attrs.variable
          const newVal =
            variableValues[varId] ||
            variables.find((v) => v.id === varId)?.label ||
            varId
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
        // Defer setContent to avoid flushSync inside React lifecycle
        requestAnimationFrame(() => {
          editor.commands.setContent(
            fromStorage(value, variables, variableValues)
          )
        })
      }
    }
  }, [value, editor, variables, variableValues])

  useEffect(() => {
    const shouldBeEditable = isEnabled && !readOnly
    if (editor && editor.isEditable !== shouldBeEditable) {
      editor.setEditable(shouldBeEditable)
    }
  }, [editor, isEnabled, readOnly])

  if (!editor) return null

  const insertCapsule = (varId: string) => {
    const newVal =
      variableValues[varId] ||
      variables.find((v) => v.id === varId)?.label ||
      varId
    editor
      .chain()
      .focus()
      .insertContent({
        type: "capsule",
        attrs: { variable: varId, label: newVal },
      })
      .insertContent(" ")
      .run()
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-md border p-2 transition-all",
        !isEnabled && "bg-muted/20 opacity-50 grayscale"
      )}
    >
      <div className="relative z-20 mb-1 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {label && (
            <Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {label}
            </Label>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-6 rounded-sm"
            onClick={() => setIsShrunk(!isShrunk)}
            title={isShrunk ? "Expand" : "Shrink"}
            type="button"
          >
            {isShrunk ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronUp className="size-3" />
            )}
          </Button>
        </div>

        {onToggleEnabled && (
          <div className="flex items-center gap-2">
            <Switch
              checked={isEnabled}
              onCheckedChange={onToggleEnabled}
              disabled={readOnly}
              className="scale-75"
            />
          </div>
        )}
      </div>

      <div
        className={cn(
          "relative z-0 overflow-hidden transition-all",
          isShrunk ? "max-h-12" : "max-h-fit"
        )}
      >
        {isEnabled && !isShrunk && !readOnly && (
          <>
            {variables && variables.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-1 rounded-sm border border-dashed border-muted-foreground/20 bg-muted/30 p-1.5">
                <span className="mr-1 flex items-center gap-1 text-[10px] font-bold tracking-tight text-muted-foreground uppercase">
                  <Type className="size-3" /> Data:
                </span>
                {variables.map((v) => (
                  <Button
                    key={v.id}
                    variant="outline"
                    size="sm"
                    className="h-6 gap-1 rounded-md bg-background px-2 text-[11px] font-medium transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                    onClick={() => insertCapsule(v.id)}
                    type="button"
                  >
                    <Plus className="size-2.5" />
                    {v.label || v.id}
                  </Button>
                ))}
              </div>
            )}

            <div className="mb-1 no-scrollbar flex items-center gap-1 overflow-x-auto border-b pb-1">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-8",
                  editor.isActive("bold") && "bg-muted text-primary"
                )}
                onClick={() => editor.chain().focus().toggleBold().run()}
                type="button"
                title="Bold"
              >
                <Bold className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-8",
                  editor.isActive("italic") && "bg-muted text-primary"
                )}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                type="button"
                title="Italic"
              >
                <Italic className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-8",
                  editor.isActive("underline") && "bg-muted text-primary"
                )}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                type="button"
                title="Underline"
              >
                <UnderlineIcon className="size-4" />
              </Button>
              <div className="mx-1 h-4 w-px bg-border" />
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-8",
                  editor.isActive("bulletList") && "bg-muted text-primary"
                )}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                type="button"
                title="Bullet List"
              >
                <List className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-8",
                  editor.isActive("orderedList") && "bg-muted text-primary"
                )}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                type="button"
                title="Ordered List"
              >
                <ListOrdered className="size-4" />
              </Button>
              <div className="mx-1 h-4 w-px bg-border" />
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:text-primary"
                onClick={() => {
                  const { from, to } = editor.state.selection
                  const text = editor.state.doc.textBetween(from, to)
                  if (text) {
                    editor
                      .chain()
                      .focus()
                      .deleteSelection()
                      .insertContent({
                        type: "capsule",
                        attrs: { variable: text, label: text },
                      })
                      .insertContent(" ")
                      .run()
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

        <div
          className={cn(
            "prose prose-sm min-h-[2rem] max-w-none focus:outline-none",
            isShrunk && "pointer-events-none line-clamp-1 opacity-60"
          )}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
