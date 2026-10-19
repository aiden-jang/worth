import { useEffect, useState } from 'react';
export function DraftPhoto({
  file,
  onChange,
  disabled,
  helper,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled: boolean;
  helper?: string;
}) {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <details className="record-extras draft-photo" open={Boolean(file)}>
      <summary>
        Photo <span>optional</span>
      </summary>
      {preview && <img src={preview} alt="Photo ready to attach" />}
      <div className="routine-actions">
        {[false, true].map((camera) => (
          <label className="button button-outline" key={String(camera)}>
            {camera ? 'Take photo' : 'Choose photo'}
            <input
              aria-label={camera ? 'Take photo' : 'Choose photo'}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture={camera ? 'environment' : undefined}
              className="photo-file-input"
              disabled={disabled}
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) onChange(selected);
                e.target.value = '';
              }}
            />
          </label>
        ))}
        {file && (
          <button
            type="button"
            className="button button-outline"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            Remove attachment
          </button>
        )}
      </div>
      <p className="exercise-helper">
        {helper ??
          'Uploads with this record. Your photo draft stays on this device until you save or discard it.'}
      </p>
    </details>
  );
}
