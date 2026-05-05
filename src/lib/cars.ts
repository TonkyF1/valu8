export const CAR_MAKES = [
  "Abarth","Alfa Romeo","Aston Martin","Audi","Bentley","BMW","Chevrolet","Chrysler",
  "Citroën","Cupra","Dacia","DS Automobiles","Ferrari","Fiat","Ford","Genesis",
  "Honda","Hyundai","Infiniti","Jaguar","Jeep","Kia","Lamborghini","Land Rover",
  "Lexus","Lotus","Maserati","Mazda","McLaren","Mercedes-Benz","MG","MINI",
  "Mitsubishi","Nissan","Peugeot","Polestar","Porsche","Renault","Rolls-Royce",
  "SEAT","Škoda","Smart","SsangYong","Subaru","Suzuki","Tesla","Toyota",
  "Vauxhall","Volkswagen","Volvo",
] as const;

export const PHOTO_SLOTS = [
  { key: "front", label: "Front 3/4 angle", hint: "Stand at the front-left corner" },
  { key: "rear", label: "Rear 3/4 angle", hint: "Stand at the rear-right corner" },
  { key: "side", label: "Driver's side full profile", hint: "Whole car in frame, level shot" },
  { key: "interior", label: "Interior (dashboard + seats)", hint: "Open driver's door, shoot across" },
  { key: "odometer", label: "Odometer / mileage", hint: "Ignition on, mileage clearly visible" },
  { key: "engine", label: "Engine bay", hint: "Bonnet open, even lighting" },
] as const;

export type PhotoSlotKey = typeof PHOTO_SLOTS[number]["key"];

export const YEARS = Array.from({ length: 2026 - 1995 + 1 }, (_, i) => 2026 - i);
