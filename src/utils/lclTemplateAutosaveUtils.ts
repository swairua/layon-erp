interface InlineEdit {
  qty?: number;
  rate?: number;
}

interface AutosaveDraft {
  inlineEdits: { [itemId: string]: InlineEdit };
  lastSavedAt: string;
}

const ls = {
  getItem: <T,>(key: string): T | null => {
    try {
      if (typeof window === 'undefined') return null;
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : null;
    } catch {
      return null;
    }
  },
  setItem: <T,>(key: string, value: T): void => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota errors
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

export function getLclTemplateAutosaveKey(structureId: string): string {
  return `lcl_template_draft_${structureId}`;
}

export function saveDraftToLocalStorage(
  structureId: string,
  inlineEdits: { [itemId: string]: InlineEdit }
): void {
  const key = getLclTemplateAutosaveKey(structureId);
  const draft: AutosaveDraft = {
    inlineEdits,
    lastSavedAt: new Date().toISOString(),
  };
  ls.setItem(key, draft);
}

export function loadDraftFromLocalStorage(
  structureId: string
): { [itemId: string]: InlineEdit } | null {
  const key = getLclTemplateAutosaveKey(structureId);
  const draft = ls.getItem<AutosaveDraft>(key);
  return draft ? draft.inlineEdits : null;
}

export function clearDraftFromLocalStorage(structureId: string): void {
  const key = getLclTemplateAutosaveKey(structureId);
  ls.removeItem(key);
}

export function getDraftLastSavedTime(structureId: string): string | null {
  const key = getLclTemplateAutosaveKey(structureId);
  const draft = ls.getItem<AutosaveDraft>(key);
  return draft ? draft.lastSavedAt : null;
}
