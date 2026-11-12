// A small coloured label showing where a recording is in the pipeline.
const STYLES = {
  INCOMPLETE: ['Incomplete upload', 'bg-amber-100 text-amber-800'],
  UPLOADED: ['Uploaded', 'bg-slate-100 text-slate-700'],
  TRANSCRIBING: ['Transcribing', 'bg-blue-100 text-blue-800'],
  TRANSLATING: ['Translating', 'bg-purple-100 text-purple-800'],
  COMPLETED: ['Completed', 'bg-green-100 text-green-800'],
};

export default function StatusBadge({ uploadStatus, stage }) {
  const key = uploadStatus === 'PENDING' ? 'INCOMPLETE' : stage;
  const [label, style] = STYLES[key] || STYLES.UPLOADED;
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
}
