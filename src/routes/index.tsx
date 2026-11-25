import { getLocationTideScoresFn } from "#/server/tide-scores";
import { createFileRoute } from "@tanstack/react-router";

const DEFAULT_LOCATION_SLUG = "fitzgerald-marine-reserve";

export const Route = createFileRoute("/")({
  loader: () => getLocationTideScoresFn({ data: DEFAULT_LOCATION_SLUG }),
  component: Home,
});

function Home() {
  const result = Route.useLoaderData();

  if (!result.ok) {
    return (
      <div className="p-8">
        <p>{result.error}</p>
      </div>
    );
  }

  const { location, scores } = result.data;

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">{location.name}</h1>
      <p className="mt-2 text-sm text-gray-600">
        {scores.length} prediction slots ({location.timezone})
      </p>
    </div>
  );
}
