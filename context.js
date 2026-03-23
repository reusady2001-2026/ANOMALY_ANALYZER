// ============================================================
// CONTEXT.JS — Location data, 12 API sources, caching
// ============================================================
 
const Context = (() => {
 
  // ── API KEYS ──────────────────────────────────────────
  const FRED_KEY       = 'a784c4a11b636eb4253d10ccf14f7cd0';
  const CONGRESS_KEY   = 'VKeyPI7SqLbHOnLdr09tLbm7ovW5KaLRpmselZcA';
  const OPENSTATES_KEY = 'd1569205-70c8-4f68-9387-f21d93d08c1f';
  const BLS_KEY        = '03fd19cf0a1b409c86028ac06b437e4a';
  const EIA_KEY        = 'SQQpyIUFK9V8JYbnMRxMQp2E38K7dn5qU4LHYqPy';
  const NCDC_TOKEN     = 'rxFHQHbyjIVAfhlAcIpvxLjfwZYTDZKa';
  // No keys: FEMA, Census, HUD, NWS, Census Permits, Open-Meteo
 
  // ── STATE ABBREVIATION MAP ────────────────────────────
  const STATE_ABBR = {
    'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
    'Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA',
    'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA',
    'Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD',
    'Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO',
    'Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ',
    'New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH',
    'Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC',
    'South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT',
    'Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY',
  };
 
  const STATES = Object.keys(STATE_ABBR);
 
  // ── FRED STATE UNEMPLOYMENT SERIES ────────────────────
  const FRED_UR = {
    'AL':'ALUR','AK':'AKUR','AZ':'AZUR','AR':'ARUR','CA':'CAUR','CO':'COUR','CT':'CTUR',
    'DE':'DEUR','FL':'FLUR','GA':'GAUR','HI':'HIUR','ID':'IDUR','IL':'ILUR','IN':'INUR',
    'IA':'IAUR','KS':'KSUR','KY':'KYUR','LA':'LAUR','ME':'MEUR','MD':'MDUR','MA':'MAUR',
    'MI':'MIUR','MN':'MNUR','MS':'MSUR','MO':'MOUR','MT':'MTUR','NE':'NEUR','NV':'NVUR',
    'NH':'NHUR','NJ':'NJUR','NM':'NMUR','NY':'NYUR','NC':'NCUR','ND':'NDUR','OH':'OHUR',
    'OK':'OKUR','OR':'ORUR','PA':'PAUR','RI':'RIUR','SC':'SCUR','SD':'SDUR','TN':'TNUR',
    'TX':'TXUR','UT':'UTUR','VT':'VTUR','VA':'VAUR','WA':'WAUR','WV':'WVUR','WI':'WIUR',
    'WY':'WYUR',
  };
 
  // ── STATE FIPS CODES ──────────────────────────────────
  const STATE_FIPS = {
    'AL':'01','AK':'02','AZ':'04','AR':'05','CA':'06','CO':'08','CT':'09','DE':'10',
    'FL':'12','GA':'13','HI':'15','ID':'16','IL':'17','IN':'18','IA':'19','KS':'20',
    'KY':'21','LA':'22','ME':'23','MD':'24','MA':'25','MI':'26','MN':'27','MS':'28',
    'MO':'29','MT':'30','NE':'31','NV':'32','NH':'33','NJ':'34','NM':'35','NY':'36',
    'NC':'37','ND':'38','OH':'39','OK':'40','OR':'41','PA':'42','RI':'44','SC':'45',
    'SD':'46','TN':'47','TX':'48','UT':'49','VT':'50','VA':'51','WA':'53','WV':'54',
    'WI':'55','WY':'56',
  };
 
  // ── BLS STATE AREA CODES (for CPI regional) ───────────
  const BLS_AREA = {
    'Northeast':'CUUR0100SA0','South':'CUUR0300SA0','Midwest':'CUUR0200SA0','West':'CUUR0400SA0',
  };
  const STATE_REGION = {
    'CT':'Northeast','ME':'Northeast','MA':'Northeast','NH':'Northeast','NJ':'Northeast','NY':'Northeast','PA':'Northeast','RI':'Northeast','VT':'Northeast',
    'IL':'Midwest','IN':'Midwest','IA':'Midwest','KS':'Midwest','MI':'Midwest','MN':'Midwest','MO':'Midwest','NE':'Midwest','ND':'Midwest','OH':'Midwest','SD':'Midwest','WI':'Midwest',
    'AL':'South','AR':'South','DE':'South','FL':'South','GA':'South','KY':'South','LA':'South','MD':'South','MS':'South','NC':'South','OK':'South','SC':'South','TN':'South','TX':'South','VA':'South','WV':'South',
    'AK':'West','AZ':'West','CA':'West','CO':'West','HI':'West','ID':'West','MT':'West','NV':'West','NM':'West','OR':'West','UT':'West','WA':'West','WY':'West',
  };
 
  // ── EIA STATE CODES ───────────────────────────────────
  const EIA_STATE = STATE_ABBR; // same codes
 
  // ── CACHE ─────────────────────────────────────────────
  const CACHE_KEY = 'oaas_context_cache';
  function _cacheKey(st, city, months) {
    return `${st}_${city}_${months[0]}_${months[months.length-1]}`;
  }
  function loadCache(key) {
    try { const all = JSON.parse(localStorage.getItem(CACHE_KEY)||'{}'); return all[key]||null; } catch { return null; }
  }
  function saveCache(key, val) {
    try {
      const all = JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');
      all[key] = val;
      const keys = Object.keys(all);
      keys.slice(10).forEach(k => delete all[k]);
      localStorage.setItem(CACHE_KEY, JSON.stringify(all));
    } catch {}
  }
 
  // ── DATE UTILITIES ────────────────────────────────────
  const MO_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 
  function monthLabelToDate(label) {
    if (!label) return null;
    const parts = String(label).split(' ');
    const m = MO_ABBR.indexOf(parts[0]);
    const y = parseInt(parts[1]);
    if (m < 0 || isNaN(y)) return null;
    return new Date(y, m, 1);
  }
 
  function dateToMonthLabel(d) { return `${MO_ABBR[d.getMonth()]} ${d.getFullYear()}`; }
 
  function toISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
 
  function getDateRange(months) {
    if (!months || !months.length) return {};
    const first = monthLabelToDate(months[0]);
    const last  = monthLabelToDate(months[months.length-1]);
    if (!first || !last) return {};
    const lookback = new Date(first.getFullYear(), first.getMonth()-13, 1);
    const endDate  = new Date(last.getFullYear(), last.getMonth()+1, 0);
    return { startDate: toISO(lookback), endDate: toISO(endDate) };
  }
 
  // ── FETCH HELPER ──────────────────────────────────────
  function fetchWithTimeout(url, ms, opts) {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), ms || 12000);
    return fetch(url, { signal: ctrl.signal, ...opts }).finally(() => clearTimeout(tid));
  }
 
  // ════════════════════════════════════════════════════════
  // SOURCE 1: FRED — Fed Funds, CPI, Rent CPI, Housing Starts, Mortgage, State Unemployment
  // ════════════════════════════════════════════════════════
  async function fetchFREDSeries(seriesId, startDate, endDate) {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&observation_start=${startDate}&observation_end=${endDate}&api_key=${FRED_KEY}&file_type=json`;
    const resp = await fetchWithTimeout(url, 9000);
    if (!resp.ok) throw new Error(`FRED ${seriesId}: HTTP ${resp.status}`);
    const json = await resp.json();
    const map = {};
    (json.observations || []).forEach(obs => {
      if (!obs.value || obs.value === '.') return;
      const d = new Date(obs.date + 'T00:00:00');
      map[dateToMonthLabel(d)] = parseFloat(obs.value);
    });
    return map;
  }
 
  async function fetchFRED(stateAbbr, startDate, endDate) {
    const urCode = FRED_UR[stateAbbr];
    const series = [
      ['FEDFUNDS','fedfunds'], ['CPIAUCSL','cpi'], ['CUUR0000SEHC','rentCPI'],
      ['HOUST','housingStarts'], ['MORTGAGE30US','mortgage30'],
    ];
    if (urCode) series.push([urCode, 'stateUR']);
    const settled = await Promise.allSettled(series.map(([id]) => fetchFREDSeries(id, startDate, endDate)));
    const out = {};
    series.forEach(([,key], i) => { out[key] = settled[i].status === 'fulfilled' ? settled[i].value : {}; });
    return out;
  }
 
  // ════════════════════════════════════════════════════════
  // SOURCE 2: FEMA — Disaster declarations
  // ════════════════════════════════════════════════════════
  async function fetchFEMA(stateAbbr, startDate, endDate) {
    const filter = `state%20eq%20'${stateAbbr}'%20and%20declarationDate%20ge%20'${startDate}'%20and%20declarationDate%20le%20'${endDate}'`;
    const url = `https://www.fema.gov/api/open/v2/disasterDeclarationsSummaries?$filter=${filter}&$orderby=declarationDate%20desc&$top=50&$format=json`;
    const resp = await fetchWithTimeout(url, 9000);
    if (!resp.ok) throw new Error(`FEMA: HTTP ${resp.status}`);
    const json = await resp.json();
    return (json.DisasterDeclarationsSummaries || []).map(d => ({
      title: d.declarationTitle || '', date: (d.declarationDate || '').slice(0,10),
      type: d.incidentType || '', number: String(d.disasterNumber || ''),
    }));
  }
 
  // ════════════════════════════════════════════════════════
  // SOURCE 3: CONGRESS.GOV — Federal housing legislation
  // ════════════════════════════════════════════════════════
  async function fetchCongress(startDate, endDate) {
    const terms = 'housing rent "real estate" multifamily "property tax" mortgage eviction zoning';
    const url = `https://api.congress.gov/v3/bill?query=${encodeURIComponent(terms)}&fromDateTime=${startDate}T00:00:00Z&toDateTime=${endDate}T23:59:59Z&sort=updateDate+desc&limit=20&api_key=${CONGRESS_KEY}`;
    const resp = await fetchWithTimeout(url, 9000);
    if (!resp.ok) throw new Error(`Congress: HTTP ${resp.status}`);
    const json = await resp.json();
    return (json.bills || []).map(b => ({
      title: b.title || '', number: `${b.type || ''}${b.number || ''}`,
      introduced: (b.introducedDate || '').slice(0,10),
    }));
  }
 
  // ════════════════════════════════════════════════════════
  // SOURCE 4: OPENSTATES — State housing legislation
  // ════════════════════════════════════════════════════════
  async function fetchOpenStates(stateName, startDate, endDate) {
    const query = `query { bills(jurisdiction:"${stateName}", searchQuery:"housing rent property tax landlord tenant", first:20, updatedSince:"${startDate}") { edges { node { title identifier createdAt } } } }`;
    const resp = await fetchWithTimeout('https://v3.openstates.org/graphql', 9000, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-KEY': OPENSTATES_KEY },
      body: JSON.stringify({ query }),
    });
    if (!resp.ok) throw new Error(`OpenStates: HTTP ${resp.status}`);
    const json = await resp.json();
    return (json.data?.bills?.edges || []).map(e => ({
      title: e.node.title || '', introduced: (e.node.createdAt || '').slice(0,10),
    }));
  }
 
  // ════════════════════════════════════════════════════════
  // SOURCE 5: CENSUS ACS — Population, income, renter ratio
  // ════════════════════════════════════════════════════════
  async function fetchCensus(stateAbbr, city) {
    const fips = STATE_FIPS[stateAbbr];
    if (!fips) return {};
    const vars = 'B01003_001E,B19013_001E,B25003_001E,B25003_002E';
    const url = `https://api.census.gov/data/2022/acs/acs5?get=${vars},NAME&for=place:*&in=state:${fips}`;
    const resp = await fetchWithTimeout(url, 12000);
    if (!resp.ok) throw new Error(`Census: HTTP ${resp.status}`);
    const rows = await resp.json();
    const header = rows[0];
    const cityLower = (city || '').toLowerCase();
    const match = rows.slice(1).find(r => String(r[header.indexOf('NAME')]||'').toLowerCase().includes(cityLower));
    if (!match) return {};
    const get = key => { const i = header.indexOf(key); return i >= 0 ? parseInt(match[i]) || null : null; };
    const renters = get('B25003_002E'), total = get('B25003_001E');
    return {
      population: get('B01003_001E'), medianIncome: get('B19013_001E'),
      renterUnits: renters, totalHousingUnits: total,
      renterRatio: (renters && total) ? renters / total : null,
    };
  }
 
  // ════════════════════════════════════════════════════════
  // SOURCE 6: HUD — Fair Market Rents
  // ════════════════════════════════════════════════════════
  async function fetchHUD(stateAbbr) {
    const url = `https://www.huduser.gov/hudapi/public/fmr/statedata/${stateAbbr}`;
    const resp = await fetchWithTimeout(url, 9000);
    if (!resp.ok) throw new Error(`HUD: HTTP ${resp.status}`);
    const json = await resp.json();
    return { year: json.year || null, rows: (json.data || []).slice(0,5) };
  }
 
  // ════════════════════════════════════════════════════════
  // SOURCE 7: BLS — Regional CPI, construction costs, wages
  // ════════════════════════════════════════════════════════
  async function fetchBLS(stateAbbr, startDate, endDate) {
    const startYear = parseInt(startDate.slice(0,4));
    const endYear = parseInt(endDate.slice(0,4));
    const region = STATE_REGION[stateAbbr] || 'South';
    const regionalCPI = BLS_AREA[region] || 'CUUR0300SA0';
 
    // Series: regional CPI, construction cost index, avg hourly earnings (maintenance workers)
    const seriesIds = [
      regionalCPI,           // Regional CPI
      'CUUR0000SA0L2',       // CPI: Housing component (national)
      'CUSR0000SEHF01',      // CPI: Electricity (national)
      'CUSR0000SEHF02',      // CPI: Utility gas (national)
      'PCU236222236222',     // PPI: Multifamily construction
    ];
 
    const body = JSON.stringify({
      seriesid: seriesIds,
      startyear: String(startYear),
      endyear: String(endYear),
      registrationkey: BLS_KEY,
    });
 
    const resp = await fetchWithTimeout('https://api.bls.gov/publicAPI/v2/timeseries/data/', 12000, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    });
    if (!resp.ok) throw new Error(`BLS: HTTP ${resp.status}`);
    const json = await resp.json();
 
    const out = {};
    const names = ['regionalCPI','housingCPI','electricityCPI','gasCPI','constructionPPI'];
    (json.Results?.series || []).forEach((s, i) => {
      const map = {};
      (s.data || []).forEach(d => {
        const moIdx = parseInt(d.period.replace('M','')) - 1;
        if (moIdx >= 0 && moIdx < 12) {
          map[`${MO_ABBR[moIdx]} ${d.year}`] = parseFloat(d.value);
        }
      });
      out[names[i] || `series_${i}`] = map;
    });
    return out;
  }
 
  // ════════════════════════════════════════════════════════
  // SOURCE 8: EIA — State electricity & gas prices
  // ════════════════════════════════════════════════════════
  async function fetchEIA(stateAbbr, startDate, endDate) {
    const out = {};
 
    // Residential electricity price by state
    try {
      const url = `https://api.eia.gov/v2/electricity/retail-sales/data?api_key=${EIA_KEY}&data[]=price&facets[sectorid][]=RES&facets[stateid][]=${stateAbbr}&start=${startDate.slice(0,7)}&end=${endDate.slice(0,7)}&frequency=monthly&sort[0][column]=period&sort[0][direction]=asc`;
      const resp = await fetchWithTimeout(url, 12000);
      if (resp.ok) {
        const json = await resp.json();
        const map = {};
        (json.response?.data || []).forEach(d => {
          const parts = d.period.split('-');
          const moIdx = parseInt(parts[1]) - 1;
          if (moIdx >= 0 && moIdx < 12) map[`${MO_ABBR[moIdx]} ${parts[0]}`] = parseFloat(d.price);
        });
        out.electricityPrice = map;
      }
    } catch {}
 
    // Natural gas residential price by state
    try {
      const url = `https://api.eia.gov/v2/natural-gas/pri/sum/data?api_key=${EIA_KEY}&data[]=value&facets[process][]=PRS&facets[duession][]=STA&facets[area-name][]=${stateAbbr}&start=${startDate.slice(0,4)}&end=${endDate.slice(0,4)}&frequency=monthly`;
      const resp = await fetchWithTimeout(url, 12000);
      if (resp.ok) {
        const json = await resp.json();
        const map = {};
        (json.response?.data || []).forEach(d => {
          if (d.period) {
            const parts = d.period.split('-');
            const moIdx = parseInt(parts[1]) - 1;
            if (moIdx >= 0 && moIdx < 12) map[`${MO_ABBR[moIdx]} ${parts[0]}`] = parseFloat(d.value);
          }
        });
        out.gasPrice = map;
      }
    } catch {}
 
    return out;
  }
 
  // ════════════════════════════════════════════════════════
  // SOURCE 9: NOAA/NWS — Weather alerts for state
  // ════════════════════════════════════════════════════════
  async function fetchNWS(stateAbbr) {
    // NWS only has current/recent alerts — useful for recent anomalies
    try {
      const url = `https://api.weather.gov/alerts/active?area=${stateAbbr}`;
      const resp = await fetchWithTimeout(url, 9000, {
        headers: { 'User-Agent': 'AnomalyAnalyzer/1.0' }
      });
      if (!resp.ok) return [];
      const json = await resp.json();
      return (json.features || []).slice(0, 20).map(f => ({
        event: f.properties?.event || '',
        headline: f.properties?.headline || '',
        severity: f.properties?.severity || '',
        onset: (f.properties?.onset || '').slice(0, 10),
        expires: (f.properties?.expires || '').slice(0, 10),
      }));
    } catch { return []; }
  }
 
  // ════════════════════════════════════════════════════════
  // SOURCE 10: OPEN-METEO — Historical weather (temp, precip, snow)
  // ════════════════════════════════════════════════════════
  async function fetchOpenMeteo(city, stateAbbr, startDate, endDate) {
    // First geocode the city
    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city + ' ' + stateAbbr)}&count=1&language=en&format=json`;
      const geoResp = await fetchWithTimeout(geoUrl, 6000);
      if (!geoResp.ok) return {};
      const geoJson = await geoResp.json();
      const loc = geoJson.results?.[0];
      if (!loc) return {};
 
      const lat = loc.latitude;
      const lon = loc.longitude;
 
      // Historical daily aggregates → we'll get monthly means
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum&timezone=America%2FNew_York`;
      const resp = await fetchWithTimeout(url, 15000);
      if (!resp.ok) return {};
      const json = await resp.json();
 
      // Aggregate to monthly
      const monthly = {};
      const days = json.daily?.time || [];
      const tmax = json.daily?.temperature_2m_max || [];
      const tmin = json.daily?.temperature_2m_min || [];
      const precip = json.daily?.precipitation_sum || [];
      const snow = json.daily?.snowfall_sum || [];
 
      days.forEach((day, i) => {
        const d = new Date(day + 'T00:00:00');
        const label = dateToMonthLabel(d);
        if (!monthly[label]) monthly[label] = { temps: [], precip: 0, snow: 0, days: 0 };
        const m = monthly[label];
        if (tmax[i] != null && tmin[i] != null) m.temps.push((tmax[i] + tmin[i]) / 2);
        if (precip[i] != null) m.precip += precip[i];
        if (snow[i] != null) m.snow += snow[i];
        m.days++;
      });
 
      // Convert to final format
      const result = {};
      Object.entries(monthly).forEach(([label, m]) => {
        result[label] = {
          avgTemp: m.temps.length ? m.temps.reduce((a,b)=>a+b,0)/m.temps.length : null,
          totalPrecip: m.precip,
          totalSnow: m.snow,
          days: m.days,
        };
      });
      return result;
    } catch { return {}; }
  }
 
  // ════════════════════════════════════════════════════════
  // SOURCE 11: NCDC — Climate extremes (heating/cooling degree days)
  // ════════════════════════════════════════════════════════
  async function fetchNCDC(stateAbbr, startDate, endDate) {
    try {
      const fips = STATE_FIPS[stateAbbr];
      if (!fips) return {};
      const url = `https://www.ncei.noaa.gov/cdo-web/api/v2/data?datasetid=GSOM&datatypeid=HTDD,CLDD,EMXT,EMNT,TPCP,SNOW&locationid=FIPS:${fips}&startdate=${startDate}&enddate=${endDate}&units=standard&limit=1000`;
      const resp = await fetchWithTimeout(url, 12000, {
        headers: { token: NCDC_TOKEN }
      });
      if (!resp.ok) return {};
      const json = await resp.json();
 
      const result = {};
      (json.results || []).forEach(r => {
        const d = new Date(r.date + 'T00:00:00');
        const label = dateToMonthLabel(d);
        if (!result[label]) result[label] = {};
        const type = r.datatype;
        if (type === 'HTDD') result[label].heatingDegreeDays = r.value;
        if (type === 'CLDD') result[label].coolingDegreeDays = r.value;
        if (type === 'EMXT') result[label].extremeMaxTemp = r.value;
        if (type === 'EMNT') result[label].extremeMinTemp = r.value;
        if (type === 'TPCP') result[label].totalPrecip = r.value;
        if (type === 'SNOW') result[label].totalSnow = r.value;
      });
      return result;
    } catch { return {}; }
  }
 
  // ════════════════════════════════════════════════════════
  // SOURCE 12: CENSUS BUILDING PERMITS — New construction
  // ════════════════════════════════════════════════════════
  async function fetchBuildingPermits(stateAbbr, startDate, endDate) {
    try {
      const fips = STATE_FIPS[stateAbbr];
      if (!fips) return {};
      const startYear = parseInt(startDate.slice(0,4));
      const endYear = parseInt(endDate.slice(0,4));
 
      // Annual building permits by state
      const url = `https://api.census.gov/data/timeseries/bps/hph?get=PERMITS&for=state:${fips}&time=from+${startYear}+to+${endYear}&category_code=TOTAL`;
      const resp = await fetchWithTimeout(url, 12000);
      if (!resp.ok) return {};
      const rows = await resp.json();
      const header = rows[0];
      const permitsIdx = header.indexOf('PERMITS');
      const timeIdx = header.indexOf('time');
      const result = {};
      rows.slice(1).forEach(r => {
        if (r[timeIdx] && r[permitsIdx]) {
          result[r[timeIdx]] = parseInt(r[permitsIdx]) || 0;
        }
      });
      return result;
    } catch { return {}; }
  }
 
  // ════════════════════════════════════════════════════════
  // MAIN ENTRY POINT — Fetch all 12 sources
  // ════════════════════════════════════════════════════════
  async function fetchDataContext(stateAbbr, city, months, onProgress) {
    const ck = _cacheKey(stateAbbr, city, months);
    const cached = loadCache(ck);
    if (cached) return cached;
 
    const { startDate, endDate } = getDateRange(months);
    if (!startDate || !endDate) return {};
 
    const stateName = Object.entries(STATE_ABBR).find(([,a]) => a === stateAbbr)?.[0] || stateAbbr;
 
    if (onProgress) onProgress('Fetching economic & environmental context...');
 
    const [fredR, femaR, congressR, osR, censusR, hudR, blsR, eiaR, nwsR, meteoR, ncdcR, permitsR] =
      await Promise.allSettled([
        fetchFRED(stateAbbr, startDate, endDate),           // 1
        fetchFEMA(stateAbbr, startDate, endDate),            // 2
        fetchCongress(startDate, endDate),                    // 3
        fetchOpenStates(stateName, startDate, endDate),       // 4
        fetchCensus(stateAbbr, city),                         // 5
        fetchHUD(stateAbbr),                                  // 6
        fetchBLS(stateAbbr, startDate, endDate),              // 7
        fetchEIA(stateAbbr, startDate, endDate),              // 8
        fetchNWS(stateAbbr),                                  // 9
        fetchOpenMeteo(city, stateAbbr, startDate, endDate),  // 10
        fetchNCDC(stateAbbr, startDate, endDate),             // 11
        fetchBuildingPermits(stateAbbr, startDate, endDate),  // 12
      ]);
 
    const ctx = {
      stateAbbr, stateName, city,
      startDate, endDate,
      fetchedAt: Date.now(),
      fred:           fredR.status     === 'fulfilled' ? fredR.value       : {},
      fema:           femaR.status     === 'fulfilled' ? femaR.value       : [],
      congress:       congressR.status === 'fulfilled' ? congressR.value   : [],
      openStates:     osR.status       === 'fulfilled' ? osR.value         : [],
      census:         censusR.status   === 'fulfilled' ? censusR.value     : {},
      hud:            hudR.status      === 'fulfilled' ? hudR.value        : {},
      bls:            blsR.status      === 'fulfilled' ? blsR.value        : {},
      eia:            eiaR.status      === 'fulfilled' ? eiaR.value        : {},
      nwsAlerts:      nwsR.status      === 'fulfilled' ? nwsR.value        : [],
      weather:        meteoR.status    === 'fulfilled' ? meteoR.value      : {},
      climate:        ncdcR.status     === 'fulfilled' ? ncdcR.value       : {},
      buildingPermits: permitsR.status === 'fulfilled' ? permitsR.value    : {},
    };
 
    saveCache(ck, ctx);
    return ctx;
  }
 
  // ── PUBLIC ────────────────────────────────────────────
  return {
    STATES,
    STATE_ABBR,
    STATE_FIPS,
    fetchDataContext,
    monthLabelToDate,
    dateToMonthLabel,
  };
 
})();
