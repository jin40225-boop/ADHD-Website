import type { FormField, FormFieldOption, FormSchema } from '@contracts/types';

export type FormAnswer = string | string[];
export type FormAnswers = Record<string, FormAnswer>;
export type FormErrors = Record<string, string>;

/** Converts legacy string options and structured options into one UI shape. */
export function normalizeOptions(options: FormField['options'] = []): FormFieldOption[] {
  return options.map((option) => typeof option === 'string' ? { label: option, value: option } : option);
}

/** Supplies an appropriate empty answer for a field. */
export function emptyAnswer(field: FormField): FormAnswer {
  return field.type === 'multiselect' || field.type === 'checkbox' ? [] : '';
}

/** Builds a complete answer object while retaining supplied drafts. */
export function createAnswers(schema: FormSchema, initialValues: FormAnswers = {}): FormAnswers {
  return Object.fromEntries(schema.fields.map((field) => [field.key, initialValues[field.key] ?? emptyAnswer(field)]));
}

/** Validates required fields plus browser-equivalent email and Taiwan phone formats. */
export function validateAnswers(schema: FormSchema, answers: FormAnswers): FormErrors {
  const errors: FormErrors = {};
  for (const field of schema.fields) {
    const value = answers[field.key] ?? emptyAnswer(field);
    const text = Array.isArray(value) ? value.join(', ') : value.trim();
    if (field.required && (!text || (Array.isArray(value) && value.length === 0))) { errors[field.key] = `請填寫「${field.label}」`; continue; }
    if (!text) continue;
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) errors[field.key] = '請輸入有效的 Email 格式';
    if (field.type === 'phone' && !/^(?:\+886[- ]?)?0?9\d{8}$|^0\d{1,2}[- ]?\d{6,8}$/.test(text.replace(/[()\s-]/g, ''))) errors[field.key] = '請輸入有效的電話號碼';
  }
  return errors;
}
