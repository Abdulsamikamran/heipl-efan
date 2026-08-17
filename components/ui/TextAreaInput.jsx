import { useCallback, useRef } from 'react';
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

export default function TextAreaInput({
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
  rows = 3,
  inputRef,
}) {
  const textareaRef = useRef(null);

  const setRef = useCallback(
    (element) => {
      textareaRef.current = element;
      if (inputRef) {
        if (typeof inputRef === 'function') {
          inputRef(element);
        } else {
          inputRef.current = element;
        }
      }
    },
    [inputRef]
  );

  const autoResize = useCallback(() => {
    const element = textareaRef.current;
    if (!element) return;

    element.style.height = 'auto';
    const nextHeight = Math.min(element.scrollHeight, 200);
    element.style.height = `${nextHeight}px`;
  }, []);

  const handleChange = useCallback(
    (event) => {
      onChange(name, event.target.value);
      autoResize();
    },
    [autoResize, name, onChange]
  );

  const handleBlur = useCallback(() => {
    if (autoFormat === 'titleCase' && value) {
      onChange(name, titleCaseValue(value));
    }
  }, [autoFormat, name, onChange, value]);

  const inputClassName = [
    'w-full resize-none rounded-lg border bg-white px-3 py-3 text-base',
    'min-h-[44px] max-h-[200px] overflow-y-auto focus:outline-none focus:ring-2',
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
      <textarea
        ref={setRef}
        id={name}
        name={name}
        value={value || ''}
        onChange={handleChange}
        onBlur={handleBlur}
        onInput={autoResize}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={inputClassName}
      />
      <FieldError error={error} />
      <FieldHelp helpText={helpText} />
    </div>
  );
}
