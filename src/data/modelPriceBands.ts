// GENERATED from an aggregate of market_listings (2026-11-04): typical asking prices from UK adverts.
// median = middle asking price; low/high = 25th/75th percentile. Bands with fewer than 15 listings are omitted. Do not edit by hand.
export type PriceBand = { band: string; count: number; median: number; low: number; high: number };
export type ModelPrices = { slug: string; make: string; model: string; listings: number; bands: PriceBand[] };
export const PRICE_DATA_UPDATED = "November 2026";
export const MODEL_PRICES: ModelPrices[] = [
 {
  "slug": "ford-fiesta",
  "make": "Ford",
  "model": "Fiesta",
  "listings": 1587,
  "bands": [
   {
    "band": "2008 and older",
    "count": 132,
    "median": 800,
    "low": 650,
    "high": 1250
   },
   {
    "band": "2009–2011",
    "count": 255,
    "median": 1450,
    "low": 1000,
    "high": 2000
   },
   {
    "band": "2012–2014",
    "count": 326,
    "median": 2450,
    "low": 1500,
    "high": 4000
   },
   {
    "band": "2015–2017",
    "count": 416,
    "median": 4500,
    "low": 3200,
    "high": 5800
   },
   {
    "band": "2018–2020",
    "count": 328,
    "median": 7000,
    "low": 5500,
    "high": 8600
   },
   {
    "band": "2021 and newer",
    "count": 130,
    "median": 12000,
    "low": 9850,
    "high": 13250
   }
  ]
 },
 {
  "slug": "volkswagen-golf",
  "make": "Volkswagen",
  "model": "Golf",
  "listings": 1372,
  "bands": [
   {
    "band": "2008 and older",
    "count": 178,
    "median": 1450,
    "low": 900,
    "high": 2200
   },
   {
    "band": "2009–2011",
    "count": 242,
    "median": 2000,
    "low": 1350,
    "high": 3750
   },
   {
    "band": "2012–2014",
    "count": 312,
    "median": 4700,
    "low": 2950,
    "high": 6450
   },
   {
    "band": "2015–2017",
    "count": 316,
    "median": 8000,
    "low": 6000,
    "high": 9900
   },
   {
    "band": "2018–2020",
    "count": 206,
    "median": 10850,
    "low": 8900,
    "high": 12800
   },
   {
    "band": "2021 and newer",
    "count": 118,
    "median": 16750,
    "low": 13500,
    "high": 25150
   }
  ]
 },
 {
  "slug": "ford-focus",
  "make": "Ford",
  "model": "Focus",
  "listings": 1367,
  "bands": [
   {
    "band": "2008 and older",
    "count": 107,
    "median": 1250,
    "low": 800,
    "high": 2250
   },
   {
    "band": "2009–2011",
    "count": 162,
    "median": 1350,
    "low": 1000,
    "high": 2000
   },
   {
    "band": "2012–2014",
    "count": 295,
    "median": 2000,
    "low": 1500,
    "high": 3000
   },
   {
    "band": "2015–2017",
    "count": 371,
    "median": 5000,
    "low": 3500,
    "high": 6500
   },
   {
    "band": "2018–2020",
    "count": 287,
    "median": 8000,
    "low": 6500,
    "high": 9850
   },
   {
    "band": "2021 and newer",
    "count": 145,
    "median": 14200,
    "low": 12000,
    "high": 15250
   }
  ]
 },
 {
  "slug": "volkswagen-polo",
  "make": "Volkswagen",
  "model": "Polo",
  "listings": 1034,
  "bands": [
   {
    "band": "2008 and older",
    "count": 106,
    "median": 1100,
    "low": 700,
    "high": 1500
   },
   {
    "band": "2009–2011",
    "count": 165,
    "median": 2200,
    "low": 1500,
    "high": 3300
   },
   {
    "band": "2012–2014",
    "count": 217,
    "median": 4300,
    "low": 2850,
    "high": 5700
   },
   {
    "band": "2015–2017",
    "count": 250,
    "median": 6300,
    "low": 5400,
    "high": 8000
   },
   {
    "band": "2018–2020",
    "count": 146,
    "median": 10000,
    "low": 8500,
    "high": 11450
   },
   {
    "band": "2021 and newer",
    "count": 150,
    "median": 14550,
    "low": 13100,
    "high": 15650
   }
  ]
 },
 {
  "slug": "bmw-3-series",
  "make": "BMW",
  "model": "3 Series",
  "listings": 917,
  "bands": [
   {
    "band": "2008 and older",
    "count": 176,
    "median": 2000,
    "low": 1300,
    "high": 3250
   },
   {
    "band": "2009–2011",
    "count": 144,
    "median": 2250,
    "low": 1650,
    "high": 3250
   },
   {
    "band": "2012–2014",
    "count": 242,
    "median": 3750,
    "low": 2650,
    "high": 5500
   },
   {
    "band": "2015–2017",
    "count": 178,
    "median": 7500,
    "low": 5300,
    "high": 11350
   },
   {
    "band": "2018–2020",
    "count": 90,
    "median": 13000,
    "low": 9950,
    "high": 15000
   },
   {
    "band": "2021 and newer",
    "count": 87,
    "median": 23400,
    "low": 18750,
    "high": 28450
   }
  ]
 },
 {
  "slug": "fiat-500",
  "make": "Fiat",
  "model": "500",
  "listings": 896,
  "bands": [
   {
    "band": "2008 and older",
    "count": 22,
    "median": 1200,
    "low": 1000,
    "high": 1450
   },
   {
    "band": "2009–2011",
    "count": 117,
    "median": 2000,
    "low": 1300,
    "high": 2500
   },
   {
    "band": "2012–2014",
    "count": 184,
    "median": 2700,
    "low": 1900,
    "high": 4300
   },
   {
    "band": "2015–2017",
    "count": 235,
    "median": 5000,
    "low": 3600,
    "high": 6000
   },
   {
    "band": "2018–2020",
    "count": 157,
    "median": 6450,
    "low": 5500,
    "high": 7500
   },
   {
    "band": "2021 and newer",
    "count": 181,
    "median": 9050,
    "low": 8500,
    "high": 10150
   }
  ]
 },
 {
  "slug": "bmw-1-series",
  "make": "BMW",
  "model": "1 Series",
  "listings": 845,
  "bands": [
   {
    "band": "2008 and older",
    "count": 78,
    "median": 1200,
    "low": 900,
    "high": 2100
   },
   {
    "band": "2009–2011",
    "count": 125,
    "median": 1700,
    "low": 1300,
    "high": 2500
   },
   {
    "band": "2012–2014",
    "count": 178,
    "median": 3200,
    "low": 2000,
    "high": 5200
   },
   {
    "band": "2015–2017",
    "count": 195,
    "median": 5650,
    "low": 4200,
    "high": 8000
   },
   {
    "band": "2018–2020",
    "count": 152,
    "median": 11000,
    "low": 8000,
    "high": 14000
   },
   {
    "band": "2021 and newer",
    "count": 117,
    "median": 20650,
    "low": 16950,
    "high": 26000
   }
  ]
 },
 {
  "slug": "nissan-qashqai",
  "make": "Nissan",
  "model": "Qashqai",
  "listings": 804,
  "bands": [
   {
    "band": "2008 and older",
    "count": 33,
    "median": 1150,
    "low": 900,
    "high": 1500
   },
   {
    "band": "2009–2011",
    "count": 110,
    "median": 1300,
    "low": 1000,
    "high": 1600
   },
   {
    "band": "2012–2014",
    "count": 172,
    "median": 2600,
    "low": 1900,
    "high": 4000
   },
   {
    "band": "2015–2017",
    "count": 230,
    "median": 5200,
    "low": 4000,
    "high": 6400
   },
   {
    "band": "2018–2020",
    "count": 129,
    "median": 7700,
    "low": 6500,
    "high": 8750
   },
   {
    "band": "2021 and newer",
    "count": 130,
    "median": 15650,
    "low": 14000,
    "high": 19350
   }
  ]
 },
 {
  "slug": "renault-clio",
  "make": "Renault",
  "model": "Clio",
  "listings": 782,
  "bands": [
   {
    "band": "2008 and older",
    "count": 74,
    "median": 850,
    "low": 700,
    "high": 1250
   },
   {
    "band": "2009–2011",
    "count": 101,
    "median": 1100,
    "low": 800,
    "high": 1400
   },
   {
    "band": "2012–2014",
    "count": 130,
    "median": 2500,
    "low": 1500,
    "high": 4200
   },
   {
    "band": "2015–2017",
    "count": 190,
    "median": 5000,
    "low": 3750,
    "high": 6300
   },
   {
    "band": "2018–2020",
    "count": 152,
    "median": 6450,
    "low": 5450,
    "high": 7900
   },
   {
    "band": "2021 and newer",
    "count": 135,
    "median": 12000,
    "low": 11150,
    "high": 13800
   }
  ]
 },
 {
  "slug": "audi-a3",
  "make": "Audi",
  "model": "A3",
  "listings": 760,
  "bands": [
   {
    "band": "2008 and older",
    "count": 82,
    "median": 1400,
    "low": 900,
    "high": 2150
   },
   {
    "band": "2009–2011",
    "count": 136,
    "median": 1950,
    "low": 1300,
    "high": 2800
   },
   {
    "band": "2012–2014",
    "count": 176,
    "median": 3900,
    "low": 2600,
    "high": 6000
   },
   {
    "band": "2015–2017",
    "count": 183,
    "median": 7650,
    "low": 5750,
    "high": 10000
   },
   {
    "band": "2018–2020",
    "count": 71,
    "median": 12000,
    "low": 9650,
    "high": 13950
   },
   {
    "band": "2021 and newer",
    "count": 112,
    "median": 18400,
    "low": 15150,
    "high": 22000
   }
  ]
 },
 {
  "slug": "mercedes-benz-c-class",
  "make": "Mercedes-Benz",
  "model": "C Class",
  "listings": 695,
  "bands": [
   {
    "band": "2008 and older",
    "count": 113,
    "median": 1300,
    "low": 1000,
    "high": 2200
   },
   {
    "band": "2009–2011",
    "count": 92,
    "median": 2700,
    "low": 2000,
    "high": 3700
   },
   {
    "band": "2012–2014",
    "count": 163,
    "median": 4300,
    "low": 3000,
    "high": 6000
   },
   {
    "band": "2015–2017",
    "count": 241,
    "median": 9000,
    "low": 6900,
    "high": 11000
   },
   {
    "band": "2018–2020",
    "count": 86,
    "median": 13000,
    "low": 9600,
    "high": 14900
   }
  ]
 },
 {
  "slug": "toyota-yaris",
  "make": "Toyota",
  "model": "Yaris",
  "listings": 674,
  "bands": [
   {
    "band": "2008 and older",
    "count": 155,
    "median": 1300,
    "low": 1000,
    "high": 1800
   },
   {
    "band": "2009–2011",
    "count": 94,
    "median": 1850,
    "low": 1500,
    "high": 2500
   },
   {
    "band": "2012–2014",
    "count": 140,
    "median": 5000,
    "low": 3600,
    "high": 6500
   },
   {
    "band": "2015–2017",
    "count": 135,
    "median": 7300,
    "low": 5500,
    "high": 8950
   },
   {
    "band": "2018–2020",
    "count": 89,
    "median": 9500,
    "low": 7800,
    "high": 11950
   },
   {
    "band": "2021 and newer",
    "count": 61,
    "median": 14000,
    "low": 12000,
    "high": 14900
   }
  ]
 },
 {
  "slug": "nissan-juke",
  "make": "Nissan",
  "model": "Juke",
  "listings": 644,
  "bands": [
   {
    "band": "2009–2011",
    "count": 65,
    "median": 1500,
    "low": 1200,
    "high": 2250
   },
   {
    "band": "2012–2014",
    "count": 169,
    "median": 2350,
    "low": 1850,
    "high": 3200
   },
   {
    "band": "2015–2017",
    "count": 176,
    "median": 4000,
    "low": 3000,
    "high": 5500
   },
   {
    "band": "2018–2020",
    "count": 68,
    "median": 6850,
    "low": 4750,
    "high": 8950
   },
   {
    "band": "2021 and newer",
    "count": 166,
    "median": 13050,
    "low": 11200,
    "high": 14950
   }
  ]
 },
 {
  "slug": "honda-jazz",
  "make": "Honda",
  "model": "Jazz",
  "listings": 638,
  "bands": [
   {
    "band": "2008 and older",
    "count": 130,
    "median": 1450,
    "low": 950,
    "high": 2000
   },
   {
    "band": "2009–2011",
    "count": 108,
    "median": 2300,
    "low": 1500,
    "high": 4300
   },
   {
    "band": "2012–2014",
    "count": 158,
    "median": 5850,
    "low": 4350,
    "high": 6850
   },
   {
    "band": "2015–2017",
    "count": 118,
    "median": 7500,
    "low": 6450,
    "high": 9500
   },
   {
    "band": "2018–2020",
    "count": 95,
    "median": 11000,
    "low": 9000,
    "high": 12500
   },
   {
    "band": "2021 and newer",
    "count": 29,
    "median": 13950,
    "low": 12500,
    "high": 15000
   }
  ]
 },
 {
  "slug": "mercedes-benz-a-class",
  "make": "Mercedes-Benz",
  "model": "A Class",
  "listings": 626,
  "bands": [
   {
    "band": "2008 and older",
    "count": 44,
    "median": 1200,
    "low": 900,
    "high": 1600
   },
   {
    "band": "2009–2011",
    "count": 41,
    "median": 1300,
    "low": 950,
    "high": 2250
   },
   {
    "band": "2012–2014",
    "count": 108,
    "median": 3950,
    "low": 2950,
    "high": 5000
   },
   {
    "band": "2015–2017",
    "count": 174,
    "median": 7000,
    "low": 5700,
    "high": 9200
   },
   {
    "band": "2018–2020",
    "count": 182,
    "median": 11950,
    "low": 9000,
    "high": 14300
   },
   {
    "band": "2021 and newer",
    "count": 77,
    "median": 20100,
    "low": 15000,
    "high": 23000
   }
  ]
 },
 {
  "slug": "peugeot-208",
  "make": "Peugeot",
  "model": "208",
  "listings": 558,
  "bands": [
   {
    "band": "2012–2014",
    "count": 147,
    "median": 1650,
    "low": 1250,
    "high": 2200
   },
   {
    "band": "2015–2017",
    "count": 163,
    "median": 3000,
    "low": 2000,
    "high": 4500
   },
   {
    "band": "2018–2020",
    "count": 91,
    "median": 6000,
    "low": 4800,
    "high": 8000
   },
   {
    "band": "2021 and newer",
    "count": 157,
    "median": 12900,
    "low": 11300,
    "high": 15550
   }
  ]
 },
 {
  "slug": "ford-kuga",
  "make": "Ford",
  "model": "Kuga",
  "listings": 557,
  "bands": [
   {
    "band": "2009–2011",
    "count": 53,
    "median": 1600,
    "low": 1300,
    "high": 2000
   },
   {
    "band": "2012–2014",
    "count": 87,
    "median": 3150,
    "low": 2500,
    "high": 4450
   },
   {
    "band": "2015–2017",
    "count": 167,
    "median": 5500,
    "low": 4300,
    "high": 7300
   },
   {
    "band": "2018–2020",
    "count": 120,
    "median": 8700,
    "low": 6900,
    "high": 10250
   },
   {
    "band": "2021 and newer",
    "count": 130,
    "median": 16300,
    "low": 13550,
    "high": 19950
   }
  ]
 },
 {
  "slug": "audi-a4",
  "make": "Audi",
  "model": "A4",
  "listings": 551,
  "bands": [
   {
    "band": "2008 and older",
    "count": 104,
    "median": 1400,
    "low": 1000,
    "high": 1900
   },
   {
    "band": "2009–2011",
    "count": 95,
    "median": 2200,
    "low": 1400,
    "high": 2800
   },
   {
    "band": "2012–2014",
    "count": 118,
    "median": 4000,
    "low": 2400,
    "high": 6000
   },
   {
    "band": "2015–2017",
    "count": 153,
    "median": 7500,
    "low": 6000,
    "high": 9450
   },
   {
    "band": "2018–2020",
    "count": 56,
    "median": 12250,
    "low": 9000,
    "high": 13850
   },
   {
    "band": "2021 and newer",
    "count": 25,
    "median": 15300,
    "low": 14000,
    "high": 19500
   }
  ]
 },
 {
  "slug": "nissan-micra",
  "make": "Nissan",
  "model": "Micra",
  "listings": 549,
  "bands": [
   {
    "band": "2008 and older",
    "count": 102,
    "median": 1050,
    "low": 700,
    "high": 1600
   },
   {
    "band": "2009–2011",
    "count": 64,
    "median": 1300,
    "low": 900,
    "high": 2050
   },
   {
    "band": "2012–2014",
    "count": 103,
    "median": 3650,
    "low": 1800,
    "high": 5200
   },
   {
    "band": "2015–2017",
    "count": 107,
    "median": 5500,
    "low": 4500,
    "high": 6950
   },
   {
    "band": "2018–2020",
    "count": 96,
    "median": 7300,
    "low": 6000,
    "high": 8500
   },
   {
    "band": "2021 and newer",
    "count": 77,
    "median": 10500,
    "low": 8650,
    "high": 12000
   }
  ]
 },
 {
  "slug": "bmw-5-series",
  "make": "BMW",
  "model": "5 Series",
  "listings": 546,
  "bands": [
   {
    "band": "2008 and older",
    "count": 103,
    "median": 1950,
    "low": 1250,
    "high": 2900
   },
   {
    "band": "2009–2011",
    "count": 94,
    "median": 2900,
    "low": 2500,
    "high": 3800
   },
   {
    "band": "2012–2014",
    "count": 131,
    "median": 4500,
    "low": 3100,
    "high": 6550
   },
   {
    "band": "2015–2017",
    "count": 134,
    "median": 8600,
    "low": 6700,
    "high": 11000
   },
   {
    "band": "2018–2020",
    "count": 84,
    "median": 12700,
    "low": 11350,
    "high": 14500
   }
  ]
 }
];
export const findModelPrices = (slug?: string) => MODEL_PRICES.find((m) => m.slug === slug);
