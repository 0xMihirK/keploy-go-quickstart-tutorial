/** Ubuntu-style shell prompt: you@dev:~/path$ */
export function Prompt({ cwd }: { cwd: string }) {
  return (
    <span className="select-none">
      <span className="font-semibold text-[#4fd18b]">you@dev</span>
      <span className="text-tape-ink">:</span>
      <span className="font-semibold text-[#6ca8ff]">{cwd}</span>
      <span className="text-tape-ink">$ </span>
    </span>
  );
}
