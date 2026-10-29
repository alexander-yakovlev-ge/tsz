'use client';

import {
  IMPORT_MAX_SIZE,
  type ImportAction,
  type ImportChange,
  type ImportIssue,
  type ImportPreview,
  type ImportResult,
  type ImportStep,
  type OwnerImportGroup,
  type OwnerResolutions,
  type OwnersPreview,
} from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { ChangeEvent, useState } from 'react';
import { ShareText, UnitName } from '@/components/registry';
import { Alert, Badge, buttonClass, FormStatusAlert } from '@/components/ui';
import { apiRequest } from '@/lib/client-api';
import { useApiForm } from '@/lib/use-api-form';

const ACTION_TONE: Record<ImportAction, 'gray' | 'accent' | 'amber' | 'red'> = {
  create: 'accent',
  update: 'amber',
  unchanged: 'gray',
  error: 'red',
  pending: 'amber',
};

function IssueList({ issues }: { issues: ImportIssue[] }) {
  const t = useTranslations('adminImport');
  return (
    <ul className="flex flex-col gap-0.5 text-sm text-red-800">
      {issues.map((issue, index) => (
        <li key={index}>
          {issue.column && <code className="mr-1 font-semibold">{issue.column}</code>}
          {t(`issues.${issue.code}`)}
        </li>
      ))}
    </ul>
  );
}

function ChangeList({ changes }: { changes: ImportChange[] }) {
  return (
    <ul className="flex flex-col gap-0.5 text-sm">
      {changes.map((change) => (
        <li key={change.field}>
          <code className="mr-1 font-semibold">{change.field}</code>
          <span className="text-gray-600 line-through">{change.from || '—'}</span> →{' '}
          {change.to || '—'}
        </li>
      ))}
    </ul>
  );
}

/** Выбор по неоднозначному совпадению: кандидаты из БД, другая метка файла или новый собственник. */
function Resolution({
  group,
  value,
  onChange,
}: {
  group: OwnerImportGroup;
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('adminImport');
  if (group.match.status !== 'ambiguous') {
    return null;
  }
  const name = `resolution-${group.key}`;
  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <legend className="px-1 font-bold">
        <span lang="ka">{group.registryName}</span>{' '}
        <span className="font-normal text-gray-700">
          ({t('keyLines', { key: group.key, lines: group.lines.join(', ') })})
        </span>
      </legend>
      {group.match.candidates.map((candidate) => {
        const option =
          candidate.type === 'owner' ? `owner:${candidate.ownerId}` : `key:${candidate.key}`;
        return (
          <label key={option} className="flex items-start gap-3">
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="mt-1 size-5 shrink-0 accent-accent"
            />
            <span className="flex flex-col">
              <span>
                {candidate.type === 'owner'
                  ? t('sameAsOwner', { name: candidate.displayName ?? candidate.registryName })
                  : t('sameAsKey', { key: candidate.key, name: candidate.registryName })}
              </span>
              <span className="text-sm text-gray-600">
                {t(`reasons.${candidate.reason}`)}
                {candidate.type === 'owner' && candidate.units.length > 0 && (
                  <> · {t('candidateUnits', { units: candidate.units.join(', ') })}</>
                )}
              </span>
            </span>
          </label>
        );
      })}
      <label className="flex items-start gap-3">
        <input
          type="radio"
          name={name}
          value="new"
          checked={value === 'new'}
          onChange={() => onChange('new')}
          className="mt-1 size-5 shrink-0 accent-accent"
        />
        <span>{t('newOwner')}</span>
      </label>
    </fieldset>
  );
}

function StepPanel({ step }: { step: ImportStep }) {
  const t = useTranslations('adminImport');
  const te = useTranslations('errors');
  const form = useApiForm();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [resolutions, setResolutions] = useState<OwnerResolutions>({});
  const [showAll, setShowAll] = useState(false);
  const [done, setDone] = useState<ImportResult | null>(null);

  function body(): FormData {
    const data = new FormData();
    data.set('file', file!);
    if (step === 'owners') {
      data.set('resolutions', JSON.stringify(resolutions));
    }
    return data;
  }

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setPreview(null);
    setResolutions({});
    setDone(null);
    form.setStatus(
      selected && selected.size > IMPORT_MAX_SIZE
        ? { kind: 'error', text: te('FILE_TOO_LARGE') }
        : null,
    );
  }

  async function check() {
    setDone(null);
    const result = await form.submit(() =>
      apiRequest<ImportPreview>('POST', `/api/import/${step}/preview`, body()),
    );
    if (result) {
      setPreview(result.data);
    }
  }

  async function commit() {
    const result = await form.submit(() =>
      apiRequest<ImportResult>('POST', `/api/import/${step}/commit`, body()),
    );
    if (result) {
      setDone(result.data);
      setPreview(null);
    } else {
      // Данные могли измениться — показываем свежую проверку.
      await check();
    }
  }

  const ownersPreview = preview?.step === 'owners' ? (preview as OwnersPreview) : null;
  const ambiguous =
    ownersPreview?.owners.filter((group) => group.match.status === 'ambiguous') ?? [];
  const unresolved = ambiguous.filter((group) => !resolutions[group.key]).length;
  const rows = (preview?.rows ?? []) as (ImportPreview['rows'][number] & {
    action: ImportAction;
  })[];
  const visibleRows = showAll
    ? rows
    : rows.filter((row) => row.action !== 'unchanged' && row.action !== 'create');

  return (
    <div className="flex flex-col gap-5">
      <p className="text-gray-600">{t(`${step}.hint`)}</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${step}-file`} className="font-semibold">
          {t('file', { name: `${step}.csv` })}
        </label>
        <input
          id={`${step}-file`}
          type="file"
          accept=".csv,text/csv"
          onChange={choose}
          className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-base file:mr-3 file:rounded-full file:border-0 file:bg-gray-100 file:px-4 file:py-1.5 file:font-semibold"
        />
      </div>
      <FormStatusAlert status={form.status} />
      {done && (
        <Alert kind="success">
          {t('done', {
            create: done.summary.create,
            update: done.summary.update,
            unchanged: done.summary.unchanged,
          })}
        </Alert>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={check}
          className={buttonClass.secondary}
          disabled={!file || form.pending || (file?.size ?? 0) > IMPORT_MAX_SIZE}
        >
          {preview ? t('recheck') : t('check')}
        </button>
        {preview && (
          <button
            type="button"
            onClick={commit}
            className={buttonClass.primary}
            disabled={form.pending || !preview.ready}
          >
            {t('commit')}
          </button>
        )}
      </div>

      {preview && (
        <section aria-labelledby={`${step}-preview`} className="flex flex-col gap-4">
          <h3 id={`${step}-preview`} className="text-lg font-bold">
            {t('previewTitle')}
          </h3>
          {preview.fileIssues.length > 0 && (
            <Alert kind="error">
              <IssueList issues={preview.fileIssues} />
            </Alert>
          )}
          <div className="flex flex-wrap gap-2" data-testid={`${step}-summary`}>
            {(['create', 'update', 'unchanged', 'error'] as const).map((action) => (
              <Badge key={action} tone={ACTION_TONE[action]}>
                {t(`summary.${action}`, { count: preview.summary[action] })}
              </Badge>
            ))}
            {ownersPreview && (
              <>
                <Badge tone="accent">
                  {t('summary.newOwners', { count: ownersPreview.summary.newOwners })}
                </Badge>
                <Badge tone="amber">
                  {t('summary.ambiguous', { count: ownersPreview.summary.ambiguous })}
                </Badge>
              </>
            )}
          </div>
          {!preview.ready && preview.fileIssues.length === 0 && (
            <Alert kind="error">
              {preview.summary.error > 0 ? t('notReadyErrors') : t('notReadyAmbiguous')}
            </Alert>
          )}

          {ambiguous.length > 0 && (
            <div className="flex flex-col gap-3">
              <h4 className="font-bold">{t('ambiguousTitle')}</h4>
              <p className="text-sm text-gray-600">{t('ambiguousHint', { count: unresolved })}</p>
              {ambiguous.map((group) => (
                <Resolution
                  key={group.key}
                  group={group}
                  value={resolutions[group.key]}
                  onChange={(value) => setResolutions({ ...resolutions, [group.key]: value })}
                />
              ))}
            </div>
          )}

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(event) => setShowAll(event.target.checked)}
              className="size-5 accent-accent"
            />
            {t('showAll')}
          </label>
          {visibleRows.length === 0 ? (
            <p className="text-gray-600">{t('nothingToShow')}</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-gray-200 text-gray-600">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      {t('line')}
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      {t('row')}
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      {t('action')}
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      {t('details')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.line} className="border-b border-gray-100 align-top last:border-0">
                      <td className="px-3 py-2 tabular-nums">{row.line}</td>
                      <td className="px-3 py-2">
                        {'key' in row ? (
                          <span className="flex flex-col">
                            <span>
                              <code>{row.key}</code> → {row.unitNumber ?? row.cadastralCode}
                            </span>
                            <ShareText share={row.share} note={row.shareNote} />
                          </span>
                        ) : (
                          <span className="flex flex-col">
                            {row.kind ? (
                              <UnitName kind={row.kind} number={row.number} />
                            ) : (
                              row.number
                            )}
                            <span className="text-gray-600">{row.cadastralCode}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={ACTION_TONE[row.action]}>{t(`actions.${row.action}`)}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <IssueList issues={row.issues} />
                        <ChangeList changes={row.changes} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** Импорт из выписки (ТЗ п. 8.10): сначала помещения, затем собственники. */
export function ImportWizard() {
  const t = useTranslations('adminImport');
  const [step, setStep] = useState<ImportStep>('units');
  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label={t('steps')} className="flex flex-wrap gap-2">
        {(['units', 'owners'] as const).map((value, index) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={step === value}
            onClick={() => setStep(value)}
            className={step === value ? buttonClass.primary : buttonClass.secondary}
          >
            {t('stepTitle', { number: index + 1, name: t(`${value}.title`) })}
          </button>
        ))}
      </div>
      {/* key: при переключении шага состояние предыдущего сбрасывается */}
      <div role="tabpanel">
        <StepPanel key={step} step={step} />
      </div>
    </div>
  );
}
