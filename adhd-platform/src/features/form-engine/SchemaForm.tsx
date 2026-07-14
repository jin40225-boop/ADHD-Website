import { useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { FormField, FormSchema } from '@contracts/types';
import { CheckboxGroup } from '@/components/ui/FormField';
import { Select } from '@/components/ui/FormField';
import { Textarea } from '@/components/ui/FormField';
import { TextInput } from '@/components/ui/FormField';
import { WarmButton } from '@/components/ui/WarmButton';
import { WarmCard } from '@/components/ui/WarmCard';
import './form-engine.css';
import { createAnswers, normalizeOptions, validateAnswers } from './form-utils';
import type { FormAnswers } from './form-utils';

export interface SchemaFormProps {
  /** Field schema supplied by the project configuration. */ schema: FormSchema;
  /** Receives validated answers only after the user confirms the review page. */ onSubmit: (answers: FormAnswers) => void | Promise<void>;
  /** Values used when editing a draft. */ initialValues?: FormAnswers;
  /** Primary submit button text. */ submitLabel?: string;
  /** Disables form interaction while an outer action is pending. */ disabled?: boolean;
}

/** Dynamic public form with client validation, error focus, and a confirmation step. */
export function SchemaForm({ schema, onSubmit, initialValues, submitLabel = '確認送出', disabled = false }: SchemaFormProps) {
  const initial = useMemo(() => createAnswers(schema, initialValues), [schema, initialValues]);
  const [answers, setAnswers] = useState<FormAnswers>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const firstErrorRef = useRef<HTMLDivElement>(null);
  const updateAnswer = (key: string, value: string | string[]) => setAnswers((current) => ({ ...current, [key]: value }));
  const check = () => { const nextErrors = validateAnswers(schema, answers); setErrors(nextErrors); return nextErrors; };
  const showReview = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const nextErrors = check(); if (Object.keys(nextErrors).length) { requestAnimationFrame(() => firstErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return; } setReviewing(true); };
  if (reviewing) return <WarmCard className="schema-confirmation" style={{ padding: '1.25rem' }}><h2>請確認填寫內容</h2><dl className="schema-confirmation__answers">{schema.fields.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{displayAnswer(answers[field.key])}</dd></div>)}</dl><div className="schema-form__actions"><WarmButton variant="secondary" onClick={() => setReviewing(false)} disabled={disabled}>返回修改</WarmButton><WarmButton onClick={() => void onSubmit(answers)} disabled={disabled}>{submitLabel}</WarmButton></div></WarmCard>;
  return <form className="schema-form" noValidate onSubmit={showReview}>{schema.fields.map((field) => <div key={field.key} ref={errors[field.key] ? firstErrorRef : undefined}>{renderField(field, answers[field.key], errors[field.key], updateAnswer)}</div>)}<div className="schema-form__actions"><WarmButton type="submit" disabled={disabled}>{submitLabel}</WarmButton></div></form>;
}

function displayAnswer(value: string | string[] | undefined) { return Array.isArray(value) ? value.join('、') : value || '—'; }

function renderField(field: FormField, value: string | string[] | undefined, error: string | undefined, onChange: (key: string, value: string | string[]) => void) {
  const common = { label: field.label, helpText: field.helpText, error, required: field.required, name: field.key };
  if (field.type === 'textarea') return <Textarea {...common} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(field.key, event.target.value)} />;
  if (field.type === 'select') return <Select {...common} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(field.key, event.target.value)} options={[{ label: '請選擇', value: '' }, ...normalizeOptions(field.options)]} />;
  if (field.type === 'multiselect' || field.type === 'checkbox') return <CheckboxGroup label={field.label} name={field.key} required={field.required} helpText={field.helpText} error={error} value={Array.isArray(value) ? value : []} onChange={(next) => onChange(field.key, next)} options={normalizeOptions(field.options).map((option) => ({ ...option, label: `${option.label}${option.disabled && option.disabledLabel ? option.disabledLabel : ''}` }))} />;
  return <TextInput {...common} type={field.type === 'phone' ? 'tel' : field.type} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(field.key, event.target.value)} />;
}
