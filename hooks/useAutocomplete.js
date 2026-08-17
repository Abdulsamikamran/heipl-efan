import { useState, useCallback } from 'react';
import { getAutocompleteSuggestions } from '../lib/db';

export default function useAutocomplete(fieldName) {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  const getSuggestions = useCallback(
    async (query) => {
      if (!query || query.length < 1) {
        const results = await getAutocompleteSuggestions(fieldName, '');
        setSuggestions(results);
        return;
      }

      const results = await getAutocompleteSuggestions(fieldName, query);
      setSuggestions(results);
    },
    [fieldName]
  );

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setIsOpen(false);
  }, []);

  const openSuggestions = useCallback(() => {
    setIsOpen(true);
  }, []);

  return {
    suggestions,
    isOpen,
    getSuggestions,
    clearSuggestions,
    openSuggestions,
  };
}
