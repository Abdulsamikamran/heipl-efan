function FieldLabel({ label, required }) {
  if (!label) return null;

  return (
    <p className="mb-2 text-sm font-medium text-gray-700">
      {label}
      {required && (
        <span className="ml-0.5 text-primary-600" aria-hidden="true">
          *
        </span>
      )}
    </p>
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

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function resolveLayout(options, layout) {
  if (layout) return layout;
  if (options.some((option) => option.length > 30)) return 'column';
  if (options.length <= 2) return 'row';
  return 'column';
}

export default function RadioGroup({
  name,
  label,
  value = '',
  onChange,
  required = false,
  options = [],
  disabled = false,
  helpText = '',
  error = '',
  layout,
  inputRef,
}) {
  const resolvedLayout = resolveLayout(options, layout);
  const containerClass =
    resolvedLayout === 'row' ? 'flex flex-wrap gap-2' : 'flex flex-col gap-2';

  return (
    <div
      ref={inputRef}
      className="w-full"
      tabIndex={-1}
    >
      <FieldLabel label={label} required={required} />
      <div className={containerClass} role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const isSelected = value === option;

          return (
            <label
              key={option}
              className={[
                'flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border px-4 py-2',
                resolvedLayout === 'column' ? 'w-full' : '',
                isSelected
                  ? 'border-primary-600 bg-primary-50 font-medium text-primary-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
                disabled ? 'cursor-not-allowed opacity-50' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={isSelected}
                onChange={() => onChange(name, option)}
                disabled={disabled}
                className="sr-only"
              />
              {isSelected && <CheckIcon />}
              <span className="text-base">{option}</span>
            </label>
          );
        })}
      </div>
      <FieldError error={error} />
      <FieldHelp helpText={helpText} />
    </div>
  );
}
