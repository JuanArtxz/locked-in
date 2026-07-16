import { Mascot } from './Mascot';

// Boot splash: just the pet and three loading dots — nothing else.
export function Splash() {
  return (
    <div className="animate-fade-in flex h-screen w-screen flex-col items-center justify-center gap-7 bg-bg">
      <div className="animate-mascot-wobble">
        <Mascot mood="happy" size={110} />
      </div>
      <div className="flex gap-2">
        {[0, 1, 2].map((d) => (
          <span
            key={d}
            className="h-2.5 w-2.5 animate-bounce rounded-full bg-accent"
            style={{ animationDelay: `${d * 160}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
