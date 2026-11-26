import type { LocationFieldGuide } from "#/lib/location-guide";

type LocationFieldNotesProps = {
  locationName: string;
  guide: LocationFieldGuide;
};

export function LocationFieldNotes({
  locationName,
  guide,
}: LocationFieldNotesProps) {
  return (
    <section
      aria-labelledby="field-notes-heading"
      className="border-t border-line pt-8"
    >
      <div className="max-w-2xl">
        <h2
          id="field-notes-heading"
          className="font-display text-xl font-semibold tracking-tight text-ink"
        >
          Field notes for {locationName}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          {guide.idealThresholdNote}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Planning &amp; access</h3>
          <ul className="mt-2.5 space-y-2.5 p-0 text-sm leading-relaxed text-ink-secondary list-none">
            {guide.accessNotes.map((note, idx) => (
              <li key={idx} className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-mid"
                />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">Safety on the reef</h3>
          <ul className="mt-2.5 space-y-2.5 p-0 text-sm leading-relaxed text-ink-secondary list-none">
            {guide.safetyNotes.map((note, idx) => (
              <li key={idx} className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sun"
                />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">Common intertidal life</h3>
          <p className="mt-2.5 text-sm leading-relaxed text-ink-secondary">
            {guide.summary}
          </p>
          <ul className="mt-3 flex flex-wrap gap-1.5 p-0 list-none">
            {guide.wildlifeHighlights.map((species) => (
              <li
                key={species}
                className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink-secondary"
              >
                {species}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {guide.isPlaceholder && (
        <p className="mt-8 text-xs text-ink-muted">
          Field notes are sample placeholder copy.
        </p>
      )}
    </section>
  );
}
