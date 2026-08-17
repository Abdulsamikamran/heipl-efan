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

export default function SelectInput({
  name,
  label,
  value = '',
  onChange,
  required = false,
  placeholder = 'Select...',
  options = [],
  disabled = false,
  helpText = '',
  error = '',
  inputRef,
}) {
  const selectClassName = [
    'w-full appearance-none rounded-lg border bg-white px-3 py-3 pr-10 text-base',
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
      <div className="relative">
        <select
          ref={inputRef}
          id={name}
          name={name}
          value={value || ''}
          onChange={(event) => onChange(name, event.target.value)}
          disabled={disabled}
          className={selectClassName}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>
      <FieldError error={error} />
      <FieldHelp helpText={helpText} />
    </div>
  );
}
