import { useEffect } from 'react';

export default function Toast({ message, type = 'info', isVisible, onClose, duration = 3000 }) {
  useEffect(() => {
    if (!isVisible) return undefined;

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const typeStyles = {
    info: 'bg-gray-800 text-white',
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    warning: 'bg-amber-500 text-white',
  };

  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 px-4">
      <div
        className={`rounded-lg px-4 py-3 text-sm shadow-lg ${
          typeStyles[type] || typeStyles.info
        }`}
      >
        {message}
      </div>
    </div>
  );
}
