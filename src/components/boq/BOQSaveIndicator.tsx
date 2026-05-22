import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface BOQSaveIndicatorProps {
  isSaving: boolean;
  lastSavedTime: string | null;
  hasUnsavedChanges: boolean;
}

export function BOQSaveIndicator({
  isSaving,
  lastSavedTime,
  hasUnsavedChanges,
}: BOQSaveIndicatorProps) {
  const [displayTime, setDisplayTime] = useState<string | null>(null);

  useEffect(() => {
    if (lastSavedTime) {
      const date = new Date(lastSavedTime);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      setDisplayTime(`${hours}:${minutes}`);
    }
  }, [lastSavedTime]);

  if (isSaving) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Saving...</span>
      </div>
    );
  }

  if (hasUnsavedChanges) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-600">
        <AlertCircle className="h-4 w-4" />
        <span>Unsaved changes</span>
      </div>
    );
  }

  if (displayTime) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <CheckCircle2 className="h-4 w-4" />
        <span>Saved at {displayTime}</span>
      </div>
    );
  }

  return null;
}
