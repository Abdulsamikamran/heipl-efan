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

export default function NumberInput({
  name,
  label,
  value = '',
  onChange,
  required = false,
  placeholder = '',
  disabled = false,
  helpText = '',
  error = '',
  min,
  max,
  inputRef,
}) {
  const handleChange = (event) => {
    onChange(name, event.target.value);
  };

  const handleBlur = () => {
    if (value === '' || value == null) return;

    let nextValue = Number(value);
    if (Number.isNaN(nextValue)) return;

    if (max != null && nextValue > max) {
      onChange(name, String(max));
      return;
    }

    if (min != null && nextValue < min) {
      onChange(name, String(min));
    }
  };

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
        type="number"
        inputMode="numeric"
        value={value ?? ''}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        className={inputClassName}
      />
      <FieldError error={error} />
      <FieldHelp helpText={helpText} />
    </div>
  );
}
