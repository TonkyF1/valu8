// Comprehensive list of car manufacturers — mainstream, luxury, performance,
// classic/heritage, American, JDM, Korean, European specialists, EV-only and more.
export const CAR_MAKES = [
  "AC","Abarth","Acura","Alfa Romeo","Alpine","Ariel","Aston Martin","Audi","Austin",
  "Austin-Healey","BAC","BAIC","Bentley","BMW","Borgward","Bristol","BYD","Bugatti","Buick",
  "BYD","Cadillac","Caterham","Chevrolet","Chrysler","Citroën","Cupra","Dacia","Daewoo",
  "Daihatsu","Datsun","De Tomaso","DeLorean","Dodge","DS Automobiles","Eagle","Ferrari","Fiat",
  "Fisker","Ford","GAC","GMC","Genesis","Ginetta","Gordon Murray","Great Wall","Haval",
  "Hennessey","Hillman","Hispano-Suiza","Honda","Hongqi","Hummer","Hyundai","Infiniti",
  "Isuzu","Iveco","Jaguar","Jeep","Jensen","Karma","Kia","Koenigsegg","KTM","Lada",
  "Lamborghini","Lancia","Land Rover","Leapmotor","LEVC","Lexus","Lincoln","Lotus","Lucid",
  "Lynk & Co","Marcos","Maserati","Maybach","Mazda","McLaren","Mercedes-AMG","Mercedes-Benz",
  "Mercury","MG","Mini (Classic)","MINI","Mitsubishi","Morgan","Morris","Nio","Nissan",
  "Noble","Oldsmobile","Opel","Pagani","Panoz","Perodua","Peugeot","Pininfarina","Plymouth",
  "Polestar","Pontiac","Porsche","Proton","RAM","Reliant","Renault","Rimac","Riley","Rivian",
  "Roewe","Rolls-Royce","Rover","Saab","Saturn","Scion","SEAT","Singer","Škoda","Smart","Spyker",
  "SsangYong","Subaru","Sunbeam","Suzuki","Talbot","Tata","Tesla","Toyota","Trabant","Triumph",
  "TVR","Vauxhall","VinFast","Volkswagen","Volvo","Wartburg","Westfield","Wiesmann","Wolseley",
  "XPeng","Yugo","Zenvo","Zotye",
].sort((a, b) => a.localeCompare(b)) as unknown as readonly string[];

export const PHOTO_SLOTS = [
  { key: "front", label: "Front 3/4 angle", hint: "Stand at the front-left corner" },
  { key: "rear", label: "Rear 3/4 angle", hint: "Stand at the rear-right corner" },
  { key: "side", label: "Driver's side full profile", hint: "Whole car in frame, level shot" },
  { key: "interior", label: "Interior (dashboard + seats)", hint: "Open driver's door, shoot across" },
  { key: "odometer", label: "Odometer / mileage", hint: "Ignition on, mileage clearly visible" },
  { key: "engine", label: "Engine bay", hint: "Bonnet open, even lighting" },
] as const;

export type PhotoSlotKey = typeof PHOTO_SLOTS[number]["key"];

// 1950 → 2026 to support classics and heritage vehicles
export const YEARS = Array.from({ length: 2026 - 1950 + 1 }, (_, i) => 2026 - i);
