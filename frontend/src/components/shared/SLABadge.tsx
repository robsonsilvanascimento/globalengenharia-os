interface SLABadgeProps {
  slaVencido: boolean;
}

export function SLABadge({ slaVencido }: SLABadgeProps) {
  if (!slaVencido) return null;
  return (
    <span style={{
      background: '#ef4444',
      color: 'white',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '0.75rem',
      fontWeight: 600,
    }}>
      SLA Vencido
    </span>
  );
}
