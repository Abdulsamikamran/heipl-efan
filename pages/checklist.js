import { useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import BrandLogo from '../components/BrandLogo';
import { useAuth, AuthSpinner } from '../lib/useAuth';

const CHECKLIST_ITEMS = [
  {
    key: 'validCnic',
    question: 'Does the consumer have a valid CNIC?',
    helpText: 'CNIC must be current and not expired',
  },
  {
    key: 'homeownerIsBillOwner',
    question:
      'Is the homeowner the same person as the electricity bill owner?',
    helpText:
      'The name on the property documents must match the electricity bill',
  },
  {
    key: 'delayedPaymentsOk',
    question:
      'Does the consumer have 4 or fewer delayed payments in the last 24 months?',
    helpText: 'Check the electricity bill payment history',
  },
  {
    key: 'noOldInstallments',
    question: 'Does the consumer have no active old installments on the bill?',
    helpText:
      'Answer Yes or No — this does not affect eligibility. You may still proceed.',
    optional: true,
  },
];

const EMPTY_ANSWERS = {
  validCnic: null,
  homeownerIsBillOwner: null,
  delayedPaymentsOk: null,
  noOldInstallments: null,
};

function ChecklistItem({ number, question, helpText, value, onChange, optional }) {
  const badgeClass =
    value === true
      ? 'bg-green-600 text-white'
      : value === false
        ? optional
          ? 'bg-primary-600 text-white'
          : 'bg-red-600 text-white'
        : 'bg-gray-200 text-gray-600';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${badgeClass}`}
        >
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-800">{question}</p>
          <p className="mt-0.5 text-xs text-gray-500">{helpText}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => onChange(true)}
              className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                value === true
                  ? 'border-green-600 bg-green-600 text-white'
                  : 'border-gray-300 bg-white text-gray-600'
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => onChange(false)}
              className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                value === false
                  ? optional
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : 'border-red-600 bg-red-600 text-white'
                  : 'border-gray-300 bg-white text-gray-600'
              }`}
            >
              No
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChecklistPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth(true);
  const [answers, setAnswers] = useState(EMPTY_ANSWERS);

  const REQUIRED_KEYS = CHECKLIST_ITEMS.filter((item) => !item.optional).map(
    (item) => item.key,
  );

  const values = Object.values(answers);
  const allAnswered = values.every((value) => value !== null);
  const requiredPassed = REQUIRED_KEYS.every((key) => answers[key] === true);
  const allPassed = allAnswered && requiredPassed;
  const anyFailed = REQUIRED_KEYS.some((key) => answers[key] === false);
  const answeredCount = values.filter((value) => value !== null).length;

  const buttonLabel = useMemo(() => {
    if (allPassed) return '✅ Proceed to Form';
    if (allAnswered) return '❌ Consumer Not Eligible';
    return `Answer all questions (${answeredCount}/4)`;
  }, [allPassed, allAnswered, answeredCount]);

  const handleProceed = () => {
    if (!allPassed) return;
    sessionStorage.setItem('checklist_passed', 'true');
    router.push('/form');
  };

  if (isLoading) return <AuthSpinner />;
  if (!user) return null;

  return (
    <>
      <Head>
        <title>Eligibility Checklist | HEIPL-E2P</title>
      </Head>
      <Layout title="Eligibility Check">
        <div className="mx-auto max-w-lg px-4 py-6">
          <div className="mb-6 text-center">
            <BrandLogo size={64} className="mx-auto mb-3 h-16 w-16" />
            <p className="text-sm font-semibold tracking-wide text-primary-600">
              HEIPL-E2P
            </p>
            <h1 className="mt-1 text-xl font-bold text-navy-600">
              Consumer Eligibility Checklist
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Verify all criteria before collecting consumer data
            </p>
          </div>

          <div className="space-y-3">
            {CHECKLIST_ITEMS.map((item, index) => (
              <ChecklistItem
                key={item.key}
                number={index + 1}
                question={item.question}
                helpText={item.helpText}
                optional={item.optional}
                value={answers[item.key]}
                onChange={(val) =>
                  setAnswers((prev) => ({ ...prev, [item.key]: val }))
                }
              />
            ))}
          </div>

          {anyFailed && (
            <div className="mt-6 rounded-xl border-2 border-red-300 bg-red-50 p-4 text-center">
              <div className="mb-2 text-3xl">❌</div>
              <h3 className="text-lg font-bold text-red-700">NOT ELIGIBLE</h3>
              <p className="mt-1 text-sm text-red-600">
                This consumer does not meet the program requirements. You
                cannot proceed with the form.
              </p>
              <button
                type="button"
                onClick={() => setAnswers({ ...EMPTY_ANSWERS })}
                className="mt-3 text-sm text-red-700 underline"
              >
                Reset checklist
              </button>
            </div>
          )}

          {allPassed && (
            <div className="mt-6 rounded-xl border-2 border-green-300 bg-green-50 p-4 text-center">
              <div className="mb-2 text-3xl">✅</div>
              <h3 className="text-lg font-bold text-green-700">ELIGIBLE</h3>
              <p className="mt-1 text-sm text-green-600">
                Consumer meets all requirements. You may proceed.
              </p>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={handleProceed}
              disabled={!allPassed}
              className="btn-primary w-full rounded-xl py-4 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-30"
            >
              {buttonLabel}
            </button>

            <button
              type="button"
              onClick={() => router.push('/')}
              className="btn-secondary w-full rounded-xl py-3 text-sm"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </Layout>
    </>
  );
}
