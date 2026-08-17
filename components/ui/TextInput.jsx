import { useCallback } from 'react';
import { titleCaseValue } from '../../lib/utils';

function FieldLabel({ name, label, required }) {
  if (!label) return null;

  return (
    <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700">
      {label}
      {required && (
        <span className="ml-0.5 text-primary-600" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

function FieldError({ error }) {
  if (!error) return null;
  return <p className="mt-1 text-xs text-red-600">{error}</p>;
}

function FieldHelp({ helpText }) {
  if (!helpText) return null;
  return <p className="mt-1 text-xs italic text-gray-500">{helpText}</p>;
}

function formatCNICInput(raw) {
  const digits = String(raw).replace(/\D/g, '').slice(0, 13);

  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

function formatPhoneInput(raw) {
  let digits = String(raw).replace(/\D/g, '');

  if (digits.startsWith('3') && !digits.startsWith('0')) {
    digits = `0${digits}`;
  }

  return digits.slice(0, 11);
}

function highlightMatch(suggestion, query) {
  if (!query) return suggestion;

  const lowerSuggestion = suggestion.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerSuggestion.indexOf(lowerQuery);

  if (index === -1) return suggestion;

  const before = suggestion.slice(0, index);
  const match = suggestion.slice(index, index + query.length);
  const after = suggestion.slice(index + query.length);

  return (
    <>
      {before}
      <strong>{match}</strong>
      {after}
    </>
  );
}

export default function TextInput({
  name,
  label,
  value = '',
  onChange,
  required = false,
  placeholder = '',
  disabled = false,
  helpText = '',
  error = '',
  autoFormat = 'none',
  autocomplete = false,
  suggestions = [],
  onSuggestionSelect,
  onCloseSuggestions,
  showSuggestions = false,
  type = 'text',
  onFocus,
  onBlur,
  inputRef,
}) {
  const inputType =
    autoFormat === 'cnic' ? 'text' : autoFormat === 'phone' ? 'tel' : type;

  const inputMode =
    autoFormat === 'cnic' || autoFormat === 'phone' ? 'numeric' : undefined;

  const handleChange = useCallback(
    (event) => {
      const raw = event.target.value;
      let formatted = raw;

      if (autoFormat === 'cnic') {
        formatted = formatCNICInput(raw);
      } else if (autoFormat === 'phone') {
        formatted = formatPhoneInput(raw);
      }

      onChange(name, formatted);
    },
    [autoFormat, name, onChange]
  );

  const handleBlur = useCallback(
    (event) => {
      if (autoFormat === 'titleCase' && value) {
        onChange(name, titleCaseValue(value));
      }
      onBlur?.(name, event);
    },
    [autoFormat, name, onBlur, onChange, value]
  );

  const handleFocus = useCallback(
    (event) => {
      onFocus?.(name, event);
    },
    [name, onFocus]
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape' && autocomplete && showSuggestions) {
        event.preventDefault();
        onCloseSuggestions?.();
      }
    },
    [autocomplete, onCloseSuggestions, showSuggestions]
  );

  const inputClassName = [
    'w-full rounded-lg border bg-white px-3 py-3 text-base',
    'min-h-[44px] focus:outline-none focus:ring-2',
    disabled ? 'cursor-not-allowed bg-gray-100' : '',
    error
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
      : 'border-gray-300 focus:border-primary-600 focus:ring-primary-600',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="relative w-full">
      <FieldLabel name={name} label={label} required={required} />
      <input
        ref={inputRef}
        id={name}
        name={name}
        type={inputType}
        inputMode={inputMode}
        value={value || ''}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autocomplete ? 'off' : undefined}
        className={inputClassName}
      />

      {autocomplete && showSuggestions && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                className="w-full px-3 py-3 text-left text-base text-gray-700 hover:bg-primary-50"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSuggestionSelect?.(name, suggestion)}
              >
                {highlightMatch(suggestion, value)}
              </button>
            </li>
          ))}
        </ul>
      )}

      <FieldError error={error} />
      <FieldHelp helpText={helpText} />
    </div>
  );
}
