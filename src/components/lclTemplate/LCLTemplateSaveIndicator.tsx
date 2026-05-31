import { useEffect } from 'react';

interface LCLTemplateSaveIndicatorProps {
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSavedTime: string | null;
}

export function LCLTemplateSaveIndicator({
  isSaving,
  hasUnsavedChanges,
  lastSavedTime,
}: LCLTemplateSaveIndicatorProps) {
  useEffect(() => {
    console.log(`[UI] SaveIndicator render - isSaving: ${isSaving}, hasUnsavedChanges: ${hasUnsavedChanges}, lastSavedTime: ${lastSavedTime}`);
  }, [isSaving, hasUnsavedChanges, lastSavedTime]);

  if (isSaving) {
    console.log(`[UI] Rendering "Saving draft..." status`);
    return <span className="text-xs text-amber-600">Saving draft...</span>;
  }

  if (hasUnsavedChanges) {
    console.log(`[UI] Rendering "Unsaved changes" status`);
    return <span className="text-xs text-orange-600">Unsaved changes</span>;
  }

  if (lastSavedTime) {
    const time = new Date(lastSavedTime).toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
    });
    console.log(`[UI] Rendering "Saved at ${time}" status`);
    return <span className="text-xs text-green-600">Saved at {time}</span>;
  }

  console.log(`[UI] Rendering no status`);
  return null;
}
