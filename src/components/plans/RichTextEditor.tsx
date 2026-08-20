// src/components/plans/RichTextEditor.tsx — éditeur riche léger (contentEditable)
import { useEffect, useRef } from "react";
import { Bold, Italic, List, ListOrdered, Heading2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

const cmd = (c: string) => document.execCommand(c, false);

export const RichTextEditor = ({
  value,
  onChange,
  placeholder,
  minHeight = 220,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const Btn = ({ icon: Icon, action, label }: { icon: any; action: string; label: string }) => (
    <button
      type="button"
      title={label}
      onMouseDown={(e) => {
        e.preventDefault();
        cmd(action);
        onChange(ref.current?.innerHTML ?? "");
      }}
      className="h-8 w-8 grid place-items-center rounded-md text-[#172030]/60 hover:bg-[#E8F0EC] hover:text-[#2A5141] transition-colors"
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <div className="rounded-xl border border-[#E8E4DC] bg-white overflow-hidden">
      <div className="flex items-center gap-0.5 border-b border-[#E8E4DC] bg-[#FAF9F6] px-2 py-1">
        <Btn icon={Bold} action="bold" label="Gras" />
        <Btn icon={Italic} action="italic" label="Italique" />
        <Btn icon={Heading2} action="formatBlock" label="Titre" />
        <Btn icon={List} action="insertUnorderedList" label="Liste à puces" />
        <Btn icon={ListOrdered} action="insertOrderedList" label="Liste numérotée" />
        <Btn icon={Undo2} action="undo" label="Annuler" />
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder || "Rédigez le contenu de cette section…"}
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        className={cn(
          "px-4 py-3 text-sm leading-relaxed text-[#172030] outline-none",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:my-2",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-[#172030]/30"
        )}
        style={{ minHeight, fontFamily: "Inter, sans-serif" }}
      />
    </div>
  );
};
