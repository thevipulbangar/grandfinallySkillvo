/**
 * Publish a course: details, then the topic skill test that gates publication.
 *
 * These are full pages in the approved design, not a modal — matching the
 * treatment already given to Wallet, Profile, Settings, and Auth. The pass
 * mark and the number of questions are both derived from the quiz actually
 * loaded for the chosen category — categories carry different numbers of
 * questions, and a hardcoded count silently disables the publish gate.
 *
 * The quiz step is sequential and one-shot: only the current question is
 * shown, there's no way back to a previous one, and each question carries a
 * 60-second countdown. Picking an option selects it; "Submit" locks it in
 * and advances (the last question's button reads "Submit test"). Letting the
 * clock run out submits whatever's selected — or nothing — as a wrong
 * answer. "End test" lets the user bail out entirely without recording an
 * attempt. Failing the whole test bans the category for 2 months
 * server-side, which is rendered here as its own screen.
 */
import React from 'react';
import type { QuizQuestion } from '../types';
import { Badge, Button, Card, Field, Input, Select, Textarea } from '../ui/primitives';
import SubPageLayout from '../ui/SubPageLayout';

export interface PublishDraft {
  title: string;
  category: string;
  description: string;
  creditFee: number;
}

interface Props {
  step: 'details' | 'quiz' | 'success';
  draft: PublishDraft;
  onDraftChange: (patch: Partial<PublishDraft>) => void;
  categories: string[];
  quiz: QuizQuestion[];
  currentQuestionIndex: number;
  /** ISO timestamp the current question was shown at — drives the on-screen timer. */
  questionShownAt: string | null;
  onAnswer: (optionIndex: number) => void;
  onContinue: () => void;
  onExit: () => void;
  /** Bail out of an in-progress test entirely — no attempt is recorded. */
  onEndTest: () => void;
  isGeneratingQuiz: boolean;
  /** True while the final answer's result is being recorded/published server-side. */
  isSubmittingQuiz: boolean;
  /** ISO timestamp the user is banned from retaking this category's test until, if any. */
  testBanUntil: string | null;
}

const QUESTION_TIME_LIMIT_SECONDS = 60;

function StepDots({ step }: { step: 'details' | 'quiz' }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className={`w-6 h-1.5 rounded-full ${step === 'details' ? 'bg-pine' : 'bg-mint'}`} />
      <span className={`w-6 h-1.5 rounded-full ${step === 'quiz' ? 'bg-pine' : 'bg-mint'}`} />
    </div>
  );
}

function formatBanDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function secondsLeft(shownAt: string) {
  const elapsed = Math.floor((Date.now() - new Date(shownAt).getTime()) / 1000);
  return Math.max(0, QUESTION_TIME_LIMIT_SECONDS - elapsed);
}

/** 60-second countdown for the current question; fires onExpire once when it hits 0. */
function QuestionTimer({ shownAt, onExpire }: { shownAt: string; onExpire: () => void }) {
  const [remaining, setRemaining] = React.useState(() => secondsLeft(shownAt));
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    firedRef.current = false;
    setRemaining(secondsLeft(shownAt));
    const interval = setInterval(() => {
      const left = secondsLeft(shownAt);
      setRemaining(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire();
      }
    }, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownAt]);

  const isLow = remaining <= 10;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums ${
        isLow ? 'text-red-600' : 'text-slate'
      }`}
    >
      ⏱ {formatCountdown(remaining)}
    </span>
  );
}

export default function PublishCoursePage({
  step,
  draft,
  onDraftChange,
  categories,
  quiz,
  currentQuestionIndex,
  questionShownAt,
  onAnswer,
  onContinue,
  onExit,
  onEndTest,
  isGeneratingQuiz,
  isSubmittingQuiz,
  testBanUntil,
}: Props) {
  // Selection is picked first, then locked in with the Submit button (or by
  // the clock running out). Both reset whenever a new question comes in.
  const [selectedOption, setSelectedOption] = React.useState<number | null>(null);
  const [locked, setLocked] = React.useState(false);
  React.useEffect(() => {
    setSelectedOption(null);
    setLocked(false);
  }, [currentQuestionIndex]);

  const submitCurrentAnswer = React.useCallback(
    (optionIndex: number) => {
      if (locked) return;
      setLocked(true);
      onAnswer(optionIndex);
    },
    [locked, onAnswer],
  );

  const passMark = Math.max(1, Math.ceil((quiz.length * 2) / 3));
  const isAiQuiz = quiz.some((q) => q.id.startsWith('ai-'));
  const currentQuestion = quiz[currentQuestionIndex];

  if (step === 'quiz' && testBanUntil) {
    return (
      <SubPageLayout backLabel="Back to teaching" onBack={onExit} maxWidth="max-w-[640px]">
        <div className="text-center py-10">
          <div className="w-20 h-20 rounded-full bg-haze flex items-center justify-center text-4xl mx-auto mb-5">
            ⏳
          </div>
          <h1 className="font-heading font-bold text-2xl m-0">Test locked</h1>
          <p className="text-[15px] text-slate mt-3 mb-7 max-w-md mx-auto">
            You didn't pass the {draft.category} skill test on your last attempt. You can retake
            it on <strong>{formatBanDate(testBanUntil)}</strong>.
          </p>
          <Button onClick={onExit}>Back to teaching</Button>
        </div>
      </SubPageLayout>
    );
  }

  if (step === 'success') {
    return (
      <SubPageLayout backLabel="Back to teaching" onBack={onExit} maxWidth="max-w-[640px]">
        <div className="text-center py-10">
          <div className="w-20 h-20 rounded-full bg-mint flex items-center justify-center text-4xl mx-auto mb-5">
            🎉
          </div>
          <h1 className="font-heading font-bold text-2xl m-0">Skill verified — you're live</h1>
          <p className="text-[15px] text-slate mt-3 mb-7 max-w-md mx-auto">
            "{draft.title}" is now on the marketplace. Set your Sunday session times and upload study
            material from the Teaching tab.
          </p>
          <Button onClick={onExit}>Go to teaching</Button>
        </div>
      </SubPageLayout>
    );
  }

  return (
    <SubPageLayout backLabel="Back to teaching" onBack={onExit} maxWidth="max-w-[640px]">
      <StepDots step={step} />

      {step === 'details' && (
        <>
          <Badge tone="sand">Step 1 · Course details</Badge>
          <h1 className="font-heading font-bold text-2xl mt-4 mb-1">Publish a new course</h1>
          <p className="text-[15px] text-slate mb-6">
            Tell learners what they'll get. You'll verify your expertise next.
          </p>

          <Card className="p-7 flex flex-col gap-5">
            <Field label="Course title">
              <Input
                value={draft.title}
                onChange={(e) => onDraftChange({ title: e.target.value })}
                placeholder="e.g. Node.js Architecture & APIs"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Category">
                <Select
                  value={draft.category}
                  onChange={(e) => onDraftChange({ category: e.target.value })}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Credit fee" hint="Charged to the student on completion.">
                <Input
                  type="number"
                  min={0}
                  max={500}
                  value={draft.creditFee}
                  onChange={(e) => onDraftChange({ creditFee: Number(e.target.value) })}
                />
              </Field>
            </div>

            <Field label="Description">
              <Textarea
                rows={4}
                value={draft.description}
                onChange={(e) => onDraftChange({ description: e.target.value })}
                placeholder="What will students be able to do by the end?"
              />
            </Field>

            <Button full disabled={!draft.title.trim() || isGeneratingQuiz} onClick={onContinue}>
              {isGeneratingQuiz ? 'Generating your AI skill test…' : 'Continue to skill test →'}
            </Button>
          </Card>
        </>
      )}

      {step === 'quiz' && (
        <>
          <Badge tone="sand">
            Step 2 · {draft.category} assessment{isAiQuiz ? ' · AI-generated' : ''}
          </Badge>
          <h1 className="font-heading font-bold text-2xl mt-4 mb-1">Topic qualification quiz</h1>
          <p className="text-[15px] text-slate mb-6">
            {quiz.length === 0
              ? 'No quiz is available for this category yet.'
              : `One question at a time, 60 seconds each. At least ${passMark} correct verifies your expertise.`}
          </p>

          {currentQuestion && (
            <Card className="p-7">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate uppercase tracking-wide m-0">
                  Question {currentQuestionIndex + 1} of {quiz.length}
                </p>
                {questionShownAt && !locked && (
                  <QuestionTimer
                    shownAt={questionShownAt}
                    onExpire={() => submitCurrentAnswer(selectedOption ?? -1)}
                  />
                )}
              </div>
              <div className="bg-haze border border-sage rounded-[14px] p-4">
                <p className="font-heading font-bold text-sm m-0 mb-3">{currentQuestion.question}</p>
                <div className="flex flex-col gap-2">
                  {currentQuestion.options.map((option, optionIndex) => (
                    <button
                      key={optionIndex}
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        if (locked) return;
                        setSelectedOption(optionIndex);
                      }}
                      className={`w-full text-left px-3.5 py-3 rounded-xl text-sm font-semibold border cursor-pointer transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                        selectedOption === optionIndex
                          ? 'bg-pine text-white border-pine'
                          : 'bg-white text-ink border-sage hover:border-moss'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {locked ? (
                <p className="text-xs text-slate mt-4 mb-0 text-center">
                  {isSubmittingQuiz && currentQuestionIndex === quiz.length - 1
                    ? 'Submitting your answers…'
                    : 'Answer locked in — next question…'}
                </p>
              ) : (
                <div className="mt-6 flex items-center justify-between gap-3">
                  <Button variant="ghost" onClick={onEndTest}>
                    End test
                  </Button>
                  <Button
                    disabled={selectedOption === null}
                    onClick={() => submitCurrentAnswer(selectedOption as number)}
                  >
                    {currentQuestionIndex === quiz.length - 1 ? 'Submit test' : 'Submit answer'}
                  </Button>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </SubPageLayout>
  );
}
