/**
 * Publish a course: details, then the topic skill test that gates publication.
 *
 * These are full pages in the approved design, not a modal — matching the
 * treatment already given to Wallet, Profile, Settings, and Auth. The pass
 * mark and the number of questions are both derived from the quiz actually
 * loaded for the chosen category — categories carry different numbers of
 * questions, and a hardcoded count silently disables the submit button.
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
  answers: Record<number, number>;
  onAnswer: (questionIndex: number, optionIndex: number) => void;
  onContinue: () => void;
  onBack: () => void;
  onSubmitQuiz: () => void;
  onExit: () => void;
  isSubmitting: boolean;
  isGeneratingQuiz: boolean;
}

function StepDots({ step }: { step: 'details' | 'quiz' }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className={`w-6 h-1.5 rounded-full ${step === 'details' ? 'bg-pine' : 'bg-mint'}`} />
      <span className={`w-6 h-1.5 rounded-full ${step === 'quiz' ? 'bg-pine' : 'bg-mint'}`} />
    </div>
  );
}

export default function PublishCoursePage({
  step,
  draft,
  onDraftChange,
  categories,
  quiz,
  answers,
  onAnswer,
  onContinue,
  onBack,
  onSubmitQuiz,
  onExit,
  isSubmitting,
  isGeneratingQuiz,
}: Props) {
  const answered = Object.keys(answers).length;
  const passMark = Math.max(1, Math.ceil((quiz.length * 2) / 3));
  const allAnswered = quiz.length > 0 && answered >= quiz.length;
  const isAiQuiz = quiz.some((q) => q.id.startsWith('ai-'));

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
    <SubPageLayout backLabel="Back to teaching" onBack={step === 'details' ? onExit : onBack} maxWidth="max-w-[640px]">
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
              : `Answer all ${quiz.length} questions — at least ${passMark} correct verifies your expertise.`}
          </p>

          <Card className="p-7">
            <div className="flex flex-col gap-4">
              {quiz.map((question, questionIndex) => (
                <div key={question.id} className="bg-haze border border-sage rounded-[14px] p-4">
                  <p className="font-heading font-bold text-sm m-0 mb-3">
                    {questionIndex + 1}. {question.question}
                  </p>
                  <div className="flex flex-col gap-2">
                    {question.options.map((option, optionIndex) => (
                      <button
                        key={optionIndex}
                        type="button"
                        onClick={() => onAnswer(questionIndex, optionIndex)}
                        className={`w-full text-left px-3.5 py-3 rounded-xl text-sm font-semibold border cursor-pointer transition-all ${
                          answers[questionIndex] === optionIndex
                            ? 'bg-pine text-white border-pine'
                            : 'bg-white text-ink border-sage hover:border-moss'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={onBack}>
                Back
              </Button>
              <Button disabled={!allAnswered || isSubmitting} onClick={onSubmitQuiz}>
                {isSubmitting
                  ? 'Publishing…'
                  : allAnswered
                    ? 'Verify answers & publish'
                    : `Answer all questions (${answered}/${quiz.length})`}
              </Button>
            </div>
          </Card>
        </>
      )}
    </SubPageLayout>
  );
}
