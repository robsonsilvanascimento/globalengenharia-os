import type { ReactNode } from 'react';
import './FormField.css';

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function FormField({ label, htmlFor, error, required, children }: FormFieldProps) {
  return (
    <div className="ui-form-field">
      <label className="ui-form-field-label" htmlFor={htmlFor}>
        {label}
        {required && <span className="ui-form-field-required">*</span>}
      </label>
      {children}
      {error && <span className="ui-form-field-error">{error}</span>}
    </div>
  );
}
