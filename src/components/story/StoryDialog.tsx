import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import './story-experience.css';

/** Shared focus trap, scroll lock, Escape handling and focus restoration. */
export function StoryDialog({ title, description, onClose, children, className = '' }: {
  title: string; description?: string; onClose: () => void; children: React.ReactNode; className?: string;
}) {
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="story-surface-backdrop" style={className.includes('story-insights') ? { zIndex: 140 } : undefined} />
      <Dialog.Content className={`story-surface ${className}`} onInteractOutside={event => event.preventDefault()} aria-describedby={undefined}>
        <Dialog.Title className="sr-only">{title}</Dialog.Title>
        {description && <Dialog.Description className="sr-only">{description}</Dialog.Description>}
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
