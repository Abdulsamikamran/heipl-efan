import { FIELD_LABELS } from '../../lib/formSchema';

export default function ErrorSummary({ errors = {}, fieldRefs = {}, labels = FIELD_LABELS }) {
  const errorEntries = Object.entries(errors).filter(([, message]) => message);

  if (errorEntries.length === 0) return null;

  const handleErrorClick = (fieldName) => {
    const fieldEl = fieldRefs[fieldName];
    if (!fieldEl) return;

    fieldEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof fieldEl.focus === 'function') {
      fieldEl.focus();
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
      <h3 className="font-medium text-red-700">⚠️ Please fix the following errors:</h3>
      <ul className="mt-2 space-y-1">
        {errorEntries.map(([fieldName, message]) => {
          const fieldLabel = labels[fieldName] || fieldName;

          return (
            <li key={fieldName}>
              <button
                type="button"
                onClick={() => handleErrorClick(fieldName)}
                className="text-left text-sm text-red-700 underline-offset-2 hover:underline"
              >
                • {fieldLabel}: {message}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
