"use client"

import { useEditor, EditorContent } from "@tiptap/react"
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
  EyeOff,
  Eye
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface RichTextEditorProps {
  value: string
  onChange: (value: string | null) => void
  placeholder?: string
  isEnabled?: boolean
  onToggleEnabled?: (enabled: boolean) => void
  label?: string
}

export function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Start typing...", 
  isEnabled = true,
  onToggleEnabled,
  label
}: RichTextEditorProps) {
  const [isShrunk, setIsShrunk] = useState(true)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  if (!editor) return null

  return (
    <div className={cn("flex flex-col border rounded-md p-2 transition-all", !isEnabled && "opacity-50 grayscale bg-muted/20")}>
      <div className="flex items-center justify-between gap-4 mb-1">
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
              onCheckedChange={(checked) => {
                onToggleEnabled(checked)
                if (!checked) onChange(null)
              }} 
              className="scale-75"
            />
          </div>
        )}
      </div>

      <div className={cn("transition-all overflow-hidden", isShrunk ? "max-h-12" : "max-h-[500px]")}>
        {isEnabled && !isShrunk && (
          <div className="flex items-center gap-1 border-b pb-1 mb-1 overflow-x-auto no-scrollbar">
            <Button
              variant="ghost"
              size="icon"
              className={cn("size-8", editor.isActive("bold") && "bg-muted")}
              onClick={() => editor.chain().focus().toggleBold().run()}
              type="button"
            >
              <Bold className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("size-8", editor.isActive("italic") && "bg-muted")}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              type="button"
            >
              <Italic className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("size-8", editor.isActive("underline") && "bg-muted")}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              type="button"
            >
              <UnderlineIcon className="size-4" />
            </Button>
            <div className="w-px h-4 bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className={cn("size-8", editor.isActive("bulletList") && "bg-muted")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              type="button"
            >
              <List className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("size-8", editor.isActive("orderedList") && "bg-muted")}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              type="button"
            >
              <ListOrdered className="size-4" />
            </Button>
          </div>
        )}
        
        <div className={cn(
          "min-h-[2rem] prose prose-sm max-w-none",
          isShrunk && "line-clamp-1 pointer-events-none opacity-60"
        )}>
          <EditorContent editor={editor} disabled={!isEnabled} />
        </div>
      </div>
    </div>
  )
}
