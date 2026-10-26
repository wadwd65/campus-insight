import { QUESTIONS } from '../lib/surveySchema.js';

export function AnswerReview({ answers }) {
  return <ol className="circle-answers">{QUESTIONS.map(q => <li key={q.field}><span>{q.text}</span><strong>{answers?.[q.field] || '未填写'}</strong></li>)}</ol>;
}
