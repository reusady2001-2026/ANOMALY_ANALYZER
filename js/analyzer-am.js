// ══════════════════════════════════════════════════════════════
// SECTION: AM Analyzer UI Module
// ══════════════════════════════════════════════════════════════

const CATEGORY_MAP = {
  'RENTAL INCOME': ['Market Rent','(Loss)/Gain to Lease','Less: Vacancy','Residential Rent','Concession','Military Discount Concession','Preferred Employer Concession','First Responder Concession','Employee Concession','Courtesy Patrol','Rent Adjustment','Preferential Rent','Section 8','Down Units','Admin Units','Model Unit','Month to Month','Seller Arrears','Delinquency'],
  'COST RECOVERY': ['Reimbursed Water/Sewer','Reimbursed Trash','Reimbursed Utilities','Reimbursed Renters Insurance','Reimbursed Utility Fee','Reimbursed Deposit Alternatives','Rev Share','Other Reimbursed costs'],
  'OTHER INCOME': ['Condo Assoc Fee','Estoppel Fee','Marketing Service Agreement','Amenity Fee','Charging Station Income','Legal Fees','Pet Rent','Key Charge','Pet Fee','Pest Control','Laundry','Interest income','Interest Expense','Cable','Parking Income','Transfer Apartment','Late Fees','Bike','Administrative Fee','Cleaning Fee','Furnished Unit Expenses','Lockout Fee','Inspection Fee','Smoking Fee','Damages Fee','Application Fee','Early Termination Fee','Bounced Check Fee','Court Cost','Miscellaneous','Licensing fees','Unallocated Payments','Storage Income'],
  'COMMERCIAL INCOME': ['COMMERCIAL RENT','CAM Income','Antenna Income'],
  'AUTO EXPENSE': ['Vehicle Registration','Auto Leasing','EZ Pass','Gas','Auto Insurance','Parking','Parking Fine','Auto Repairs','Tolls'],
  'GENERAL AND ADMINISTRATIVE': ['Ramp Plus Charges','Bank Service Charges','Clickpay','Yardi expense','Yardi Payment Processing Fees','Deposit Alternative','Renters Insurance','Wire Transfer Fee','Tenant Screening','Travel Expense','Temp Housing','BlueMoon','Tech Costs','Shipping (UPS FEDEX)','Postage','Printing Expense','Escrow Admin Fee','Alert Services/ Security Alarm','Messaging/ Answering Service','Phones/Internet/Cable','Employee Gifts','Food & Entertaiment','Water/ Coffee/ Drinks for Office','Staff Retention & Entertainment','Staff Merchandise','Software Subscriptions','Holiday Party','Seasonal Decorations','Recruiting Expense','Contributions','Affordable Housing Management & Compliance','Legal L & T','Broker of Record (L&T)','Security','Consulting Fees','Corporation Tax','Professional Fees','Union Dues','Office Furniture','Office Supplies','Office Equipment','Financing fee','Office Expense','Training/ Seminars','Uniforms','Property Registration','Fees and Permits','Memberships','Website & Domain Services','Licenses','Miscellaneous Expense','Online Payment Fee'],
  'MANAGEMENT FEES': ['Management Fees'],
  'LEASING & MARKETING': ['Online Marketing Expense','Print Marketing','Marketing Concessions','Resident Pet Program','Marketing Software','Resident Events','Resident Retention','Resident Coffee Station','Other Marketing Expense','Promotion and entertainment','Community Functions','Signage Marketing','Resident Referral','Brokers fee'],
  'ADMIN PAYROLL': ['Payroll - Admin Assistant Property Manager','Assistant Manager','Payroll Taxes - Administrative','Workers Comp - Administrative','Health Insurance - Administrative','Overtime - Administrative','Bonus - Administrative'],
  'LEASING PAYROLL': ['Payroll - Leasing','Leasing Consultant','Payroll Taxes - Leasing','Workers Comp - Leasing','Health Insurance - Leasing','Overtime - Leasing','Bonus - Leasing'],
  'MAINTENANCE PAYROLL': ['Payroll - Maintenance','Maintenance Tech','Payroll Taxes - Maintenance','Workers Comp - Maintenance','Health Insurance - Maintenance','Overtime - Maintenance','Bonus - Maintenance'],
  'PROPERTY MANAGER PAYROLL': ['Payroll - Property Manager'],
  'OTHER PAYROLL': ['Reimbursement - Phones/Gas/Tolls','Payroll Services','Outside Services','Severance Pay'],
  'TAXES AND INSURANCE': ['Property & Liability Insurance','Umbrella Insurance','Flood Insurance','ELPI Insurance','Real Estate Taxes','Consultant'],
  'UTILITIES': ['Electric Expense','Electric Expense - vacant units','Gas Expense','Gas Expense - Vacant Units','Water expense','Sewer Expense','Rubbish Removal/Sanitation','Utility Billing','Recoverable Elec/Gas/Water'],
  'UNIT TURNOVER': ['Unit Turnover - Carpet Cleaning & Repairs','Paint & Plaster Contract','Paint & Plaster Contract - Extra service','Unit Turnover - Painting','Unit Turnover - Cleaning','Unit Turnover - Countertop Repairs','Unit Turnover - Vinyl Repairs','Unit Turnover - Appliances','Unit Turnover - HVAC Repairs','Unit Turnover - Bathroom Repairs','Unit Turnover - Inspection Fees','Unit Turnover - Resurfacing','Unit Turnover - Floor Repairs','Unit Turnover - General Repairs','Unit Turnover - Kitchen Repairs','Unit Turnover - Supplies'],
  'CONTRACT REPAIRS': ['Amazon Locker Lease','Intercom Software Contract','Software Contract','EV Station Software Contract','Exterminating Contract','Exterminating Contract - Extra service','Pool Maintenance Contract','Pool Maintenance Contract - Extra service','Power Washing','Landscaping Contract','Landscaping Contract - Extra service','Concierge Services Contract','Cleaning Contract','Valet Trash','Sprinkler contract','Scent Services Contract','Gym Fees','Peloton Contract','Vent Cleaning','HVAC Contract','Aquarium Servicing Contract','Generator Inspection Contract','Cleaning Contract - Extra service','Shuttle Contract','Flooring & Carpeting Contract','Snow Removal Contract','Snow Removal Contract - Extra service','Pond Treatment Contract','Storage Unit Contract','Washer & Dryer Rental Contract','Fire/Sprinkler Inspections & Monitoring Contract','Fire Alarm Monitoring Contract','Elevator Contract','Security - Live Monitoring Contract'],
  'REPAIRS & MAINTENANCE': ['Elevator Consultant','Plumber - In House','Fire Pump Fuel','Boiler Repairs & Maint','Hot water Heaters','Fitness center repairs/contract','Flooring & Carpeting','Parking Pass','PTAC Repair Parts','Signs and Safety','Welding','Fireplace/Chimney Repairs','Package Locker Service','Fencing','Lead Abatement & Testing','Paint & Plaster','Plumbing Repairs & Maint','Exterior Repairs & Maint','Hallway Cleaning','Interior Repairs & Maint','Elevator Repairs & Maint','Gutter Repairs & Maint','Bathroom Repairs & Maint','Amenities Supplies/Equipment','Amenity Repairs & Maint','Roof Repairs & Maint','Carpet Cleaning','Compactor','Generator Expenses','Landscape Repairs','One time Cleanup','Doors/Garage','Mold','Sewer and Drain Cleaning','Leak Repair','Fire Extinguisher','HVAC Repairs & Maint','HVAC Cleaning','Intercom','Electrical Repairs & Maint','Towing costs','Carpet Repairs & Maint','Golf Cart Repairs & Maint','Security camera','Kitchen supplies','Bathroom Supplies','Plumbing supplies','Paint Supplies','Landscaping Supplies','Tiles','Hardware Supplies','Pool Supplies','Outdoor Sports/Activities/Equipment','Janitorial Supplies','Ground Supplies','Building & Maintenance Supplies','Electrical Supplies','Miscellaneous Supplies','First Aid & Safety Supplies','Appliances','Appliance Parts','Tools','Hvac Parts','Covid19 Expenses','Filters','Elevator Inspections and Permits','Inspections and Permits','Sprinklers','Pool Repairs/Maintenance','Windows/Screens','Window Shades','Locks & Keys','Fire Alarms','Smoke Alarms','Paving','Screen','Environmental Compliance','PO Suspense Expense','Locksmith'],
  'OTHER EXPENSES': ['Parking Lot Lease','Property Inspection','Late Fee','Bad debts expense','Bad Debt Recoveries','Violation Penalty','Violation Removal'],
};

const INCOME_CATEGORIES = new Set(['RENTAL INCOME','COST RECOVERY','OTHER INCOME','COMMERCIAL INCOME']);

// ── groupByCategory ───────────────────────────────────────────
// Maps analyzeAsset() results into per-category monthly totals.
// Returns an array of { categoryName, section, monthTotals[] }
// sorted income categories first, then expense.
function groupByCategory(results) {
  // Build reverse lookup: metric name → category name
  const metricToCategory = new Map();
  for (const [cat, metrics] of Object.entries(CATEGORY_MAP)) {
    for (const m of metrics) metricToCategory.set(m, cat);
  }

  // Accumulate totals per category
  const catMap = new Map(); // categoryName → { categoryName, section, monthTotals[] }

  for (const result of results) {
    if (!result) continue;
    const cat = metricToCategory.get(result.name);
    if (!cat) continue; // metric not in CATEGORY_MAP — skip

    if (!catMap.has(cat)) {
      catMap.set(cat, {
        categoryName: cat,
        section: INCOME_CATEGORIES.has(cat) ? 'income' : 'expense',
        monthTotals: [],
      });
    }

    const entry = catMap.get(cat);

    for (let i = 0; i < result.res.length; i++) {
      const v = result.res[i]?.v;
      if (v == null) continue;
      if (entry.monthTotals[i] == null) entry.monthTotals[i] = 0;
      entry.monthTotals[i] += v;
    }
  }

  // Return as sorted array: income categories first, then expense
  return Array.from(catMap.values()).sort((a, b) => {
    if (a.section !== b.section) return a.section === 'income' ? -1 : 1;
    return a.categoryName.localeCompare(b.categoryName);
  });
}
