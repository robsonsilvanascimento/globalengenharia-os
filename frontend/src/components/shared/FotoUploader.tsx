import { useRef, useState } from 'react';
import './FotoUploader.css';

interface FotoSelecionada {
  mime_type: string;
  base64: string;
  nome: string;
}

interface FotoUploaderProps {
  onFotosChange: (fotos: FotoSelecionada[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

export function FotoUploader({
  onFotosChange,
  maxFiles = 5,
  disabled = false,
}: FotoUploaderProps) {
  const [fotos, setFotos] = useState<FotoSelecionada[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList) {
    const remaining = maxFiles - fotos.length;
    if (remaining <= 0) return;

    const selected = Array.from(files).slice(0, remaining);

    let loaded = 0;
    const novas: FotoSelecionada[] = [];

    selected.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const base64 = result.split(',')[1];
        novas.push({ mime_type: file.type, base64, nome: file.name });
        loaded += 1;
        if (loaded === selected.length) {
          const updated = [...fotos, ...novas];
          setFotos(updated);
          onFotosChange(updated);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  }

  function handleRemove(index: number) {
    const updated = fotos.filter((_, i) => i !== index);
    setFotos(updated);
    onFotosChange(updated);
  }

  const limitReached = fotos.length >= maxFiles;

  return (
    <div className="foto-uploader">
      {!limitReached && !disabled && (
        <label className="foto-uploader__input-label">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            onChange={handleInputChange}
            disabled={disabled}
          />
          Clique para selecionar fotos ({fotos.length}/{maxFiles})
        </label>
      )}

      {fotos.length > 0 && (
        <div className="foto-uploader__previews">
          {fotos.map((foto, index) => (
            <div key={index} className="foto-uploader__preview">
              <img
                src={`data:${foto.mime_type};base64,${foto.base64}`}
                alt={foto.nome}
              />
              {!disabled && (
                <button
                  type="button"
                  className="foto-uploader__remove"
                  onClick={() => handleRemove(index)}
                  aria-label={`Remover ${foto.nome}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
