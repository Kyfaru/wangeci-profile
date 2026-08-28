/**
 * State/county cascade helper for the signup form's country -> state
 * dropdown. Calls the free countriesnow.space public API directly from the
 * client — this is intentionally NOT one of our own `/api/**` mocks, since
 * it's a third-party lookup with no backend involvement either way.
 *
 * Network failure here must never crash the signup form: callers get back
 * an empty `states` array plus an `error` string, and should render the
 * state dropdown disabled/empty with that error rather than throwing.
 */

const COUNTRIES_NOW_STATES_URL =
  "https://countriesnow.space/api/v0.1/countries/states";

export interface CountryState {
  name: string;
  stateCode?: string;
}

export interface FetchStatesResult {
  states: CountryState[];
  error: string | null;
}

interface CountriesNowStatesResponse {
  error: boolean;
  msg?: string;
  data?: {
    name: string;
    iso3?: string;
    states: Array<{ name: string; state_code?: string }>;
  };
}

/**
 * Fetch the states/provinces for a country by its common name (e.g. "Kenya",
 * matching the `name` field in lib/countries.json).
 */
export async function fetchStatesForCountry(
  countryName: string
): Promise<FetchStatesResult> {
  if (!countryName.trim()) {
    return { states: [], error: null };
  }

  try {
    const res = await fetch(COUNTRIES_NOW_STATES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: countryName }),
    });

    if (!res.ok) {
      return {
        states: [],
        error: `Could not load states (HTTP ${res.status}).`,
      };
    }

    const json = (await res.json()) as CountriesNowStatesResponse;

    if (json.error) {
      return { states: [], error: json.msg ?? "Could not load states." };
    }

    const states = (json.data?.states ?? []).map((s) => ({
      name: s.name,
      stateCode: s.state_code,
    }));

    return { states, error: null };
  } catch {
    // Network failure, CORS issue, malformed JSON, etc. — never throw out
    // of a signup form for a non-essential dropdown.
    return {
      states: [],
      error: "Couldn't reach the states lookup service. You can skip this field.",
    };
  }
}
