import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CIRCLE_HEADLINE_MAX_LENGTH } from '@/lib/circlePostPreview';

interface CircleHeadlineFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  premium?: boolean;
}

export function CircleHeadlineField({ value, onChange, disabled, premium }: CircleHeadlineFieldProps) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <Label htmlFor={id}>Headline <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <span id={id + '-length'} className="text-xs tabular-nums text-muted-foreground">
          {value.length}/{CIRCLE_HEADLINE_MAX_LENGTH} characters
        </span>
      </div>
      <Input
        id={id}
        aria-describedby={id + '-length' + (premium ? ' ' + id + '-preview' : '')}
        value={value}
        onChange={event => onChange(event.target.value)}
        disabled={disabled}
        maxLength={CIRCLE_HEADLINE_MAX_LENGTH}
        dir="auto"
        placeholder="Give readers a reason to open your post"
        className="h-11 rounded-xl text-base font-semibold"
      />
      {premium && (
        <p id={id + '-preview'} className="text-xs text-muted-foreground">
          The headline and any cover image are visible before unlock. Post detail also shows a short excerpt.
        </p>
      )}
    </div>
  );
}
