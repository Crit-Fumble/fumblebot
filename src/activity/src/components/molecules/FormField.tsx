import { Input, Label, Textarea, Select, type SelectOption } from '../atoms';

export interface FormFieldProps {
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'textarea' | 'select';
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  options?: SelectOption[];
  testId?: string;
}

export function FormField({
  label,
  type = 'text',
  name,
  value,
  onChange,
  placeholder,
  error,
  required,
  disabled,
  options = [],
  testId,
}: FormFieldProps) {
  const fieldId = testId || name;

  return (
    <div className="w-full" data-testid={`${fieldId}-field`}>
      <Label htmlFor={fieldId} required={required} testId={`${fieldId}-label`}>
        {label}
      </Label>

      {type === 'textarea' ? (
        <Textarea
          id={fieldId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          error={!!error}
          disabled={disabled}
          testId={fieldId}
        />
      ) : type === 'select' ? (
        <Select
          id={fieldId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          options={options}
          placeholder={placeholder}
          error={!!error}
          disabled={disabled}
          testId={fieldId}
        />
      ) : (
        <Input
          id={fieldId}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          error={!!error}
          disabled={disabled}
          testId={fieldId}
        />
      )}

      {error && (
        <p className="mt-1 text-sm text-discord-red" data-testid={`${fieldId}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
