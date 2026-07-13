import { useState } from 'react';
import { useParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333';

type PageState = 'initial' | 'sending' | 'success' | 'error';

type ErrorKind = 'invalid' | 'already_answered' | 'generic';

function getNoteColor(note: number): string {
  if (note <= 6) return '#dc2626';
  if (note <= 8) return '#ca8a04';
  return '#16a34a';
}

function getNoteBackground(note: number, selected: boolean): React.CSSProperties {
  if (!selected) {
    return {
      backgroundColor: '#f3f4f6',
      color: '#374151',
      border: '2px solid #e5e7eb',
    };
  }
  const color = getNoteColor(note);
  return {
    backgroundColor: color,
    color: '#ffffff',
    border: `2px solid ${color}`,
  };
}

export function NpsRespostaPage() {
  const { token } = useParams<{ token: string }>();
  const [selectedNote, setSelectedNote] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [pageState, setPageState] = useState<PageState>('initial');
  const [errorKind, setErrorKind] = useState<ErrorKind>('generic');

  async function handleSubmit() {
    if (selectedNote === null || !token) return;
    setPageState('sending');

    try {
      const response = await fetch(`${API_URL}/nps/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nota: selectedNote, comentario: comment || undefined }),
      });

      if (response.status === 201) {
        setPageState('success');
      } else if (response.status === 400 || response.status === 404) {
        setErrorKind('invalid');
        setPageState('error');
      } else if (response.status === 409) {
        setErrorKind('already_answered');
        setPageState('error');
      } else {
        setErrorKind('generic');
        setPageState('error');
      }
    } catch {
      setErrorKind('generic');
      setPageState('error');
    }
  }

  const errorMessages: Record<ErrorKind, string> = {
    invalid: 'Este link é inválido ou expirou.',
    already_answered: 'Você já avaliou este atendimento.',
    generic: 'Ocorreu um erro. Tente novamente.',
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.logo}>Global Engenharia</div>

        {pageState === 'success' && (
          <div style={styles.feedbackBox}>
            <div style={styles.successIcon}>✓</div>
            <p style={styles.feedbackTitle}>Obrigado!</p>
            <p style={styles.feedbackText}>Sua avaliação foi registrada.</p>
          </div>
        )}

        {pageState === 'error' && (
          <div style={styles.feedbackBox}>
            <div style={styles.errorIcon}>!</div>
            <p style={styles.feedbackText}>{errorMessages[errorKind]}</p>
          </div>
        )}

        {(pageState === 'initial' || pageState === 'sending') && (
          <>
            <h1 style={styles.title}>Como foi o seu atendimento?</h1>
            <p style={styles.subtitle}>Sua opinião é muito importante para nós</p>

            <div style={styles.notesWrapper}>
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedNote(i)}
                  style={{
                    ...styles.noteButton,
                    ...getNoteBackground(i, selectedNote === i),
                  }}
                >
                  {i}
                </button>
              ))}
            </div>

            <p style={styles.noteLabel}>0 = Péssimo · 10 = Excelente</p>

            <textarea
              style={styles.textarea}
              placeholder="Deixe um comentário (opcional)"
              maxLength={500}
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <p style={styles.charCount}>{comment.length}/500</p>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={selectedNote === null || pageState === 'sending'}
              style={{
                ...styles.submitButton,
                ...(selectedNote === null || pageState === 'sending'
                  ? styles.submitButtonDisabled
                  : {}),
              }}
            >
              {pageState === 'sending' ? 'Enviando...' : 'Enviar Avaliação'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    padding: '40px 32px',
    maxWidth: '560px',
    width: '100%',
    textAlign: 'center',
  },
  logo: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1e3a5f',
    marginBottom: '32px',
    letterSpacing: '0.02em',
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#111827',
    margin: '0 0 8px',
  },
  subtitle: {
    fontSize: '15px',
    color: '#6b7280',
    margin: '0 0 32px',
  },
  notesWrapper: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    justifyContent: 'center',
    marginBottom: '12px',
  },
  noteButton: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.1s',
  },
  noteLabel: {
    fontSize: '13px',
    color: '#9ca3af',
    marginBottom: '24px',
  },
  textarea: {
    width: '100%',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    padding: '12px',
    fontSize: '14px',
    color: '#374151',
    resize: 'vertical',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    outline: 'none',
  },
  charCount: {
    fontSize: '12px',
    color: '#9ca3af',
    textAlign: 'right',
    margin: '4px 0 24px',
  },
  submitButton: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#1e3a5f',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  submitButtonDisabled: {
    backgroundColor: '#d1d5db',
    cursor: 'not-allowed',
  },
  feedbackBox: {
    padding: '32px 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  successIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#dcfce7',
    color: '#16a34a',
    fontSize: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    fontSize: '32px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#111827',
    margin: 0,
  },
  feedbackText: {
    fontSize: '15px',
    color: '#6b7280',
    margin: 0,
  },
};
