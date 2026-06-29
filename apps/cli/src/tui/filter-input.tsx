/**
 * Filter input. Press `/` in the global keyboard handler to focus this
 * field; Esc clears and blurs.
 *
 * The input is a controlled `<input>`. `onInput` fires on every keystroke.
 */

import { useEffect, useRef } from "react";
import type { InputRenderable } from "@opentui/core";

interface FilterInputProps {
  value: string;
  onChange: (next: string) => void;
  focused: boolean;
  onSubmit?: () => void;
  onEscape?: () => void;
  placeholder?: string;
}

export function FilterInput({
  value,
  onChange,
  focused,
  onSubmit,
  onEscape,
  placeholder = "filter…",
}: FilterInputProps): React.ReactNode {
  const ref = useRef<InputRenderable | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (focused) ref.current.focus();
    else ref.current.blur();
  }, [focused]);

  return (
    <input
      ref={ref}
      focused={focused}
      value={value}
      placeholder={placeholder}
      onInput={(v: string) => onChange(v)}
      onSubmit={onSubmit ? () => onSubmit() : undefined}
      onKeyDown={
        onEscape
          ? (e) => {
              if (e.name === "escape") onEscape();
            }
          : undefined
      }
    />
  );
}