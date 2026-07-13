import { useEffect, useRef, useState } from 'react';

/** Anima um número de 0 até `valor` com easing suave, sempre que `valor` muda. */
export function useCountUp(valor: number, duracaoMs = 700): number {
  const [exibido, setExibido] = useState(0);
  const inicioRef = useRef<number | null>(null);
  const valorInicialRef = useRef(0);

  useEffect(() => {
    inicioRef.current = null;
    valorInicialRef.current = exibido;
    let frameId: number;

    function tick(timestamp: number) {
      if (inicioRef.current === null) {
        inicioRef.current = timestamp;
      }
      const progresso = Math.min((timestamp - inicioRef.current) / duracaoMs, 1);
      const eased = 1 - (1 - progresso) ** 3;
      const atual = Math.round(valorInicialRef.current + (valor - valorInicialRef.current) * eased);
      setExibido(atual);
      if (progresso < 1) {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return exibido;
}
