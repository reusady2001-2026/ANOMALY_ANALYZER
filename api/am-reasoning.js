const CF_URL = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.CF_D1_DATABASE_ID}/query`;
const CF_TOKEN = process.env.CF_API_TOKEN;
const FRED_KEY = process.env.FRED_KEY;

async function d1(sql, params = []) {
  const r = await fetch(CF_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params })
  });
  const j = await r.json();
  if (!j.success) throw new Error(JSON.stringify(j.errors));
  return j.result[0].results;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STATE_CENTROIDS = {
  'AL':[32.8,-86.8],'AK':[64.2,-153.4],'AZ':[34.3,-111.1],'AR':[34.9,-92.4],
  'CA':[36.8,-119.4],'CO':[39.0,-105.5],'CT':[41.6,-72.7],'DE':[39.0,-75.5],
  'FL':[28.7,-82.5],'GA':[32.2,-83.4],'HI':[20.3,-156.4],'ID':[44.4,-114.6],
  'IL':[40.0,-89.2],'IN':[39.8,-86.1],'IA':[42.1,-93.5],'KS':[38.5,-98.4],
  'KY':[37.5,-85.3],'LA':[31.1,-91.9],'ME':[45.4,-69.2],'MD':[39.1,-76.8],
  'MA':[42.2,-71.5],'MI':[44.3,-85.4],'MN':[46.4,-93.1],'MS':[32.7,-89.7],
  'MO':[38.5,-92.5],'MT':[47.0,-109.6],'NE':[41.5,-99.9],'NV':[39.3,-116.6],
  'NH':[43.7,-71.6],'NJ':[40.1,-74.7],'NM':[34.4,-106.1],'NY':[42.9,-75.5],
  'NC':[35.5,-79.8],'ND':[47.5,-100.5],'OH':[40.4,-82.8],'OK':[35.6,-96.9],
  'OR':[44.6,-122.1],'PA':[40.6,-77.2],'RI':[41.7,-71.5],'SC':[33.9,-80.9],
  'SD':[44.4,-100.2],'TN':[35.8,-86.3],'TX':[31.5,-99.3],'UT':[39.3,-111.1],
  'VT':[44.1,-72.7],'VA':[37.8,-78.2],'WA':[47.4,-120.4],'WV':[38.6,-80.6],
  'WI':[44.3,-89.8],'WY':[43.0,-107.6]
};

const FRED_UR_MAP = {
  'NJ':'NJUR','NY':'NYUR','CA':'CAUR','TX':'TXUR','FL':'FLUR','PA':'PAUR',
  'IL':'ILUR','OH':'OHUR','GA':'GAUR','NC':'NCUR','MI':'MIUR','VA':'VAUR',
  'WA':'WAUR','AZ':'AZUR','MA':'MAUR','TN':'TNUR','IN':'INUR','MO':'MOUR',
  'MD':'MDUR','WI':'WIUR','CO':'COUR','MN':'MNUR','SC':'SCUR','AL':'ALUR',
  'LA':'LAUR','KY':'KYUR','OR':'ORUR','OK':'OKUR','CT':'CTUR','IA':'IAUR',
  'UT':'UTUR','NV':'NVUR','AR':'ARUR','MS':'MSUR','KS':'KSUR','NM':'NMUR',
  'NE':'NEUR','WV':'WVUR','ID':'IDUR','HI':'HIUR','NH':'NHUR','ME':'MEUR',
  'RI':'RIUR','MT':'MTUR','DE':'DEUR','SD':'SDUR','ND':'NDUR','AK':'AKUR',
  'VT':'VTUR','WY':'WYUR',
};

const STATE_REGIONS = {
  Northeast: ['ME','NH','VT','MA','RI','CT','NY','NJ','PA'],
  Southeast: ['DE','MD','VA','WV','NC','SC','GA','FL','AL','MS','TN','KY','AR','LA'],
  Midwest:   ['OH','IN','IL','MI','WI','MN','IA','MO','ND','SD','NE','KS'],
  Southwest: ['TX','OK','NM','AZ'],
  West:      ['CO','WY','MT','ID','WA','OR','CA','NV','UT','AK','HI'],
};

function getRegion(stateAbbr) {
  for (const [region, states] of Object.entries(STATE_REGIONS)) {
    if (states.includes(stateAbbr)) return region;
  }
  return 'Unknown';
}

function parseMonthLabel(label) {
  const parts = (label || '').split(' ');
  const mo = MONTH_NAMES.indexOf(parts[0]);
  const yr = parseInt(parts[1]);
  if (mo < 0 || isNaN(yr)) return null;
  return { month: mo + 1, year: yr, date: new Date(yr, mo, 1) };
}

module.exports = async function handler(req, res) {
  res.status(200).json({ ok: true });
};
