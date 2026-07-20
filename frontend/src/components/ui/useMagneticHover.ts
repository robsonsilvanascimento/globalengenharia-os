import { useEffect, useRef } from 'react';

const STRENGTH = 0.3;
const MAX_OFFSET_PX = 10;

/**
 * Faz o elemento seguir sutilmente o cursor durante o hover (efeito
 * "magnético") e volta com uma pequena sobra elástica ao sair. Manipula o
 * DOM diretamente via ref em vez de setState para não re-renderizar o
 * componente a cada mousemove. Desativado quando o usuário prefere menos
 * movimento na tela (prefers-reduced-motion).
 */
export function useMagneticHover<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    function handleMouseMove(event: MouseEvent) {
      const rect = el!.getBoundingClientRect();
      const relativeX = event.clientX - (rect.left + rect.width / 2);
      const relativeY = event.clientY - (rect.top + rect.height / 2);
      const offsetX = Math.max(-MAX_OFFSET_PX, Math.min(MAX_OFFSET_PX, relativeX * STRENGTH));
      const offsetY = Math.max(-MAX_OFFSET_PX, Math.min(MAX_OFFSET_PX, relativeY * STRENGTH));
      el!.style.transition = 'transform 0.08s ease-out';
      el!.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    }

    function handleMouseLeave() {
      el!.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
      el!.style.transform = 'translate(0, 0)';
    }

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return ref;
}
