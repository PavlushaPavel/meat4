import type { Block } from '@/content/types';

/**
 * Отрисовка блоков длинного чтения на распечатке.
 *
 * Ритм авторского текста — короткие абзацы, часто в одно предложение. Каждый
 * абзац остаётся отдельным блоком: склеивать их в плотные куски запрещено, на
 * этом ритме держится подача (docs/SPEC.md §4.2).
 */
export function Blocks({ blocks }: { blocks: readonly Block[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'p':
      return <p className="text-base leading-relaxed">{block.text}</p>;

    case 'quote':
      // Чужой или внутренний голос: отбит линейкой слева, как пометка на полях.
      return (
        <p className="border-l-2 border-paper-line pl-4 italic text-paper-ink-dim">
          {block.text}
        </p>
      );

    case 'lead':
      // Одно крупное утверждение на раздел — то, ради чего написан кусок.
      return (
        <p className="font-display text-lead font-semibold uppercase leading-tight tracking-tight text-paper-ink">
          {block.text}
        </p>
      );

    case 'h':
      return (
        <h3 className="pt-2 font-display text-xl font-semibold uppercase leading-tight text-paper-ink">
          {block.text}
        </h3>
      );

    case 'list':
      return (
        <ul className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span aria-hidden="true" className="pt-1.5 text-paper-ink-dim">
                —
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
  }
}
