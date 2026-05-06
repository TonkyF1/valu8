// Context-aware variant / engine / trim suggestions.
// Lookups try model-specific first, then make-level fallback.
// If neither matches, the form falls back to a free-text input.

// ---------- Model-specific variant lists ----------
// Keys are normalised: lowercase make + " · " + lowercase model.
const MODEL_VARIANTS: Record<string, string[]> = {
  // ---- Bugatti ----
  "bugatti · chiron": ["Chiron (Standard)", "Chiron Sport", "Chiron Pur Sport", "Chiron Super Sport", "Chiron Super Sport 300+", "Chiron Profilée"],
  "bugatti · veyron": ["Veyron 16.4", "Veyron Super Sport", "Veyron Grand Sport", "Veyron Grand Sport Vitesse"],
  "bugatti · divo": ["Divo"],
  "bugatti · centodieci": ["Centodieci"],
  "bugatti · mistral": ["W16 Mistral"],
  "bugatti · tourbillon": ["Tourbillon"],

  // ---- Ferrari ----
  "ferrari · 488 gtb": ["488 GTB", "488 Pista", "488 Spider", "488 Pista Spider"],
  "ferrari · 458 italia": ["458 Italia", "458 Speciale", "458 Speciale A", "458 Spider"],
  "ferrari · f8 tributo": ["F8 Tributo", "F8 Spider"],
  "ferrari · 296 gtb": ["296 GTB", "296 GTS", "296 Speciale"],
  "ferrari · sf90 stradale": ["SF90 Stradale", "SF90 Spider", "SF90 XX Stradale", "SF90 XX Spider"],
  "ferrari · 812 superfast": ["812 Superfast", "812 GTS", "812 Competizione", "812 Competizione A"],
  "ferrari · roma": ["Roma", "Roma Spider"],
  "ferrari · portofino": ["Portofino", "Portofino M"],
  "ferrari · california": ["California", "California T", "California T HS"],
  "ferrari · purosangue": ["Purosangue"],
  "ferrari · 599 gtb": ["599 GTB Fiorano", "599 GTO", "599 SA Aperta"],
  "ferrari · ff": ["FF"],
  "ferrari · gtc4lusso": ["GTC4Lusso", "GTC4Lusso T"],
  "ferrari · f430": ["F430", "F430 Scuderia", "Scuderia Spider 16M", "F430 Spider"],
  "ferrari · 360 modena": ["360 Modena", "360 Spider", "360 Challenge Stradale"],

  // ---- Lamborghini ----
  "lamborghini · huracán": ["Huracán LP610-4", "Huracán Evo", "Huracán Evo RWD", "Huracán Performante", "Huracán STO", "Huracán Tecnica", "Huracán Sterrato", "Huracán Spyder"],
  "lamborghini · aventador": ["Aventador LP700-4", "Aventador S", "Aventador SV", "Aventador SVJ", "Aventador Ultimae", "Aventador Roadster"],
  "lamborghini · urus": ["Urus", "Urus S", "Urus Performante", "Urus SE"],
  "lamborghini · revuelto": ["Revuelto"],
  "lamborghini · gallardo": ["Gallardo", "Gallardo LP560-4", "Gallardo LP570-4 Superleggera", "Gallardo LP570-4 Spyder Performante", "Gallardo Spyder"],
  "lamborghini · murciélago": ["Murciélago", "Murciélago LP640", "Murciélago LP670-4 SV", "Murciélago Roadster"],
  "lamborghini · countach": ["Countach LP400", "Countach LP500S", "Countach Quattrovalvole", "Countach 25th Anniversary", "Countach LPI 800-4"],

  // ---- McLaren ----
  "mclaren · 720s": ["720S Coupe", "720S Spider", "765LT", "765LT Spider"],
  "mclaren · 750s": ["750S Coupe", "750S Spider"],
  "mclaren · 570s": ["570S Coupe", "570S Spider", "570GT", "600LT Coupe", "600LT Spider"],
  "mclaren · artura": ["Artura", "Artura Spider"],
  "mclaren · gt": ["GT", "GTS"],
  "mclaren · senna": ["Senna", "Senna GTR"],
  "mclaren · p1": ["P1", "P1 GTR"],
  "mclaren · 12c": ["MP4-12C", "12C Spider"],

  // ---- Pagani ----
  "pagani · zonda": ["Zonda C12", "Zonda S", "Zonda F", "Zonda R", "Zonda Cinque", "Zonda Tricolore", "Zonda HP Barchetta"],
  "pagani · huayra": ["Huayra Coupe", "Huayra Roadster", "Huayra BC", "Huayra BC Roadster", "Huayra R", "Huayra Codalunga"],
  "pagani · utopia": ["Utopia Coupe", "Utopia Roadster"],

  // ---- Koenigsegg ----
  "koenigsegg · agera": ["Agera", "Agera R", "Agera S", "Agera RS", "Agera RSR", "Agera Final"],
  "koenigsegg · jesko": ["Jesko", "Jesko Absolut", "Jesko Attack"],
  "koenigsegg · regera": ["Regera"],
  "koenigsegg · gemera": ["Gemera"],

  // ---- Porsche 911 (deeply variant-rich) ----
  "porsche · 911": ["Carrera", "Carrera T", "Carrera S", "Carrera 4", "Carrera 4S", "Carrera GTS", "Targa 4", "Targa 4S", "Targa 4 GTS", "Turbo", "Turbo S", "GT3", "GT3 Touring", "GT3 RS", "GT2", "GT2 RS", "Dakar", "Sport Classic", "Speedster", "S/T"],
  "porsche · 911 carrera": ["Carrera", "Carrera T", "Carrera Cabriolet", "Carrera 4", "Carrera 4 Cabriolet"],
  "porsche · 911 carrera s": ["Carrera S", "Carrera S Cabriolet", "Carrera 4S", "Carrera 4S Cabriolet"],
  "porsche · 911 turbo": ["Turbo", "Turbo Cabriolet", "Turbo S", "Turbo S Cabriolet"],
  "porsche · 911 gt3": ["GT3", "GT3 Touring", "GT3 RS"],
  "porsche · 911 (964)": ["964 Carrera 2", "964 Carrera 4", "964 Turbo 3.3", "964 Turbo 3.6", "964 RS"],
  "porsche · 911 (993)": ["993 Carrera", "993 Carrera S", "993 Carrera 4S", "993 Turbo", "993 GT2", "993 RS"],
  "porsche · 911 (996)": ["996 Carrera", "996 Carrera 4S", "996 Turbo", "996 GT3", "996 GT3 RS", "996 GT2"],
  "porsche · 911 (997)": ["997.1 Carrera", "997.1 Carrera S", "997.2 Carrera", "997.2 Carrera S", "997 Turbo", "997 Turbo S", "997 GT3", "997 GT3 RS", "997 GT3 RS 4.0", "997 GT2", "997 GT2 RS", "997 Sport Classic"],
  "porsche · 911 (991)": ["991.1 Carrera", "991.1 Carrera S", "991.2 Carrera", "991.2 Carrera S", "991.2 GTS", "991 Turbo", "991 Turbo S", "991 GT3", "991 GT3 RS", "991 GT2 RS", "991 R", "991 Speedster"],
  "porsche · 911 (992)": ["992.1 Carrera", "992.1 Carrera S", "992.1 GTS", "992.1 Turbo", "992.1 Turbo S", "992.1 GT3", "992.1 GT3 RS", "992 Dakar", "992 Sport Classic", "992 S/T", "992.2 Carrera", "992.2 GTS T-Hybrid"],

  // ---- Porsche others ----
  "porsche · 718 cayman": ["718 Cayman", "718 Cayman T", "718 Cayman S", "718 Cayman GTS 4.0", "718 Cayman GT4", "718 Cayman GT4 RS"],
  "porsche · 718 boxster": ["718 Boxster", "718 Boxster T", "718 Boxster S", "718 Boxster GTS 4.0", "718 Spyder", "718 Spyder RS"],
  "porsche · cayenne": ["Cayenne", "Cayenne S", "Cayenne E-Hybrid", "Cayenne S E-Hybrid", "Cayenne GTS", "Cayenne Turbo", "Cayenne Turbo S E-Hybrid", "Cayenne Turbo GT", "Cayenne Coupe"],
  "porsche · macan": ["Macan", "Macan T", "Macan S", "Macan GTS", "Macan Turbo", "Macan Electric", "Macan 4 Electric", "Macan Turbo Electric"],
  "porsche · panamera": ["Panamera", "Panamera 4", "Panamera 4 E-Hybrid", "Panamera GTS", "Panamera Turbo", "Panamera Turbo S E-Hybrid", "Panamera Sport Turismo"],
  "porsche · taycan": ["Taycan", "Taycan 4S", "Taycan GTS", "Taycan Turbo", "Taycan Turbo S", "Taycan Turbo GT", "Taycan Cross Turismo", "Taycan Sport Turismo"],

  // ---- Renault Clio (RS-rich) ----
  "renault · clio": ["1.0 SCe", "1.0 TCe 90", "1.0 TCe 100", "1.3 TCe 130", "1.5 dCi", "E-Tech Hybrid", "RS Line", "Iconic", "Initiale Paris"],
  "renault · clio rs 197": ["RS 197", "RS 197 Cup", "RS 197 R27"],
  "renault · clio rs 200": ["RS 200 Mk3 (200T)", "RS 200 Cup", "RS 200 EDC", "RS 200 Lux"],
  "renault · clio rs 220 trophy": ["RS 220 Trophy", "RS 220 Trophy R"],
  "renault · clio williams": ["Clio Williams 1", "Clio Williams 2", "Clio Williams 3"],
  "renault · megane rs 225": ["Megane RS 225", "Megane RS 225 Cup", "Megane RS 230 F1 Team R26", "R26.R"],
  "renault · megane rs 250": ["Megane RS 250", "Megane RS 250 Cup", "Megane RS 250 Trophy"],
  "renault · megane rs 265 trophy": ["RS 265", "RS 265 Cup", "RS 265 Trophy", "RS 275 Trophy", "RS 275 Trophy-R"],
  "renault · megane rs 280": ["Megane RS 280", "Megane RS 280 Cup", "Megane RS Trophy 300"],
  "renault · 5 gt turbo": ["5 GT Turbo Phase 1", "5 GT Turbo Phase 2", "5 GT Turbo Raider"],

  // ---- Ford performance ----
  "ford · fiesta": ["1.0 EcoBoost 100", "1.0 EcoBoost 125", "1.0 EcoBoost mHEV", "1.5 TDCi", "Zetec", "Titanium", "ST-Line", "ST-Line X", "Vignale", "Active"],
  "ford · fiesta st": ["Fiesta ST-2", "Fiesta ST-3", "ST Performance Edition", "ST Mountune"],
  "ford · focus": ["1.0 EcoBoost", "1.5 EcoBoost", "1.5 EcoBlue", "2.0 EcoBlue", "Zetec", "Titanium", "ST-Line", "ST-Line X", "Active", "Vignale"],
  "ford · focus st": ["Focus ST mk2 225", "Focus ST mk3 250", "Focus ST mk4 280", "Focus ST Edition"],
  "ford · focus rs": ["Focus RS Mk1", "Focus RS Mk2", "Focus RS Mk2 500", "Focus RS Mk3", "Focus RS Heritage Edition"],
  "ford · puma": ["1.0 EcoBoost mHEV", "Titanium", "ST-Line", "ST-Line X", "Vignale", "Puma ST", "Puma ST Gold Edition"],
  "ford · mustang": ["2.3 EcoBoost", "5.0 GT", "5.0 GT California Special", "5.0 Bullitt", "5.0 Mach 1", "Shelby GT350", "Shelby GT500", "Dark Horse"],
  "ford · escort cosworth": ["Escort RS Cosworth (Big Turbo)", "Escort RS Cosworth (Small Turbo)", "Escort RS Cosworth Lux"],
  "ford · sierra cosworth": ["Sierra RS Cosworth 3-door", "Sierra Sapphire RS Cosworth", "Sapphire Cosworth 4x4"],

  // ---- BMW M / popular ----
  "bmw · 3 series": ["320i", "330i", "320d", "330d", "330e", "M340i", "M340d", "M Sport", "M Sport Pro", "Touring"],
  "bmw · m3": ["E36 M3", "E46 M3", "E46 M3 CSL", "E92 M3", "E92 M3 GTS", "F80 M3", "F80 M3 CS", "G80 M3", "G80 M3 Competition", "G80 M3 CS", "M3 Touring"],
  "bmw · m4": ["F82 M4", "F82 M4 Competition", "F82 M4 CS", "F82 M4 GTS", "G82 M4", "G82 M4 Competition", "G82 M4 CSL"],
  "bmw · m5": ["E39 M5", "E60 M5", "F10 M5", "F90 M5", "F90 M5 Competition", "F90 M5 CS", "G90 M5"],
  "bmw · 1 series": ["116d", "118i", "118d", "120d", "M135i", "M135i xDrive", "M Sport"],
  "bmw · 5 series": ["520i", "520d", "530i", "530d", "530e", "540i", "M550i", "M Sport", "Touring"],
  "bmw · z4": ["sDrive18i", "sDrive20i", "sDrive30i", "M40i"],
  "bmw · i4": ["eDrive35", "eDrive40", "M50"],
  "bmw · ix": ["xDrive40", "xDrive50", "M60"],

  // ---- Audi performance ----
  "audi · rs3": ["RS3 8P", "RS3 8V", "RS3 8V Sportback", "RS3 8Y Saloon", "RS3 8Y Sportback", "RS3 Performance Edition"],
  "audi · rs4": ["RS4 B5", "RS4 B7", "RS4 B8 Avant", "RS4 B9 Avant", "RS4 Competition Plus"],
  "audi · rs6": ["RS6 C5", "RS6 C6", "RS6 C7", "RS6 C7 Performance", "RS6 C8", "RS6 C8 Performance", "RS6 GT"],
  "audi · r8": ["R8 4.2 V8", "R8 5.2 V10", "R8 V10 Plus", "R8 V10 Performance", "R8 GT", "R8 Spyder"],
  "audi · tt": ["1.8 TFSI", "2.0 TFSI", "TTS", "TT RS", "TT RS Iconic Edition"],

  // ---- Mercedes-AMG ----
  "mercedes-amg · c 63": ["C 63 W204", "C 63 Black Series W204", "C 63 S W205", "C 63 S Coupe", "C 63 S Estate", "C 63 S E Performance W206"],
  "mercedes-amg · e 63": ["E 63 W212", "E 63 S W213", "E 63 S Final Edition"],
  "mercedes-amg · gt": ["GT", "GT S", "GT C", "GT R", "GT R Pro", "GT Black Series", "GT 63 4-Door", "GT 63 S 4-Door"],

  // ---- VW Golf ----
  "volkswagen · golf": ["1.0 TSI", "1.5 TSI", "1.5 eTSI", "1.6 TDI", "2.0 TDI", "Life", "Style", "R-Line", "Match"],
  "volkswagen · golf gti": ["GTI Mk5", "GTI Mk6", "GTI Mk7", "GTI Mk7.5", "GTI Mk8", "GTI Clubsport", "GTI Clubsport S", "GTI Edition 35", "GTI Performance", "GTI TCR"],
  "volkswagen · golf r": ["R Mk6", "R Mk7", "R Mk7.5", "R Mk8", "R 20 Years", "R Estate"],
  "volkswagen · golf r32": ["R32 Mk4", "R32 Mk5"],

  // ---- Honda ----
  "honda · civic type r": ["EP3 Type R", "FN2 Type R", "FK2 Type R", "FK8 Type R", "FK8 Type R GT", "FK8 Limited Edition", "FL5 Type R"],
  "honda · nsx": ["NSX (NA1)", "NSX-R (NA2)", "NSX (2017)", "NSX Type S"],
  "honda · s2000": ["AP1", "AP2", "S2000 CR (Club Racer)", "S2000 GT"],

  // ---- Nissan ----
  "nissan · gt-r": ["R35 GT-R", "R35 GT-R Premium", "R35 GT-R Black Edition", "R35 GT-R Track Edition", "R35 Nismo", "R35 Nismo MY24", "T-Spec"],
  "nissan · skyline gt-r r34": ["R34 GT-R", "R34 GT-R V-Spec", "R34 GT-R V-Spec II", "R34 GT-R V-Spec II Nür", "R34 GT-R M-Spec", "R34 GT-R M-Spec Nür", "Z-Tune"],
  "nissan · skyline gt-r r33": ["R33 GT-R", "R33 GT-R V-Spec", "R33 GT-R V-Spec N1", "R33 GT-R LM", "R33 400R"],
  "nissan · skyline gt-r r32": ["R32 GT-R", "R32 GT-R V-Spec", "R32 GT-R V-Spec II", "R32 GT-R N1", "R32 Nismo"],
  "nissan · 350z": ["350Z", "350Z Roadster", "350Z Nismo", "350Z 35th Anniversary"],
  "nissan · 370z": ["370Z", "370Z Roadster", "370Z Nismo", "370Z 50th Anniversary"],

  // ---- Toyota ----
  "toyota · gr yaris": ["GR Yaris Circuit Pack", "GR Yaris Convenience Pack", "GR Yaris Performance Pack", "GR Yaris Rallye", "GR Yaris Aero Performance"],
  "toyota · gr supra": ["GR Supra 2.0", "GR Supra 3.0", "GR Supra Pro", "GR Supra A91", "GR Supra Final Edition", "GR Supra Manual"],
  "toyota · supra mk4": ["Supra Mk4 NA", "Supra Mk4 Turbo", "Supra Mk4 RZ", "Supra Mk4 SZ-R"],

  // ---- Lancia / Italian classics ----
  "lancia · delta integrale": ["Delta HF Turbo", "Delta HF 4WD", "Delta Integrale 8v", "Delta Integrale 16v", "Delta Integrale Evo I", "Delta Integrale Evo II"],

  // ---- Jaguar ----
  "jaguar · f-type": ["F-Type 2.0", "F-Type 3.0 V6", "F-Type 3.0 V6 S", "F-Type R", "F-Type SVR", "F-Type Project 7", "F-Type 75"],
  "jaguar · xkr": ["XKR Coupe", "XKR Convertible", "XKR-S", "XKR-S GT"],
  "jaguar · e-type": ["E-Type Series 1 3.8", "E-Type Series 1 4.2", "E-Type Series 2", "E-Type Series 3 V12", "E-Type Lightweight"],
  "jaguar · xj220": ["XJ220", "XJ220S"],

  // ---- Land Rover ----
  "land rover · defender": ["Defender 90", "Defender 110", "Defender 130", "Defender D250", "Defender D300", "Defender P400", "Defender V8", "Defender Octa", "Defender 75th Edition"],
  "land rover · range rover": ["P400e", "D300", "D350", "P400", "P530 V8", "Autobiography", "SV", "First Edition"],
  "land rover · range rover sport": ["P400", "P440e", "P510e", "P530 V8", "SV Edition One", "SVR"],

  // ---- Tesla ----
  "tesla · model 3": ["Standard Range Plus", "Long Range AWD", "Long Range RWD", "Performance", "Highland Standard Range", "Highland Long Range", "Highland Performance"],
  "tesla · model s": ["Long Range", "Long Range Plus", "Plaid", "Plaid+"],
  "tesla · model x": ["Long Range", "Plaid"],
  "tesla · model y": ["RWD", "Long Range AWD", "Performance", "Juniper Long Range", "Juniper Performance"],

  // ---- Aston Martin ----
  "aston martin · vantage": ["V8 Vantage 4.3", "V8 Vantage 4.7", "V8 Vantage S", "V12 Vantage", "V12 Vantage S", "V12 Vantage Roadster", "Vantage (2018)", "Vantage F1 Edition", "Vantage (2024)"],
  "aston martin · db9": ["DB9 Coupe", "DB9 Volante", "DB9 GT"],
  "aston martin · db11": ["DB11 V8", "DB11 V12", "DB11 AMR", "DB11 Volante"],
  "aston martin · dbs": ["DBS V12", "DBS Volante", "DBS Carbon Edition", "DBS Superleggera", "DBS 770 Ultimate"],

  // ---- Bentley ----
  "bentley · continental gt": ["Continental GT V8", "Continental GT W12", "Continental GT Speed", "Continental GT Mulliner", "Continental Supersports", "Continental GT3-R"],

  // ---- Rolls-Royce ----
  "rolls-royce · ghost": ["Ghost", "Ghost Series II", "Ghost Black Badge", "Ghost EWB"],
  "rolls-royce · phantom": ["Phantom VII", "Phantom VIII", "Phantom EWB", "Phantom Drophead Coupe"],

  // ---- Maserati ----
  "maserati · mc20": ["MC20 Coupe", "MC20 Cielo", "MC20 GT2 Stradale"],
  "maserati · granturismo": ["GranTurismo (2008)", "GranTurismo S", "GranTurismo MC Stradale", "GranTurismo Modena", "GranTurismo Trofeo", "GranTurismo Folgore"],

  // ---- Mini classic ----
  "mini (classic) · cooper": ["Cooper 998", "Cooper 1071", "Cooper Mk1", "Cooper Mk2"],
  "mini (classic) · cooper s": ["Cooper S 970", "Cooper S 1071", "Cooper S 1275", "Cooper S Mk2", "Cooper S Mk3"],

  // ---- Mini modern ----
  "mini · cooper s": ["Cooper S 3-door", "Cooper S 5-door", "Cooper S Convertible", "Cooper S Sport", "Cooper S Resolute Edition"],
  "mini · john cooper works": ["JCW Hatch", "JCW Convertible", "JCW Clubman", "JCW Countryman", "JCW GP Mk1", "JCW GP Mk2", "JCW GP Mk3"],
};

// ---------- Make-level fallbacks ----------
const COMMON_PETROL = ["1.0 TCe", "1.2 TSI", "1.4 TSI", "1.5 TSI", "1.6 Petrol", "2.0 Petrol"];
const COMMON_DIESEL = ["1.5 dCi", "1.6 HDi", "1.6 TDI", "2.0 TDI", "2.0 HDi", "2.2 TDCi"];
const COMMON_HYBRID = ["Hybrid", "Plug-in Hybrid (PHEV)", "Mild Hybrid"];
const COMMON_EV = ["Electric (Standard Range)", "Electric (Long Range)", "Electric (Performance)"];
const COMMON_TRIMS = ["Base", "Mid-spec", "Top-spec / Sport"];
const GENERIC = [...COMMON_PETROL, ...COMMON_DIESEL, ...COMMON_HYBRID, ...COMMON_EV, ...COMMON_TRIMS];

const MAKE_VARIANTS: Record<string, string[]> = {
  "Audi": ["1.0 TFSI", "1.4 TFSI", "1.5 TFSI", "2.0 TFSI", "2.0 TDI", "3.0 TDI", "S line", "Black Edition", "Vorsprung", "S model", "RS model", "e-tron"],
  "BMW": ["116i", "118i", "118d", "120d", "320i", "320d", "330i", "330e", "520d", "M Sport", "M Sport Pro", "M Performance"],
  "Mercedes-Benz": ["A180", "A200", "A220d", "C200", "C220d", "C300", "E220d", "E300", "AMG Line", "AMG Premium", "EQ"],
  "Ford": ["1.0 EcoBoost 100", "1.0 EcoBoost 125", "1.5 EcoBoost", "1.5 TDCi", "2.0 EcoBlue", "ST-Line", "ST-Line X", "Titanium", "Vignale", "ST", "RS"],
  "Volkswagen": ["1.0 TSI", "1.4 TSI", "1.5 TSI", "1.6 TDI", "2.0 TDI", "2.0 TSI", "GTI", "GTD", "R-Line", "R", "Match", "Life", "Style"],
  "Vauxhall": ["1.0 Turbo", "1.2 Turbo", "1.4 Turbo", "1.6 CDTi", "SRi", "SRi Nav", "Elite Nav", "GS Line", "Ultimate", "VXR"],
  "Renault": ["1.0 SCe", "1.0 TCe 90", "1.2 TCe 100", "1.3 TCe 130", "1.5 dCi 90", "1.5 dCi 110", "E-Tech Hybrid", "ZE Electric", "Iconic", "RS Line"],
  "Peugeot": ["1.2 PureTech 75", "1.2 PureTech 100", "1.2 PureTech 130", "1.5 BlueHDi 100", "1.5 BlueHDi 130", "GT Line", "GT", "Allure", "Active", "e-208"],
  "Citroën": ["1.2 PureTech", "1.5 BlueHDi", "1.6 BlueHDi", "Feel", "Flair", "Shine", "C-Series", "ë-C4 Electric"],
  "Toyota": ["1.0 VVT-i", "1.2 Turbo", "1.5 Hybrid", "1.8 Hybrid", "2.0 Hybrid", "2.5 Hybrid", "Icon", "Design", "Excel", "GR Sport"],
  "Honda": ["1.0 VTEC Turbo", "1.5 VTEC Turbo", "1.5 i-MMD Hybrid", "2.0 i-MMD Hybrid", "SR", "EX", "Sport"],
  "Nissan": ["1.0 DIG-T", "1.3 DIG-T", "1.5 dCi", "1.6 dCi", "e-Power", "Acenta", "N-Connecta", "Tekna", "Tekna+"],
  "Hyundai": ["1.0 T-GDi", "1.2 MPi", "1.4 T-GDi", "1.6 CRDi", "1.6 T-GDi N Line", "Hybrid", "Plug-in Hybrid", "Electric", "SE Connect", "Premium", "Ultimate", "N"],
  "Kia": ["1.0 T-GDi", "1.4 T-GDi", "1.6 CRDi", "1.6 T-GDi GT-Line", "Hybrid", "Plug-in Hybrid", "Electric", "2", "3", "4", "GT-Line S"],
  "MINI": ["One", "Cooper", "Cooper S", "Cooper SD", "John Cooper Works", "Electric", "Sport", "Exclusive"],
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

// Lookup priority: model-specific → make-level → empty (free-text fallback in UI).
export function getVariantsFor(make: string, model: string): string[] {
  if (!make) return [];
  if (model) {
    const key = `${make.toLowerCase()} · ${model.toLowerCase()}`;
    if (MODEL_VARIANTS[key]) return MODEL_VARIANTS[key];
  }
  return MAKE_VARIANTS[make] || [];
}

// Backwards-compatible export — returns make-level only.
export function getVariantsForMake(make: string): string[] {
  return MAKE_VARIANTS[make] || GENERIC;
}
