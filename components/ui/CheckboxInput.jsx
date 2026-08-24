export default function CheckboxInput({
  name,
  label,
  value = false,
  onChange,
  required = false,
  helpText = '',
  error = '',
  disabled = false,
  inputRef,
}) {
  return (
    <div className="w-full">
      <label
        htmlFor={name}
        className={`flex items-start gap-3 rounded-xl border p-3 ${
          error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        <input
          ref={inputRef}
          id={name}
          name={name}
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(event) => onChange(name, event.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-600"
        />
        <span>
          <span className="block text-sm font-medium text-gray-800">
            {label}
            {required && (
              <span className="ml-0.5 text-primary-600" aria-hidden="true">
                *
              </span>
            )}
          </span>
          {helpText && (
            <span className="mt-0.5 block text-xs text-gray-500">{helpText}</span>
          )}
        </span>
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
