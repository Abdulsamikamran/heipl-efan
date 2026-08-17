import { useState } from 'react';

function DocumentIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function ChevronIcon({ isOpen }) {
  return (
    <svg
      className={`h-5 w-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function SectionBadge({ sectionKey, isOfficeSection }) {
  const badgeClass = isOfficeSection
    ? 'flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white'
    : 'flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white';

  return (
    <div className={badgeClass}>
      {sectionKey === 'meta' ? <DocumentIcon /> : sectionKey}
    </div>
  );
}

export default function FormSection({
  sectionKey,
  title,
  children,
  collapsible = false,
  defaultOpen = true,
  isOfficeSection = false,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const headerClass = [
    'flex items-center justify-between gap-3 px-4 py-3',
    isOfficeSection ? 'bg-blue-50' : 'bg-white',
    collapsible ? 'cursor-pointer select-none' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const titleClass = isOfficeSection
    ? 'text-base font-semibold text-blue-800'
    : 'text-base font-semibold text-gray-800';

  const handleHeaderClick = () => {
    if (collapsible) {
      setIsOpen((prev) => !prev);
    }
  };

  const handleHeaderKeyDown = (event) => {
    if (!collapsible) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen((prev) => !prev);
    }
  };

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <div
        className={headerClass}
        onClick={handleHeaderClick}
        onKeyDown={handleHeaderKeyDown}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? isOpen : undefined}
      >
        <div className="flex items-center gap-3">
          <SectionBadge sectionKey={sectionKey} isOfficeSection={isOfficeSection} />
          <h2 className={titleClass}>{title}</h2>
        </div>
        {collapsible && <ChevronIcon isOpen={isOpen} />}
      </div>

      <div
        className={`transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[9999px] opacity-100' : 'max-h-0 overflow-hidden opacity-0'
        }`}
      >
        <div
          className={`grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 ${
            isOfficeSection ? 'bg-blue-50/50' : ''
          }`}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
