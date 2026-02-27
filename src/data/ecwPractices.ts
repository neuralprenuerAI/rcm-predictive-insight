export interface EcwPractice {
  id: string;
  name: string;
  city: string;
  state: string;
  fhir_url: string;
}

let cachedPractices: EcwPractice[] | null = null;
let loadingPromise: Promise<EcwPractice[]> | null = null;

async function loadPractices(): Promise<EcwPractice[]> {
  if (cachedPractices) return cachedPractices;
  if (loadingPromise) return loadingPromise;

  loadingPromise = fetch("/data/practiceList.json")
    .then((res) => res.json())
    .then((json: any) => {
      const practices: EcwPractice[] = [];
      const entries: any[] = json.entry || [];

      for (const entry of entries) {
        const r = entry.resource;
        if (r?.resourceType === "Organization") {
          const addr = r.address?.[0];
          practices.push({
            id: r.id,
            name: (r.name || "").trim(),
            city: (addr?.city || "").trim(),
            state: (addr?.state || "").trim(),
            fhir_url: `https://fhir4.eclinicalworks.com/fhir/r4/${r.id}`,
          });
        }
      }

      // Sort alphabetically by name
      practices.sort((a, b) => a.name.localeCompare(b.name));
      cachedPractices = practices;
      return practices;
    });

  return loadingPromise;
}

export async function searchPractices(
  query: string,
  limit = 20
): Promise<EcwPractice[]> {
  const practices = await loadPractices();
  if (!query || query.length < 2) return [];

  const q = query.toLowerCase();
  const results: EcwPractice[] = [];

  for (const p of practices) {
    if (
      p.name.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q)
    ) {
      results.push(p);
      if (results.length >= limit) break;
    }
  }

  return results;
}
