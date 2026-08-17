import { useRef, useState, useEffect, useCallback } from 'react';
import { addRecord, updateRecord } from '../lib/db';

export default function useFormAutosave(formData, recordId, setRecordId) {
  const intervalRef = useRef(null);
  const isDirtyRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  const markDirty = useCallback(() => {
    isDirtyRef.current = true;
  }, []);

  const saveDraft = useCallback(async () => {
    if (!formData) return false;

    setIsSaving(true);

    try {
      const now = new Date().toISOString();
      const payload = {
        ...formData,
        syncStatus: 'draft',
        updatedAt: now,
      };

      if (!recordId) {
        const newId = await addRecord({
          ...payload,
          createdAt: now,
        });

        if (newId) {
          setRecordId(newId);
          isDirtyRef.current = false;
          return true;
        }

        return false;
      }

      const updated = await updateRecord(recordId, payload);
      if (updated) {
        isDirtyRef.current = false;
        return true;
      }

      return false;
    } catch (error) {
      console.error('saveDraft error:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [formData, recordId, setRecordId]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (isDirtyRef.current) {
        saveDraft();
      }
    }, 30000);

    const handleBlur = () => {
      if (isDirtyRef.current) {
        saveDraft();
      }
    };

    window.addEventListener('blur', handleBlur);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('blur', handleBlur);
    };
  }, [saveDraft]);

  return { saveDraft, markDirty, isSaving };
}
