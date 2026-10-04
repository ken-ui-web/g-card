export function LoadingState({ text }: { text: string }) {
  return <div className="loading-state" role="status" aria-live="polite"><span className="loading-state__spinner" aria-hidden="true" /><span>{text}</span><span className="loading-state__dots" aria-hidden="true"><i /><i /><i /></span></div>;
}
