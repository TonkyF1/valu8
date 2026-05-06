// Curated common UK variant / engine / trim suggestions per make.
// These are used as suggestions in a combobox — users can also type their own.
// Keeping this generic-per-make (rather than per-model) keeps the dataset
// maintainable while still surfacing realistic options for every car.

const COMMON_PETROL = ["1.0 TCe", "1.2 TSI", "1.4 TSI", "1.5 TSI", "1.6 Petrol", "2.0 Petrol"];
const COMMON_DIESEL = ["1.5 dCi", "1.6 HDi", "1.6 TDI", "2.0 TDI", "2.0 HDi", "2.2 TDCi"];
const COMMON_HYBRID = ["Hybrid", "Plug-in Hybrid (PHEV)", "Mild Hybrid"];
const COMMON_EV = ["Electric (Standard Range)", "Electric (Long Range)", "Electric (Performance)"];
const COMMON_TRIMS = ["Base", "Mid-spec", "Top-spec / Sport", "GT Line", "S Line"];

const GENERIC = [...COMMON_PETROL, ...COMMON_DIESEL, ...COMMON_HYBRID, ...COMMON_EV, ...COMMON_TRIMS];

export const MAKE_VARIANTS: Record<string, string[]> = {
  "Audi": ["1.0 TFSI", "1.4 TFSI", "1.5 TFSI", "2.0 TFSI", "2.0 TDI", "3.0 TDI", "S line", "Black Edition", "Vorsprung", "S model", "RS model", "e-tron"],
  "BMW": ["116i", "118i", "118d", "120d", "320i", "320d", "330i", "330e", "520d", "M Sport", "M Sport Pro", "M Performance", "i3", "i4", "iX"],
  "Mercedes-Benz": ["A180", "A200", "A220d", "A35 AMG", "C200", "C220d", "C300", "E220d", "E300", "AMG Line", "AMG Premium", "EQ"],
  "Ford": ["1.0 EcoBoost 100", "1.0 EcoBoost 125", "1.5 EcoBoost", "1.5 TDCi", "2.0 EcoBlue", "ST-Line", "ST-Line X", "Titanium", "Vignale", "ST", "RS"],
  "Volkswagen": ["1.0 TSI", "1.4 TSI", "1.5 TSI", "1.6 TDI", "2.0 TDI", "2.0 TSI", "GTI", "GTD", "R-Line", "R", "Match", "Life", "Style"],
  "Vauxhall": ["1.0 Turbo", "1.2 Turbo", "1.4 Turbo", "1.6 CDTi", "SRi", "SRi Nav", "Elite Nav", "GS Line", "Ultimate", "VXR"],
  "Renault": ["1.0 SCe", "1.0 TCe 90", "1.2 TCe 100", "1.3 TCe 130", "1.5 dCi 90", "1.5 dCi 110", "RS 200", "RS 220 Trophy", "E-Tech Hybrid", "ZE Electric", "Iconic", "RS Line"],
  "Peugeot": ["1.2 PureTech 75", "1.2 PureTech 100", "1.2 PureTech 130", "1.5 BlueHDi 100", "1.5 BlueHDi 130", "GT Line", "GT", "Allure", "Active", "e-208"],
  "Citroën": ["1.2 PureTech", "1.5 BlueHDi", "1.6 BlueHDi", "Feel", "Flair", "Shine", "C-Series", "ë-C4 Electric"],
  "Toyota": ["1.0 VVT-i", "1.2 Turbo", "1.5 Hybrid", "1.8 Hybrid", "2.0 Hybrid", "2.5 Hybrid", "Icon", "Design", "Excel", "GR Sport"],
  "Honda": ["1.0 VTEC Turbo", "1.5 VTEC Turbo", "1.5 i-MMD Hybrid", "2.0 i-MMD Hybrid", "Type R", "SR", "EX", "Sport"],
  "Nissan": ["1.0 DIG-T", "1.3 DIG-T", "1.5 dCi", "1.6 dCi", "e-Power", "Acenta", "N-Connecta", "Tekna", "Tekna+"],
  "Hyundai": ["1.0 T-GDi", "1.2 MPi", "1.4 T-GDi", "1.6 CRDi", "1.6 T-GDi N Line", "Hybrid", "Plug-in Hybrid", "Electric", "SE Connect", "Premium", "Ultimate", "N"],
  "Kia": ["1.0 T-GDi", "1.4 T-GDi", "1.6 CRDi", "1.6 T-GDi GT-Line", "Hybrid", "Plug-in Hybrid", "Electric", "2", "3", "4", "GT-Line S"],
  "MINI": ["One", "Cooper", "Cooper S", "Cooper SD", "John Cooper Works", "Electric", "Classic", "Sport", "Exclusive"],
  "Land Rover": ["2.0 D165", "2.0 D200", "2.0 P250", "3.0 D300", "3.0 P400", "S", "SE", "HSE", "Autobiography", "First Edition"],
  "Jaguar": ["2.0 D180", "2.0 P250", "2.0 P300", "3.0 D300", "R-Dynamic S", "R-Dynamic SE", "R-Dynamic HSE", "SVR"],
  "Porsche": ["Carrera", "Carrera S", "Carrera 4S", "Turbo", "Turbo S", "GTS", "GT3", "Diesel", "S E-Hybrid", "Performance"],
  "Tesla": ["Standard Range Plus", "Long Range", "Performance", "Plaid"],
  "Volvo": ["B3", "B4", "B5", "T6 Recharge", "T8 Recharge", "Momentum", "R-Design", "Inscription", "Ultimate"],
  "Mazda": ["1.5 Skyactiv-G", "2.0 Skyactiv-G", "2.0 Skyactiv-X", "1.5 Skyactiv-D", "SE-L", "Sport", "GT Sport"],
  "SEAT": ["1.0 TSI", "1.5 TSI", "1.6 TDI", "2.0 TDI", "FR", "Xcellence", "Cupra"],
  "Škoda": ["1.0 TSI", "1.5 TSI", "1.6 TDI", "2.0 TDI", "SE", "SE L", "Sportline", "vRS", "iV"],
  "Fiat": ["1.0 Hybrid", "1.2", "1.4 T-Jet", "Lounge", "Sport", "500e", "Abarth"],
  "Alfa Romeo": ["1.6 JTDM", "2.2 JTDM", "2.0 Turbo", "Veloce", "Quadrifoglio", "Speciale"],
  "MG": ["1.5 VTi-tech", "Trophy", "Exclusive", "EV Standard Range", "EV Long Range", "Trophy Connect"],
  "Polestar": ["Standard Range", "Long Range Single Motor", "Long Range Dual Motor", "Performance Pack"],
  "Cupra": ["1.5 TSI", "2.0 TSI", "VZ", "VZ2", "VZ3", "e-Boost"],
  "Dacia": ["SCe 65", "TCe 90", "TCe 100 Bi-Fuel", "Blue dCi 95", "Essential", "Comfort", "Extreme"],
  "Lexus": ["Hybrid", "F Sport", "Premium", "Takumi"],
  "Suzuki": ["1.0 Boosterjet", "1.4 Boosterjet", "Hybrid", "AllGrip", "SZ4", "SZ5", "SZ-T"],
};

export function getVariantsForMake(make: string): string[] {
  return MAKE_VARIANTS[make] || GENERIC;
}
