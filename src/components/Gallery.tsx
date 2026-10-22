import business from '../business.json'
import CarPhoto from './CarPhoto'
import { cn } from '../lib/cn'

type Work = { photo: string; caption: string }
const WORKS = (business.gallery ?? []) as Work[]

function Figure({ work, className, ratio }: { work: Work; className?: string; ratio: string }) {
  return (
    <figure className={className}>
      <div
        className={cn(
          'group relative overflow-hidden rounded-3xl border border-white/5 bg-zinc-900/40 transition-[border-color,scale] duration-300 hover:border-white/20 hover:scale-[1.01]',
          ratio
        )}
      >
        <CarPhoto
          src={work.photo}
          alt={work.caption}
          className="transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
      </div>
      <figcaption className="mt-2 text-sm text-zinc-500">{work.caption}</figcaption>
    </figure>
  )
}

/** «Работы студии»: одна широкая фотография сверху и две квадратные под ней */
export default function Gallery() {
  if (WORKS.length === 0) return null
  const [wide, ...squares] = WORKS

  return (
    <section id="works" className="scroll-mt-4" aria-labelledby="works-title">
      <h2 id="works-title" className="mb-3 px-1 text-xl font-semibold text-white">
        Работы студии
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <Figure work={wide} ratio="aspect-[2/1]" className="col-span-2" />
        {squares.slice(0, 2).map((w) => (
          <Figure key={w.caption} work={w} ratio="aspect-square" />
        ))}
      </div>
    </section>
  )
}
