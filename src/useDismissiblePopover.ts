import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';

export function useDismissiblePopover(open: boolean, setOpen: Dispatch<SetStateAction<boolean>>) {
  const group = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeFromOutside(event: Event) {
      if (event.target instanceof Node && !group.current?.contains(event.target)) setOpen(false);
    }
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    }
    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('focusin', closeFromOutside);
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('focusin', closeFromOutside);
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [open, setOpen]);

  return { group, button };
}
