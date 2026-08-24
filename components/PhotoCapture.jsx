import { useEffect, useRef, useState } from 'react';
import { savePhoto, getPhoto, deletePhoto } from '../lib/db';

const compressImage = (file, maxWidth = 1200, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const createThumbnail = (base64) => {
  return new Promise((resolve) => {
    const thumbCanvas = document.createElement('canvas');
    const thumbImg = new Image();
    thumbImg.onload = () => {
      const size = 200;
      thumbCanvas.width = size;
      thumbCanvas.height = size;
      const ctx = thumbCanvas.getContext('2d');
      const min = Math.min(thumbImg.width, thumbImg.height);
      const sx = (thumbImg.width - min) / 2;
      const sy = (thumbImg.height - min) / 2;
      ctx.drawImage(thumbImg, sx, sy, min, min, 0, 0, size, size);
      resolve(thumbCanvas.toDataURL('image/jpeg', 0.5));
    };
    thumbImg.src = base64;
  });
};

export default function PhotoCapture({
  recordId,
  photoType,
  label,
  frontCamera = false,
  onPhotoSaved,
  onPhotoRemoved,
  disabled = false,
}) {
  const fileInputRef = useRef(null);
  const [existingPhoto, setExistingPhoto] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!recordId) {
      setExistingPhoto(null);
      setThumbnail(null);
      return;
    }

    let cancelled = false;

    getPhoto(recordId, photoType).then(async (photo) => {
      if (cancelled || !photo) return;
      setExistingPhoto(photo);
      const thumb = await createThumbnail(photo.base64);
      if (!cancelled) setThumbnail(thumb);
    });

    return () => {
      cancelled = true;
    };
  }, [recordId, photoType]);

  const handleCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const base64 = await compressImage(file);

      if (!recordId) {
        setError('Please save the form first before adding photos');
        setIsProcessing(false);
        return;
      }

      await savePhoto(recordId, photoType, base64);
      const thumb = await createThumbnail(base64);
      setThumbnail(thumb);
      setExistingPhoto({ base64, type: photoType, uploaded: false });
      if (onPhotoSaved) onPhotoSaved({ type: photoType, base64 });
    } catch (err) {
      setError('Failed to process photo');
      console.error(err);
    }

    setIsProcessing(false);
    e.target.value = '';
  };

  const handleRemove = async () => {
    if (recordId) {
      await deletePhoto(recordId, photoType);
    }
    setExistingPhoto(null);
    setThumbnail(null);
    if (onPhotoRemoved) onPhotoRemoved(photoType);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>

      {existingPhoto || thumbnail ? (
        <div className="relative inline-block">
          <img
            src={thumbnail || existingPhoto?.base64}
            alt={label}
            className="h-28 w-28 rounded-xl border-2 border-gray-200 object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-sm text-white shadow-md active:bg-red-600"
          >
            ×
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-1 right-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white"
          >
            🔄
          </button>
          {existingPhoto && !existingPhoto.uploaded && (
            <span className="absolute left-1 top-1 rounded-full bg-amber-500 px-1 py-0.5 text-[8px] leading-none text-white">
              Pending
            </span>
          )}
          {existingPhoto && existingPhoto.uploaded && (
            <span className="absolute left-1 top-1 rounded-full bg-green-500 px-1 py-0.5 text-[8px] leading-none text-white">
              ✓
            </span>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (!recordId) {
              setError('Save the form first');
              return;
            }
            fileInputRef.current?.click();
          }}
          disabled={disabled || isProcessing}
          className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400 active:border-primary-500 active:text-primary-500 disabled:opacity-40"
        >
          {isProcessing ? (
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          ) : (
            <>
              <svg
                width="28"
                height="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
              >
                <path
                  d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
                />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span className="text-[10px]">Take Photo</span>
            </>
          )}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture={frontCamera ? 'user' : 'environment'}
        onChange={handleCapture}
        className="hidden"
      />

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
