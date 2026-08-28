"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface DropdownItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
}

interface DropdownMenuProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
  className?: string;
}

export function DropdownMenu({ trigger, items, align = "right", className = "" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <div onClick={() => setOpen(!open)} className="cursor-pointer">
        {trigger}
      </div>
      {open && (
        <div className={`absolute z-50 mt-1 min-w-[160px] bg-card border rounded-xl shadow-xl py-1 animate-in fade-in slide-in-from-top-2 duration-150 ${
          align === "right" ? "right-0" : "left-0"
        }`}>
          {items.map((item, i) =>
            item.divider ? (
              <div key={i} className="my-1 border-t" />
            ) : (
              <button
                key={i}
                onClick={() => { item.onClick(); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors ${
                  item.danger ? "text-red-500 hover:bg-red-500/10" : ""
                }`}
              >
                {item.icon && <span className="w-4 h-4 shrink-0">{item.icon}</span>}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  count?: number;
  badge?: string;
  children: ReactNode;
  className?: string;
}

export function Collapsible({ title, defaultOpen = false, count, badge, children, className = "" }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`bg-card border rounded-xl overflow-hidden ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{title}</span>
          {count !== undefined && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground font-medium">
              {count}
            </span>
          )}
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t">{children}</div>
      )}
    </div>
  );
}

interface InlineDropdownProps {
  label: string;
  children: ReactNode;
}

export function InlineDropdown({ label, children }: InlineDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {label} <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-40 top-full left-0 mt-1 bg-card border rounded-xl shadow-xl py-1 min-w-[140px] animate-in fade-in duration-100">
          {children}
        </div>
      )}
    </div>
  );
}
